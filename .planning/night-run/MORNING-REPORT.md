# Morning report — 2026-07-17

## 1. Do this first (2 minutes, then you can leave)

**You can already develop from anywhere. It is running.** Open the **Code tab in the Claude mobile
app**, or **claude.ai/code** → session **`polytoken-travel`** (green dot = online). Full Claude Code
on this PC: edit, test, commit, push, MCP servers, subagents.

Claude Code shipped **Remote Control** (v2.1.196, June 2026). No admin, no Tailscale, no port
forwarding — the PC only makes outbound calls. I verified it against the docs, started it, and left
a keepalive that relaunches it if the link drops. **This is the thing you asked for, and it was
already in a product you pay for.**

**Optional, ~4 min, needs your UAC click** — for what Remote Control *cannot* do (install software,
change system settings, drive Docker Desktop, fix a broken box):

```powershell
# Right-click PowerShell → Run as administrator
cd C:\Users\pc\Desktop\nauta.services.email-listener\.planning\night-run\remote-desktop
Set-ExecutionPolicy -Scope Process Bypass -Force
.\SETUP-RUN-AS-ADMIN.ps1     # RDP-over-Tailscale + Sunshine/Moonlight
```

That "fix a broken box" case is not hypothetical: **Docker Desktop died on this machine tonight**
and took all 20 Supabase containers and the dev server with it. Remote Control could not have fixed
that. RDP can. I restarted everything — you land on a working box (`/login` → 200).

## 2. Read on the plane (in this order)

| Doc | Why |
|---|---|
| `reports/ai-architecture-audit.md` | **Your D4 question, answered with file:line citations.** Written for a strong engineer who is not an LLM researcher. Verdict: reject every agent framework, sign up for nothing, the whole infra ask is 2GB of RAM. |
| `reports/negative-space.md` | The v1.11 draft + the architecture invariants your foggy vision implies. Feeds `/gsd:new-milestone`, does not bypass it. |
| `docs/design/taste-references.md` | The taste layer, now a standing contract. §5 has the provenance correction. |
| `reports/frontier.md` | Remote desktop + tool-ontology prior art, mid-2026. |
| `DIRECTIVES-2026-07-17.md` | Your four directives as I recorded them — **check I read you right, especially D2.** |

## 3. Three things I was wrong about (own list)

1. **"We have essentially no evals."** Half wrong, and worse than being right. You *have* eval
   plumbing — and `tests/evals/test_retrieval_golden_set.py` scores an **`EchoToolExecutor`, an
   identity function** (verified: line 93). recall@k against an echo is trivially perfect. You built
   the plumbing and never connected it to water. Its own docstring says it awaits "Phases 36/37" —
   which shipped.
2. **"The AI stack is a tool-loop in a tRPC router."** Wrong — it's Python/FastAPI hexagonal in
   `apps/email-listener`. I briefed the auditor with this and it corrected me.
3. **I nearly relayed a confident, wrong finding as fact.** Lane D reported a "live law-1 violation
   on every surface" in `dropzone.tsx`. Checked it: `--ring` maps to `var(--ink)` (compliant), no
   ring-offset is set (the white-halo trap cannot fire), and production importers number **zero**.
   Logged in `DIRECTIVES-2026-07-17.md` → Correction log.

## 4. The findings that matter most

- **Phase 57 shipped a self-improvement loop nobody measures.** `suggest_entity_types.py:126` feeds
  human corrections as few-shot examples with zero evidence it beats cold start. **It could be
  hurting accuracy right now.** That is the argument for evals, written in your own code.
- **Your complexity ceiling is one line.** `chat_stream.py` cancels the run on client disconnect —
  run lifetime == browser-tab lifetime (verified in its own docstring). Every ambition you listed
  (desktop control, terminal, automations, long agents) lives past it. But `chat_run_events` already
  has monotonic `seq` + a unique index + `seq` on the SSE wire — the substrate for resumable runs is
  **already built** and tied to a TCP socket. ~200 lines, no new dependency.
- **D2's registry already exists and doesn't know it.** `container.py` carries `tool_executors` +
  `server_tool_defs` — two parallel hand-maintained dicts with identical keys. That is the capability
  registry, unnamed. Also: at 200–800 tokens/tool schema, it needs **search, not enumeration**, from
  day one — retrofitting after genui composes against a flat list would hurt.
- **999.36 — evaluate Remote Control before funding v2.2 as a milestone.** 30 minutes. A product you
  pay for may have retired the pain we were about to spend nights on.

## 5. What is real vs. what is not

**Landed and pushed** (47+ commits): the taste layer, bound permanently into the design-system skill
+ brand guide §3.9 so every future agent loads it without being told; six strategy reports; the
v1.11 draft; the AI audit; Remote Control live; the dev env restored.

**Built tonight, in worktrees, NOT yet merged:** Lane C (daemon: protocol package + ToolExecutor +
permission model), Lane D (files vault, 4 plans). Both got the registry contract (INV-1..INV-4) mid-
flight so v2.0 and D2 converge instead of diverging.

**Not done, stated plainly:** Phases 62/63 (v1.10's remaining surfaces) were not executed — the
session limit at ~02:15 cost ~3 hours and I spent the recovered time on your explicit priorities
(remote desktop, taste, D2/D4) instead. Lane B (research/docs/mail) never started. Lane E has 1 of
~2 plans. **No pixel of Lane C or D has been seen by anyone** — jsdom does no layout, and eleven
bugs shipped through green suites this milestone. Nothing is merged to main, so nothing is claimed.

**Still yours alone:** Phase 61's UAT gate (6-item checklist, `61-08-SUMMARY.md`), and the v1.9
console debt (LIVE-03/04, CLUS-07) — until that lands, pencil-amber has still never rendered on a
real pixel.

## 6. The one decision I need from you

**D2 — the self-building product.** I recorded it, drafted the invariant (every capability ships as
a typed, discoverable primitive genui can bind to; one registry read by the LLM, genui, the canvas,
and the daemon), and sized v1.11's phases 68/71 to **fail gracefully** if you reject the framing.
I did not silently re-architect around it while you slept. Bless it, amend it, or kill it.
