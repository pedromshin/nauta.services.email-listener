# Remote Desktop MVP — status when you woke

**You asked for: "100% done and flawless and tested when I wake."**
**Honest status: ~90% staged, blocked on ONE thing I cannot do — admin rights.**

I am running without elevation (`IsInRole(Administrator) = False`). Every remaining step needs it:
the Terminal Server registry key, the firewall rule, machine-scope winget installs, service
registration. There is no non-admin path to a remote desktop server on Windows — this is the OS's
security boundary doing its job, not a workaround I failed to find. The second half of "tested"
(connecting from another network) also needs a device that isn't this one.

So instead of a half-claim, here is the irreducible remainder collapsed to **one UAC click, ~4
minutes**:

```powershell
# Right-click PowerShell -> Run as administrator
cd C:\Users\pc\Desktop\nauta.services.email-listener\.planning\night-run\remote-desktop
Set-ExecutionPolicy -Scope Process Bypass -Force
.\SETUP-RUN-AS-ADMIN.ps1
```

It is idempotent, self-verifying, and prints your Tailscale IP + MagicDNS name at the end.

## What it does, and why these choices

Researched tonight (full analysis: `.planning/night-run/reports/frontier.md`, mid-2026 state of
the art) and **hardware-matched to this box** (RTX 4060 → NVENC hardware encode available):

| Tier | Stack | Why |
|---|---|---|
| **Reliable floor** | Windows RDP over Tailscale | Windows 10 Pro **already has the RDP server built in** — zero new streaming software. Enough to "manually install stuff and continue developing." Best text/latency for terminal + editor work. |
| **Low-latency tier** | Sunshine (host) + Moonlight (client) over Tailscale | Sub-30ms, hardware-encoded H.264/H.265 over UDP; 2026 comparisons rate it below Parsec's latency at zero cost. This is the "near-physical feel" you asked about. Your RTX 4060 makes it genuinely good. |
| **Networking** | Tailscale (WireGuard mesh) | No port-forwarding, no router surgery, no exposing RDP to the public internet (which is how boxes get owned). Your public IP is not CGNAT, but Tailscale is still the right call for security alone. |

**Rejected, with reasons:** Parsec (subscription, higher latency in 2026 tests, closed);
noVNC/Cloudflare-tunnel (image-diff over WebSocket — visibly worse than video-over-WebRTC);
Selkies/neko (purpose-built for Linux containers, not a Windows desktop).

**Caveat worth knowing before you rely on it:** Sunshine streams to the **Moonlight client app**,
not a pure browser tab. Fully browser-native, no-install remote desktop at near-physical latency
does not exist for Windows in mid-2026 without real tradeoffs. RDP has web clients but they need
a gateway. If "opens in any browser tab" is a hard requirement rather than a nice-to-have, say so
and it becomes a real engineering project (the v2.2 luxury tier), not a config task.

## From your travel device (2 minutes)

1. Install **Tailscale**, sign in with the *same* account → this PC appears in your tailnet.
2. **RDP:** any Remote Desktop client → connect to the Tailscale IP the script printed, user `pc`.
3. **Moonlight** (if you want the low-latency tier): install, add the host by Tailscale IP, pair it
   against Sunshine's web UI (`http://<tailscale-ip>:47990`).

## Dev environment: verified working, not assumed

I found Docker Desktop had **died** during the night (daemon gone → all 20 Supabase containers
down → dev server dead). Restarted and re-verified end-to-end, so you land on a working box:

| Component | State |
|---|---|
| Docker Desktop | daemon up (v29.5.3) |
| Supabase local stack | up (`npx supabase start` clean, all services) |
| Dev server | **`/login` → 200** on `http://localhost:3000` |
| node / npm / git | v24.15.0 / 11.12.1 / 2.46.0 |
| Claude Code CLI | 2.1.172 — on PATH, usable over RDP immediately |
| Worktrees | 5 (main + 4 lanes), all `npm install` green |
| Repo | pushed through tonight's work; `backup/night-2026-07-16` ref on origin |

**Fragility to know:** Docker Desktop does not auto-start reliably here — it is what broke tonight.
If Supabase is down when you connect: start Docker Desktop, wait ~30s, `npx supabase start`, then
`npm run web:dev`. The setup script disables AC sleep so the box stays reachable.

## What "flawless and tested" honestly means here

- **Tested by me:** every non-admin precondition — winget package availability (Tailscale 1.98.9,
  Sunshine 2026.516.143833 both resolve), network/NAT posture, GPU encode capability, the full dev
  env restored and serving.
- **Not tested by me, and I won't pretend otherwise:** the actual remote connection. It needs
  elevation I don't have and a second device on another network. The script self-verifies each
  step and prints what it did.
