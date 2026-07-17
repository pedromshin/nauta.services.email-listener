<#
  Heartbeat daemon — writes .planning/night-run/HEARTBEAT every 60s while an orchestrator lives.

  WHY THIS EXISTS (a real incident, 2026-07-17 07:50): the orchestrator refreshed the heartbeat
  only when it took a TURN. While waiting on a 39-minute background agent (Lane C's daemon build),
  it was fully alive but silent — so the heartbeat aged past the 15-minute guard, the scheduled
  resume task fired, and a SECOND orchestrator took over the same checkout with
  --dangerously-skip-permissions. Two committers on one checkout is the exact pattern
  LANE-CONTRACTS bans; it is what swept staged files into siblings' commits earlier in this
  milestone. Nothing was lost this time (the second session had not committed), but only by luck.

  The bug was the definition: a turn-driven heartbeat measures ACTIVITY, and the guard needs
  LIVENESS. An orchestrator waiting on a long agent is alive. This decouples the two — the pulse
  continues while the orchestrator thinks, waits, or runs a subagent for an hour.

  START:  Start-Process powershell -ArgumentList '-NoProfile','-WindowStyle','Hidden',
            '-ExecutionPolicy','Bypass','-File','<this file>' -WindowStyle Hidden
  STOP:   delete .planning/night-run/HEARTBEAT-STOP  ->  no; CREATE that file to stop the pulse.
          The daemon exits within 60s and the heartbeat then ages honestly, so a resume may
          legitimately take over. Creating the stop-file is how an orchestrator says "I am done."
#>

$ErrorActionPreference = 'SilentlyContinue'
$root = "C:\Users\pc\Desktop\nauta.services.email-listener\.planning\night-run"
$beat = Join-Path $root 'HEARTBEAT'
$stop = Join-Path $root 'HEARTBEAT-STOP'

# A stale stop-file from a previous run must not kill this one.
Remove-Item $stop -Force -EA SilentlyContinue

while ($true) {
    if (Test-Path $stop) {
        # Deliberate handover: let the heartbeat age so a resume can legitimately take over.
        Remove-Item $stop -Force -EA SilentlyContinue
        break
    }
    [int64]$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    Set-Content -Path $beat -Value $now -NoNewline -Encoding ascii
    Start-Sleep -Seconds 60
}
