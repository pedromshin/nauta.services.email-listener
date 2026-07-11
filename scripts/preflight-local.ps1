<#
.SYNOPSIS
    Bring the local polytoken stack to a known-green DB state, idempotently.

.DESCRIPTION
    Companion script to docs/RUN-LOCAL.md. Runs, in this exact order:
      1. Kill stale python/uvicorn/node processes (zombie-process preflight).
      2. Ensure Supabase is up under project_id=polytoken (stop a stale nauta
         stack first if one is detected), then read the service_role key +
         API URL from `npm run sb:status`.
      3. Seed EXACTLY ONE auth.users row via the GoTrue admin/users API,
         BEFORE migrating (the 0032 tenancy-backfill migration precondition).
      4. Run `npm run db:migrate` (applies 0000-0035 via Drizzle).
      5. Apply idempotent Supabase-role GRANTs + NOTIFY pgrst, piped into the
         DB container via `docker exec -i` (plain `docker exec` drops stdin).
      6. DB-based green assertion (has_table_privilege) -> PASS/FAIL, exits
         nonzero on FAIL.

    Never echoes the service_role key or any other secret to stdout. All
    values this script emits are kept ASCII (a non-ASCII secret once caused
    a production outage -- same discipline applies here).

.NOTES
    Windows is the primary shell for this repo. Run from the repo root:
        ./scripts/preflight-local.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

$SeedEmail = "pedromaschio.shin@gmail.com"
$DbContainer = "supabase_db_polytoken"
$ApiUrlFallback = "http://127.0.0.1:54321"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Step 1: Kill stale processes (zombie-process preflight, see RUN-LOCAL.md #4)
# ---------------------------------------------------------------------------
Write-Step "Step 1/6: Killing stale python/uvicorn/node processes"

$staleProcs = Get-Process python, uvicorn, node -ErrorAction SilentlyContinue
if ($staleProcs) {
    $staleProcs | Stop-Process -Force
    Write-Ok "Stopped $($staleProcs.Count) stale process(es)"
}
else {
    Write-Warn "No stale python/uvicorn/node processes found (nothing to kill)"
}

foreach ($port in 8000, 3000) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        Write-Warn "Port $port is still LISTEN after kill -- a non-matched process may be holding it"
    }
    else {
        Write-Ok "Port $port is free"
    }
}

# ---------------------------------------------------------------------------
# Step 2: Ensure Supabase is up under project_id=polytoken
# ---------------------------------------------------------------------------
Write-Step "Step 2/6: Ensuring Supabase is up (project_id=polytoken)"

$staleNautaContainers = docker ps -a --format "{{.Names}}" 2>$null | Select-String -Pattern "_nauta$"
if ($staleNautaContainers) {
    Write-Warn "Stale nauta-project containers detected -- stopping them first"
    npx supabase stop --project-id nauta
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "supabase stop --project-id nauta exited $LASTEXITCODE (continuing -- may already be stopped)"
    }
}

npm run sb:start
if ($LASTEXITCODE -ne 0) {
    Write-Warn "npm run sb:start exited $LASTEXITCODE -- checking if the stack is already running"
}

$statusOutput = npm run sb:status 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Fail "npm run sb:status failed -- Supabase does not appear to be running under project_id=polytoken"
    exit 1
}

$serviceRoleKey = $null
$anonKey = $null
$apiUrl = $ApiUrlFallback

foreach ($line in ($statusOutput -split "`r?`n")) {
    if ($line -match "^\s*API URL:\s*(\S+)\s*$") { $apiUrl = $Matches[1] }
    if ($line -match "^\s*service_role key:\s*(\S+)\s*$") { $serviceRoleKey = $Matches[1] }
    if ($line -match "^\s*anon key:\s*(\S+)\s*$") { $anonKey = $Matches[1] }
}

if (-not $serviceRoleKey) {
    Write-Fail "Could not parse service_role key out of 'npm run sb:status' output -- is Supabase running?"
    exit 1
}
Write-Ok "Supabase is up (project_id=polytoken); API URL: $apiUrl; service_role key captured (not printed)"

