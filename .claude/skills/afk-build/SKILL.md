---
name: afk-build
description: Build GitHub issues labelled ready-for-agent (AFK issues) end to end. Each issue is delivered in its own separate Claude session and independently verified by another separate session, all on the same model as the orchestrator. Use when asked to build, implement, work through, or run AFK / ready-for-agent issues, or "/afk-build [issue numbers]".
---

# afk-build

You are the **orchestrator**. You never implement or verify code yourself; you only schedule `run-issue.ps1`, which spawns one fresh headless `claude` process per phase (implementer, then verifier, then fix rounds if verification fails).

## Hard rules

1. **One issue = its own session(s).** Never work an issue in this session or share a session between issues.
2. **Same model everywhere.** Use the exact model ID you were started with (your system prompt states it, e.g. `claude-sonnet-5-5`) as `-Model` for every call. Never pick a different one or an alias. If you cannot tell your model ID, ask the user.
3. **Verification is separate.** The verifier is a different session from the implementer; never accept an implementer's claim of success, only `RESULT: PASS` from the script.

## Procedure

1. Pick the issues: the numbers the user gave, otherwise
   `gh issue list --state open --label ready-for-agent --json number,title,body,labels` (label name per `docs/agents/triage-labels.md` if present). **Skip issues labelled `afk-failed`** (a previous run failed and needs investigation) unless the user names them explicitly.
2. Read each body's "Blocked by" section and order blockers first. Skip and report an issue whose blocker failed or is still open and not in this batch.
3. Run issues **one at a time**:
   `powershell -NoProfile -ExecutionPolicy Bypass -File "<skill dir>\run-issue.ps1" -Issue <n> -Model <your-model-id> [-Base <branch>]`
   - Use `-Base issue-<m>` when blocked by an issue `m` that just passed, otherwise omit it.
   - Use `run_in_background` (runs are long) and wait for the completion notification; don't poll.
   - `<skill dir>` is `.claude\skills\afk-build` in the repo, or `~\.claude\skills\afk-build` at user level.
4. Read the output: `RESULT: PASS|FAIL #n class=<c> run=<id> dir=<path>`, plus `REASON:` and `NEXT:` lines on failure. Exit 0 = pass, 1 = failed verification or push, 2 = environment or session crash (fix the cause rather than retrying blindly).
5. Report a table: issue, PASS/FAIL, run id, failure class, branch, run dir. For each FAIL add the reason, failing criteria and next step (from `<dir>\result.json`). Do not merge; that is the user's call.

## Failure records

Every run writes `<repo>\.afk\runs\<run-id>\` (git-ignored via `.git/info/exclude`) with all transcripts and `result.json`: run id, status, failure class (`env-error`, `session-crashed`, `verification-failed`, `push-failed`), reason, model, base/head SHA, rounds, failing criteria, next step. On failure the script also comments the same details on the issue and adds the `afk-failed` label (created if missing); a later PASS removes it.

## Customising

Prompts live in `prompts/implement.md` and `prompts/verify.md`. A repo overrides either with a same-named file in `.claude/afk-prompts/`. No script edits per project. The sessions run in `acceptEdits` mode with a Bash allowlist (`-Tools` parameter); widen it if a project needs other commands.

## Reuse in other projects

Copy this folder to `~/.claude/skills/afk-build`. Needs `git`, `gh` (authenticated) and `claude` on PATH, and issues labelled `ready-for-agent`. Manual run: `run-issue.ps1 -Issue 12 -Model <id> [-Base main] [-MaxRounds 2] [-Extra "notes"]`.
