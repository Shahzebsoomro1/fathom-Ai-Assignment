param(
    [switch]$Watch,
    [switch]$Hook,
    [switch]$NoCommit,
    [string]$TranscriptPath,
    [string]$LogRoot,
    [string]$SessionRoot = 'C:\Users\user\.codex\sessions'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$settings = Get-Content -LiteralPath (Join-Path $projectRoot 'capture-settings.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$utf8 = New-Object System.Text.UTF8Encoding($false)
if (-not $LogRoot) { $LogRoot = Join-Path $projectRoot '.agent-logs' }
[IO.Directory]::CreateDirectory($logRoot) | Out-Null
[IO.Directory]::CreateDirectory((Join-Path $projectRoot '.capture-runtime')) | Out-Null

function Sync-Transcript([string]$Path) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
    $reader = New-Object IO.StreamReader($stream, $utf8)
    try {
        $firstLine = $reader.ReadLine()
        if (-not $firstLine) { return }
        $meta = $firstLine | ConvertFrom-Json
        if ($meta.type -ne 'session_meta') { return }
        # Guardian/approval-review and delegated transcripts are not user sessions.
        if ($meta.payload.source -isnot [string] -or $meta.payload.source -notin @('vscode','cli','exec')) { return }
        $cwd = [IO.Path]::GetFullPath($meta.payload.cwd).TrimEnd('\','/')
        $root = [IO.Path]::GetFullPath($projectRoot).TrimEnd('\','/')
        if ($cwd -ne $root -and -not $cwd.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { return }
        $remaining = $reader.ReadToEnd()
    } finally { $reader.Dispose() }
    $records = New-Object System.Collections.Generic.List[object]
    $lines = @($firstLine) + @($remaining -split "`n" | Where-Object { $_.Length -gt 0 })
    foreach ($line in $lines) {
        try { $records.Add(($line | ConvertFrom-Json)) } catch {
            # A live transcript can end in a partially flushed JSON record.
            if ($line -ne $lines[-1]) { throw }
        }
    }
    $meta = $records | Where-Object type -eq 'session_meta' | Select-Object -First 1
    if (-not $meta) { return }
    $cwd = [IO.Path]::GetFullPath($meta.payload.cwd).TrimEnd('\','/')
    $root = [IO.Path]::GetFullPath($projectRoot).TrimEnd('\','/')
    if ($cwd -ne $root -and -not $cwd.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { return }
    $contexts = @{}
    $eventPromptTurns = @{}
    $scanTurn = ''
    foreach ($record in $records) {
        if ($record.type -eq 'event_msg' -and $record.payload.type -eq 'task_started') { $scanTurn = $record.payload.turn_id }
        if ($record.type -eq 'turn_context' -and $record.payload.model) {
            $contexts[$record.payload.turn_id] = $record.payload.model
            $scanTurn = $record.payload.turn_id
        }
        if ($record.type -eq 'event_msg' -and $record.payload.type -eq 'user_message') { $eventPromptTurns[$scanTurn] = $true }
    }
    if ($contexts.Count -eq 0) { return }
    $firstContext = $records | Where-Object type -eq 'turn_context' | Select-Object -First 1
    $model = $firstContext.payload.model
    $initialModel = $model
    $turnId = ''
    $num = 0
    $promptByTurn = @{}
    $entries = New-Object System.Collections.Generic.List[object]
    foreach ($record in $records) {
        $p = $record.payload
        if ($record.type -eq 'event_msg' -and $p.type -eq 'task_started') {
            $turnId = $p.turn_id
            if ($contexts.ContainsKey($turnId)) { $model = $contexts[$turnId] }
        }
        if ($record.type -eq 'turn_context') {
            $turnId = $p.turn_id
            $model = $p.model
        }
        $isPrompt = $record.type -eq 'event_msg' -and $p.type -eq 'user_message'
        $promptText = [string]$p.message
        if ($record.type -eq 'response_item' -and $p.role -eq 'user' -and $p.internal_chat_message_metadata_passthrough.content_item_kinds -contains 'user.text' -and -not $eventPromptTurns.ContainsKey($turnId)) {
            $isPrompt = $true
            $promptText = (@($p.content | Where-Object type -eq 'input_text' | ForEach-Object { $_.text }) -join "`n")
        }
        if ($isPrompt) {
            $num++
            $promptByTurn[$turnId] = $num
            $entries.Add([pscustomobject]@{Type='PROMPT';Num=$num;Timestamp=$record.timestamp;Model=$model;Text=$promptText})
        }
        if ($record.type -eq 'response_item' -and $p.type -eq 'message' -and $p.role -eq 'assistant' -and $p.phase -eq 'final_answer' -and $num -gt 0) {
            $responseTurn = $turnId
            if ($p.internal_chat_message_metadata_passthrough.turn_id) { $responseTurn = $p.internal_chat_message_metadata_passthrough.turn_id }
            $responseNum = $num
            if ($promptByTurn.ContainsKey($responseTurn)) { $responseNum = $promptByTurn[$responseTurn] }
            $responseModel = $model
            if ($contexts.ContainsKey($responseTurn)) { $responseModel = $contexts[$responseTurn] }
            $parts = @($p.content | Where-Object type -eq 'output_text' | ForEach-Object { $_.text })
            $entries.Add([pscustomobject]@{Type='RESPONSE';Num=$responseNum;Timestamp=$record.timestamp;Model=$responseModel;Text=($parts -join "`n")})
        }
    }
    if ($entries.Count -eq 0) { return }
    $firstTime = [DateTimeOffset]::Parse($entries[0].Timestamp).ToUniversalTime()
    $id = $meta.payload.id
    $shortId = $id.Substring(0,8)
    $name = $firstTime.ToString('yyyy-MM-dd_HH-mm-ss') + '_' + $id + '.md'
    $path = Join-Path $logRoot $name
    $body = New-Object System.Text.StringBuilder
    foreach ($entry in $entries) {
        [void]$body.Append("[LOG_ENTRY type=$($entry.Type) num=$($entry.Num) session=$shortId]`ntimestamp: $($entry.Timestamp)`nmodel: $($entry.Model)`n`n")
        [void]$body.Append($entry.Text)
        [void]$body.Append("`n`n`n")
    }
    $bodyText = $body.ToString()
    $prompts = @($entries | Where-Object Type -eq 'PROMPT')
    $date = $firstTime.ToString('yyyy-MM-dd')
    $header = "---`nsession_id: $id`ndate: $date`nauthor: $($settings.author)`nmodel: $initialModel`ntool: codex-$($meta.payload.source)`nproject: $($settings.project)`ntotal_exchanges: $num`nfirst_prompt_time: $($prompts[0].Timestamp)`nlast_prompt_time: $($prompts[-1].Timestamp)`n---`n`n# Session Log - $date`n`nSession: ``$shortId`` | Project: ``$($settings.project)`` | Author: ``$($settings.author)```n`n---`n`n"
    if (Test-Path -LiteralPath $path) {
        $old = [IO.File]::ReadAllText($path, $utf8)
        $marker = $old.IndexOf('[LOG_ENTRY type=')
        if ($marker -lt 0 -or -not $bodyText.StartsWith($old.Substring($marker), [StringComparison]::Ordinal)) {
            throw "Capture refused to change existing entries: $path"
        }
        if ($old -eq ($header + $bodyText)) { return }
    }
    # Only session summary fields change; existing entry bytes must remain identical.
    [IO.File]::WriteAllText($path, $header + $bodyText, $utf8)
    if ($settings.auto_commit -and -not $NoCommit -and @($entries | Where-Object Type -eq 'RESPONSE').Count -gt 0) {
        $gitArgs = @('-c', ('safe.directory=' + $projectRoot.Replace('\','/')), '-C', $projectRoot)
        & git @gitArgs add -- '.agent-logs' | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not stage capture logs.' }
        & git @gitArgs diff --cached --quiet -- '.agent-logs'
        if ($LASTEXITCODE -eq 1) {
            & git @gitArgs commit --only -m ('capture: record session ' + $shortId) -- '.agent-logs' | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not commit capture logs.' }
        }
    }
}

function Sync-All {
    $writeMutex = New-Object Threading.Mutex($false, ('Local\8xCaptureWrite_' + ($projectRoot -replace '[^a-zA-Z0-9]', '_')))
    if (-not $writeMutex.WaitOne(10000)) { throw 'Capture writer is busy.' }
    try {
        if ($TranscriptPath) { Sync-Transcript $TranscriptPath; return }
        if (-not (Test-Path -LiteralPath $SessionRoot)) { throw "Session store missing: $SessionRoot" }
        foreach ($file in Get-ChildItem -LiteralPath $SessionRoot -Recurse -Filter '*.jsonl') {
            Sync-Transcript $file.FullName
        }
    } finally { $writeMutex.ReleaseMutex(); $writeMutex.Dispose() }
}

if ($Hook) {
    $hookInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($hookInput.transcript_path -and (Test-Path -LiteralPath $hookInput.transcript_path)) {
        $TranscriptPath = $hookInput.transcript_path
    } else { exit 0 }
}
$mutex = New-Object Threading.Mutex($false, ('Local\8xCapture_' + ($projectRoot -replace '[^a-zA-Z0-9]', '_')))
if ($Watch) {
    if (-not $mutex.WaitOne(0)) { exit 0 }
    try {
        while ($true) {
            try { Sync-All } catch {
                [IO.File]::AppendAllText((Join-Path $projectRoot '.capture-runtime\errors.log'), ([DateTime]::UtcNow.ToString('o') + ' ' + $_.Exception.Message + "`n"), $utf8)
            }
            Start-Sleep -Seconds 2
        }
    } finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
} else {
    Sync-All
}
if ($Hook) { [Console]::Out.Write('{}') }
