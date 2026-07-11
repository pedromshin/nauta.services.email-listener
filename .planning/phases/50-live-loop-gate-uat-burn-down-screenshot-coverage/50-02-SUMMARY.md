---
phase: 50-live-loop-gate-uat-burn-down-screenshot-coverage
plan: 02
subsystem: testing
tags: [playwright, chat-canvas, react-flow, radix-tooltip, radix-popover, bedrock, chat_run_events, provenance-link, knowledge-graph]

# Dependency graph
requires:
  - phase: 49-03
    provides: "apps/web/e2e/helpers/seed-session.ts — seedAuthenticatedContext, reused unmodified"
  - phase: 50-01
    provides: "Confirmed the local stack (Supabase + FastAPI listener + Next.js dev server) is provable via seeded-session e2e specs"
provides:
  - "apps/web/e2e/uat-39-tool-round.spec.ts — DB-verified live tool-round + citation chip spec (39.1, 39.2)"
  - "apps/web/e2e/uat-41-knowledge-preview.spec.ts — DB/DOM-verified knowledge-preview canvas node spec (41.1-41.5)"
  - "apps/web/e2e/helpers/uat-chat-fixtures.ts — seedKnowledgeGraphFixture(client, userId), a reusable tier-diverse knowledge_nodes/edges fixture"
  - "A real production bug fix in chat-canvas.tsx (canvas-restore async-updater race) — any saved canvas layout with more than the default chat node was silently pruned back to just that node on every restore, before this fix"
  - "LIVE-05's chat-surface slice CLOSED — all 7 backlog UAT scenarios in 39/41-HUMAN-UAT.md now passed, none pending or silently parked (LIVE-05 itself also spans 43/45/47/48-HUMAN-UAT.md, closed by 50-03/50-04, rolled up by 50-05)"
affects: [50-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-driven settle-check (waitForNextRunSettled polling chat_runs.status via a NEW row id) replacing a UI-timing-based 'Stop generating' wait that missed a real but narrow client-side streaming-state window"
    - "Two-step mouse-leave (move away, then a tiny follow-up move) to reliably close a Radix Tooltip whose hoverable-content grace-area polygon is created by the SAME pointerleave event that would otherwise need to be evaluated against it"
    - "Re-select the conversation after page.reload() in any /chat e2e flow — selectedId lives in plain React state, not the URL or storage, so a reload always lands on the no-conversation-selected empty state"
    - "Scope DOM assertions to structurally-unambiguous selectors (direct-child combinators, distinguishing attribute values) when a component's icon children could plausibly share a class/tag with the assertion target (lucide icons embedding <line>/size-N classes inside a larger tree)"

key-files:
  created:
    - apps/web/e2e/uat-39-tool-round.spec.ts
    - apps/web/e2e/uat-41-knowledge-preview.spec.ts
    - apps/web/e2e/helpers/uat-chat-fixtures.ts
    - .planning/todos/pending/2026-07-11-chat-cost-ledger-null-user-id.md
  modified:
    - apps/web/src/app/chat/_canvas/chat-canvas.tsx
    - .planning/milestones/v1.6-phases/39-tool-round-ui-citation-chips/39-HUMAN-UAT.md
    - .planning/milestones/v1.6-phases/41-knowledge-preview-canvas-node/41-HUMAN-UAT.md

key-decisions:
  - "39.2's citation-chip scenario was closed via the HONEST seeding path (a real CONFIRMED email_components/extraction_records slice driving search_emails's real RRF(k=60) retrieval) rather than deferred to tracked-fix — the ~30min budget in the plan's decision rule was not exceeded"
  - "Found and fixed a genuine chat-canvas.tsx production bug (not a test-only issue) while root-causing why the knowledge-preview node never survived canvas restore: setNodes's functional updater is invoked asynchronously by React, but seededRef.current was flipped synchronously right after the setNodes(...) call in the same effect body, so the updater observed the already-flipped ref and fell back to an empty baseline. This affected EVERY conversation whose saved canvas layout has any node beyond the default chat node, not just this test's fixture — fixed by capturing the seed-state synchronously before either the setNodes call or the ref mutation"
  - "Filed (did not fix) a pre-existing, out-of-scope bug: chat_cost_ledger insert fails NOT NULL user_id on every server-locus chat turn — reproduced live during Task 1 but unrelated to the files this plan touches; per the deviation-rules scope boundary"
  - "Restarted a stale, long-running (many hours uptime) Next.js dev server holding port 3000 mid-investigation — it was not reflecting current file edits, which had made the knowledge-preview restore bug look unreproducible via direct code instrumentation until the restart"

requirements-completed: []  # LIVE-05 spans 39/41/43/45/47/48-HUMAN-UAT.md across plans 50-02/03/04; this plan closes only the 39+41 slice — the requirement itself is marked complete by 50-05's roll-up once every slice is closed.

# Metrics
duration: ~2h10m
completed: 2026-07-11
---

# Phase 50 Plan 02: Live-Loop UAT Burn-Down (Chat Surface) Summary

**Converted all 7 deferred Phase-39/41 chat-surface UAT scenarios into DB/DOM-verified live passes against the local stack, and found+fixed a real chat-canvas.tsx restore-race bug that was silently pruning any saved canvas node beyond the default chat node on every reload.**

## Performance

- **Duration:** ~2h 10m
- **Started:** 2026-07-11T04:44:00Z (approx, following 50-01)
- **Completed:** 2026-07-11T06:55:00Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified) + 1 todo filed

