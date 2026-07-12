---
phase: 53-mobile-responsive-answer
plan: 03
subsystem: ui
tags: [react, nextjs, tailwind, radix-tabs, inbox, responsive, playwright]

# Dependency graph
requires:
  - phase: 53-mobile-responsive-answer
    provides: "53-01's useIsMobileViewport()/md-breakpoint convention (not consumed directly here — this plan is CSS-only per 53-UI-SPEC's Breakpoint & Mount Contract) and the md:hidden global nav trigger unblocking inbox reachability on a phone"
provides:
  - "InboxThreePane's mobile single-pane master->detail stack (Tabs filter + full-width list + tap-through stacked detail + ArrowLeft back bar), byte-identical desktop three-pane preserved alongside it"
  - "mobileView local state pattern (list/detail) with an explicit-tap-only guard against the background default-select effect — the reusable shape for any future CSS-dual-tree mobile collapse in this codebase"
affects: [53-04, 49-live-loop-gate-deploy-oauth-real-email]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS-only dual-tree mobile collapse (hidden md:block desktop / flex ... md:hidden mobile), no JS branch — per 53-UI-SPEC's Breakpoint & Mount Contract mechanism 1"
    - "Explicit `import * as React from \"react\"` required in every component file a vitest suite mounts directly — Next.js's SWC automatic JSX runtime tolerates its absence, vitest's plain esbuild classic-runtime transform does not (documented gotcha, now applied to 5 more files)"
    - "Playwright locator scoping for CSS-dual-tree components: page.getByRole(...) auto-excludes display:none via the accessibility tree; plain tag/class locators (page.locator(\"button\")) do not and must be scoped to the visible pane explicitly"

key-files:
  created:
    - apps/web/src/app/_components/__tests__/inbox-mobile-stack.test.tsx
  modified:
    - apps/web/src/app/_components/inbox-three-pane.tsx
    - apps/web/src/app/_components/inbox-row.tsx
    - apps/web/src/app/_components/inbox-thread-group.tsx
    - apps/web/src/app/_components/entity-chips.tsx
    - packages/ui/src/resizable.tsx
    - apps/web/e2e/uat-45-threads.spec.ts

key-decisions:
  - "Desktop ResizablePanelGroup left 100% byte-identical (wrapped, never edited internally) — the mobile stack's list/loading/error/empty/load-more blocks are a deliberate duplicate of the desktop blocks rather than a shared extraction, per the plan's own 'do NOT edit its internals' instruction and to keep desktop regression risk at zero"
  - "mobileView only flips to \"detail\" via an explicit new handleSelectMemberMobile wrapper passed to the mobile list's onSelectMember — the existing background default-select effect keeps setting selectedEmailId unchanged, so first paint on a phone never auto-deposits the user into the detail view"

patterns-established:
  - "Rule 3 fix: this is the FIRST vitest suite to mount InboxThreePane's real render tree end-to-end (desktop + mobile), which surfaced that 5 files in that tree lacked the explicit React import genui-panel-node.tsx's own doc comment already flags as necessary for vitest's classic JSX runtime — fixed identically, zero behavior change"
  - "Rule 1 fix: introducing a second CSS-hidden DOM tree for the same list data breaks any pre-existing Playwright spec that queries by plain tag/class (not getByRole) without scoping to the visible pane — uat-45-threads.spec.ts's 3 affected locators fixed with a desktopPane() scoping helper"

requirements-completed: []  # MOBL-02 spans 53-02/53-03/53-04 (frontmatter); left Pending until 53-04 lands, per the 53-01/53-02 precedent (LIVE-05/RSKN-05 pattern).

# Metrics
duration: ~25min
completed: 2026-07-12
---

# Phase 53 Plan 03: Inbox single-pane master->detail stack below md Summary

