# Starts the full TargetVision stack: Docker containers (postgres + fake-gcs),
# API server (8080), and web dev server (8083). Safe to re-run; used by the
# Startup-folder launcher so the app comes back after a reboot/logon.

$ErrorActionPreference = 'Continue'
# Rebuild PATH from the registry so node/pnpm are found even when the
# launching process has a stale environment.
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
    [System.Environment]::GetEnvironmentVariable('Path', 'User')
$repo = 'C:\Vibes\Targetvision\Targetvision'
$logDir = Join-Path $repo 'scripts\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null

# Wait for Docker Desktop (it auto-starts at logon but takes a while)
$deadline = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $deadline) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 10
}

docker compose -f "$repo\docker-compose.yml" up -d *> "$logDir\docker.log"

# Resolve pnpm from the (registry-rebuilt) PATH; corepack installs it next to
# node (e.g. C:\Program Files\nodejs\pnpm.cmd), not under %APPDATA%\npm.
$pnpm = (Get-Command pnpm.cmd -ErrorAction SilentlyContinue).Source
if (-not $pnpm) { $pnpm = "$env:APPDATA\npm\pnpm.cmd" }

function Start-IfNotListening([int]$port, [string]$script, [string]$log) {
    $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $listening) {
        Start-Process -FilePath $pnpm -ArgumentList 'run', $script `
            -WorkingDirectory $repo -WindowStyle Hidden `
            -RedirectStandardOutput $log -RedirectStandardError "$log.err"
    }
}

Start-IfNotListening 8080 'dev:api' "$logDir\api.log"
Start-IfNotListening 8083 'dev:web' "$logDir\web.log"
# MCP HTTP gateway (remote photo search via the tunnel); exits at boot unless
# MCP_AUTH_TOKEN is set in .env.
Start-IfNotListening 8086 'mcp:http' "$logDir\mcp.log"
