---
description: Start a new Claude session in its own worktree for a GitHub issue
argument-hint: <issue-number> [extra notes]
allowed-tools: Bash(powershell:*)
---

Run this exactly, using the first word of "$ARGUMENTS" as the issue number and the rest (if any) as -Extra:

powershell -NoProfile -File ".claude\new-issue.ps1" -Issue <number> -Extra "<rest>"

Then report the one-line result. Do nothing else; do not work on the issue in this session.
