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

Log: `.agent-logs/2026-10-07_16-29-38_01a11732-da3c-72d1-88b7-14bef091eecb.md`

[LOG_ENTRY type=PROMPT num=1 session=01a11732]
timestamp: 2026-10-07T16:29:38.373Z
model: gpt-6.1-sol

CAPTURE TEST — 8x assignment, Shahzeb Soomro


[LOG_ENTRY type=RESPONSE num=1 session=01a11732]
timestamp: 2026-10-07T16:29:42.674Z
model: gpt-6.1-sol

Received: “CAPTURE TEST — 8x assignment, Shahzeb Soomro.” What would you like me to do with it?



Log: `.agent-logs/2026-10-07_16-35-57_01a11738-97e2-79d1-a7d0-b9fc2f5a55b4.md`

[LOG_ENTRY type=PROMPT num=1 session=01a11738]
timestamp: 2026-10-07T16:35:57.993Z
model: gpt-6.1-sol

CAPTURE TEST — 8x assignment, Shahzeb Soomro


[LOG_ENTRY type=RESPONSE num=1 session=01a11738]
timestamp: 2026-10-07T16:36:01.513Z
model: gpt-6.1-sol

Received: **CAPTURE TEST — 8x assignment, Shahzeb Soomro**.



Verified at (UTC): 2026-10-07T16:47:21.1405652Z
Windows Startup entry: `C:\Users\user\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\8x-Fantom-Agent-Capture.cmd`
Historical guardian artifact SHA256 at verification: `DA7CE70BE2AE90D86C32FF1698BFCFD3E2FE0E46E8E10F2A8504ABEF654E8EDE`
