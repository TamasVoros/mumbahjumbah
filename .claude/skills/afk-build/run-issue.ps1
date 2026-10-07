<#
.SYNOPSIS
  Deliver one GitHub issue: implementer session -> independent verifier session (-> fix rounds).
.DESCRIPTION
  Generic, project-agnostic. Every phase is a separate headless `claude` process, all on -Model.
  Prompts come from prompts\implement.md and prompts\verify.md next to this script; a repo can
  override them with .claude\afk-prompts\<same name>. Placeholders: {ISSUE} {NUMBER} {BRANCH}
  {BASE} {FEEDBACK}. Repo, base branch and worktree path are derived from git.

  Every run writes <repo>\.afk\runs\<run-id>\ (transcripts + result.json) and comments on the
  issue. A failed run also labels the issue `afk-failed`; PASS removes that label.
  Failure classes: env-error, session-crashed, verification-failed, push-failed.
.PARAMETER Issue    Issue number.
.PARAMETER Model    Model for every session (the orchestrator passes its own).
.PARAMETER Base     Branch to start from (default: current branch).
.PARAMETER MaxRounds  Implement/verify rounds before giving up (default 2).
.PARAMETER Extra    Extra notes appended to the implementer prompt.
.PARAMETER Tools    Tool allowlist for the headless sessions (no permission bypass; sessions run
                    in acceptEdits mode and can only use these Bash commands).
.OUTPUTS  Last line: RESULT: PASS|FAIL #<n> class=<c> run=<id> dir=<path>
          Exit code: 0 pass, 1 failed, 2 environment/crash.
#>
param(
    [Parameter(Mandatory)][int]$Issue,
    [Parameter(Mandatory)][string]$Model,
    [string]$Base = "",
    [int]$MaxRounds = 2,
    [string]$Extra = "",
    [string[]]$Tools = @("Read", "Glob", "Grep", "Bash(git:*)", "Bash(gh:*)", "Bash(npm:*)", "Bash(npx:*)", "Bash(node:*)")
)
$ErrorActionPreference = "Continue"   # Stop would turn native stderr (2>$null) into terminating errors in PS 5.1; failures are checked explicitly

# Failures carry a class so the report can say what kind of failure it was.
function Fail($class, $msg) {
    $e = New-Object System.Exception($msg)
    $e.Data["AfkClass"] = $class
    throw $e
}

# ---- state shared with the reporting section ----
$runId = "issue-$Issue-" + (Get-Date -Format yyyyMMdd-HHmmss)
$runDir = $null; $repo = $null; $branch = "issue-$Issue"; $path = $null
$status = "FAIL"; $class = $null; $reason = $null; $rounds = 0
$failing = @(); $lastReport = $null; $baseSha = $null; $headSha = $null; $lines = @()

try {
    foreach ($t in "git", "gh", "claude") {
        if (-not (Get-Command $t -ErrorAction SilentlyContinue)) { Fail "env-error" "'$t' not found on PATH" }
    }
    $repo = (git rev-parse --show-toplevel 2>$null)
    if (-not $repo) { Fail "env-error" "not inside a git repository" }
    $repo = $repo.Trim()

    # run dir: kept out of git via the repo-wide exclude file (no tracked changes needed)
    $runDir = Join-Path $repo ".afk\runs\$runId"
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    $common = (git rev-parse --git-common-dir).Trim()
    $exclude = Join-Path (Resolve-Path $common) "info\exclude"
    New-Item -ItemType Directory -Path (Split-Path $exclude) -Force | Out-Null
    if (-not (Test-Path $exclude) -or -not (Select-String -Path $exclude -Pattern '^\.afk/$' -Quiet)) {
        Add-Content -Path $exclude -Value ".afk/"
    }

    $issueText = gh issue view $Issue --json number,title,body --jq '"#\(.number) \(.title)\n\n\(.body)"' 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $issueText) { Fail "env-error" "issue #$Issue not found (or gh not authenticated)" }
    $issueText = ($issueText -join "`n")

    if (-not $Base) { $Base = (git rev-parse --abbrev-ref HEAD).Trim() }
    $baseSha = (git rev-parse $Base).Trim()
    $path = Join-Path (Split-Path $repo -Parent) "$(Split-Path $repo -Leaf)-issue-$Issue"
    if (-not (Test-Path $path)) {
        git worktree add $path -b $branch $Base 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail "env-error" "could not create worktree $path on branch $branch from $Base (branch may already exist)" }
    }

    function Get-Template($name) {
        $override = Join-Path $repo ".claude\afk-prompts\$name"
        $file = if (Test-Path $override) { $override } else { Join-Path $PSScriptRoot "prompts\$name" }
        if (-not (Test-Path $file)) { Fail "env-error" "prompt template missing: $file" }
        Get-Content -Raw $file
    }
    function Expand($t, $feedback) {
        $t.Replace("{ISSUE}", $issueText).Replace("{NUMBER}", "$Issue").Replace("{BRANCH}", $branch).Replace("{BASE}", $Base).Replace("{FEEDBACK}", $feedback)
    }
    function Invoke-Session($prompt, $label) {
        Push-Location $path
        try {
            $out = $prompt | & claude -p --model $Model --permission-mode acceptEdits --allowedTools ($Tools -join ",")
            $code = $LASTEXITCODE
        } finally { Pop-Location }
        $text = ($out -join "`n")
        Set-Content -Path (Join-Path $runDir "$label.md") -Value $text -Encoding utf8
        if ($code -ne 0) { Fail "session-crashed" "$label session exited with code $code" }
        $text
    }

    $env:CLAUDE_CODE_SUBAGENT_MODEL = $Model   # keep any nested subagents on the same model
    $feedback = if ($Extra) { "`nExtra notes:`n$Extra" } else { "" }
    for ($rounds = 1; $rounds -le $MaxRounds; $rounds++) {
        Write-Output "Round ${rounds}: implementer (fresh session, model $Model)"
        [void](Invoke-Session (Expand (Get-Template "implement.md") $feedback) "r$rounds-implement")

        Write-Output "Round ${rounds}: verifier (separate fresh session, model $Model)"
        $lastReport = Invoke-Session (Expand (Get-Template "verify.md") "") "r$rounds-verify"
        $lines = @($lastReport -split "`n" | Where-Object { $_.Trim() })
        if ($lines.Count -and $lines[-1].Trim() -eq "VERDICT: PASS") { $status = "PASS"; break }
        $feedback = "`nA previous round FAILED independent verification. Fix every defect below, then re-run all checks.`n`n$lastReport"
    }
    if ($status -ne "PASS") {
        $rounds = $MaxRounds
        $failing = @($lines | Where-Object { $_ -match '\b(FAIL|UNVERIFIED)\b' -and $_ -notmatch '^VERDICT' } | ForEach-Object { $_.Trim() })
        Fail "verification-failed" "independent verification still failing after $MaxRounds round(s)"
    }

    $headSha = (git -C $path rev-parse HEAD).Trim()
    $remote = (git -C $path ls-remote --heads origin $branch 2>$null)
    if (-not $remote -or "$remote" -notmatch [regex]::Escape($headSha)) {
        $status = "FAIL"
        Fail "push-failed" "verification passed but origin/$branch does not contain local HEAD $headSha"
    }
}
catch {
    $status = "FAIL"
    $c = $_.Exception.Data["AfkClass"]
    if ($c) { $class = $c; $reason = $_.Exception.Message }
    else { $class = "env-error"; $reason = "unexpected: $($_.Exception.Message)" }
}

