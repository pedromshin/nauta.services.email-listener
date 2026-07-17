# Vision Corpus Inventory — polytoken.ai

Sources read: `.planning/research/polytoken-vision/VISION.md` (E0–E7 ladder),
`.planning/research/two-epoch-endgame/ENDGAME-PLAN.md` (v1.9/v2.0 restructure),
`.planning/PROJECT.md` (Key Decisions, Current/Active/Out-of-Scope), `.planning/ROADMAP.md`
(canonical Backlog section, `## Backlog`), `.planning/STATE.md` (999.2x provenance).

## 1. Epoch ladder E0–E7 (VISION.md, superseded in sequencing only)

- **E0** — Finish v1.5 (promotion mechanic, recall measurement, knowledge canvas). SHIPPED.
- **E1** — v1.6 Chat × Knowledge Convergence (tool loop, knowledge tools, live panels, quarantine). SHIPPED.
- **E2** — polytoken.ai rebrand + design refactor + auth/tenancy + email threads/forwarding. SHIPPED (v1.7/v1.8).
- **E3** — Email-Cluster Workflow: thread cards on canvas, chats bound to threads, web-research → knowledge nodes → promote-to-global, cluster context. SHIPPED (v1.9 Band 3), but its declared acceptance bar (CLUS-07, live on real inbox) is unproven-live tech debt.
- **E4** — Desktop app + daemon: outbound persistent connection, watched folders → directory panels, Claude-Code-class attached chats (fs/terminal/git), embedded editor. NOT STARTED — folded into v2.0.
- **E5** — Browser-control canvas panel (CDP-first per the endgame thinning; perception-stack research deferred). NOT STARTED — folded into v2.0.
- **E6** — Tool/skill registry (per-user allowlist panel, thinned from "hundreds of OSS tools") + agent self-repository of reusable functions. NOT STARTED — folded into v2.0.
- **E7** — Distributed inference/compute-credit pooling. Explicitly PARKED as a venture decision (needs E4 shipped + real multi-tenancy + demonstrated demand); only obligation carried forward is keeping the daemon protocol "job-shaped."

**Sequencing note:** the two-epoch endgame (locked 2026-07-10) compressed E1–E3 into v1.9 "Cloud Workspace" and E4+E5+E6 into v2.0 "Local Agent Platform" (one shared daemon/permission-model/ToolExecutor foundation — deliberately NOT three staged epochs, since browser control and registry tools are "just more executors behind the same gate"). E7 stays parked, outside both epochs. As of 2026-07-15, v1.10 "Product Design & Research Canvas" was inserted AHEAD of v2.0 (two post-lock user findings, 999.18 + 999.19, postdate the endgame lock) — v2.0 keeps its number and content unchanged, just follows v1.10 now.

## 2. What v2.0 currently promises

Per ENDGAME-PLAN.md §3 and ROADMAP.md's v2.0 entry (E4+E5+E6 merged, one requirements umbrella):

- **First-class (core loop):** desktop app hosting a daemon (outbound persistent connection to polytoken cloud, per-command permissioning, audit log, daemon auth — `/gsd:secure-phase` mandated on every daemon phase); watched folders → directory panels on canvas; directory panels + attached chats = Claude-Code-class agent loop scoped to a folder (fs/terminal/git executors via the generalized ToolExecutor port); destructive fs ops require confirm-action widgets (extends v1.6 Fork-2 machinery).
- **Thinned (deliberate scope cuts):** browser-control panel ships CDP-first, perception/vision research (pixelrag/ui-tars/etc.) explicitly deferred, no perception stack locked now; tool/skill registry ships as a per-user allowlist control panel over the daemon's executor set, NOT the hundreds-of-OSS-tools registry E6 originally envisioned.
- **Stretch/trailing:** embedded editor panels (code-server/Monaco in the jailed-iframe discipline from Phase 20); agent self-repository of reusable functions (template flywheel generalized — generated=INFERRED, human-blessed=EXTRACTED).
- **Split rule:** if v2.0's roadmap exceeds ~15 phases, split v2.0/v2.1 at the daemon-core/executors-on-top seam — still one epoch, one requirements umbrella, two execution passes.
- v2.0 is NOT yet opened (`/gsd:new-milestone` not run). Plan of record: `.planning/research/two-epoch-endgame/ENDGAME-PLAN.md` §3. Currently sequenced AFTER v1.10 (per PROJECT.md "Next epoch" section).

## 3. Every backlog 999.x item (canonical list: ROADMAP.md `## Backlog`)

