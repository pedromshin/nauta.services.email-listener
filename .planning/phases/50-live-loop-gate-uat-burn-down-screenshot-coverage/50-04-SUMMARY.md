---
phase: 50-live-loop-gate-uat-burn-down-screenshot-coverage
plan: 04
subsystem: testing
tags: [playwright, css-tokens, dtcg, xyflow, supabase-ssr, e2e]

# Dependency graph
requires:
  - phase: 50-01
    provides: "Authenticated screenshot-harness run .planning/ui-reviews/2026-07-11T04-32-30-989Z/ — the real pixel evidence cited by both UAT files this plan closes"
  - phase: 50-02
    provides: "uat-chat-fixtures.ts's seedKnowledgeGraphFixture (tier-diverse EXTRACTED/INFERRED/AMBIGUOUS knowledge graph) and resolveImporterId — reused unmodified for 48.2"
provides:
  - "apps/web/e2e/uat-48-token-surfaces.spec.ts — CSS/DOM-verified proof (getComputedStyle) that the Phase-48 token extensions (radius.pill, color.success/destructive, color.tier.*, color.graph.*) actually resolve on live rendered elements"
  - "47-HUMAN-UAT.md and 48-HUMAN-UAT.md CLOSED — zero [pending] scenarios remain in either file"
  - "49-HUMAN-UAT.md item 6 / MORNING-CHECKLIST.md §E.3 — a real destination for the 47.1 subjective brand-fit sign-off, not a claim of routing with nowhere to land"