## Accomplishments
- Closed both Phase-39 scenarios (39.1 tool-round activity affordance, 39.2 citation chip deep-link) with a real Bedrock Sonnet 4.6 tool round against the live local stack, DB-verified via a `chat_run_events` `tool_call` row and a real CONFIRMED `email_components`/`extraction_records` slice driving `search_emails`'s RRF retrieval
- Closed all five Phase-41 knowledge-preview canvas node scenarios (tier-styled edges/dots, tooltip hover/dismiss, add-preview popover Cancel/Add/outside-click, viewport-center placement while panned, remove-then-reload DB persistence) against a real React Flow viewport and a tier-diverse `knowledge_nodes`/`knowledge_node_edges` fixture
- Root-caused and fixed a genuine production bug in `chat-canvas.tsx`: an async-updater/ref-mutation ordering race that silently dropped every restored canvas node beyond the default chat node on every page load whenever a saved layout had more than one node
- 41-HUMAN-UAT.md and 39-HUMAN-UAT.md both moved from `partial`/`pending` to `complete`, zero pending scenarios remain

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase-39 burn-down (39.1 + 39.2)** - `1abcac7` (feat)
2. **Task 2: Phase-41 burn-down (41.1-41.5) + chat-canvas.tsx restore-race fix** - `f0426bd` (feat)

**Plan metadata:** (this commit, following SUMMARY/STATE/ROADMAP updates)

_Note: both tasks were `tdd="true"` per plan frontmatter; each closes with a real passing e2e spec against the live local stack rather than a separate RED/GREEN cycle, since the target behavior already existed in production code — the "test" IS the live-stack verification the plan calls for._

## Files Created/Modified
- `apps/web/e2e/uat-39-tool-round.spec.ts` - Seeded-session spec: real Bedrock tool round -> DB-verified `chat_run_events` row -> collapsed result row -> citation chip deep-link assertion
- `apps/web/e2e/uat-41-knowledge-preview.spec.ts` - Seeded-session spec covering all 5 knowledge-preview node scenarios against a live React Flow viewport
- `apps/web/e2e/helpers/uat-chat-fixtures.ts` - `seedKnowledgeGraphFixture(client, userId)`: tier-diverse (EXTRACTED/INFERRED/AMBIGUOUS) `knowledge_nodes`/`knowledge_node_edges` fixture, `KNOWLEDGE_PREVIEW_NODE_ID` constant, `requireEnv`/`resolveImporterId` helpers
- `apps/web/src/app/chat/_canvas/chat-canvas.tsx` - **Bug fix**: captured `wasSeeded = seededRef.current` synchronously before `setNodes(...)` and the ref mutation, instead of reading the ref live inside the async functional updater
- `.planning/milestones/v1.6-phases/39-tool-round-ui-citation-chips/39-HUMAN-UAT.md` - status `partial` -> `complete`, both scenarios `passed` with evidence
- `.planning/milestones/v1.6-phases/41-knowledge-preview-canvas-node/41-HUMAN-UAT.md` - status `partial` -> `complete`, all 5 scenarios `passed` with evidence, deviations section documenting the chat-canvas.tsx fix
- `.planning/todos/pending/2026-07-11-chat-cost-ledger-null-user-id.md` - filed (not fixed): pre-existing `chat_cost_ledger` NOT NULL `user_id` violation on every server-locus chat turn