| # | One-line description | Status |
|---|---|---|
| 999.1 | GenUI history leaked cross-importer (missing importer_id scoping) | RESOLVED (Phase 44, 2026-07-10) |
| 999.2 | Grid `colSpan` for asymmetric layouts + pytest event-loop test-isolation cleanup | OPEN (colSpan); event-loop part resolved 46-02 |
| 999.3 | v1.3 connected-env verification (live Bedrock eval, Playwright code-island, live-progress streaming) | Absorbed into v1.7 kickoff hygiene / v1.9 Band 1 |
| 999.4 | Design Engine (DSGN-01..04: unify-vs-hybrid lock, visual-compare repair, promptable design system, screenshot/URL→token extraction) | PARTIALLY absorbed (v1.8/v1.10 visual identity); DSGN-02/04 explicitly deferred as "not cheap" |
| 999.5 | Orchestration Visualizer (live agent run-tree on canvas) | OPEN, deferred to v2.0 stretch (next to directory/browser panels) |
| 999.6 | Chat & Studio Design Uplift (UPLIFT-01..03) | SHIPPED as v1.4 (Phases 26–28) |
| 999.7 | Editable genui panels / studio-on-canvas — per-panel token/spec editing, regenerate in place | SHIPPED — absorbed into v1.9 Phase 52 |
| 999.8 | Declarative display-binding gap: (a) generator-prompt fix, (b) renderer affordance for mustache-in-text | (a) SHIPPED v1.4 POLISH-01; (b) still OPEN, touches locked SpecRenderer |
| 999.9 | Canvas auto-layout stacking (cosmetic, dagre nodesep) | SHIPPED v1.4 POLISH-02 |
| 999.10 | Knowledge-graph uplift — adopt graphify's algorithms (tier ladder, bounded expand, tier-pruned detail) onto live Postgres | SHIPPED v1.5 (Phases 29–32); stage-3 BFS/tier-pruning/snapshot-diff (KGX-01..03) remain deferred pending a measured retrieval-miss rate |
| 999.11 | polytoken.ai product vision — full E0–E7 epoch ladder (rebrand, auth/tenancy, E3 workflow, daemon, browser panel, registry, distributed inference) | SUPERSEDED 2026-07-10 by two-epoch endgame restructure; content lives on as VISION.md |
| 999.12 | Tailwind v3.4→v4 (`@theme`/oklch) + React 18→19 migration, revalidate vendored `packages/ui`, settle Radix-vs-Base-UI | UNPARKED 2026-07-14 → v1.10 Phase 55 (Platform Migration), SHIPPED per 55-01-SUMMARY.md |
| 999.13 | genui catalog expansion — register 20 vendored Magic UI/Kibo UI components as spec types | OPEN, not scoped into any milestone yet |
| 999.14 | Untracked `dev/design` scratch pages break `@polytoken/web` typecheck (import `@nauta/ui`) | OPEN, opportunistic-fix candidate; exempted from palette-ban gates |
| 999.15 | Chat-path Bedrock prompt caching (no `cache_control` on chat system prompt / tools schema, unlike the genui path) | OPEN, cost hygiene, sequenced behind value work |
| 999.16 | Raw-palette entity-chips/StatusBadge surfaces off-token (inbox chips, entity-detail confidence badge) | RESOLVED — absorbed as RSKN-06 into v1.9 Phase 51, CLOSED |
| 999.17 | Editable-panel chrome unreachable on mobile / docked view ignores overlays (PANL editing desktop-canvas-only) | CLOSED — promoted to v1.10 Phase 61 (SURF-07), both read+write halves closed per STATE.md |
| 999.18 | **HIGH PRIORITY** — full production UI/UX rebuild: no phase ever did real visual/UX design, base palette still stock-shadcn, brand register was voice/tone only | PROMOTED 2026-07-15 → v1.10 in full: (a) IDNT-01..04 (Phases 58–59), (b) SURF-01..05 (Phases 60–62), (c) SURF-06 (Phase 62), (d) Phase 58 human gate — this IS v1.10's spine, actively executing |
| 999.19 | Frictionless research canvas: auto-collected sources (no capture ceremony), user-selected canon, canvas edges-as-context, source-grounded presentation panels, plus an email-corrections learning loop | PROMOTED 2026-07-15 → v1.10 in full: step 1→LEARN-01/02 (Phase 57), steps 3–5→RCNV-01..05 (Phases 56, 63) — actively executing |
| 999.20 | Deep nauta→polytoken purge in LIVE STATE: `entity_instances.nauta_id` DB column rename, AWS `nauta-services-*` resource renames (re-parked Hazard A/B/C, S3 bucket holds real inbound email), local repo directory rename | OPEN, parked — needs DB access + user-driven infra; queued for after v1.10 |
| 999.21 | Pre-existing sidebar pointer-events E2E interception bug (Playwright) + a genui `artifacts.test.ts` content-hash-drift failure, both pre-existing (not migration regressions) | OPEN, opportunistic-fix candidate during v1.10 Phases 60–62 |
| 999.22 | **HIGH** — `npm run build:local` silently corrupts a running dev server's shared `.next` dir (server chunks overwritten, client JS never executes, damage surfaces silently) — and the plans' own verification steps trigger it | CLOSED for the Phase 61 gate (`playwright.geometry.config.ts` no-webServer config); underlying `distDir`/`NEXT_DIST_DIR` fix still open project-wide |
| 999.23 | Screenshot harness has no theme axis (dark mode never once photographed) and asserts nothing (can report `ok` while capturing a crash) | CLOSED — theme axis + liveness assertion added in Phase 61 Plan 01 |
| 999.24 | Screenshot harness used a fixed 400ms wait instead of waiting for loading state to actually clear, producing false "settled" frames | CLOSED — replaced with bounded networkidle + skeleton-clear settle, 32/32 settled |
| 999.25 | Suggestion-chip (`--sugg` INFERRED-tier) styling/visual gap not reachable by current screenshot fixtures (seeded data is confirmed entities, not suggestions) | OPEN — explicitly out of scope for Phase 61, flagged for Phase 62 |

