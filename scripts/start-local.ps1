$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDirectory = Join-Path $repoRoot 'logs'
$logPath = Join-Path $logDirectory 'local-autostart.log'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-LocalLog([string] $message) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $message"
    Add-Content -LiteralPath $logPath -Value $line
}

try {
    $wslPath = Join-Path $env:SystemRoot 'System32\wsl.exe'
    if (-not (Test-Path -LiteralPath $wslPath)) { throw 'WSL was not found.' }
    $distribution = 'Ubuntu-22.04'
    if ($repoRoot -notmatch '^([A-Za-z]):\\(.*)$') { throw 'The project must be on a local Windows drive.' }
    $linuxRepoRoot = "/mnt/$($Matches[1].ToLowerInvariant())/$($Matches[2].Replace('\', '/'))"

    $desktopPath = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    $desktopRunning = Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue
    if (-not $desktopRunning -and (Test-Path -LiteralPath $desktopPath)) {
        Start-Process -FilePath $desktopPath | Out-Null
    }

    Push-Location $repoRoot
    try {
        Write-LocalLog 'Starting local TutorPlatform services.'
        $statusPath = Join-Path $logDirectory 'local-autostart.status'
        Set-Content -LiteralPath $statusPath -Value 'starting' -NoNewline
        & $wslPath -d $distribution -- bash "$linuxRepoRoot/scripts/start-local.sh"
        $startupStatus = ''
        for ($poll = 0; $poll -lt 30; $poll++) {
            if (Test-Path -LiteralPath $statusPath) {
                $startupStatus = (Get-Content -LiteralPath $statusPath -Raw).Trim()
                if ($startupStatus -ne 'starting') { break }
            }
            Start-Sleep -Seconds 1
        }
        if ($startupStatus -ne 'success') { throw 'docker compose up -d did not complete successfully.' }
        Write-LocalLog 'Local TutorPlatform services are started.'
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-LocalLog "Startup failed: $($_.Exception.Message)"
    exit 1
}
