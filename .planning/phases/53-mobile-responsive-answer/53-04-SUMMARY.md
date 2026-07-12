---
phase: 53-mobile-responsive-answer
plan: 04
subsystem: ui
tags: [react, nextjs, tailwind, radix-dialog, sheet, email-detail, responsive]

# Dependency graph
requires:
  - phase: 53-mobile-responsive-answer
    provides: "53-03's CSS-dual-tree / Sheet-collapse mobile pattern precedent (desktop persistent `hidden md:flex`/`md:block` vs. mobile `md:hidden` triggered overlay) and its documented vitest React-import gotcha, both reused verbatim here"
provides:
  - "CanvasShell's LAYERS/INSPECTOR/SUMMARY panels Sheet-collapsed below md — same slot nodes render inside a left/right Sheet instead of a persistent flex sibling; CANVAS is the sole persistent w-full flex-1 zone on mobile"
  - "CanvasToolbar's two new OPTIONAL onOpenLayers/onOpenInspector props + md:hidden size-11 Layers/PanelRight trigger buttons, following the existing Tooltip icon-button idiom"
  - "Sheet-open-reveals-slot-content DOM assertion pattern (query document.body for Radix's portaled [role=\"dialog\"] before/after a trigger click) — reusable for any future test proving a Sheet-collapse actually opens the right content, not just that a hidden persistent copy exists somewhere in the tree"
affects: [49-live-loop-gate-deploy-oauth-real-email]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sheet-collapse of desktop-persistent flex-sibling panels below md (Sheet/SheetContent/SheetTrigger from @polytoken/ui/sheet, side=\"left\"/\"right\" matching the panel's desktop position) — same pattern 53-UI-SPEC's Judgment Calls #3/#5 already established, extended here to CanvasShell's LAYERS/INSPECTOR/SUMMARY per Judgment Call #7"
    - "Explicit `import * as React from \"react\"` required in every component file a vitest suite mounts directly — canvas-shell.tsx and canvas-toolbar.tsx are the FIRST vitest suite to mount them; same documented gotcha 53-03/genui-panel-node.tsx already carry"
    - "SheetContent gets an explicit md:hidden className override (in addition to its trigger being md:hidden) — belt-and-suspenders so a Sheet left open across a resize past md still visually collapses, and gives the file a literal `md:hidden` substring for the artifact contains-check"

key-files:
  created:
    - apps/web/src/app/emails/[id]/_components/__tests__/canvas-shell-mobile.test.tsx
  modified:
    - apps/web/src/app/emails/[id]/_components/canvas-shell.tsx
    - apps/web/src/app/emails/[id]/_components/canvas-toolbar.tsx

key-decisions:
  - "Right-group ml-auto moved from the Close button itself onto a new wrapping div containing [Layers trigger?, Inspector trigger?, Close] — avoids conditionally deciding which element carries ml-auto depending on whether the two new optional props are provided; behavior-preserving when both are omitted (Close is the sole child, wrapper's ml-auto reproduces the prior single-element ml-auto exactly)"
  - "Inspector Sheet renders BOTH inspector and summary slot nodes stacked inside one SheetContent (matching the desktop layout's Inspector-then-Summary reading order) rather than a third Sheet — summary is optional and shares the Inspector trigger/side per 53-UI-SPEC §5's 'INSPECTOR and SUMMARY when present' framing"
  - "SheetTitle rendered sr-only in both mobile Sheets (mirrors AppSidebar's own mobile-Sheet convention in sidebar.tsx) — Radix Dialog.Content requires an accessible title; this avoids an a11y console warning without adding any visible new copy"

requirements-completed: [MOBL-02]  # MOBL-02 spanned 53-02/53-03/53-04; this is the last contributing plan.

# Metrics
duration: ~20min
completed: 2026-07-12
---

# Phase 53 Plan 04: Email-detail CanvasShell Sheet-collapse below md Summary

**`CanvasShell`'s LAYERS (w-64) and INSPECTOR/SUMMARY (w-72 each) panels now gate `hidden md:flex` and Sheet-collapse below `md` — two new `md:hidden` toolbar triggers (`Layers`/`PanelRight`) open left/right Sheets rendering the IDENTICAL slot nodes, proven by a new 7-test vitest suite plus 1 auto-fixed pre-existing gap (missing React imports, the same documented vitest gotcha 53-03 hit).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-12T05:22:00Z (approx., immediately following 53-03's close)
- **Completed:** 2026-07-12T05:42:13Z
- **Tasks:** 1/1 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `CanvasShell`'s three persistent side panels (`LAYERS w-64`, `INSPECTOR w-72`, optional `SUMMARY w-72`) each gained `hidden md:flex md:flex-col` — none renders persistently below `md`; `CANVAS` remains the sole persistent `flex-1 min-w-0 overflow-hidden` zone at every width, satisfying "no horizontal overflow at 360/390/414" for this surface (53-UI-SPEC §5, Judgment Call #7)
- Two new `Sheet`s (`side="left"` for Layers, `side="right"` for Inspector+Summary) render the SAME `layers`/`inspector`/`summary` ReactNode slots CanvasShell already receives — zero new data path, same `showRegions`/`showHistory`/`showUnrelated` state driving the content, only the container differs below `md`
- `CanvasToolbar` gained two OPTIONAL `md:hidden size-11` ghost icon buttons (`Layers` / `PanelRight`, `aria-label="Show layers"` / `"Show inspector"`) in the right group, using the toolbar's existing `Tooltip` idiom for parity with Select/Draw; when the new `onOpenLayers`/`onOpenInspector` props are omitted (i.e. every existing desktop-only call site untouched by this plan), neither button renders and all prior toolbar behavior is unchanged
- 7-test `canvas-shell-mobile.test.tsx` proves: (a) both persistent panels carry `hidden`+`md:flex` via source assertion, (b) both mobile triggers exist and carry `md:hidden`, (c) tapping "Show layers" mounts a Radix `[role="dialog"]` into `document.body` containing exactly the layers slot content (not inspector/summary), (d) tapping "Show inspector" mounts a dialog with BOTH inspector and summary content, (e) the canvas slot is present before and after opening a Sheet, (f) the toolbar's own existing controls (Select/Draw, view toggles, Close) render correctly with the two new props omitted
- Found-live Rule 3 fix: `canvas-shell.tsx` and `canvas-toolbar.tsx` were the FIRST vitest suite to mount them directly, exposing the same missing-`React`-import gotcha 53-03 already documented and fixed for 5 other files — fixed identically here, zero behavior change