*(No 999.26+ item exists in the corpus as of this read.)*

## 4. Coverage check against the seven candidate strategy areas

| Candidate area | Existing coverage | Verdict |
|---|---|---|
| **Research canvas / frictionless capture** | 999.19 (full spec: auto-collected sources, no capture ceremony, canon selection, edges-as-context, presentation panels) — actively building as v1.10 Band 4 (RCNV-01..05, Phases 56/63) | **COVERED** — do not re-propose; extend/cite 999.19 instead |
| **Email automation rules** | 999.19 step 1 = email-corrections LEARNING LOOP (user corrects what each email is, system improves classification over time, suggest-only) — v1.10 Band 5 (LEARN-01/02, Phase 57). This is a *learning* loop, not declarative "if X then Y" automation rules | **PARTIALLY COVERED** — the learning/classification angle is covered; explicit user-authored automation-rule UI (e.g., "auto-forward emails from X to Y" or scheduled/triggered actions) has **NO existing backlog coverage** — genuinely new if that's the ask |
| **Self-cloud / file storage** | E4 "watched folders → directory panels," "remote filesystem ops (download everything from this ontology cluster to my machine)" — part of v2.0's daemon core loop | **COVERED** by E4/v2.0, but v2.0 not yet opened (sequenced after v1.10) |
| **Chat parity with claude-web** | No epoch or backlog item names "claude-web parity" as a goal. v1.6 already ships tool loop, citations, live data-bound panels, quarantine — substantial chat capability exists, but nothing frames it as matching/parity-testing against claude.ai's web chat feature set (e.g. projects, artifacts-as-a-concept, memory, file uploads at claude-web's breadth) | **NO EXISTING COVERAGE** — genuinely new if framed as an explicit parity target |
| **Remote desktop** | E5 Browser-Control Canvas Panel gives *browser* remote control (CDP-first), and E4's daemon gives fs/terminal/git control scoped to a folder — but full remote-desktop (arbitrary GUI app control, screen-share-class access beyond browser/fs/terminal) is not in VISION.md or any backlog item; E5's own perception-stack research (screenshot-first agentic control) was deliberately left unlocked/deferred | **NO EXISTING COVERAGE** for true remote-desktop; browser + fs/terminal control (a narrower slice) IS covered by E4/E5 |
| **Repo-ontology / agent-pluggable integrations** | E6 "Tool/skill registry" (per-user allowlist over external OSS tools/capabilities) is the closest match, but ENDGAME-PLAN.md explicitly THINS it to "per-user allowlist control panel," deliberately deferring the "hundreds of OSS tools" registry concept. E4's "agent self-repository of reusable functions" (template flywheel, generated=INFERRED/human-blessed=EXTRACTED) is adjacent but is about the agent's own generated code, not third-party repo/plugin ontology integration | **PARTIALLY COVERED** (E6, thinned) — a fuller "repo-ontology" or plugin-marketplace concept has **NO EXISTING COVERAGE** |
| **Multi-tenancy** | E2 delivered real per-user tenancy: Supabase RLS + app-boundary `user_id` scoping (v1.7 Phase 44, migrations 0031–0034, 13 tables). VISION.md explicitly notes "single-user for now" as the current irreversibility guardrail — multi-tenant in the sense of *multiple distinct organizations/teams sharing one deployment* (as opposed to per-user isolation on a personal product) is not scoped anywhere; E7 (distributed inference) explicitly requires "real multi-user tenancy" as a precondition and is parked | **PER-USER TENANCY COVERED** (shipped); **true multi-org/team tenancy has NO EXISTING COVERAGE** and is implicitly gated behind E7's parked precondition |

## 5. Net: genuinely new areas (no existing backlog/vision coverage)

1. Explicit chat-feature parity with claude.ai's web chat (framed as a parity target, not just capability growth)
2. True remote-desktop (beyond browser CDP-control and fs/terminal/git scoped to a folder)
3. Repo-ontology / broader agent-pluggable third-party integration marketplace (E6 deliberately thinned away from this)
4. Explicit rule-based email automation (as distinct from the learning/classification loop already in 999.19 step 1)
5. True multi-org/team tenancy (distinct from the per-user tenancy already shipped)

Everything else proposed under those seven labels maps onto existing, already-sequenced work (999.19 research canvas, E4 self-cloud, E2 per-user tenancy) — new strategy should extend/cite those items rather than re-derive them.
