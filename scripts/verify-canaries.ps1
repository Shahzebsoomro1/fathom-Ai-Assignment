param([string[]]$CanarySessions = @(
    '01a11732-da3c-72d1-88b7-14bef091eecb',
    '01a11738-97e2-79d1-a7d0-b9fc2f5a55b4'
))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object Text.UTF8Encoding($false)
$settings = Get-Content -LiteralPath (Join-Path $projectRoot 'capture-settings.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$canary = 'CAPTURE TEST ' + [char]0x2014 + ' 8x assignment, ' + $settings.name
if ($CanarySessions.Count -ne 2 -or $CanarySessions[0] -eq $CanarySessions[1]) { throw 'Two distinct real sessions are required.' }
$sections = New-Object Collections.Generic.List[string]
foreach ($id in $CanarySessions) {
    $sessionFile = Get-ChildItem -LiteralPath 'C:\Users\user\.codex\sessions' -Recurse -Filter ('*' + $id + '.jsonl') | Select-Object -First 1
    if (-not $sessionFile) { throw "Missing real transcript: $id" }
    $records = Get-Content -LiteralPath $sessionFile.FullName -Encoding UTF8 | ForEach-Object { $_ | ConvertFrom-Json }
    $meta = $records | Where-Object type -eq 'session_meta' | Select-Object -First 1
    if ($meta.payload.source -ne 'exec') { throw 'Expected an independent Codex exec session.' }
    $promptRecord = $records | Where-Object { $_.type -eq 'response_item' -and $_.payload.role -eq 'user' -and $_.payload.internal_chat_message_metadata_passthrough.content_item_kinds -contains 'user.text' } | Select-Object -First 1
    $responseRecord = $records | Where-Object { $_.type -eq 'response_item' -and $_.payload.role -eq 'assistant' -and $_.payload.phase -eq 'final_answer' } | Select-Object -First 1
    if (-not $promptRecord -or -not $responseRecord) { throw 'Canary did not complete.' }
    $prompt = (@($promptRecord.payload.content | Where-Object type -eq 'input_text' | ForEach-Object text) -join "`n")
    if ($prompt -cne $canary) { throw 'Canary prompt differs from the requested text.' }
    $response = (@($responseRecord.payload.content | Where-Object type -eq 'output_text' | ForEach-Object text) -join "`n")
    $models = @($records | Where-Object type -eq 'turn_context' | ForEach-Object { $_.payload.model } | Select-Object -Unique)
    if ($models.Count -ne 1 -or $models[0] -ne 'gpt-6.1-sol') { throw 'Unexpected canary model.' }
    $log = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.agent-logs') -Filter ('*' + $id + '.md') | Select-Object -First 1
    if (-not $log) { throw 'Watcher has not captured the canary yet. This verifier never runs capture.' }
    $text = [IO.File]::ReadAllText($log.FullName, $utf8)
    $shortId = $id.Substring(0,8)
    $expected = "[LOG_ENTRY type=PROMPT num=1 session=$shortId]`ntimestamp: $($promptRecord.timestamp)`nmodel: gpt-6.1-sol`n`n" + $prompt + "`n`n`n" + "[LOG_ENTRY type=RESPONSE num=1 session=$shortId]`ntimestamp: $($responseRecord.timestamp)`nmodel: gpt-6.1-sol`n`n" + $response + "`n`n`n"
    $body = $text.Substring($text.IndexOf('[LOG_ENTRY type='))
    if ($body -cne $expected) { throw 'Canary log is not an exact prompt/final-response match.' }
    $sections.Add("Log: ``.agent-logs/$($log.Name)```n`n" + $body)
}
$installation = Get-Content -LiteralPath (Join-Path $projectRoot '.capture-runtime\installation.json') -Raw | ConvertFrom-Json
if (-not (Test-Path -LiteralPath $installation.startup_file)) { throw 'Automatic startup installation is missing.' }
if (-not (Get-Process -Id $installation.launched_pid -ErrorAction SilentlyContinue)) { throw 'Installed watcher is not running.' }
$guardianFile = Join-Path $projectRoot '.agent-logs\2026-10-07_16-27-36_01a1172d-e4c3-7bd1-bf4d-a1132b46e761.md'
$guardianHash = (Get-FileHash -LiteralPath $guardianFile -Algorithm SHA256).Hash
$report = @'
# CAPTURE TEST - 8x assignment

Status: PASS - two independent, real Codex canary sessions were automatically
captured, and every prompt and final response was compared verbatim with its native
session transcript. This verification script reads captures; it never generates them.

Author: Shahzeb Soomro (`shahzebsoomro1`)
Project: Fantom-Ai-Assignment
Tool: Codex VS Code extension, with Codex CLI 0.162.0-alpha.2 for the canaries.
Planning model: `gpt-6.1-sol`. Execution model: `gpt-6.1-sol`.
No separate planning or execution agent was used. Codex's infrastructure also runs
automatic approval review using `codex-auto-review`; that is not an assignment agent.

The current session metadata reports `originator: codex_vscode`, `source: vscode`,
and `model: gpt-6.1-sol`. Both canaries explicitly requested and recorded that model.

## Automatic mechanism and configuration

The installed PowerShell watcher polls the native `%USERPROFILE%\.codex\sessions`
store every two seconds. It accepts only root user sessions for this workspace
(`vscode`, `cli`, `exec`), extracts user prompts and `final_answer` messages, and
excludes reasoning, commentary, tools, environment context, and internal subagents.
UTC timestamps and each turn's recorded model are preserved. Session summary fields
update; existing log-entry bytes must remain identical. Repeated reads are idempotent.

The watcher is running outside the tool-command lifecycle, so it can capture this
turn's final response after the coding agent finishes. A Windows user Startup entry
relaunches it at sign-in. No command is needed per prompt, response, or new session.
Completed captures are automatically committed under `.agent-logs/`, interleaved
with implementation commits; no automatic commit includes product code.

Files installed/changed:

- `scripts/capture.ps1`: extractor, background watcher, append-only guard, log commits.
- `scripts/install-capture.ps1`: installs the Startup entry and launches the watcher hidden.
- `capture-settings.json`: name, GitHub handle, project, automatic log commits.
- `.codex/hooks.json`: supplemental `UserPromptSubmit` and `Stop` lifecycle hooks.
- `.gitattributes`: preserves the capture files' bytes in Git.
- `.gitignore`: ignores only runtime diagnostics; `.agent-logs/` remains committed.
- `AGENTS.md`: requires successful capture verification before product work.

Native hooks were checked in the installed CLI and in the
[official OpenAI hook documentation](https://learn.chatgpt.com/docs/hooks).
Project hooks require Codex's project/hook trust review, so this installation uses
the independently running watcher as its verified mechanism. The supplemental hook
config does not establish or bypass persistent trust.

The exact original attached capture instructions were preserved in
`ASSIGNMENT-CAPTURE-REQUIREMENTS.md`; the initial logged prompt retains its attachment
reference verbatim.

## Verification and setup failures

Both canaries used fresh `codex exec` processes with read-only sandboxing, the same
workspace, and `-m gpt-6.1-sol`. The second canary was submitted while the watcher
was already running; its prompt and final answer appeared without manual extraction.

`scripts/test-capture.ps1` passed checks for exact Unicode/whitespace, exclusion of
intermediate content, repeated extraction, immutable existing entries, model switches,
duplicate prompt suppression, and internal-review session exclusion. Synthetic test
output is isolated in ignored `.capture-runtime/tests/` and is not submission evidence.

Attempts/issues retained honestly:

1. Ordinary StreamReader access could not read an active transcript. Fixed with
   explicit read/write/delete file sharing.
2. The initial CLI extractor expected legacy `event_msg.user_message` records.
   This CLI writes prompts as messages with `user.text` metadata instead. Added
   that source while excluding injected environment context and duplicate prompts.
3. Git initialized inside the sandbox had a different owner from the host user.
   Commands now use a safe-directory exception for this exact repository only;
   no global safe-directory wildcard was installed.
4. The first watcher scope also included an internal guardian/approval-review
   transcript. Its already-recorded entries were not edited, tidied, or deleted.
   The accidental historical file is retained at
   `.agent-logs/2026-10-07_16-27-36_01a1172d-e4c3-7bd1-bf4d-a1132b46e761.md`.
   It contains internal review prompts, which can quote tool history; it is a setup
   failure artifact, not a user assignment session. Updated capture rejects that
   session source before reading its body and the watcher was restarted.
5. The second CLI reported a model-list refresh timeout. Its requested model still
   completed the canary successfully; the actual response is preserved below.

No product assignment implementation has started. The supplied file contains capture
setup instructions only; a product brief has not been provided.

## Raw canary entries

'@
$report += "`n" + ($sections -join "`n")
$report += "`nVerified at (UTC): $([DateTime]::UtcNow.ToString('o'))`n"
$report += "Windows Startup entry: ``$($installation.startup_file)```n"
$report += "Historical guardian artifact SHA256 at verification: ``$guardianHash```n"
[IO.File]::WriteAllText((Join-Path $projectRoot 'CAPTURE-TEST.md'), $report, $utf8)
Write-Output 'PASS: two real canaries exactly matched; watcher is running; Startup installation exists; CAPTURE-TEST.md written.'
