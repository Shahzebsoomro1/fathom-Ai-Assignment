$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$testRoot = Join-Path $projectRoot '.capture-runtime\tests'
[IO.Directory]::CreateDirectory($testRoot) | Out-Null
$utf8 = New-Object Text.UTF8Encoding($false)
$fixturePath = Join-Path $testRoot 'fixture.jsonl'
$outputRoot = Join-Path $testRoot ([Guid]::NewGuid().ToString())
$fixture = New-Object Collections.Generic.List[object]
function Add-Record($type, $payload, $time) { $fixture.Add(@{type=$type;payload=$payload;timestamp=$time}) }
Add-Record 'session_meta' @{id='00000000-0000-0000-0000-000000000001';cwd=$projectRoot;source='exec'} '2026-10-07T00:00:00.000Z'
Add-Record 'event_msg' @{type='task_started';turn_id='a'} '2026-10-07T00:00:01.000Z'
Add-Record 'turn_context' @{turn_id='a';model='model-a'} '2026-10-07T00:00:01.000Z'
$prompt = "  Verbatim prompt`nUnicode: $([char]0x2014) $([char]0x03bb)`nTrailing whitespace  `n"
Add-Record 'response_item' @{type='message';role='user';content=@(@{type='input_text';text=$prompt});internal_chat_message_metadata_passthrough=@{content_item_kinds=@('user.text');turn_id='a'}} '2026-10-07T00:00:02.000Z'
Add-Record 'response_item' @{type='message';role='assistant';phase='commentary';content=@(@{type='output_text';text='DO NOT CAPTURE COMMENTARY'})} '2026-10-07T00:00:03.000Z'
Add-Record 'response_item' @{type='reasoning';text='DO NOT CAPTURE REASONING'} '2026-10-07T00:00:03.000Z'
Add-Record 'response_item' @{type='function_call';name='shell';arguments='DO NOT CAPTURE TOOL'} '2026-10-07T00:00:03.000Z'
Add-Record 'response_item' @{type='message';role='assistant';phase='final_answer';content=@(@{type='output_text';text="Final answer`n"})} '2026-10-07T00:00:04.000Z'
function Write-Fixture {
    $json = ($fixture | ForEach-Object { $_ | ConvertTo-Json -Depth 12 -Compress }) -join "`n"
    [IO.File]::WriteAllText($fixturePath, $json + "`n", $utf8)
}
function Run-Capture {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'capture.ps1') -TranscriptPath $fixturePath -LogRoot $outputRoot -NoCommit
    if ($LASTEXITCODE -ne 0) { throw 'Fixture capture failed.' }
}
Write-Fixture
Run-Capture
$logPath = (Get-ChildItem -LiteralPath $outputRoot -Filter '*.md' | Select-Object -First 1).FullName
$first = [IO.File]::ReadAllText($logPath, $utf8)
if (-not $first.Contains("model: model-a`n`n" + $prompt + "`n`n`n")) { throw 'Prompt was changed.' }
if ($first.Contains('DO NOT CAPTURE')) { throw 'Intermediate content leaked.' }
Run-Capture
if ([IO.File]::ReadAllText($logPath, $utf8) -cne $first) { throw 'Repeated extraction was not idempotent.' }
Add-Record 'event_msg' @{type='task_started';turn_id='b'} '2026-10-07T00:01:00.000Z'
Add-Record 'turn_context' @{turn_id='b';model='model-b'} '2026-10-07T00:01:00.000Z'
Add-Record 'event_msg' @{type='user_message';message='Second prompt'} '2026-10-07T00:01:01.000Z'
Add-Record 'response_item' @{type='message';role='user';content=@(@{type='input_text';text='Second prompt'});internal_chat_message_metadata_passthrough=@{content_item_kinds=@('user.text');turn_id='b'}} '2026-10-07T00:01:01.001Z'
Add-Record 'response_item' @{type='message';role='assistant';phase='final_answer';content=@(@{type='output_text';text='Second final'})} '2026-10-07T00:01:02.000Z'
Write-Fixture
Run-Capture
$second = [IO.File]::ReadAllText($logPath, $utf8)
$originalBody = $first.Substring($first.IndexOf('[LOG_ENTRY type='))
if (-not $second.Substring($second.IndexOf('[LOG_ENTRY type=')).StartsWith($originalBody, [StringComparison]::Ordinal)) { throw 'Existing entries changed.' }
if (($second -split '\[LOG_ENTRY type=PROMPT').Count -ne 3) { throw 'Prompt duplicated or missed.' }
if (-not $second.Contains("model: model-b`n`nSecond prompt")) { throw 'Model switch missing.' }
$fixture[0].payload.source = @{subagent=@{other='guardian'}}
Write-Fixture
$guardianRoot = Join-Path $testRoot ([Guid]::NewGuid().ToString())
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'capture.ps1') -TranscriptPath $fixturePath -LogRoot $guardianRoot -NoCommit
if (@(Get-ChildItem -LiteralPath $guardianRoot -Filter '*.md').Count -ne 0) { throw 'Guardian session leaked.' }
Write-Output 'PASS: verbatim Unicode/whitespace, final-only capture, idempotence, append-only entries, model switches, duplicate suppression, guardian exclusion.'
