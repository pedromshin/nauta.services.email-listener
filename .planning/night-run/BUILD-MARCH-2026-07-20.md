# Build March — 2026-07-20 (user: "build the entire vision and roadmap, literally the entire thing")

**Authorization (user, verbatim intent):** *"we need to build the entire vision and roadmap,
literally the entire thing — all phases, all epochs, all milestones, all todos, all pending.
everything."* Verification is DEFERRED by explicit user instruction (*"well deal with bullshit to
make it test run and verify later"*). The user is on their phone and will NOT run localhost — no
dev server, no pixel review, no live OAuth/email from this session.

**Method:** sequenced WAVES of parallel builders (Workflow tool), scoped to DISJOINT file sets so
they never collide. Commit + push between waves. Each wave lands real code; verification is a later
pass. Honest accounting: "the entire thing" is a multi-session engineering effort — this march
sweeps every slice buildable WITHOUT pixels/localhost/live-services, and enumerates the rest.

**Plan of record:** `night-run/reports/negative-space.md` (v1.11), `research/polytoken-vision/
VISION.md` (E0–E7), `research/two-epoch-endgame/ENDGAME-PLAN.md` (v2.0), `night-run/ENDGAME-2-DRAFT.md`
(v1.12→v3.0 ladder), `DIRECTIVES-2026-07-17.md` (D1–D4). Registry spine (D2) committed: `bd514b3`.

---

## Wave status

- [~] **Wave 1 — Registry spine consumers + first features** (workflow `w7oduc239`, running)
  - [~] daemon → `@polytoken/capabilities` reconcile (INV-2)
  - [~] Python chat capability registry (REG-02) — collapse the two parallel dicts
  - [~] Research evals harness (RSRCH-05 / Phase 72)
  - [~] PDF export floor (DOCS-01 / Phase 70)
- [ ] **Wave 2 — v1.11 research + composition** (after Wave 1 lands; touches chat backend, must be serial to Wave 1's python-registry)
  - [ ] Phase 69 — research depth loop (multi-round plan→search→verify→synthesize) + `pmark` 3-tier citations (RSRCH-01/02/03/04)
  - [ ] Phase 70 rest — documents as first-class objects (list/reopen/canvas node, regenerate-from-spec) (DOCS-02/03)
  - [ ] Phase 71 — genui × registry BINDING, the D2 proof: a generated panel runs a real query + mutation, unregistered fails closed (REG-04)
  - [ ] MAIL-01/02 — rules matcher over fixtures, executed as registry capabilities
- [ ] **Wave 3 — v1.10 carried visual (code-only, PIXEL-GATED on user)**
  - [ ] Phase 62 — `/knowledge`, `/studio`, `/settings/*`, `/login` redesign + production empty/loading/error states (SURF-03/05/06)
  - [ ] Phase 63 — research-canvas visual surfaces: source nodes, canon curation UX, source-grounded panels (RCNV-02/03/05)
- [ ] **Wave 4 — v2.0 Local Agent Platform** (daemon 65 + vault 66 already landed)
  - [ ] Watched folders → directory panels on canvas; directory-scoped attached chats (Claude-Code-class loop over the daemon executors)
  - [ ] Browser-control canvas panel, CDP-first (perception stack deferred by ENDGAME-PLAN)
  - [ ] Tool registry as per-user allowlist panel (over the capability registry `source`/`trust`)
  - [ ] Destructive-op confirm-action widgets keyed on `risk` (INV-4)
  - [ ] Embedded editor panel (Monaco/code-server, jailed-iframe discipline) — stretch
- [ ] **Wave 5 — v2.1 / v2.2 / v2.3 advances**
  - [ ] v2.1 — files vault hardening; files/recipes/sheets as knowledge/canvas nodes; watched-folder sync
  - [ ] v2.2 — session streaming hardening (Phase 67 slice landed); repo/GitHub surfaces
  - [ ] v2.3 — OSS/MCP ontology: POPULATE the registry with `source:"external"` + `trust` tiers (thin vetting gate only — INV-3)
- [ ] **Wave 6 — backlog sweep** (open 999.x that are code-only)
  - [ ] 999.2 grid colSpan · 999.8(b) renderer mustache · 999.13 genui catalog expansion (20 vendored components) · 999.15 Bedrock chat prompt caching · 999.25 suggestion-chip styling · 999.31 carve run_chat_turn.py · 999.32 root CLAUDE.md + micro-skills · 999.33 rule-based mail actions (fixture) · 999.35 save references inside polytoken
- [ ] **Wave 7 — todos** (`.planning/todos/pending/` currently EMPTY — nothing pending)

## Genuinely NOT buildable from this session (enumerated, not faked)

- **Pixel/taste gates** — Phases 62/63/69/70/71 surfaces need the user's on-screen review (D1 taste
  gate; the "green tests ≠ good UI" lesson). Code lands; "done" waits on the user.
- **Live legs** — LIVE-03 (OAuth), LIVE-04 (real inbound email), CLUS-07 (six-leg scenario), and
  MAIL's real-mail switch (v1.12) — user console actions, ~30 min, no dev work.
- **v3.0 launch hardening** — gated on a launch decision (orgs/RLS-primary/billing); tenancy stays
  ADR-only per `tenancy-arch.md` §3. Not built speculatively.
- **999.20 nauta purge in live state** — needs DB access + user-driven AWS/infra migration.
- **Remote desktop luxury tier (999.26)** — needs the user's Windows box + a UAC click.
- **D2 bless** — the registry is built at its cheapest scope; if the user rejects the framing,
  Phase 71 drops and Phase 68 stands alone.

---
*Updated as each wave lands. Commits reference the wave. Pushed to `claude/gsd-plugin-marketplace-s6us9d`.*
