---
phase: 53-mobile-responsive-answer
plan: 02
subsystem: ui
tags: [tailwind, pointer-coarse, touch-target, react-flow, canvas, wcag]

# Dependency graph
requires:
  - phase: 48-token-system-extensions
    provides: ".touch-target utility (globals.css, D-48-07 -- min-height/min-width 44px, breakpoint-static)"
  - phase: 52-editable-genui-panels
    provides: "PanelActionsToolbar chrome (panel-actions-toolbar.tsx, panel-action-button-class.ts, pack-switcher.tsx) this plan grows the hit-area of"
provides:
  - "pointer-coarse: hit-area growth on the Phase-52 panel toolbar row, its 4 shared icon buttons, and the pack-switcher trigger"
  - "pointer-coarse: hit-area growth on KnowledgePreviewNode's remove button and footer link"
  - "committed touch-target-pointer-coarse.test.tsx locking the pointer-coarse: class contract on all six swept targets"
affects: [53-mobile-responsive-answer, 49-live-loop-gate-deploy-oauth-real-email]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pointer-coarse: (Tailwind v3.4 core (pointer: coarse) media feature, zero config) as the touch-capability-driven hit-area mechanism for EXISTING desktop-authored chrome, distinct from md:/useIsMobileViewport()'s viewport-width mount/layout mechanism (53-UI-SPEC Judgment Call #1)"
    - "Class-string source-text assertion (readFileSync + import.meta.url, mirrors palette-ban.test.ts's idiom) as the correct test contract for a CSS media FEATURE jsdom's matchMedia mock cannot exercise"

key-files:
  created:
    - apps/web/src/app/chat/_canvas/__tests__/touch-target-pointer-coarse.test.tsx
  modified:
    - apps/web/src/app/chat/_canvas/panel-actions-toolbar.tsx
    - apps/web/src/app/chat/_canvas/controls/panel-action-button-class.ts
    - apps/web/src/app/chat/_canvas/controls/pack-switcher.tsx
    - apps/web/src/app/chat/_canvas/knowledge-preview-node.tsx

key-decisions:
  - "Used pointer-coarse: (not a viewport-width check) because these six controls only ever render when the canvas is mounted (>=md) -- a max-width check would be a permanent no-op and would silently miss a touch tablet running the canvas at >=768px"
  - "No jsdom matchMedia mock in the new test -- pointer-coarse is a CSS media FEATURE, not a viewport-width query; asserted the class STRING is present instead (source-text read for inline classNames, direct import for the one exported constant)"

patterns-established:
  - "Hit-area-only pointer-coarse: append -- glyph size, color, and behavior never change; only min-height/min-width via .touch-target or an explicit h-11 grows"

requirements-completed: [MOBL-02]

# Metrics
duration: 12min
completed: 2026-07-12
---

# Phase 53 Plan 02: Touch-Target Sweep (pointer-coarse:) Summary

**pointer-coarse: hit-area growth (Tailwind v3.4 core `(pointer: coarse)` variant) on all six 53-UI-SPEC-listed canvas controls -- Phase-52 panel toolbar row, its 4 shared icon buttons, the pack-switcher trigger, and KnowledgePreviewNode's remove button + footer link -- plus a committed class-string regression test.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-12T01:52:00-03:00 (approx, first Edit)
- **Completed:** 2026-07-12T01:57:07-03:00
- **Tasks:** 2/2
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments
- Six canvas controls now grow to a >=44px hit-area (WCAG 2.5.8) on any touch-capable pointer, regardless of viewport width, via Tailwind's `pointer-coarse:` variant -- zero change to mouse/trackpad appearance
- One shared-class edit (`PANEL_ACTION_ICON_BUTTON_CLASS`) covers all 4 toolbar icon buttons (edit/regenerate/re-theme/history) at once
- New committed test (`touch-target-pointer-coarse.test.tsx`) locks the `pointer-coarse:` class contract in place for all six targets, using source-text assertion (not a jsdom `matchMedia` mock, which cannot exercise a pointer-capability CSS media feature)
- Full `_canvas` regression suite (27 files / 204 tests) stays green; committed palette-ban/token-contrast/token-registration gates stay green; typecheck clean outside the pre-existing `app/dev/design/**` exclusion

