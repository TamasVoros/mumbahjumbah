param(
    [Parameter(Mandatory)][int]$Issue,
    [string]$Extra = ""
)

# ===== YOUR PROMPT: edit this text. {ISSUE} = issue number/title/body, {NUMBER} = issue number. =====
$PromptTemplate = @'
/implement GitHub issue {ISSUE}

This issue is AFK: make decisions yourself, do not ask questions.
- Read CLAUDE.md, CONTEXT.md, docs/designs/reverse-bingo.md and docs/adr/ first.
- Satisfy every acceptance criterion, with tests, and verify them for real.
- Run typecheck and the full test suite before finishing.
- Commit with a proper message ending in "Closes #{NUMBER}", then push the current branch to origin.
- Make sure I can open the app: locally (npm run dev) or on the *.workers.dev URL
  (npm run deploy; no custom domain exists yet). Tell me the URL at the end.
'@
# ====================================================================================================

$ErrorActionPreference = "Stop"
$repo = (git rev-parse --show-toplevel).Trim()
$name = Split-Path $repo -Leaf
$path = Join-Path (Split-Path $repo -Parent) "$name-issue-$Issue"

if (-not (Test-Path $path)) {
    git worktree add $path -b "issue-$Issue"
}

$issueText = gh issue view $Issue --json number,title,body --jq '"#\(.number) \(.title)\n\n\(.body)"'
$prompt = $PromptTemplate.Replace("{ISSUE}", $issueText).Replace("{NUMBER}", "$Issue")
if ($Extra) { $prompt += "`n`nExtra notes:`n$Extra" }

$file = Join-Path $env:TEMP "claude-issue-$Issue.md"
Set-Content -Path $file -Value $prompt -Encoding utf8

$cmd = "claude (Get-Content -Raw '$file')"
if (Get-Command wt -ErrorAction SilentlyContinue) {
    Start-Process wt -ArgumentList @("-d", "`"$path`"", "powershell", "-NoExit", "-Command", "`"$cmd`"")
} else {
    Start-Process powershell -WorkingDirectory $path -ArgumentList @("-NoExit", "-Command", $cmd)
}
Write-Output "Started new Claude session for issue #$Issue in $path"