affects: [50-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-seeded persisted message parts as a live-LLM substitute for CSS-only UAT assertions: chat_messages.parts is replayed verbatim by chat.getHistory (D-18/FOUND-1), so inserting a tool_invocation_result part directly renders the SAME real ProvenanceLink chip a live Bedrock tool round would have produced, without paying for the live round when the tool-round mechanism itself was already proven live elsewhere (50-02's uat-39 spec)"
    - "React Flow edge/node targeting for CSS assertions: `.react-flow__node[data-id=\"...\"]` for nodes (established by uat-41), `[data-testid=\"rf__edge-{id}\"] path.react-flow__edge-path` for edges (new this plan) — both read via getComputedStyle rather than DOM attribute/class matching so a token regression that keeps the class name but breaks the resolved value is still caught"

key-files:
  created:
    - apps/web/e2e/uat-48-token-surfaces.spec.ts
  modified:
    - .planning/milestones/v1.8-phases/48-token-system-extensions/48-HUMAN-UAT.md
    - .planning/milestones/v1.8-phases/47-brand-foundation-verification-tooling/47-HUMAN-UAT.md
    - .planning/phases/49-live-loop-gate-deploy-oauth-real-email/49-HUMAN-UAT.md
    - .planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md

key-decisions:
  - "48.1's /chat citation-chip slice is DB-seeded (a chat_messages row with a real tool_invocation_result part), not driven through a live Bedrock tool round. ProvenanceLink is consumed in exactly ONE place in this codebase (tool-invocation-result-row.tsx) — there is no second '/emails/[id] citation surface' or 'knowledge deep-link chip' instance to fall back to per the plan's literal wording, and the tool-round mechanism itself (chip renders, correct href/icon) was already proven live in 50-02 (39.2). This is a deterministic-fixture choice within 50-CONTEXT.md's explicit 'Claude's Discretion' grant, not a tracked-fix — annotated inline in the spec and via a test.info() annotation."
  - "48.2's tier-edge assertion reuses 50-02's seedKnowledgeGraphFixture unmodified rather than adding a new fixture helper — the exact same EXTRACTED/INFERRED/AMBIGUOUS knowledge graph uat-41 already seeds satisfies 48.2's needs, and DB-querying the actual knowledge_node_edges row ids after seeding (rather than exporting new constants from uat-chat-fixtures.ts) kept the change surface to zero on a file another passing spec depends on."
  - "The 47.1 brand-mark scenario is dispositioned evidence-captured -> moved-to-morning-checklist, never passed (no human has judged it) and never left [pending] (would silently park it against the standing 'never deferrable-by-default' rule). Added item 6 to 49-HUMAN-UAT.md and Section E.3 to MORNING-CHECKLIST.md — outside this plan's declared file list, but necessary so the routing claim has a real destination (Rule 2: the plan's own acceptance bar for 47-HUMAN-UAT.md requires 'moved-to-morning-checklist' to mean something)."

requirements-completed: [LIVE-05]

# Metrics
duration: ~50min
completed: 2026-07-11
---

# Phase 50 Plan 04: Token-Surface UAT Burn-down (Phase 47/48) Summary

**New Playwright spec (`uat-48-token-surfaces.spec.ts`) proves via `getComputedStyle` that the ProvenanceLink chip resolves the pill radius token (9999px), confirm/deny controls resolve distinct success/destructive colors, and EXTRACTED vs INFERRED knowledge-graph edges resolve visibly distinct stroke/dasharray — closing both Phase-48 UAT scenarios as `passed` and routing Phase-47's inherently subjective brand-mark sign-off to a real morning-checklist destination instead of leaving it `[pending]`.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-07-11T09:50:00Z (approx)
- **Completed:** 2026-07-11T10:42:45Z
- **Tasks:** 2 completed
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `apps/web/e2e/uat-48-token-surfaces.spec.ts` (394 lines, 2 tests) closes both Phase-48 scenarios against the LOCAL live stack via a seeded session:
  - **48.1**: DB-seeds a real settled chat turn carrying a `tool_invocation_result` part with a citation (replayed verbatim by `chat.getHistory`, D-18) so the SAME real `ProvenanceLink` component renders on `/chat`; `getComputedStyle(chip).borderRadius` resolves to exactly `9999px` (the `radius.pill` token, not a class-name check). Then seeds a real unconfirmed FIELD candidate (entity type + field + email + region components + extraction record) on `/emails/[id]`, clicks the entity row to auto-expand it (D-10 active-parent arming), and proves the CONFIRM and DENY buttons resolve two distinct, non-transparent computed `background-color` values (success vs destructive tokens).
  - **48.2**: Reuses 50-02's `seedKnowledgeGraphFixture` (tier-diverse EXTRACTED/INFERRED/AMBIGUOUS knowledge graph) unmodified, checks the "Knowledge Rules" filter-rail row to reveal the fixture's `knowledge_node` nodes and `kne-*` edges, then proves the EXTRACTED and INFERRED tier edges resolve BOTH a distinct `stroke` color AND a distinct `stroke-dasharray` (solid tier-extracted vs dashed tier-inferred). Also proves the filter rail's "Instances"/"Emails"/"Components" dots (the closed `graph.entity`/`graph.email`/`graph.emailComponent` palette) resolve 3 visually distinct colors.
  - Both tests passed live on chromium on the first run — zero fixes needed, zero flakiness observed.
- `48-HUMAN-UAT.md`: both scenarios moved from `[pending]` to `passed`, each citing the new spec's live assertions plus real authenticated pixel evidence from 50-01's screenshot-harness run (`.planning/ui-reviews/2026-07-11T04-32-30-989Z/{chat,emails,knowledge}-desktop.png`) — replacing the old textual-only before/after `index.md` pointers. Summary counts updated (passed: 2, pending: 0), `status: complete`.
- `47-HUMAN-UAT.md`: the brand-mark scenario (47.1) set to `evidence-captured (real login-desktop.png) -> moved-to-morning-checklist` — deliberately neither `passed` (no human sign-off yet) nor `[pending]` (would silently park it). `status: evidence-captured`.
- Gave the routing claim a real destination: added item 6 to `49-HUMAN-UAT.md` and a copy-paste-ready Section E.3 to `MORNING-CHECKLIST.md` (one-glance visual judgment call, no setup needed) — both outside this plan's declared file list but required so "routed to the morning checklist" means something concrete, not just a claim.

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase-48 burn-down spec — chip pill + success-green (48.1) and graph palette + tier strokes (48.2)** - `cf7e7eb` (feat)
2. **Task 2: Record 48 + 47 dispositions against the real 50-01 captures; route 47.1 aesthetic sign-off to morning** - `d9446cd` (docs)

**Plan metadata:** (this commit)

_Note: plan frontmatter marks `tdd="true"`, but per this exact phase's established precedent (50-01/02/03, all single `feat` commits despite the same flag), these UAT-burn-down specs verify ALREADY-SHIPPED Phase-48 token behavior — there is no new application feature to RED/GREEN against. The spec passed live on its first run; no separate test-then-feat cycle applied._

## Files Created/Modified

- `apps/web/e2e/uat-48-token-surfaces.spec.ts` - New: 2 tests, CSS/DOM-verified proof of the pill radius, success/destructive colors, and tier-ladder/graph-palette tokens on live rendered elements
- `.planning/milestones/v1.8-phases/48-token-system-extensions/48-HUMAN-UAT.md` - Both scenarios `passed`, real pixel evidence cited, zero `[pending]`
- `.planning/milestones/v1.8-phases/47-brand-foundation-verification-tooling/47-HUMAN-UAT.md` - `evidence-captured -> moved-to-morning-checklist` disposition, zero `[pending]`
- `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/49-HUMAN-UAT.md` - Added item 6 (brand-mark sign-off) so 47.1's routing has a destination
- `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md` - Added Section E.3 (one-glance sign-off, no setup)

## Decisions Made

See `key-decisions` in frontmatter for full rationale. Summary:
- DB-seeded (not live-LLM-driven) `/chat` citation chip for 48.1 — the tool-round mechanism was already proven live in 50-02; this plan only needed the chip's resolved CSS.
- Reused 50-02's knowledge-graph fixture unmodified for 48.2 rather than adding new fixture surface.
- Added a real morning-checklist destination (49-HUMAN-UAT.md item 6 + MORNING-CHECKLIST.md §E.3) for 47.1's routing claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Gave the 47.1 "moved-to-morning-checklist" disposition a real destination**
- **Found during:** Task 2
- **Issue:** The plan's acceptance criteria for `47-HUMAN-UAT.md` requires the brand-mark scenario be dispositioned `evidence-captured ... moved-to-morning-checklist`, but the plan's declared file list only covers the two `*-HUMAN-UAT.md` files being updated — leaving the routing claim with nowhere to actually land would repeat exactly the "silently parked" failure mode the standing rule (deploy/OAuth/live-UAT gates never deferrable-by-default) exists to prevent.
- **Fix:** Appended item 6 to `49-HUMAN-UAT.md` (the file 50-03 already established as the real destination for other Phase-49-morning-checklist-routed scenarios, e.g. 43.1/45.5/45.6) and a corresponding copy-paste-ready Section E.3 to `MORNING-CHECKLIST.md`.
- **Files modified:** `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/49-HUMAN-UAT.md`, `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md`
- **Verification:** Both files updated with consistent cross-references (47-HUMAN-UAT.md -> 49-HUMAN-UAT.md item 6 -> MORNING-CHECKLIST.md §E.3); manually reviewed for consistency.
- **Committed in:** `d9446cd` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary to make the plan's own acceptance bar for 47-HUMAN-UAT.md meaningful — no scope creep beyond the plan's stated intent ("subjective brand sign-off items route to the morning checklist per the plan... never silently parked").

## Issues Encountered

None — both spec tests passed live on the first run against the local stack (no auto-fixes to application code were needed; Phase 48's token implementation held up correctly under live DOM/CSS verification).

## User Setup Required

None for this plan directly. The routed 47.1 brand-mark sign-off (Section E.3) is a lightweight addition to the ALREADY user-gated Phase 49 morning checklist — no new external service configuration.

## Next Phase Readiness

- LIVE-05's Phase 47/48 slice is CLOSED — both `*-HUMAN-UAT.md` files have zero `[pending]` scenarios, each disposition backed by either live CSS/DOM assertions + real pixels (48.1, 48.2) or a real evidence pointer + an explicit, non-silent routing (47.1).
- Combined with 50-02 (Phase 39/41) and 50-03 (Phase 43/45), all six deferred-UAT source files (39/41/43/45/47/48) now have zero silently-parked scenarios — ready for 50-05's roll-up into `50-UAT-BURNDOWN.md`, which should close the LIVE-05 requirement overall.
- The `.react-flow__edge` targeting pattern (`[data-testid="rf__edge-{id}"] path.react-flow__edge-path`) established this plan is reusable for any future React-Flow edge-style assertion — the node-targeting equivalent (`.react-flow__node[data-id="..."]`) was already established by uat-41.

---
*Phase: 50-live-loop-gate-uat-burn-down-screenshot-coverage*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: apps/web/e2e/uat-48-token-surfaces.spec.ts
- FOUND: .planning/milestones/v1.8-phases/48-token-system-extensions/48-HUMAN-UAT.md
- FOUND: .planning/milestones/v1.8-phases/47-brand-foundation-verification-tooling/47-HUMAN-UAT.md
- FOUND: .planning/phases/49-live-loop-gate-deploy-oauth-real-email/49-HUMAN-UAT.md
- FOUND: .planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md
- FOUND: cf7e7eb (Task 1 commit)
- FOUND: d9446cd (Task 2 commit)
