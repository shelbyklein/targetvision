# Starts the DEV preview stack (branch previews at targetvisiondev.shelbyklein.com).
#
# Runs the API (8084) and web dev server (8085) from the SEPARATE dev worktree at
# C:\Vibes\Targetvision\targetvision-dev. See docs/DEV_ENVIRONMENT.md for setup.
#
# Deliberately does NOT:
#   - run `docker compose up`  -> the prod stack already owns the shared
#     Postgres (5433) + fake-gcs (4443) containers; dev reuses them.
#   - run any `db push` / migration -> dev shares the PROD database, so a schema
#     push here would mutate real prod data. Keep schema changes to prod only.
#
# The dev API binds 8084 because the dev worktree's own `.env` sets PORT=8084;
# the web port (8085) + API proxy target (8084) come from the `dev:web:dev` script.

$ErrorActionPreference = 'Continue'
# Rebuild PATH from the registry so node/pnpm are found even when the launching
# process has a stale environment.
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
    [System.Environment]::GetEnvironmentVariable('Path', 'User')

$repo = 'C:\Vibes\Targetvision\targetvision-dev'
if (-not (Test-Path $repo)) {
    Write-Error "Dev worktree not found at $repo. Create it first: git worktree add ../targetvision-dev <branch> (see docs/DEV_ENVIRONMENT.md)."
    exit 1
}
if (-not (Test-Path (Join-Path $repo '.env'))) {
    Write-Error "No .env in the dev worktree ($repo). Copy prod's .env and apply the dev overrides (see .env.dev.example)."
    exit 1
}

$logDir = Join-Path $repo 'scripts\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null

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

# dev:api reads the dev worktree's own .env (PORT=8084). dev:web:dev binds 8085.
Start-IfNotListening 8084 'dev:api'     "$logDir\dev-api.log"
Start-IfNotListening 8085 'dev:web:dev' "$logDir\dev-web.log"