# Known gotcha (docs/RUN-LOCAL.md #2): Google OAuth env() refs in config.toml resolve from the
# PROCESS env, not .env.local. This is a non-fatal warning -- it does not block the DB-green gate.
if (-not $env:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID -or -not $env:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET) {
    Write-Warn "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID/_SECRET not set in the process env -- local Google sign-in will silently fail to configure (see RUN-LOCAL.md #2)"
}

# ---------------------------------------------------------------------------
# Step 3: Seed EXACTLY ONE auth user BEFORE migrating (0032 backfill precondition)
# ---------------------------------------------------------------------------
Write-Step "Step 3/6: Seeding single auth user ($SeedEmail) via GoTrue admin API"

$seedHeaders = @{
    "apikey"        = $serviceRoleKey
    "Authorization" = "Bearer $serviceRoleKey"
    "Content-Type"  = "application/json"
}
$seedBody = @{
    email          = $SeedEmail
    email_confirm  = $true
} | ConvertTo-Json -Compress

try {
    $seedResponse = Invoke-RestMethod -Method Post -Uri "$apiUrl/auth/v1/admin/users" `
        -Headers $seedHeaders -Body $seedBody -ErrorAction Stop
    Write-Ok "Seeded auth user (id: $($seedResponse.id))"
}
catch {
    $errorBody = $null
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        $errorBody = $_.ErrorDetails.Message
    }
    if ($errorBody -match "already.*registered" -or $errorBody -match "already exists" -or $errorBody -match "email_exists") {
        Write-Ok "Auth user already exists -- treating as success (idempotent)"
    }
    else {
        Write-Fail "Failed to seed auth user: $($_.Exception.Message)"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Step 4: Run migrations (0000-0035 via Drizzle)
# ---------------------------------------------------------------------------
Write-Step "Step 4/6: Running db:migrate"

npm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Fail "npm run db:migrate exited $LASTEXITCODE"
    exit 1
}
Write-Ok "Migrations applied"

# ---------------------------------------------------------------------------
# Step 5: Idempotent Supabase-role GRANTs + NOTIFY pgrst, piped via docker exec -i
# ---------------------------------------------------------------------------
Write-Step "Step 5/6: Applying Supabase-role grants and reloading PostgREST"

$grantSql = @"
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
"@

# NOTE: plain `docker exec` (without -i) drops stdin -- always use `docker exec -i` here.
$grantSql | docker exec -i $DbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Grant SQL failed against container '$DbContainer' (docker exec -i exited $LASTEXITCODE)"
    exit 1
}
Write-Ok "Grants applied and PostgREST schema reload notified"

# ---------------------------------------------------------------------------
# Step 6: DB-based green assertion (trust the DB, not the terminal)
# ---------------------------------------------------------------------------
Write-Step "Step 6/6: DB-based green assertion"

$privCheckSql = "SELECT has_table_privilege('service_role', 'public.chat_conversations', 'SELECT');"
$privResult = (docker exec -i $DbContainer psql -U postgres -d postgres -tAc "$privCheckSql" 2>&1 | Out-String).Trim()

$tableCountSql = "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
$tableCountResult = (docker exec -i $DbContainer psql -U postgres -d postgres -tAc "$tableCountSql" 2>&1 | Out-String).Trim()

$privOk = $privResult -eq "t"
$tableCount = 0
[int]::TryParse($tableCountResult, [ref]$tableCount) | Out-Null
$tableCountOk = $tableCount -gt 0

if ($privOk -and $tableCountOk) {
    Write-Ok "PASS: has_table_privilege(service_role, public.chat_conversations, SELECT) = t; $tableCount tables in public schema"
    Write-Host ""
    Write-Host "Local stack is DB-verified green. Start the listener and web app per docs/RUN-LOCAL.md #3." -ForegroundColor Green
    exit 0
}
else {
    Write-Fail "DB-based green assertion FAILED"
    if (-not $privOk) {
        Write-Fail "  has_table_privilege check returned '$privResult' (expected 't') -- grants may not have applied"
    }
    if (-not $tableCountOk) {
        Write-Fail "  public schema table count is '$tableCountResult' (expected > 0) -- migrations may not have applied"
    }
    exit 1
}
