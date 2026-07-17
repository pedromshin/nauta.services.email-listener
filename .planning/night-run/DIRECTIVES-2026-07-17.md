# Directives — user, 2026-07-17 (recorded verbatim-faithful; they are asleep/traveling)

Three new directives + one standing correction. These outrank my prior drafts where they conflict.

---

## D1 — Taste is permanent, not a one-off

> "this good taste should apply for the stuff we are going to build now and for future stuff"

**Binding.** `docs/design/taste-references.md` (landed tonight, 285 lines) is not a night-run
artifact — it is a standing contract alongside `58-IDENTITY.md`. Every surface, every phase,
forever: read it + invoke the `frontend-design` skill before building; click-economy is a testable
review criterion; anti-generic checklist runs in screenshot review.

**Action taken:** recorded in memory (`ui-taste-directive.md`), bound into LANE-CONTRACTS.md.
**Action owed:** fold the checklist into `.claude/skills/polytoken-design-system/SKILL.md` so it
loads automatically for every agent, and into the brand guide §3. Then it survives without me.

### ⚠️ Correction you need to hear (the reference-mining found this)

**Your two "curated references" are not what you think they are:**

- **`links.md`** is a raw Instagram-caption scrape of 18 reels — not curated design commentary.
  Design-relevant salvage: **Mobbin, Awwwards, Screenlane, 21st.dev, Uiverse.io** (surfaced via a
  reel *about avoiding "generic vibe-coded UI"* — the closest thing to a taste signal in there).
  Also **SSGOI** (page transitions).
  **Actively anti-pattern for your locked identity:** ColorFlow, Vibe UI, ShaderGradient,
  liquid-logo, liquid-glass-js, shaders.com — decorative shader/gradient toys that fight "colour
  is earned, never decorative." I did not use them.
- **`0 - nauta_design_case.pdf`** is the Nauta take-home **business/architecture assignment**
  (agentic email ingestion). Zero visual content. Not a taste document.
- **No first-person design principles by you exist anywhere in the repo.** The only authoritative
  taste artifact is still `58-IDENTITY.md` — which is *your* pick, so it counts.

**So the taste layer was built from researched best-in-class patterns (Linear, Raycast,
Superhuman, HEY Screener, Warp, Finder, Perplexity/NotebookLM) rather than from your links.**
That is a better outcome than pretending your scrape was a moodboard — but you should know the
provenance. **If you have real references elsewhere (Mobbin boards, saved screenshots, a Figma),
point me at them and the layer gets sharper.** Ties directly to D2: saving references is a thing
you want to do *inside polytoken*.

---

## D2 — The self-building product (the deepest architectural directive yet)

> "i will want this to be a self building product, so that ui uigen can deepen the integration…
> so that i can build features this project from chat/canvas itself, and should be able to use any
> complex tools and lower architecture stuff i will laydown by writing directly to this code.
> essencially, i will want to have such an agnostic, integrated and ai driven structure (the
> product emanated from this project, which is its infrastructure) that we can piece it together
> using our genui engine and have actual functional complex features of any kind, defined and
> limited but how the infrastructure (this project itself)"

**Reading it back:** the repo is the *infrastructure*; the product *emanates* from it. You write
the hard/low-level primitives directly in code; then from chat/canvas, genui composes those
primitives into real, functional features — bounded only by what the infrastructure exposes. The
product builds itself out of its own substrate.

**This reframes the ladder, and it is not a v2.x feature — it is an architectural invariant that
must hold from now on:**

> **Every capability we build must be exposed as a typed, discoverable, composable PRIMITIVE that
> the genui engine can compose — not just as a hand-wired React surface.**

Concretely, the seam this implies (proposal — needs your bless):
1. **A capability registry.** Every tool/query/mutation/data-source declares itself with a zod
   schema + metadata (what it does, what it needs, what it returns, cost/risk). One registry, read
   by: the LLM (as tools), genui (as composable blocks), the daemon (as executables), the canvas
   (as node types).
