---
phase: 52-editable-genui-panels-studio-on-canvas
plan: 04
subsystem: ui
tags: [react, trpc, genui, canvas, versioning, tdd]

# Dependency graph
requires:
  - phase: 52-02
    provides: PanelActionsToolbar/PanelActionControlProps contract, RegenerateControl/VersionHistoryControl interface-first skeletons, usePanelOverlay/appendVersion wiring
  - phase: 52-01
    provides: panel-overlay.ts (appendVersion/restoreVersion/listPriorVersions, supersede-never-mutate version chain)
provides:
  - apps/web/.../format-relative-time.ts — shared formatRelativeTime util (studio history-island vocabulary, extracted verbatim)
  - apps/web/.../controls/regenerate-control.tsx — one-click Regenerate (52-UI-SPEC Component 3), replacing Plan 52-02's inert skeleton
  - apps/web/.../controls/version-history-control.tsx — Version History popover + Restore (52-UI-SPEC Component 4), replacing Plan 52-02's inert skeleton
affects: [52-06-nl-retheme-client, panel-toolbar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derive-fresh-in-render over set-then-refetch: RegenerateControl computes its dynamic `intent` via useMemo from already-available historyRows on every render, then feeds it straight into api.genui.generate.useQuery(..., {enabled:false}) — avoids the same-tick stale-closure race a setState-then-immediately-refetch pattern would hit (see generation-sandbox-island.tsx's queryPackId note, deliberately NOT replicated here)"
    - "Persist-failure surrogate reused verbatim: VersionHistoryControl's Restore failure path mirrors pack-switcher.tsx's exact test seam (writeOverlay/scheduleSave throwing synchronously simulates a persist failure) rather than inventing a second convention"

key-files:
  created:
    - apps/web/src/app/chat/_canvas/format-relative-time.ts
    - apps/web/src/app/chat/_canvas/__tests__/format-relative-time.test.ts
    - apps/web/src/app/chat/_canvas/__tests__/regenerate-control.test.tsx
    - apps/web/src/app/chat/_canvas/__tests__/version-history-control.test.tsx
  modified:
    - apps/web/src/app/chat/_canvas/controls/regenerate-control.tsx
    - apps/web/src/app/chat/_canvas/controls/version-history-control.tsx
    - apps/web/src/app/chat/_canvas/__tests__/genui-panel-node-toolbar.test.tsx

key-decisions:
  - "appendVersion's real AppendVersionInput type has no parentVersionId field (appendVersion computes it internally from the overlay's own prior activeVersionId) — the plan's literal example call included one anyway; the actual call omits it, matching the established edit-params-control.tsx precedent and the type's real shape, not the plan's illustrative snippet"
  - "Regenerate's appendVersion call explicitly threads stylePackId: resolvedPackId into the new version — omitting it would have silently dropped the panel back to DEFAULT_PACK_ID on every regenerate (resolveActivePanel resolves a STORED version's own stylePackId, never the spec's embedded style_pack_id, once that version is active)"
  - "history-island.tsx was NOT refactored to import the new shared formatRelativeTime (Claude's discretion per the plan) — kept the diff minimal and out-of-scope-file-free; the two implementations are byte-identical and both covered by tests, so no drift risk"
  - "VersionHistoryControl does not call onBusyChange during a restore — 52-UI-SPEC.md's Interactive-State Contract table only specifies in-popover row locking for Restore (every other row's button disabled), unlike Regenerate's explicit 'toolbar disabled except this button' — followed the table literally rather than over-locking"

requirements-completed: [PANL-03]

# Metrics
duration: ~20min
completed: 2026-07-11
---

# Phase 52 Plan 04: Regenerate + Version History (PANL-03) Summary

**One-click Regenerate that appends a provenance-tagged variant in place via the existing genui.generate transport, plus a Version History popover whose Restore action supersedes-never-mutates through the Plan 52-01 version chain — both replacing Plan 52-02's inert toolbar skeletons.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-11T23:14:00-03:00 (approx, first context read)
- **Completed:** 2026-07-11T23:31:18-03:00
- **Tasks:** 2 completed
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- `formatRelativeTime` — extracted verbatim from `history-island.tsx` into a shared canvas util (`format-relative-time.ts`), matching the studio's exact vocabulary ("just now" / "{n} minute(s) ago" / "{n} hour(s) ago" / "{n} day(s) ago") so the canvas Version History popover never invents a second relative-time convention
- `RegenerateControl` — one-click regenerate (no popover, no confirmation): derives the intent from the nearest preceding user message in `chat.getHistory` relative to the panel's own `provenance.messageId` (falling back to a documented constant directive when none exists), calls the SAME `genui.generate` transport `generation-sandbox-island.tsx` uses, and on a non-fallback outcome appends a `regenerate` version (with the resolved pack captured) via `appendVersion` — supersede-never-mutate. Icon `motion-safe:animate-spin` + `aria-label="Regenerating panel"` while in flight; a fallback/no-data outcome fires the exact `toast.error` copy with Retry and leaves the current version untouched
- `VersionHistoryControl` — the History popover (Component 4): a permanent "Current" row, then `listPriorVersions(overlay)` newest-first with a per-provenance icon+verb (Regenerated/Re-themed/Edited) and relative time, or the exact empty-state copy when no prior version exists. Restore appends a clone of the target version via `restoreVersion` (nothing is ever deleted/rewritten), closes the popover, and shows the success toast; the persist-failure surrogate path (mirroring `pack-switcher.tsx`'s established throwing-`scheduleSave` test seam) fires the error toast + Retry and keeps the popover open
- Extended `genui-panel-node-toolbar.test.tsx`'s `~/trpc/react` mock with inert `chat.getHistory`/`genui.generate` stubs — `RegenerateControl` now mounts for real inside the toolbar that suite renders (the exact same deviation shape 52-03-SUMMARY.md documented for `applyPanelEdit`)

## Task Commits

Each task was committed atomically (Task 1 is TDD-flavored — util test written and passing before the control's own test suite):

1. **Task 1: Shared formatRelativeTime util + Regenerate control**
   - `5c6ea63` feat: shared formatRelativeTime util + Regenerate control (PANL-03)
2. **Task 2: Version History popover + Restore (version-history-control.tsx)**
   - `ed71d0f` feat: Version History popover with Restore (PANL-03)

**Plan metadata:** (this commit) docs: complete plan

## Files Created/Modified
- `apps/web/src/app/chat/_canvas/format-relative-time.ts` - shared `formatRelativeTime` (studio vocabulary, verbatim)
- `apps/web/src/app/chat/_canvas/__tests__/format-relative-time.test.ts` - 6 tests: the four vocabulary branches + pluralization + degrade-on-unparsable
- `apps/web/src/app/chat/_canvas/controls/regenerate-control.tsx` - `RegenerateControl` + exported `deriveIntent` pure helper
- `apps/web/src/app/chat/_canvas/__tests__/regenerate-control.test.tsx` - 7 tests: `deriveIntent` (3), successful regenerate appends version + generating signal + no toast, fallback outcome error toast, no-data error toast, isLocked disabling
- `apps/web/src/app/chat/_canvas/controls/version-history-control.tsx` - `VersionHistoryControl`: History popover + Restore
- `apps/web/src/app/chat/_canvas/__tests__/version-history-control.test.tsx` - 5 tests: empty state, two prior versions render with correct verbs, restore appends+closes+success-toast, persist-failure error-toast+stays-open, isLocked disabling
- `apps/web/src/app/chat/_canvas/__tests__/genui-panel-node-toolbar.test.tsx` - extended `~/trpc/react` mock (Rule 1 fix, see below)

## Decisions Made
See `key-decisions` in frontmatter above (the `appendVersion`/`parentVersionId` call-shape correction, threading `stylePackId` into the regenerated version, not refactoring `history-island.tsx`, and Restore's deliberate non-use of `onBusyChange`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Regenerate's `appendVersion` call corrected to match the real `AppendVersionInput` type**
- **Found during:** Task 1
- **Issue:** The plan's `<behavior>` text illustrates the success call as `appendVersion(overlay, { generatedBy: "regenerate", specJson: ..., parentVersionId: overlay?.activeVersionId ?? null })`. `AppendVersionInput` (panel-overlay.ts) has no `parentVersionId` field — `appendVersion` computes it internally from the overlay's own prior `activeVersionId`. Passing it literally would fail TypeScript's excess-property check on an object literal.
- **Fix:** Omitted `parentVersionId` from the call; `appendVersion`'s own internal computation already produces the exact same value the plan's text describes, matching the established call shape `edit-params-control.tsx` already uses.
- **Files modified:** apps/web/src/app/chat/_canvas/controls/regenerate-control.tsx
- **Verification:** `npm run typecheck -w @polytoken/web` clean; `regenerate-control.test.tsx` asserts the appended version's `parentVersionId` behavior indirectly via `panel-overlay.ts`'s own already-tested `appendVersion` unit coverage (52-01).
- **Committed in:** `5c6ea63`

**2. [Rule 2 - Missing Critical] Regenerate's new version now threads `stylePackId: resolvedPackId`**
- **Found during:** Task 1
- **Issue:** `resolveActivePanel` resolves an ACTIVE version's pack from that version's OWN `stylePackId` field (never the spec's embedded `style_pack_id`) once `overlay.stylePackId` is cleared — which `appendVersion` always does. Without explicitly setting `stylePackId` on the new `regenerate` version, a successful regenerate would have silently reset the panel to `DEFAULT_PACK_ID`, discarding any prior pack choice (PANL-01) the user had made.
- **Fix:** `appendVersion(overlay, { generatedBy: "regenerate", specJson: ..., stylePackId: resolvedPackId })` — captures the pack the generate call itself used.
- **Files modified:** apps/web/src/app/chat/_canvas/controls/regenerate-control.tsx
- **Verification:** `regenerate-control.test.tsx`'s success test asserts `versions[0]?.stylePackId === "polytoken-teal"`.
- **Committed in:** `5c6ea63`

**3. [Rule 1 - Bug] `genui-panel-node-toolbar.test.tsx`'s `~/trpc/react` mock only stubbed `useQueries` + `genui.applyPanelEdit`**
- **Found during:** Task 1 (`npm run test -w @polytoken/web -- _canvas --run` regression pass)
- **Issue:** That suite mounts the REAL `GenuiPanelNode`, which now mounts the REAL `RegenerateControl` (no longer an inert skeleton). The missing `api.chat.getHistory`/`api.genui.generate` mock stubs threw `Cannot read properties of undefined (reading 'getHistory')`, breaking 2/3 tests in that file — the exact same failure shape 52-03-SUMMARY.md documented for `applyPanelEdit`.
- **Fix:** Extended the mock with inert `chat.getHistory.useQuery` (`{ data: [] }`) and `genui.generate.useQuery` (`{ refetch: () => Promise.resolve({ data: undefined }) }`) stubs — this suite only exercises toolbar/theming wiring, not the regenerate flow itself (covered by `regenerate-control.test.tsx`).
- **Files modified:** apps/web/src/app/chat/_canvas/__tests__/genui-panel-node-toolbar.test.tsx
- **Verification:** Full `_canvas` suite green (23 files / 188 tests, including this file's 3/3).
- **Committed in:** `5c6ea63`

**4. [Rule 1 - Bug] `VERB_ICONS` record typed against a hand-rolled icon prop shape instead of lucide-react's own `LucideIcon`**
- **Found during:** Task 2 (`npm run typecheck -w @polytoken/web`)
- **Issue:** `RotateCw`/`Wand2`/`SlidersHorizontal` are `ForwardRefExoticComponent<LucideProps>` — `LucideProps["aria-hidden"]` is typed `Booleanish` (accepts `"true"`/`"false"` strings too), which is NOT assignable to a hand-rolled `{ "aria-hidden"?: boolean }` prop shape. Three `TS2322` errors.
- **Fix:** Imported `type LucideIcon` from `lucide-react` and typed `VERB_ICONS` as `Readonly<Record<PanelVersionVerb, LucideIcon>>` instead of a hand-rolled component-type record.
- **Files modified:** apps/web/src/app/chat/_canvas/controls/version-history-control.tsx
- **Verification:** `npm run typecheck -w @polytoken/web` clean outside the pre-existing `app/dev/design` exclusion (`grep "error TS" | grep -v "app/dev/design"` returns nothing).
- **Committed in:** `ed71d0f`

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bug, 1 Rule 2 missing-critical, 1 Rule 1 bug/type)
**Impact on plan:** All four were necessary for the plan's own tasks to typecheck, pass their own tests, or preserve PANL-01's pack-persistence guarantee across a regenerate. None change the plan's must-haves, artifacts, or key-links.

## Issues Encountered
- Confirmed via `history.ts` (the `chat.getHistory` procedure) that rows are ordered `turnIndex ASC, version ASC` server-side — `deriveIntent` relies on this exact ordering to walk backward from the assistant row for "the nearest preceding user message," so no client-side re-sort was needed.
- Confirmed `listPriorVersions` never returns an entry representing the base/original spec (it only filters `overlay.versions`, which never stores the base spec itself) — so `52-UI-SPEC.md`'s `INITIAL_VERSION_SENTINEL`/"Generated" row is defensively wired (`VersionIcon`/`verbFor` both fall back to `PanelsTopLeft`/"Generated") but not independently reachable through today's version-chain data model; documented rather than force-fit into a test that can't actually construct that state.
- `Badge`/`Button`/`Popover`/`ScrollArea`/`Tooltip` primitives all already existed in `@polytoken/ui` — zero new vendored components, zero registry-safety gate triggered (matches 52-UI-SPEC.md's "Registry Safety" section).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PANL-03 is now genuinely complete end-to-end: one-click regenerate with correct busy/error signalling, and a non-destructive, append-only Restore flow.
- Plan 52-06 (NL Re-theme client) can proceed independently — it consumes the same already-stable `PanelActionControlProps`/`usePanelOverlay`/`appendVersion` contracts this plan also used, and never touches `regenerate-control.tsx`/`version-history-control.tsx`.
- Live-canvas confirmation (a real regenerate round-trip against FastAPI with a visible content swap, and a real restore) is AUTHORED-BUT-NOT-RUN — Docker/FastAPI was down this session (52-CONTEXT.md's environment-constrained posture, same as Plans 52-01/52-02/52-03/52-05). The version-chain mechanics themselves (supersede-never-mutate, provenance fields, restore) are FULLY tested with mocks per this session's `<overnight_mode>` instruction. Queued to `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md` §G's existing standing catch-all ("Any Phase 52–54 items marked 'queued to §G' in their SUMMARYs follow the same pattern") — no separate edit needed to that file, matching 52-02/52-03's identical precedent.
- No blockers.

---
*Phase: 52-editable-genui-panels-studio-on-canvas*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 7 files created/modified confirmed present on disk (plus this SUMMARY.md); both task
commit hashes (`5c6ea63`, `ed71d0f`) confirmed present in `git log`.