**`inbox-three-pane.tsx` gains a `flex md:hidden` mobile stack (segmented Tabs filter, full-width list, tap-through stacked detail with an `ArrowLeft` back bar) alongside the byte-identical `hidden md:block` desktop three-pane, proven by a new 4-test vitest suite — plus 2 auto-fixed pre-existing gaps the new test tree exposed (missing React imports in 5 files; a Playwright spec's now-ambiguous plain-tag locators).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-12T04:55:00Z (approx.)
- **Completed:** 2026-07-12T05:21:03Z
- **Tasks:** 1/1 completed
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Inbox collapses to a genuine single-pane master->detail stack below `md`: segmented `Tabs` filter (All/Unread/With entities, mirroring `FiltersRail`'s exact labels), the same `InboxThreadGroup`/`InboxRow` list full-width with no `ResizablePanel` wrapper, and a tap-through detail view (sticky `h-11` back bar + byte-identical `ReadingPreview`)
- Desktop `ResizablePanelGroup` three-pane wrapped in `hidden md:block`, never edited internally — zero desktop regression risk by construction
- Guard proven live: the background default-select effect keeps resolving `selectedEmailId` (feeds `ReadingPreview` prefetch) but never flips `mobileView` — first paint on a phone always shows the list, confirmed by a dedicated test
- Found-live Rule 3 fix: `inbox-mobile-stack.test.tsx` is the FIRST vitest suite to mount `InboxThreePane`'s real render tree (desktop + mobile), which exposed that `resizable.tsx`, `inbox-row.tsx`, `inbox-thread-group.tsx`, and `entity-chips.tsx` were all missing the explicit `import * as React from "react"` that vitest's classic-runtime JSX transform requires (Next.js's SWC runtime tolerates its absence) — same documented gotcha `genui-panel-node.tsx` already carries a comment for
- Found-live Rule 1 fix: the new mobile stack's second DOM tree (CSS-hidden via `md:hidden`) duplicates every inbox row, which breaks `uat-45-threads.spec.ts`'s 3 plain `page.locator("button").filter(...)` calls (Playwright's `getByRole` locators already exclude `display:none` via the accessibility tree, but plain tag locators do not) — fixed with a `desktopPane()` scoping helper, not run live this session (Docker down)

## Task Commits

Each task was committed atomically:

1. **Task 1: Split inbox into desktop three-pane + mobile master->detail stack** - `1f28166` (feat)

**Deviation fix (Rule 1):** `a4b88ea` (fix) — scope `uat-45-threads.spec.ts`'s button locators to the desktop pane

**Plan metadata:** _pending — this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md updates committed next_

_Note: Task 1 was TDD (`tdd="true"`) — test authored and implementation written together in the same commit (mirrors 53-01's precedent: "both folded into one commit per the plan's task boundary"). RED was confirmed live via two intermediate failing runs (first a `ReferenceError: React is not defined` at the component's own Fragment, then again transitively inside `resizable.tsx`) before all 5 missing-import fixes made the suite GREEN._

## Files Created/Modified
- `apps/web/src/app/_components/inbox-three-pane.tsx` - Wrapped the existing `ResizablePanelGroup` in `hidden h-full md:block`; added a sibling `flex h-full flex-col md:hidden` mobile stack (Tabs filter, list, tap-through detail, back bar); new `mobileView` state + `handleSelectMemberMobile` handler; explicit `React` import (vitest gotcha)
- `apps/web/src/app/_components/__tests__/inbox-mobile-stack.test.tsx` - New: 4 tests — Tabs filter presence/aria-label, `hidden md:block`/`md:hidden` wrapper class-string source assertions, first-paint-always-list guard, tap-to-detail + back-preserves-selection round trip (mocks `~/trpc/react`'s 3 direct `.useQuery` calls this component makes)
- `apps/web/src/app/_components/inbox-row.tsx` - Explicit `React` import only (vitest gotcha, zero behavior change)
- `apps/web/src/app/_components/inbox-thread-group.tsx` - Explicit `React` import only (vitest gotcha, zero behavior change)
- `apps/web/src/app/_components/entity-chips.tsx` - Explicit `React` import only (vitest gotcha, zero behavior change)
- `packages/ui/src/resizable.tsx` - Explicit `React` import only (vitest gotcha, zero behavior change)
- `apps/web/e2e/uat-45-threads.spec.ts` - Added `desktopPane()` locator-scoping helper; 3 `page.locator("button").filter(...)` call sites (45.1/45.2/45.4) now scoped to it, so they keep resolving to exactly one element now that the inbox renders a second CSS-hidden mobile tree with the same rows

## Decisions Made
- Kept the desktop `ResizablePanelGroup`'s internals 100% untouched (wrapped only) and duplicated the list/loading/error/empty/load-more JSX for the mobile branch rather than extracting a shared helper — the plan explicitly calls for this ("do NOT edit its internals"), and it keeps desktop regression risk at zero since no shared code path could be affected by a mobile-only change
- `handleSelectMemberMobile` is a thin wrapper (`setSelectedEmailId` + `setMobileView("detail")`) passed ONLY to the mobile list's `onSelectMember` — the desktop list keeps `onSelectMember={setSelectedEmailId}` unchanged, so `mobileView` is provably inert on the desktop render path
- `ReadingPreview` on mobile is wrapped by one extra sticky back-bar row (`flex h-11 shrink-0 ... px-2` per 53-UI-SPEC §4 point 4) rather than merged into its own header — `ReadingPreview`'s own markup stays byte-identical between desktop and mobile call sites

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Explicit `React` import added to 5 files (vitest classic-runtime JSX gotcha)**
- **Found during:** Task 1 (first test run — `ReferenceError: React is not defined`)
- **Issue:** `inbox-three-pane.tsx`, `resizable.tsx`, `inbox-row.tsx`, `inbox-thread-group.tsx`, and `entity-chips.tsx` all compile fine under Next.js's SWC automatic JSX runtime (no `React` import needed there) but crash under vitest's plain esbuild transform, which defaults to the classic runtime (`React.createElement`) and needs `React` explicitly in scope. This is a pre-existing, already-documented gotcha in this codebase (`genui-panel-node.tsx` carries the identical comment) — `inbox-mobile-stack.test.tsx` is simply the FIRST vitest suite to mount `InboxThreePane`'s real desktop+mobile render tree, so it's the first to trip over it for these 5 files.
- **Fix:** Added `import * as React from "react";` with the same explanatory comment `genui-panel-node.tsx` uses, to all 5 files.
- **Files modified:** `apps/web/src/app/_components/inbox-three-pane.tsx`, `apps/web/src/app/_components/inbox-row.tsx`, `apps/web/src/app/_components/inbox-thread-group.tsx`, `apps/web/src/app/_components/entity-chips.tsx`, `packages/ui/src/resizable.tsx`
- **Verification:** `inbox-mobile-stack.test.tsx` green (4/4); full web suite reconfirmed green (57 files/381 tests, up from 55/372 pre-plan)
- **Committed in:** `1f28166` (Task 1 commit)

**2. [Rule 1 - Bug] Scoped `uat-45-threads.spec.ts`'s ambiguous button locators to the desktop pane**
- **Found during:** Task 1 (post-implementation review of the overnight_mode instruction: "the uat-45 threads spec relies on this component's desktop DOM — do not break its selectors")
- **Issue:** The new mobile stack renders a second, CSS-hidden (`md:hidden`) DOM tree containing the SAME `InboxThreadGroup`/`InboxRow` rows as the desktop tree. `page.getByRole(...)` locators (used in most of the spec) already exclude `display:none` elements via the accessibility tree, so they were unaffected — but 3 call sites (45.1/45.2/45.4) use a plain `page.locator("button").filter({ hasText: ... })`, which is a raw DOM/CSS query that does NOT filter by visibility. Those would now resolve to 2 elements (one per tree) and violate Playwright's strict-mode single-match requirement.
- **Fix:** Added a `desktopPane(page)` helper (`page.locator('[class="hidden h-full md:block"]')`) and scoped all 3 affected locators to it. `page.getByRole(...)` call sites left untouched (already correct).
- **Files modified:** `apps/web/e2e/uat-45-threads.spec.ts`
- **Verification:** Not run live this session (Docker down — Playwright e2e requires a live local stack, per this plan's own `<verification>` deferral to the 49-phase MORNING-CHECKLIST). Reasoning verified by direct code inspection of Playwright's documented `getByRole` hidden-element exclusion behavior vs. plain-locator DOM matching; TypeScript types for the new `Locator` import/helper checked by hand (e2e is excluded from `tsc --noEmit` per `apps/web/tsconfig.json`'s own `exclude: ["e2e", ...]`).
- **Committed in:** `a4b88ea` (separate fix commit, since it lands after Task 1's own commit and touches a file outside Task 1's declared `files_modified`)

---

**Total deviations:** 2 auto-fixed (1 blocking/Rule 3, 1 bug/Rule 1)
**Impact on plan:** Both fixes were necessary consequences of this plan's own structural change (a second DOM tree) being exercised by tests for the first time — no scope creep, no unrelated changes.

## Issues Encountered
None beyond the two deviations above, both resolved within the fix-attempt limit (1 attempt each).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `InboxThreePane`'s `mobileView` pattern (CSS-dual-tree + explicit-tap-only state flip) is available as a reference shape for 53-04 or any later plan needing the same "desktop persistent, mobile toggled" collapse
- `uat-45-threads.spec.ts`'s locator-scoping fix means it remains safe to run once Docker/the live stack are available again — not verified live this session, flagged for `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md` §G alongside the rest of Phase 53's deferred live-viewport confirmations
- Full web test suite reconfirmed green (57 files/381 tests, up from 55/372 at 53-01's close) after this plan's changes; typecheck clean outside the pre-existing, documented `app/dev/design/**` exclusion; palette-ban/token-contrast/token-registration gates green
- `MOBL-02` intentionally left Pending in REQUIREMENTS.md — spans 53-02/53-03/53-04 per each plan's own `requirements:` frontmatter; mark Complete only after 53-04 (the last contributing plan), mirroring the LIVE-05/RSKN-05/53-01/53-02 precedent
- Live 360/390/414 no-horizontal-overflow confirmation of the inbox flow remains DEFERRED to the same MORNING-CHECKLIST §G — not faked as passed

## Self-Check: PASSED

- FOUND: `apps/web/src/app/_components/inbox-three-pane.tsx` (modified, contains `md:hidden`)
- FOUND: `apps/web/src/app/_components/__tests__/inbox-mobile-stack.test.tsx`
- FOUND: `apps/web/src/app/_components/inbox-row.tsx` (modified)
- FOUND: `apps/web/src/app/_components/inbox-thread-group.tsx` (modified)
- FOUND: `apps/web/src/app/_components/entity-chips.tsx` (modified)
- FOUND: `packages/ui/src/resizable.tsx` (modified)
- FOUND: `apps/web/e2e/uat-45-threads.spec.ts` (modified)
- FOUND commit `1f28166` in `git log --oneline`
- FOUND commit `a4b88ea` in `git log --oneline`

---
*Phase: 53-mobile-responsive-answer*
*Completed: 2026-07-12*
