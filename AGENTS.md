# Assignment capture

## Local-only development

The user explicitly instructed: "Do NOT deploy or publish anything. Keep everything
local in our workspace while we build the remaining steps."
Do not create hosting resources, push source to a hosting provider, upload deployment
archives, deploy, publish, or update the existing hosted version. Local development,
browser previews, checks, and local Git commits remain authorized. The deployment
record predates this instruction and does not authorize further hosting activity.

Do not start building the product until CAPTURE-TEST.md records PASS for two real,
independent canary sessions. The project-scoped capture watcher runs automatically
and starts at Windows sign-in. It records user prompts and final assistant responses
and commits completed captures under .agent-logs/. Never ignore that directory or
alter or remove recorded entries. Do not include commentary, reasoning, or tool
events in new captures.

See CAPTURE-TEST.md for verification and scripts/install-capture.ps1 for installation
on this Windows host. Native .codex/hooks.json hooks are supplemental and require
Codex's hook trust review; continuous capture does not depend on them being trusted.