# ---- record + report (always runs) ----
if ($status -eq "PASS") { $class = $null; $reason = $null }
if ($path -and (Test-Path $path) -and -not $headSha) { $headSha = (git -C $path rev-parse HEAD 2>$null) }
$next = switch ($class) {
    "verification-failed" { "Read r$rounds-verify.md, fix the listed defects in the worktree (or rerun with -Extra '<guidance>'). If a criterion cannot be verified headless, relabel the issue ready-for-human." }
    "session-crashed"     { "Inspect the last transcript in the run dir for the crash/limit error, then rerun the same command (the worktree and branch are reused)." }
    "push-failed"         { "Check git credentials/branch protection, then push branch '$branch' from the worktree manually and re-verify." }
    "env-error"           { "Fix the environment problem in the reason, then rerun." }
    default               { "" }
}
$result = [ordered]@{
    runId = $runId; issue = $Issue; status = $status; failureClass = $class; reason = $reason
    model = $Model; base = $Base; baseSha = $baseSha; headSha = $headSha; branch = $branch
    worktree = $path; rounds = $rounds; failingCriteria = $failing; nextStep = $next
    runDir = $runDir; finishedAt = (Get-Date).ToString("o")
}
if ($runDir -and (Test-Path $runDir)) {
    $result | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $runDir "result.json") -Encoding utf8
}

# issue comment + label (best effort; never mask the result). Skipped when the issue itself is unreachable.
if ($repo -and $reason -notmatch '^issue #\d+ not found') {
    try {
        if ($status -eq "PASS") {
            $body = "AFK run ``$runId`` on branch ``$branch`` (model ``$Model``): independent verification **passed** in round $rounds. HEAD ``$headSha``."
            gh issue comment $Issue --body $body 2>$null | Out-Null
            gh issue edit $Issue --remove-label afk-failed 2>$null | Out-Null
        } else {
            $crit = if ($failing.Count) { ($failing | ForEach-Object { "- $_" }) -join "`n" } else { "_none recorded_" }
            $body = @"
AFK run ``$runId`` **FAILED** (``$class``) after $rounds round(s).

**Reason:** $reason
**Branch:** ``$branch`` @ ``$headSha`` (base ``$Base`` @ ``$baseSha``) · **Model:** ``$Model``
**Worktree:** ``$path``
**Run dir (transcripts + result.json):** ``$runDir``

**Failing / unverified criteria**
$crit

**Suggested next step:** $next
"@
            gh label create afk-failed --description "AFK run failed; needs investigation" --color B60205 2>$null | Out-Null
            gh issue comment $Issue --body $body 2>$null | Out-Null
            gh issue edit $Issue --add-label afk-failed 2>$null | Out-Null
        }
    } catch { Write-Output "WARN: could not update issue #${Issue}: $($_.Exception.Message)" }
}

if ($status -ne "PASS") { Write-Output "REASON: $reason"; Write-Output "NEXT: $next" }
Write-Output "RESULT: $status #$Issue class=$class run=$runId dir=$runDir"
if ($status -eq "PASS") { exit 0 }
if ($class -in "env-error", "session-crashed") { exit 2 } else { exit 1 }