## Task Commits

Each task was committed atomically:

1. **Task 1: Sheet-collapse LAYERS/INSPECTOR/SUMMARY below md in CanvasShell + toolbar triggers** - `f9d7fc2` (feat)

_Note: Task 1 was TDD (`tdd="true"`) — test and implementation were designed together and folded into one commit per the plan's task boundary (mirrors 53-01/53-03's own precedent). The missing-React-import RED failure (`ReferenceError: React is not defined`, both `CanvasShell` and `CanvasToolbar`) was confirmed live on the first suite run before the fix made all 7 tests GREEN; that failure is the same pre-existing/documented gotcha, not a defect in the new feature logic itself, so it was folded into the single Task 1 commit rather than split into a separate fix commit (consistent with 53-01's precedent for the identical class of gotcha)._

**Plan metadata:** _pending — this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md updates committed next_

## Files Created/Modified
- `apps/web/src/app/emails/[id]/_components/canvas-shell.tsx` - Added `mobileLayersOpen`/`mobileInspectorOpen` state; gated the three persistent side-panel divs `hidden md:flex md:flex-col`; added two `Sheet`s rendering the same `layers`/`inspector`+`summary` slot nodes below `md`; passed `onOpenLayers`/`onOpenInspector` down to `CanvasToolbar`; explicit `React` import (vitest gotcha)
- `apps/web/src/app/emails/[id]/_components/canvas-toolbar.tsx` - Added optional `onOpenLayers?`/`onOpenInspector?` props; right group refactored into a single `ml-auto` wrapping div containing the two new conditional `md:hidden size-11` Tooltip-wrapped icon buttons (`Layers`/`PanelRight`) plus the existing Close button; explicit `React` import (vitest gotcha)
- `apps/web/src/app/emails/[id]/_components/__tests__/canvas-shell-mobile.test.tsx` - New: 7 tests (createRoot-in-jsdom + `act`, mirrors `inbox-mobile-stack.test.tsx`'s convention) — persistent-panel gating (source assertion), trigger presence + `md:hidden` (source assertion + DOM), Sheet-open reveals correct slot content via `document.body` `[role="dialog"]` query, canvas slot always present, toolbar behavior unchanged when new props omitted

## Decisions Made
- Moved `ml-auto` from the Close button onto a new wrapping `<div className="ml-auto flex items-center gap-1">` around the whole right group — avoids a conditional "which element gets ml-auto" branch and is provably behavior-preserving for every existing desktop call site (Close remains the sole visible child there, in the same position, same styling)
- Inspector and Summary share ONE Sheet (`side="right"`), stacked in the same reading order as the desktop's `INSPECTOR` then `SUMMARY` flex siblings, rather than a third Sheet — 53-UI-SPEC §5 frames Inspector/Summary together ("INSPECTOR and SUMMARY when present") and a third full-height overlay for an optional, often-empty slot would add UI surface with no corresponding trigger design in the spec
- Added an explicit `md:hidden` className to each `SheetContent` in addition to its trigger being `md:hidden` — belt-and-suspenders correctness (a Sheet left open across a viewport resize past `md` still collapses) and gives `canvas-shell.tsx` the literal `md:hidden` substring the plan's own artifact contract names
- `SheetTitle` rendered `sr-only` in both Sheets (mirrors `AppSidebar`'s own mobile-Sheet `SheetTitle className="sr-only"` convention in `sidebar.tsx`) rather than omitted — avoids a Radix Dialog accessibility console warning without introducing any new visible copy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Explicit `React` import added to `canvas-shell.tsx` and `canvas-toolbar.tsx` (vitest classic-runtime JSX gotcha)**
- **Found during:** Task 1 (first test run — `ReferenceError: React is not defined` thrown from both `CanvasShell` and `CanvasToolbar`)
- **Issue:** Both files compile fine under Next.js's SWC automatic JSX runtime (no `React` import needed there) but crash under vitest's plain esbuild transform, which defaults to the classic runtime (`React.createElement`) and needs `React` explicitly in scope. This is the identical, already-documented gotcha `genui-panel-node.tsx` and 53-03's five fixed files carry — `canvas-shell-mobile.test.tsx` is simply the FIRST vitest suite to mount either of these two files.
- **Fix:** Added `import * as React from "react";` with the same explanatory comment convention, to both files.
- **Files modified:** `apps/web/src/app/emails/[id]/_components/canvas-shell.tsx`, `apps/web/src/app/emails/[id]/_components/canvas-toolbar.tsx`
- **Verification:** `canvas-shell-mobile.test.tsx` green (7/7); full web suite reconfirmed green (58 files/388 tests, up from 57/381 at 53-03's close); `npm run typecheck -w @polytoken/web` shows zero errors referencing either file (only the pre-existing, documented `app/dev/design/**` exclusion remains)
- **Committed in:** `f9d7fc2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking/Rule 3)
**Impact on plan:** The fix was a necessary consequence of this plan's own test being the first to exercise these two files under vitest — no scope creep, no unrelated changes, identical fix shape to 53-03's precedent.

## Issues Encountered
None beyond the deviation above, resolved within the fix-attempt limit (1 attempt).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `MOBL-02` is now marked Complete in REQUIREMENTS.md — this was the last of its three contributing plans (53-02/53-03/53-04)
- The `document.body` `[role="dialog"]` Sheet-open-reveals-content assertion pattern this suite introduces is available as a reusable shape for any future test proving a Sheet-collapse (this codebase's now three-times-used mobile pattern) actually opens with the right content, not merely that a hidden persistent copy exists somewhere in the render tree
- Full web test suite reconfirmed green (58 files/388 tests, up from 57/381 at 53-03's close); typecheck clean outside the pre-existing, documented `app/dev/design/**` exclusion; palette-ban/token-contrast/token-registration gates green (full suite run, all 58 files including `palette-ban.test.ts`)
- Live 360/390/414 no-horizontal-overflow confirmation of the email-detail flow remains DEFERRED to `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md` §G, alongside the rest of Phase 53's deferred live-viewport confirmations — not faked as passed
- `email-detail.tsx` was NOT modified, per the plan's own instruction — `CanvasShell` owns the collapse internally around the slots it already receives

## Self-Check: PASSED

- FOUND: `apps/web/src/app/emails/[id]/_components/canvas-shell.tsx` (modified, contains `hidden md:flex` and `md:hidden`)
- FOUND: `apps/web/src/app/emails/[id]/_components/canvas-toolbar.tsx` (modified, contains `Show layers`)
- FOUND: `apps/web/src/app/emails/[id]/_components/__tests__/canvas-shell-mobile.test.tsx`
- FOUND commit `f9d7fc2` in `git log --oneline`

---
*Phase: 53-mobile-responsive-answer*
*Completed: 2026-07-12*
