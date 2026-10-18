$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$startupScript = Join-Path $repoRoot 'scripts\start-local.ps1'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskName = 'TutorPlatform Local Stack'
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$startupScript`""

$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
    -Description 'Starts the local TutorPlatform Docker Compose stack when this Windows user signs in.'

Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null
Write-Output "Installed per-user startup task: $taskName"