## Decisions Made
- Closed 39.2 via honest confirmed-data seeding rather than tracked-fix (within the plan's ~30min budget)
- Fixed the chat-canvas.tsx restore-race as a Rule 1 in-scope bug (directly blocks the knowledge-preview node — the exact surface this plan verifies — from ever surviving a restore) rather than working around it in the test
- Left the pre-existing `chat_cost_ledger` bug as a filed todo, not fixed, since it's unrelated to any file this plan touches (scope boundary)
- Restarted the stale dev server holding port 3000 once it became clear it wasn't reflecting on-disk edits, rather than continuing to debug against a stale bundle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] chat-canvas.tsx canvas-restore async-updater race**
- **Found during:** Task 2, while root-causing why the seeded `knowledge-preview` node never appeared in the DOM despite the server correctly returning it from `chat.getCanvasLayout`
- **Issue:** The reconcile `useEffect` mutated `seededRef.current = true` synchronously immediately after calling `setNodes(updaterFn)`. React invokes a functional `setNodes` updater asynchronously (deferred to the render phase), so by the time the updater actually ran, it observed the already-flipped `seededRef.current === true` and used `prev` (still `[]` on a fresh mount) as its baseline instead of `persistence.initialNodes` — silently dropping every restored node beyond the synthesized default chat node, on EVERY canvas restore where the saved layout had more than one node
- **Fix:** Captured `const wasSeeded = seededRef.current` synchronously, before either the `setNodes` call or the ref mutation, and used `wasSeeded` inside the updater instead of a live ref read
- **Files modified:** `apps/web/src/app/chat/_canvas/chat-canvas.tsx`
- **Verification:** 4 consecutive clean 5/5 serial test-suite runs post-fix; all 21 pre-existing `chat-canvas`/`use-canvas-persistence` unit tests still pass unmodified
- **Committed in:** `f0426bd` (Task 2 commit)

**2. [Rule 1 - Bug] Test-selector precision bugs in uat-41-knowledge-preview.spec.ts (test-file only)**
- **Found during:** Task 2, iterating the 41.1/41.3 assertions to green
- **Issue:** (a) an unscoped `svg line` locator also matched two lucide `Share2` icon `<line>` elements; (b) a "solid full-opacity edge" count assertion expected 2 when only 1 can ever match given 3 total edges; (c) an unscoped `.size-3` locator also matched the focus dot's own nested Share2 icon; (d) a pane-relative outside-click coordinate landed inside the toolbar's own top-right panel instead of the empty pane background
- **Fix:** Scoped the svg-line locator to `svg[width="280"] > line`; corrected the edge-count assertion to 1; scoped the dot-size locator to `a > span.size-N`; computed the outside-click coordinate from the pane's live bounding box (bottom-center)
- **Files modified:** `apps/web/e2e/uat-41-knowledge-preview.spec.ts`
- **Verification:** 41.1 and 41.3 pass consistently across all subsequent runs
- **Committed in:** `f0426bd` (Task 2 commit)

**3. [Rule 1 - Bug] Radix Tooltip mouse-leave dismissal needed a two-step pointer move (test-file only)**
- **Found during:** Task 2, test 41.2
- **Issue:** A single synthetic `page.mouse.move()` away from a hovered dot never closed the tooltip, even after an 8s wait. Root-caused via `@radix-ui/react-tooltip`'s source: `TooltipContentHoverable`'s hoverable-content grace-area polygon is created ON the trigger's `pointerleave` event, then only evaluated ("did the pointer leave the polygon") on a SUBSEQUENT `pointermove` — the one synthetic move that CAUSES the pointerleave arrives too late to also trigger its own polygon evaluation
- **Fix:** Added a second, tiny follow-up `mouse.move()` immediately after the first, supplying the extra `pointermove` the grace-area check needs to actually close
- **Files modified:** `apps/web/e2e/uat-41-knowledge-preview.spec.ts`
- **Verification:** 41.2 passes consistently across all subsequent runs; this is a real, reusable Radix Tooltip automation pattern, not a product bug (real hardware mouse movement generates many intermediate events that a single synthetic jump does not)
- **Committed in:** `f0426bd` (Task 2 commit)

**4. [Rule 1 - Bug] 41.5's page.reload() assumption (test-file only)**
- **Found during:** Task 2, test 41.5
- **Issue:** The test assumed a plain `page.reload()` alone would land back on the same conversation's canvas view. `page.tsx`'s `selectedId` is plain in-memory React state (`useState<string | null>(null)`), not URL- or storage-backed, so any reload always lands on the no-conversation-selected empty state — only the Chat/Canvas *view mode* itself is localStorage-persisted per-conversation
- **Fix:** Re-select the conversation by its title after `page.reload()`, mirroring `openCanvasView`'s own selection step
- **Files modified:** `apps/web/e2e/uat-41-knowledge-preview.spec.ts`
- **Verification:** 41.5 passes consistently across all subsequent runs
- **Committed in:** `f0426bd` (Task 2 commit)

**5. [Rule 1 - Bug] uat-39-tool-round.spec.ts UI-timing settle-check replaced with DB-driven polling (documented in prior session, carried into this summary for completeness)**
- **Found during:** Task 1
- **Issue:** A "Stop generating" UI-timing-based wait never reliably caught the transient streaming state even when the turn genuinely completed successfully end-to-end
- **Fix:** Replaced with `waitForNextRunSettled(dbClient, conversationId, priorRunId)`, polling `chat_runs.status` until a NEW run row (id differs from the prior run) leaves `running`
- **Files modified:** `apps/web/e2e/uat-39-tool-round.spec.ts`
- **Verification:** Passed 2/2 consecutive live runs at the time, reconfirmed passing again in this session's final full re-run
- **Committed in:** `1abcac7` (Task 1 commit)

---

**Total deviations:** 5 auto-fixed (1 production bug fix, 4 test-authoring/automation-precision fixes)
**Impact on plan:** The chat-canvas.tsx fix is the significant one — it corrects real, previously-unnoticed data loss on canvas restore, directly in the surface (`knowledge-preview` node persistence) this plan exists to verify. All other fixes are test-file-only precision corrections. No scope creep — nothing outside the plan's 2 files/tasks was touched except the one in-scope production bug and the pre-existing unrelated `chat_cost_ledger` issue, which was filed as a todo rather than fixed.

## Issues Encountered
- A long-running (many hours uptime), stale Next.js dev server on port 3000 was not reflecting on-disk edits during part of the investigation, making the knowledge-preview restore bug appear unreproducible via direct code instrumentation (added `console.log` statements never fired). Restarting the dev server resolved this and confirmed the bug was real, not a debugging artifact.
- Diagnosing the restore-race required direct inspection of network request/response payloads (`chat.getCanvasLayout` returning 2 nodes correctly, `chat.saveCanvasLayout` immediately re-saving only 1) and reading `use-canvas-persistence.ts`/`chat-canvas.tsx` source with targeted instrumentation, since the bug was a subtle React scheduling-order issue, not a data or query bug.

## User Setup Required

None - no external service configuration required. All scenarios ran against the local stack (Supabase local + FastAPI listener + Next.js dev server), no hosted target was ever addressed (T-50-04 mitigated).

## Next Phase Readiness
- LIVE-05's chat-surface slice is fully closed: all 7 backlog UAT scenarios (39×2 + 41×5) have a DB/DOM-verified `passed` disposition, feeding directly into 50-05's `50-UAT-BURNDOWN.md` roll-up. LIVE-05 itself stays Pending until 50-03 (43/45) and 50-04 (47/48) close their slices too.
- The `chat-canvas.tsx` restore-race fix benefits every future canvas-node type (not just `knowledge-preview`) and should be considered a foundational correctness fix for any subsequent canvas work
- `.planning/todos/pending/2026-07-11-chat-cost-ledger-null-user-id.md` remains open for a future plan to pick up (cost tracking is silently broken on every server-locus chat turn, unrelated to this plan's scope)

---
*Phase: 50-live-loop-gate-uat-burn-down-screenshot-coverage*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 8 claimed files verified present on disk; both task commit hashes (`1abcac7`, `f0426bd`) verified present in git history.
