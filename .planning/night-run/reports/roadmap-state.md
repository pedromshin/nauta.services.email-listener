# v1.10 Roadmap State — as of 2026-07-17

Sources read: `.planning/ROADMAP.md` (Phase 62/63 verbatim), `.planning/STATE.md` (Current
Position + progress frontmatter), `.planning/HANDOFF.json` (empty auto-checkpoint, no live
session state), `.planning/REQUIREMENTS.md` (traceability table), `.planning/phases/49-.../MORNING-CHECKLIST.md`,
`.planning/phases/60-.../60-VERIFICATION.md`, `.planning/phases/51-.../51-VERIFICATION.md`.

## 1. Remaining v1.10 work, in order, with verbatim success criteria

STATE.md frontmatter: `total_phases: 9, completed_phases: 7, total_plans: 32, completed_plans: 34, percent: 78`
(plan count exceeds phase-declared totals because Phase 61 ran 8 plans vs an earlier smaller estimate).

**Phase 62 — Surface Redesign: Knowledge, Studio & Production States** (not started; Plans: TBD)
Depends on: Phase 59, Phase 60, Phase 61 (all satisfied — Phase 61 code-complete, see §2).
Requirements: SURF-03, SURF-05, SURF-06.

> **Goal**: The `/knowledge` canvas, `/studio`, `/settings/*`, and `/login` are redesigned on the
> locked identity, and every Band-3-redesigned surface (inbox, email-detail, chat+canvas, knowledge,
> studio, settings, login) gains production-grade empty/loading/error states in place of first-draft
> placeholders — the wrap-up pass that closes out the surface-redesign band.

Success Criteria (verbatim):
1. `/knowledge`'s canvas (node chrome, filter rail, legend, detail pane) is redesigned on the new identity.
2. `/studio`, `/settings/*`, and `/login` are redesigned on the new identity — layout, hierarchy, and density all deliberately redesigned, not inherited defaults.
3. Every surface touched in Phases 60–62 has a designed (not first-draft) empty state, loading state, and error state — verifiable by triggering each condition on each surface.
4. The full 16-surface screenshot harness + 32/32 E2E suite + palette-ban/WCAG gates stay green across the whole redesigned surface set.

Known carry-in flag from Phase 61 (D-61-04, STATE.md line 186): `/knowledge`'s "tier" concept is
EXTRACTED/INFERRED/AMBIGUOUS — a DIFFERENT axis from chat's confirmed/suggested/terminal — Phase 62
"must decide, not rename." Also: Phase 62 must append `knowledge/` + `entities/` to
`role-hue-ban`'s `SCOPED_DIRS` as it sweeps — the last unswept roots, the only reason the ban gate
is still scoped rather than global (STATE.md line 34-37).

**Phase 63 — Research Canvas: Visual Surfaces** (not started; Plans: TBD)
Depends on: Phase 59 (locked identity), Phase 56 (backend ledger/edges — Complete), Phase 61
(redesigned canvas chrome — code-complete).
Requirements: RCNV-02, RCNV-03, RCNV-05.

> **Goal**: The visual layer of the research canvas lands on the locked identity: auto-collected
> sources appear as nodes on the canvas without the user asking, the user can curate them into a
> personal canon through canvas-level UX (never chat widgets), and the user can generate
> presentation-grade panels grounded in the selected canon/sources.

Success Criteria (verbatim):
1. During a research conversation, sources the agent used appear as nodes on the canvas automatically — visibly related to the conversation — without any per-turn confirm action.
2. The user can select auto-collected source nodes into a personal canon via a canvas-level curation UX (e.g., multi-select + an explicit "add to canon" action on the canvas), which promotes them through the existing suggest-only gate — zero per-turn chat widgets involved.
3. The user can generate a presentation-grade genui panel whose content is grounded in the selected canon/sources.
4. The new source nodes and curation styling match the Phase 59 designed identity, not stock canvas node styling.

Both phases carry `**UI hint**: yes`.

### REQUIREMENTS.md traceability (Pending rows only)
| Requirement | Phase | Status |
|---|---|---|
| SURF-03 | Phase 62 | Pending |
| SURF-05 | Phase 62 | Pending |
| SURF-06 | Phase 62 | Pending |
| RCNV-02 | Phase 63 | Pending |
| RCNV-03 | Phase 63 | Pending |
| RCNV-05 | Phase 63 | Pending |

Everything else (STCK-01..04, RCNV-01/04, LEARN-01/02, IDNT-01..04, SURF-01/02/04/07) = Complete.
22/22 requirements mapped to phases; 16/22 marked Complete, 6/22 Pending (all in Phase 62/63).

## 2. Every OPEN human gate / user-owed action across v1.9 + v1.10

