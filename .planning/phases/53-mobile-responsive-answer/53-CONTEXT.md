# Phase 53: Mobile-Responsive Answer - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning
**Mode:** Overnight autonomous run — grey-area answers are the recommended defaults,
auto-accepted per the user's explicit "finish all milestones autonomously" directive.

<domain>
## Phase Boundary

The product becomes usable on a mobile viewport: canvas surfaces (chat canvas, /knowledge)
collapse to an inline-first list/feed presentation below the `md` (768px) breakpoint while
desktop keeps the 2D canvas (MOBL-01); core flows (login → inbox → thread → email detail →
chat) show no horizontal overflow and keep ≥44px touch targets even under denser style
packs (MOBL-02).

Out of scope: native mobile apps (web-first only, VISION E2); per-breakpoint token
dimension (LOCKED CLOSED by D-48-07 — "Phase 53 MAY collapse the canvas to an inline feed
below md and add a narrowly-scoped density mechanism only if genuinely needed, but MAY NOT
reopen the token-dimension question"); any Phase-52 editing-control redesign for touch
(controls must remain reachable/tappable, not redesigned).

</domain>

<decisions>
## Implementation Decisions

### Canvas → Feed Collapse (MOBL-01)
- The switch line is the Tailwind `md` breakpoint (768px) — the LOCKED D-48-07 convention;
  no new breakpoints, no token-dimension changes
- Below `md`, /chat renders the INLINE FEED presentation: the conversation message stream
  with genui panels rendered inline in flow order (market-validated: Claude Artifacts
  inline on mobile; ChatGPT removed Canvas on mobile) — the React-Flow 2D canvas is NOT
  mounted at all below md (do not merely hide it: avoid paying its init cost on phones)
- Below `md`, /knowledge renders a list presentation: node list (grouped/filterable with
  the existing filter facets) + tap-through to the existing node-detail pane as a
  full-width sheet; the React-Flow graph is not mounted below md
- Desktop (≥md) behavior is UNCHANGED on both surfaces
- Detection is CSS-first (Tailwind responsive classes) for layout, with a single shared
  `useIsMobileViewport()` (matchMedia on the md query) ONLY where mount/unmount decisions
  are needed — one hook, not scattered window.innerWidth reads

### Core-Flow Responsiveness (MOBL-02)
- Fix horizontal overflow on: login, inbox three-pane (collapses to single-pane
  master→detail navigation below md), thread view, email detail, chat feed —
  overflow-x must be none at 360px, 390px, and 414px widths
- Touch targets: the existing `.touch-target` (44px) utility guards ALL interactive
  elements on mobile — apply it (or min-h/min-w equivalents) to the elements that are
  smaller on dense packs; the Phase-52 panel toolbar's size-6 icons get a mobile-only
  touch-target expansion (padding/hit-area, not visual redesign)
- The inbox three-pane below md: list → (tap) → thread/detail as stacked navigation with
  a back affordance; no horizontal panes

### Verification (environment-constrained tonight)
- Docker/WSL down: verification is vitest component tests with mocked matchMedia (feed
  renders below md, canvas above), Tailwind class assertions, typecheck, and the committed
  gates; Playwright viewport specs (360/768/1024) are AUTHORED but their live run is
  queued to MORNING-CHECKLIST.md §G — never faked

### Claude's Discretion
- Exact feed item components (reuse existing message-stream components wherever possible);
  back-affordance placement; whether /knowledge mobile list reuses the entities-list idiom;
  any narrowly-scoped density tweak (allowed by D-48-07 only if genuinely needed — prefer
  none)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- docs/design/breakpoint-decision.md (D-48-07 — the LOCKED convention this phase implements)
- `.touch-target` utility (44px floor, shipped 48-01)
- Existing message-stream components on /chat (feed building blocks)
- inbox-three-pane.tsx (the pane structure to collapse)
- node-detail-pane.tsx + filter-rail.tsx on /knowledge (list/detail building blocks)
- Phase-52 panel chrome (PanelThemeScope etc.) — panels must render inline in the feed too

### Established Patterns
- Tailwind responsive variants; tokens breakpoint-static (D-48-07)
- vitest jsdom with mocked matchMedia; committed palette/contrast/registration gates

### Integration Points
- apps/web/src/app/chat/page.tsx + _canvas/ (canvas mount point — conditional mount)
- apps/web/src/app/knowledge/ (graph mount point)
- apps/web/src/app/_components/inbox-three-pane.tsx

</code_context>

<specifics>
## Specific Ideas

- "Gracefully degrade" means the mobile presentation is a REAL usable answer (feed with
  working panels, list with working detail), not a shrunken canvas or a "use desktop" wall

</specifics>

<deferred>
## Deferred Ideas

- Native apps; gesture/drag interactions on mobile canvas (canvas simply isn't mounted)
- Live viewport E2E runs → MORNING-CHECKLIST.md §G (Docker down tonight)

</deferred>
