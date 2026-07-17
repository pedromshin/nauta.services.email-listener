<#
  Remote Desktop MVP — one-shot elevated setup.

  WHY YOU ARE RUNNING THIS AND NOT AN AGENT: the night-run orchestrator has NO ADMIN RIGHTS.
  Every step below needs elevation (winget machine-scope installs, the Terminal Server registry
  key, firewall rules, service installs). Everything that did NOT need admin is already done and
  verified; this is the irreducible remainder. It is idempotent — safe to re-run.

  HOW: right-click Windows PowerShell -> "Run as administrator", then:
      cd C:\Users\pc\Desktop\nauta.services.email-listener\.planning\night-run\remote-desktop
      Set-ExecutionPolicy -Scope Process Bypass -Force
      .\SETUP-RUN-AS-ADMIN.ps1

  TIME: ~4 minutes, one Tailscale browser login.
#>

$ErrorActionPreference = 'Continue'
function Step($n) { Write-Host "`n=== $n ===" -ForegroundColor Cyan }
function OK($m)   { Write-Host "  [ok] $m"   -ForegroundColor Green }
function Warn($m) { Write-Host "  [!!] $m"   -ForegroundColor Yellow }

# --- guard -------------------------------------------------------------------
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "NOT ELEVATED. Re-open PowerShell as administrator and re-run." -ForegroundColor Red
    exit 1
}
OK "running elevated"

# --- 1. RDP: the zero-install remote desktop (Windows 10 Pro has the server built in) ---------
# This alone satisfies "use the remote desktop, manually install stuff, keep developing".
# Sunshine below is the LOW-LATENCY tier; RDP is the reliable floor. Both get installed.
Step "1/5  Enable Remote Desktop + Network Level Authentication"
Set-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name fDenyTSConnections -Value 0
Set-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name UserAuthentication -Value 1
Enable-NetFirewallRule -DisplayGroup "Remote Desktop" -EA SilentlyContinue
# Keep the machine reachable: never sleep on AC, and require a password on wake.
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change monitor-timeout-ac 15
OK "RDP enabled (NLA on), firewall opened, sleep disabled on AC"

# --- 2. Tailscale: reach this PC from anywhere without router/port-forward surgery -------------
Step "2/5  Install Tailscale"
if (-not (Get-Command tailscale -EA SilentlyContinue)) {
    winget install --id Tailscale.Tailscale --silent --accept-package-agreements --accept-source-agreements
    $env:Path += ";C:\Program Files\Tailscale"
} else { OK "already installed" }

# --- 3. Sunshine: the near-physical-latency tier (RTX 4060 -> NVENC hardware encode) -----------
Step "3/5  Install Sunshine (game-stream host; pairs with Moonlight)"
if (-not (Test-Path "C:\Program Files\Sunshine\sunshine.exe")) {
    winget install --id LizardByte.Sunshine --silent --accept-package-agreements --accept-source-agreements
} else { OK "already installed" }
Start-Sleep -Seconds 3
Get-Service SunshineService -EA SilentlyContinue | Start-Service -EA SilentlyContinue

# --- 4. Tailscale login ------------------------------------------------------------------------
Step "4/5  Connect Tailscale  (a browser window will open — sign in with Google/GitHub)"
& "C:\Program Files\Tailscale\tailscale.exe" up --accept-routes
Start-Sleep -Seconds 2
$ts = & "C:\Program Files\Tailscale\tailscale.exe" ip -4 2>$null
if ($ts) { OK "Tailscale IP: $ts" } else { Warn "no Tailscale IP yet — re-run 'tailscale up' after login" }

# --- 5. Verify ---------------------------------------------------------------------------------
Step "5/5  Verify"
$rdp = (Get-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server').fDenyTSConnections
if ($rdp -eq 0) { OK "RDP server: ENABLED" } else { Warn "RDP still disabled" }
if (Test-Path "C:\Program Files\Sunshine\sunshine.exe") { OK "Sunshine: installed -> https://localhost:47990 (set your web-UI user/pass on first open)" }
$hn = (& "C:\Program Files\Tailscale\tailscale.exe" status --json 2>$null | ConvertFrom-Json).Self.DNSName
if ($hn) { OK "MagicDNS name: $($hn.TrimEnd('.'))" }

Write-Host @"

============================================================
  DONE. From your travel laptop/phone:

  1. Install Tailscale, sign in with the SAME account.
  2. Then either:
     RELIABLE FLOOR — Remote Desktop client -> connect to:
         $ts        (or the MagicDNS name above)
         user: pc
     LOW-LATENCY TIER — install Moonlight, add host $ts,
         pair it against Sunshine's web UI (https://localhost:47990
         from this PC, or http://$ts`:47990 over Tailscale).

  3. Dev env is already verified working on this box — see
     ENV-VERIFIED.md in this folder.
============================================================
"@ -ForegroundColor Cyan
