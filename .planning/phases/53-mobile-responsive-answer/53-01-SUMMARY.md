---
phase: 53-mobile-responsive-answer
plan: 01
subsystem: ui
tags: [react, nextjs, tailwind, matchmedia, sidebar, responsive]

# Dependency graph
requires:
  - phase: 48-token-system-extensions
    provides: ".touch-target utility + md-breakpoint convention (D-48-07, docs/design/breakpoint-decision.md)"
provides:
  - "useIsMobileViewport() — the single shared mobile-viewport mount/unmount signal for Phase 53"
  - "Global md:hidden mobile nav trigger in root layout.tsx (SidebarTrigger reachable on every authenticated route below md)"
affects: [53-02, 53-03, 53-04, 53-05, 53-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public matchMedia(max-width:767px) hook mirroring a private in-package hook's exact numeric contract, so two independent mobile-detection call sites can never disagree at the same instant"
    - "renderToString-based SSR-safety test: proves a hook's pre-effect render never touches window/matchMedia, instead of asserting via a brittle act-timing race"

key-files:
  created:
    - apps/web/src/hooks/use-is-mobile-viewport.ts
    - apps/web/src/hooks/__tests__/use-is-mobile-viewport.test.ts
  modified:
    - apps/web/src/app/layout.tsx

key-decisions:
  - "useIsMobileViewport() duplicates @polytoken/ui/sidebar's private useIsMobile() logic verbatim (same 768px line, same matchMedia shape) rather than exporting the private hook, since sidebar.tsx's internal is intentionally unexported and this hook must be public across /chat + /knowledge (per 53-UI-SPEC)"
  - "SSR-safety verified via ReactDOMServer.renderToString (proves matchMedia is never called during the synchronous render pass) instead of asserting on pre-act state, which is a more direct proof of the SSR contract"

patterns-established:
  - "One shared mobile-viewport hook for JS mount/unmount decisions; all other mobile presentation stays CSS-only (md: classes / pointer-coarse: variant) per D-48-07 — Wave 2 plans must not add a second window.innerWidth/matchMedia read site"

requirements-completed: [MOBL-01, MOBL-02]

# Metrics
duration: ~6min
completed: 2026-07-12
---

# Phase 53 Plan 01: Foundation — useIsMobileViewport hook + global mobile nav trigger Summary

**Shared `matchMedia(max-width:767px)` hook (SSR-safe, mirrors sidebar's private `useIsMobile` byte-for-byte) plus a global `md:hidden` `SidebarTrigger` bar in root `layout.tsx`, closing the gap where no way existed to open app nav on a phone.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-12T04:38:00Z (approx.)
- **Completed:** 2026-07-12T04:42:08Z
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `useIsMobileViewport()` — the ONE shared JS mount/unmount signal for the whole phase, tested for false@>=768px / true@<768px / updates-on-`change` / SSR-safe `false` pre-effect default
- Global mobile nav trigger closes a found gap (grep-verified: no `SidebarTrigger` existed anywhere in the app before this plan) — every authenticated route now has a reachable, 44px app-nav trigger below `md`
- Desktop chrome byte-identical: diff confirms `SidebarProvider`/`AppSidebar`/`SidebarInset` nesting unchanged, only additive `md:hidden` markup added

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the shared useIsMobileViewport() hook (RED->GREEN)** - `c6a63c4` (feat)
2. **Task 2: Add the global md:hidden mobile nav trigger to the root layout** - `f6add79` (feat)

_Note: Task 1 was TDD (`tdd="true"`) — RED confirmed live (module-not-found failure against the test written first) before the hook implementation made it GREEN, both folded into one commit per the plan's task boundary._

## Files Created/Modified
- `apps/web/src/hooks/use-is-mobile-viewport.ts` - Public `useIsMobileViewport(): boolean` hook, `matchMedia("(max-width: 767px)")`, SSR-safe `false` default, `change`-event subscription with cleanup
- `apps/web/src/hooks/__tests__/use-is-mobile-viewport.test.ts` - 4 tests: false@>=768px, true@<768px, updates-on-change (fake `MediaQueryList` capturing the `change` handler), SSR-safety via `renderToString` (proves `matchMedia` is never called during the synchronous render)
- `apps/web/src/app/layout.tsx` - Added `SidebarTrigger`/`BrandMark` imports and a `md:hidden` bar (`h-11`, `border-b border-border/50 bg-background`) inside `SidebarInset` directly above `{children}`, containing a `size-11` `SidebarTrigger` + glyph `BrandMark` + "Polytoken" label

## Decisions Made
- Mirrored `packages/ui/src/sidebar.tsx`'s private `useIsMobile()` shape exactly (same `MOBILE_BREAKPOINT = 768`, same `matchMedia` subscription pattern) rather than inventing a new contract, so the AppSidebar's own mobile `Sheet` and this hook's mount decisions can never disagree on which side of `md` the viewport is on
- Used `ReactDOMServer.renderToString` for the SSR-safety test instead of racing `act()` timing — a `matchMedia` spy that must NOT be called during the synchronous (pre-effect) render pass is a direct, unambiguous proof that the hook's initial value never depends on a `window` read

## Deviations from Plan

None — plan executed exactly as written. One clarifying observation (not a fix, out of scope for this plan's file list): 53-UI-SPEC's threat register (T-53-01-01) and the plan's own action text state "/login renders outside `SidebarProvider`'s authenticated shell." Direct inspection of `apps/web/src/app/login/page.tsx` shows no route-group/layout override — `/login` renders through the SAME root `layout.tsx` (and therefore the same `SidebarProvider`/`AppSidebar`/`SidebarInset` shell) as every other route; `AppSidebar` itself has no auth-conditional rendering. This is a **pre-existing characteristic of the codebase**, not something introduced by this plan — the new `SidebarTrigger` only makes an already-mounted-but-off-canvas sidebar openable on mobile; it does not add any nav content that wasn't already present in the render tree on `/login` before this plan. No fix applied (would be a Rule 4 architectural change — gating `AppSidebar`/the shell on auth state — out of scope for this plan's `files_modified` list and not requested). Flagged here for a future security-focused pass to evaluate independently of Phase 53.

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: information-disclosure (pre-existing, not introduced by this plan) | `apps/web/src/app/layout.tsx`, `apps/web/src/components/app-sidebar.tsx` | The root layout's `SidebarProvider`/`AppSidebar` shell wraps `/login` with no auth-conditional rendering, so the full nav rail (including this plan's new `SidebarTrigger`) is present in the DOM on `/login` regardless of session state — contradicts 53-UI-SPEC's stated mitigation for T-53-01-01. Predates this plan; not fixed here (architectural, Rule 4 territory). |

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useIsMobileViewport()` is ready for Wave 2 plans (`/chat`'s `ChatCanvasIsland` gating, `/knowledge`'s `KnowledgeGraphIsland` gating) to import as the single shared mount-decision signal
- Global mobile nav trigger unblocks MOBL-02's inbox→chat→knowledge navigation path on mobile for every subsequent Phase 53 plan
- Full web test suite reconfirmed green (55 files / 372 tests) after both tasks; typecheck clean outside the pre-existing, documented `app/dev/design/**` exclusion
- Live-viewport confirmation (real render at 360/390/414) remains DEFERRED to `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md` §G per the plan's own `<verification>` section — not faked as passed

## Self-Check: PASSED

- FOUND: `apps/web/src/hooks/use-is-mobile-viewport.ts`
- FOUND: `apps/web/src/hooks/__tests__/use-is-mobile-viewport.test.ts`
- FOUND: `apps/web/src/app/layout.tsx` (modified, diff verified)
- FOUND commit `c6a63c4` in `git log --oneline`
- FOUND commit `f6add79` in `git log --oneline`

---
*Phase: 53-mobile-responsive-answer*
*Completed: 2026-07-12*