2. **Genui composes primitives, not markup.** Today genui emits UI specs. The deepening you want =
   genui specs can *bind* to registry capabilities — a generated panel can actually query, mutate,
   and act, not just render. That is the difference between "a chart of my data" and "a feature."
3. **The infrastructure is the limit, deliberately.** A generated feature can only do what the
   registry exposes — which is the safety model *and* the extension model. You widen what's
   possible by writing a new primitive in code; the AI composes within it.
4. **This subsumes v2.3's ontology.** The OSS/skills/integrations ontology is the same registry,
   pointed outward.

**Sequencing consequence:** the v2.0 daemon's ToolExecutor + permission model and this registry are
*the same abstraction* seen from two sides. Lane C is building the daemon-side half tonight. They
should converge, not diverge — flagged for the resumed session.

**Status: DRAFT for your bless.** This is big enough that I will not silently re-architect around
it while you sleep. Recorded, not executed.

---

## D3 — Remote desktop MVP, before travel

> "i will specially want the remote desktop mvp to be 100% done and flawless and tested when i
> wake because im going to travel and will want this to allow me to at least use the remote desktop
> and manually install stuff and continue developing this remotely with correct env setup"

**Status: ~90% staged, ONE UAC click from done. I have no admin rights — a hard OS boundary, not a
missed workaround.** Full honest status + the one-shot script:
`.planning/night-run/remote-desktop/README.md` + `SETUP-RUN-AS-ADMIN.ps1`.

Stack chosen from tonight's research + this box's hardware (RTX 4060 → NVENC): **RDP over Tailscale**
as the reliable floor (Windows 10 Pro already has the server — zero new software, enough to install
things and keep developing) + **Sunshine/Moonlight** as the near-physical-latency tier.

**Dev env: found broken, fixed, verified.** Docker Desktop had died overnight → all Supabase
containers down → dev server dead. Restarted; `/login` → 200; Claude Code CLI 2.1.172 on PATH.
You land on a working box.

---

## D4 — The AI-engineering depth question (your stated weak axis)

> "look, study, find and save references … for ai engineering, llm engineering, ai agentic systems,
> patterns, architectures, and analyze critically against our own structure … will our ai and llm
> systems handle an explosion in complexity? … should we do changes, refactors, planning?
> should we use other libraries or platforms? what is the path to making this a sophisticated deep
> ai product? my background is frontend → backend → infra → data → ai agentic applications, so im
> also not too deep into data science / llm engineering research itself"

**This deserves a real research + critical-architecture-audit workstream, not a paragraph.** Queued
as the top item for the resumed session (5:20am reset): a deep-research sweep (the `deep-research`
skill exists in this setup) + an adversarial audit of our AI stack against it, answering
specifically:
- Can our chat/tool-loop architecture carry: multi-agent graphs, long-horizon agentic workflows,
  browser control, terminal/computer use, complex automations, self-improvement loops?
- Bedrock-only vs. adding a framework (LangGraph? Mastra? Vercel AI SDK's agent primitives? DSPy
  for optimization?) — with an honest "or nothing, and here's why."
- Evals/observability: we have essentially none. That is the *actual* bottleneck for a
  self-improving system (email extraction, genui, chat quality). Langfuse/Braintrust/Phoenix class.
- Memory/retrieval architecture at scale; the knowledge graph's role.
- **The self-building registry (D2) is the spine this must be designed around.**

**Also: you want to save references inside polytoken instead of Claude.** That is D2 + v1.11's
research core meeting — the first real dogfood. Noted as a wedge: *this* research workstream is
exactly the content that should live in the product.

---

## Session state at time of writing (~02:15, session limit hit, resets 05:20)

Landed: taste layer (285 lines), 6 strategy reports (roadmap, vision corpus, codebase health,
tenancy ADRs, git safety, frontier), Lane C 3 plans + context, Lane E 1 plan + context, Lane D
context only. **Missing: the negative-space v1.11 synthesis** (agent died mid-write) — re-run it.
Resume insurance: Windows scheduled task `polytoken-night-resume` @ 07:50 + heartbeat guard.

