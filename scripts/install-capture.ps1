$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$captureScript = Join-Path $PSScriptRoot 'capture.ps1'
$startupRoot = [Environment]::GetFolderPath('Startup')
if (-not $startupRoot) { throw 'Windows user Startup directory is unavailable.' }
$startupFile = Join-Path $startupRoot '8x-Fantom-Agent-Capture.cmd'
$command = '@echo off' + "`r`n" + 'start "" /min powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $captureScript + '" -Watch' + "`r`n"
[IO.File]::WriteAllText($startupFile, $command, (New-Object Text.UTF8Encoding($false)))
[IO.Directory]::CreateDirectory((Join-Path $projectRoot '.capture-runtime')) | Out-Null
$process = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File', ('"' + $captureScript + '"'), '-Watch') -RedirectStandardError (Join-Path $projectRoot '.capture-runtime\watcher-stderr.log') -RedirectStandardOutput (Join-Path $projectRoot '.capture-runtime\watcher-stdout.log') -PassThru
[IO.File]::WriteAllText((Join-Path $projectRoot '.capture-runtime\installation.json'), (@{ startup_file=$startupFile; launched_pid=$process.Id; installed_at=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json))
Write-Output "Installed automatic project-scoped capture: $startupFile"
Write-Output "Started hidden watcher PID: $($process.Id)"