## Task Commits

Each task was committed atomically:

1. **Task 1: pointer-coarse: sweep on the Phase-52 panel toolbar + pack switcher** - `3898eec` (feat)
2. **Task 2: pointer-coarse: sweep on KnowledgePreviewNode + class-string test** - `dddfef4` (feat)

_No TDD tasks in this plan (class-string additions to existing markup); the committed test was authored alongside the implementation in Task 2, both in one commit per plan convention for `auto`-type tasks._

## Files Created/Modified
- `apps/web/src/app/chat/_canvas/panel-actions-toolbar.tsx` - `role="toolbar"` row className appends `pointer-coarse:h-11` (base `h-8` retained)
- `apps/web/src/app/chat/_canvas/controls/panel-action-button-class.ts` - `PANEL_ACTION_ICON_BUTTON_CLASS` appends `pointer-coarse:touch-target` (covers all 4 icon buttons; glyph stays `size-3.5`)
- `apps/web/src/app/chat/_canvas/controls/pack-switcher.tsx` - `TRIGGER_CLASS` appends `pointer-coarse:h-11` (base `h-6 w-28` retained; width already exceeded 44px)
- `apps/web/src/app/chat/_canvas/knowledge-preview-node.tsx` - remove button appends `pointer-coarse:touch-target`; footer `Link` appends `pointer-coarse:h-11`
- `apps/web/src/app/chat/_canvas/__tests__/touch-target-pointer-coarse.test.tsx` - new class-string assertion suite (5 tests) covering all six swept targets

## Decisions Made
- Followed 53-UI-SPEC's Judgment Call #1 verbatim: `pointer-coarse:` (touch-capability axis) governs tap-target size on this canvas-only chrome, while `md:`/`useIsMobileViewport()` (viewport-width axis) continues to govern layout/mount decisions elsewhere in Phase 53 -- the two mechanisms are deliberately not conflated.
- For the class-string test, imported `PANEL_ACTION_ICON_BUTTON_CLASS` directly (it's exported) but read source text for the other three files' inline `className` literals, since no exported constant exists for the toolbar row, `TRIGGER_CLASS` (module-private), or the knowledge-preview node's inline classes -- mirrors `palette-ban.test.ts`'s existing `readFileSync` + `import.meta.url` idiom rather than inventing a new one.

## Deviations from Plan

None - plan executed exactly as written. All six class additions match the plan's Task action descriptions and the 53-UI-SPEC Spacing Scale table verbatim; no `busyAction`/lock/`disabled`/`deleteElements`/`hrefFor` behavior was touched.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - this plan is a pure hit-area CSS class addition to existing, already-wired controls; no new data source, component, or rendering path was introduced.

## Threat Flags

None - this plan's threat register (T-53-02-01/02/SC) covers the full change surface: class-only edits verified against the existing behavior test suites, no new dependency, no new network/auth/file-access surface.

## Next Phase Readiness
- MOBL-02's touch-target requirement now has coverage on both its multi-plan contributors present in this codebase state (53-02 canvas controls here; other MOBL-02 surfaces -- inbox stack, email-detail panel collapse -- are 53-03/53-04's scope per their own `requirements:` frontmatter). `MOBL-02` intentionally left Pending in REQUIREMENTS.md-tracked state until its LAST contributing plan closes (mirrors the 53-01 precedent for `MOBL-01`/`MOBL-02`).
- Live touch-target confirmation on a real touch device remains DEFERRED to `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md` §G, per this plan's own `<verification>` block -- not faked as passed.
- No blockers for 53-03/53-04/53-05/53-06.

---
*Phase: 53-mobile-responsive-answer*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 5 modified/created files confirmed present on disk; both task commits (`3898eec`, `dddfef4`) confirmed present in `git log`. No missing items.