---

## Correction log (orchestrator, verified before relaying)

**Lane D's `dropzone.tsx` finding is OVERSTATED — do NOT queue a fix.** The planner reported
`packages/ui/src/dropzone.tsx`'s `ring-1 ring-ring` drag-active state as "a stock accent (law 1)
*and* the ring/white-halo trap, live on every surface using it today." Checked all three claims:

| Claim | Verdict |
|---|---|
| `ring-1 ring-ring` exists (line 87) | **TRUE** |
| "a stock accent — law 1 violation" | **FALSE.** `--ring: var(--ink)` in globals.css (both themes) — it resolves to ink and is law-1 compliant. |
| "the white-halo trap" | **FALSE.** `--tw-ring-offset-color: #fff` only bites when ring-offset-width > 0; dropzone sets no ring-offset (0 occurrences). The trap cannot fire. |
| "live on every surface using it today" | **FALSE.** Production importers: **0**. Only `apps/web/src/app/dev/design/previews-vendored.tsx`, a gate-excluded preview harness. |

**The one real (minor) point:** `ring-ring` is compliant *by indirection* rather than by statement —
which this codebase has a documented preference against (61-03: *"say the token where the sketch says
it — never inherit ink through primary's indirection"*; `variant="ghost"` resolving correctly through
`--accent`/`--ring` was called "the §E trap — compliant by accident of an indirection rather than by
design"). So it is a style-consistency nit on dead code, not a live law-1 bug.

**Lane D's DECISION is unaffected and stands** — hand-rolling the vault's drop handlers is right for
its signature interaction (the sheet rises to accept), independent of dropzone's state.

**Why this is logged:** I was one step from relaying "fix the live law-1 bug in dropzone" to Lane A
on a subagent's say-so. The finding was confident, specific, and wrong in its severity and its blast
radius. Same discipline as the rendered-geometry lesson, one level up: *verify the claim before
acting on it, including — especially — a claim that flatters the finder.*

---

## INCIDENT — dual orchestrator, 07:50 (my design flaw; contained, nothing lost)

**What happened:** the `polytoken-night-resume` scheduled task fired at 07:50 and a SECOND
orchestrator took over this checkout headless with `--dangerously-skip-permissions`. It read the
heartbeat as **38 minutes stale**, concluded the first orchestrator was dead, and correctly (by the
rule as written) claimed the run. Two committers on one checkout is the precise pattern
LANE-CONTRACTS bans — it is what swept staged files into siblings' commits earlier in this milestone.

**The flaw was mine, and it was a definition error.** The heartbeat refreshed only when the
orchestrator took a TURN. It had been waiting on Lane C's 39-minute daemon build — fully alive,
entirely silent. **A turn-driven heartbeat measures ACTIVITY; the guard needs LIVENESS.** An agent
waiting on a long subagent is alive. The guard worked exactly as specified and reached the wrong
conclusion.

**Contained:** the second session had made no commits — only an (accurate, preserved) edit to
NIGHT-RUN's run-order. Killed PID 15152; disabled the one-shot task so it cannot re-fire;
Remote Control (PID 29312) deliberately left alive.

**Fixed structurally, not by care:** `heartbeat-daemon.ps1` now pulses every 60s in its own
process for as long as an orchestrator lives, decoupled from turn-taking. Deliberate handover is
explicit — create `HEARTBEAT-STOP` and the pulse ends within 60s, so the heartbeat then ages
honestly and a resume may legitimately take over.

**The lesson, and it generalizes past this repo:** a safety guard is only as good as the *proxy* it
measures. "Recent write" was a proxy for "alive" that silently inverted under exactly the condition
the system was designed to create — long autonomous background work. This is the same shape as
tonight's other findings: the class-string gate that could not see `variant="destructive"` on a
status, the eval that scored an identity function, the geometry gate that measured vertical overflow
while the bug was horizontal. **The gate is never the thing; verify the proxy still tracks the
property under the conditions you actually run in.**