**v1.9 debt (3 items, still owed as of this reading — user declined twice, 2026-07-14):**
Recorded in `phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md` (the single
runsheet) and reiterated in `REQUIREMENTS.md` → Out of Scope table and `STATE.md` line 196-197.
1. **LIVE-03 — OAuth live** (MORNING-CHECKLIST.md §A): Google Cloud Console client setup, redirect
   URIs on both Supabase-hosted projects, provider enable on staging+prod, env vars, then sign in
   on the deployed app and reload/sign-out check. Claude verifies server-side against `auth.users`/`auth.identities`.
2. **LIVE-04 — real email flowing** (MORNING-CHECKLIST.md §B, depends on §A): terraform apply for
   the SES catch-all rule is DONE (2026-07-12, confirmed live). Remaining: §B.3 get forwarding
   address → §B.4 Gmail add-forwarding → §B.5 retrieve verification code from inbox → §B.6 send a
   real test email end-to-end. Claude verifies via `forwarding_addresses`/`emails`/Storage bucket.
3. **CLUS-07 — six-leg live scenario** (MORNING-CHECKLIST.md §H, depends on §A + §B + §G): the
   milestone's own declared acceptance bar for v1.9 — thread card → attach chat → web_search with
   thread context → source capture → promote → second chat sees cluster context, all on a REAL
   inbox thread. Requires migration 0036 applied (DONE local/staging/prod, 2026-07-12) plus live
   §A/§B first. Each of the six legs has an explicit DB-verify query in H.4.

Explicitly declared "no development work required — these are user-only actions and do not block
v1.10 phase planning" (STATE.md line 41-44). REQUIREMENTS.md's Out of Scope table repeats:
"Consequence: inbox/canvas redesigned against seeded fixtures, LEARN loop built without a real
inbound message."

**v1.9 secondary decisions still open in MORNING-CHECKLIST.md (lower priority, not gating v1.10):**
- §C GitHub repo rename — RESOLVED, executed 2026-07-13 (repo now `pedromshin/polytoken.ai`).
- §D Vercel project rename (`nauta-web`→`polytoken-web`) — optional, still undone, independent of A/B/C.
- §E.1 refresh stale hosted DB passwords (`28P01` errors on native verify scripts) — still needed for native (non-Management-API) DB script paths.
- §E.2 ECS coverage-gate ratchet — DECIDED and RESOLVED end-to-end 2026-07-13.
- §E.3 / §F.2 brand-mark visual sign-off — routed here, status not re-confirmed in this pass.
- §F.1 Gmail-forward fixture realism check — standalone manual step, status not re-confirmed.

**v1.10 human gates:**
- **Phase 58 (Visual Identity Sketch & Pick) — RESOLVED.** D-58-01 LOCKED 2026-07-15: user picked
  "Provenance × Meaningful Colour" (`phases/58-visual-identity-sketch-pick-human-gate/58-IDENTITY.md`).
  ROADMAP.md still shows the Phase 58 checkbox as `[ ]` (unchecked) in the phase list — a table
  formatting artifact worth flagging to the orchestrator, since IDNT-01/02 are both marked
  `Complete` in REQUIREMENTS.md and STATE.md's Current Position states the gate is RESOLVED. Treat
  Phase 58 as DONE.
- **Phase 61 screenshot-review human gate (61-08 Task 3).** STATE.md's Current Position header
  (last_updated 2026-07-16T08:05:00Z) says: "AWAITING THE HUMAN GATE (61-08 Task 3, blocking):
  Phase 61 is code-complete and reviewed in both themes (`61-SCREENSHOT-REVIEW.md`,
  PROVEN/UNPROVEN per claim), but the user has not yet looked at the pixels." Git log (most recent
  commits) shows `61-08` plan-completion commits and a later `docs(61): resolve D-61-02` commit,
  and REQUIREMENTS.md/ROADMAP.md both now show SURF-02/SURF-07 as Complete and Phase 61 checked off
  with "(completed 2026-07-16)" — but no explicit "user approved the pixels" statement was found in
  the portions of STATE.md read. **This is the most load-bearing ambiguity in the state files: it
  is unclear whether the human actually looked at Phase 61's screenshots and approved, or whether
  the phase was marked complete on code-completion alone** (the same failure mode Phase 51 had —
  "ugly/experimental" shipped through green gates). Untracked files `61-UI-REVIEW.md`... not
  present; `.planning/ui-reviews/2026-07-16T*` directories exist (7 timestamped dirs from 2026-07-16)
  suggesting active screenshot-review runs that day, but their verdicts were not read in this pass.
  **Recommend the orchestrator confirm this explicitly before starting Phase 62**, since Phase 62
  explicitly depends on Phase 61 and repeats the same "green tests are not a look" risk (60-VERIFICATION.md
  even cites "tonight's sidebar half-width incident... found only when the user opened the app" as
  the standing proof).
- **Phase 60 criterion 4 partial-proof gap (60-VERIFICATION.md, status `human_needed`):** 3 of 4
  human-verification items are NOT closeable inside Phase 60's boundary — they need seeded
  `suggested`-tier facts / regions or a real extracted message, which do not exist in fixtures.
  Deferred to "Backlog 999.25 / v1.9 debt LIVE-04" — i.e., blocked on the same LIVE-04 real-email
  leg above. Not blocking Phase 62/63 per ROADMAP (not a named success criterion of those phases).

## 3. What ENDGAME-PLAN.md sequences after v1.10

Per `.planning/ROADMAP.md` §"Next Two Epochs" (locked 2026-07-10, note added 2026-07-15):
- **v2.0 — Local Agent Platform** (Epoch B = VISION E4+E5+E6 merged): daemon + ONE permission model
  + generalized ToolExecutor as shared foundation; watched folders → directory panels with
  Claude-Code-class attached chats (fs/terminal/git); browser panel CDP-first (perception research
  deferred); tool registry as per-user allowlist panel; embedded editor + agent self-repository as
  stretch. `/gsd:secure-phase` on every daemon phase. Split into v2.0/v2.1 at the
  daemon-core/executors seam only if the roadmap exceeds ~15 phases. Originally sequenced directly
  after v1.9; two post-lock findings (999.18, 999.19) inserted v1.10 ahead of it instead — v2.0
  keeps its number and content unchanged, now follows v1.10.
- **E7 (compute pooling): NOT an epoch** — parked at its own gate as a venture decision; sole
  carried obligation is keeping the v2.0 daemon protocol job-shaped.
- Separately, backlog **999.20** (deep nauta→polytoken purge in live state — DB column rename,
  AWS resource renames, local dir rename) is explicitly "next after v1.10 per REQUIREMENTS.md" —
  it needs DB access + user-driven infra and is NOT part of v1.10 or v2.0 proper, just queued
  behind v1.10's close.

## 4. Plan-count estimate for Phases 62-63

Comparables: Phase 60 (2 requirements — SURF-01, SURF-04, covering inbox + email-detail + region
overlays) ran **7 plans**. Phase 61 (2 requirements — SURF-02, SURF-07, covering chat + canvas +
mobile panel chrome) ran **8 plans** across 4 waves.

- **Phase 62** covers 3 requirements (SURF-03, SURF-05, SURF-06) across FOUR surfaces
  (`/knowledge`, `/studio`, `/settings/*`, `/login`) PLUS a cross-cutting production-states pass
  over every surface touched in Phases 60-62 (7 surfaces total for empty/loading/error states) —
  broader surface count than either Phase 60 or 61, but each individual surface may be simpler than
  the inbox/chat rebuilds (knowledge canvas reuses Phase 61's canvas-vocabulary; studio/settings/login
  are comparatively small surfaces). Estimate: **7-9 plans**, likely split as knowledge canvas (2-3
  plans), studio+settings+login (2-3 plans), production-states sweep (2-3 plans), possibly a
  dedicated harness/handoff plan like 60-07/61-01.
- **Phase 63** covers 3 requirements (RCNV-02, RCNV-03, RCNV-05) on ONE surface family (canvas
  source nodes + canon curation UX + source-grounded panel generation), backend already built by
  Phase 56. Narrower scope than Phase 60/61's ground-up surface rebuilds. Estimate: **5-7 plans**
  (source-node rendering, canon-curation multi-select UX, promotion-gate wiring reuse, source-grounded
  genui generation, harness/screenshot-capture close-out).

Total v1.10 plan count if these estimates hold: current 34 completed + ~12-16 more = **~46-50 plans**
across 9 phases by milestone close (vs. STATE.md's stale `total_plans: 32` frontmatter figure,
which already undercounts the 34 completed — the frontmatter total is not being kept current plan-by-plan).

## Other flags for the orchestrator

- `.planning/HANDOFF.json` is an empty auto-checkpoint (`"partial": true`, all arrays empty,
  `phase: null`) — it carries no usable session-resume state; do not rely on it for "what's next."
- Migrations 0037 (chat_source_ledger + chat_context_edges), 0038 (entity_type_corrections), 0039
  (entity-resolution dismiss filter) are AUTHORED + journal-coherent but **APPLIED NOWHERE** (STATE.md
  line 193-194) — this affects live-verification of Phase 56/57 backend work and will matter for
  Phase 63's visual layer, which builds on the Phase 56 ledger.
- 999.21 (pre-existing sidebar pointer-events E2E bug + a genui `artifacts.test.ts` hash-drift
  failure) and 999.22 (build:local vs dev-server `.next` corruption, now structurally closed per
  61-01) remain flagged as opportunistic-fix candidates for Phases 62/63 since they touch sidebar
  and genui-adjacent surfaces.
