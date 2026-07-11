---
created: 2026-07-07
title: /knowledge pre-existing UI debt — glassmorphism ban violations + raw glyph icon
area: web/knowledge
files:
  - apps/web/src/app/knowledge/_components/graph-toolbar.tsx
  - apps/web/src/app/knowledge/_components/filter-rail.tsx
  - apps/web/src/app/knowledge/_components/node-detail-pane.tsx
  - apps/web/src/app/knowledge/_components/taxonomy-banner.tsx
resolves_phase: 51
---

## Problem

Found by the Phase-32 UI review audit (32-UI-REVIEW.md, score 19/24). Pre-existing on
`/knowledge` — NOT introduced by Phase 32, but violating contracts locked in v1.4:

1. **Glassmorphism ban (docs/design/product-register-and-bans.md item 3):** `backdrop-blur-md`
   persists at `graph-toolbar.tsx:42`, `filter-rail.tsx:96`, `node-detail-pane.tsx:373`,
   `taxonomy-banner.tsx:46`. v1.4 closed the app's blur debt for /chat + /studio; /knowledge
   predates that sweep and was never audited.
2. **Icon vocabulary break:** `graph-toolbar.tsx:73` renders a raw `⊞` Unicode glyph instead of
   a `lucide-react` icon.

## Solution

Mirror the v1.4 blur-debt closure: replace `backdrop-blur-md` surfaces with solid
`bg-background/95`-style treatments (see conversation-rail resolution, Phase 28), and swap the
`⊞` glyph for the appropriate lucide icon (e.g. `LayoutGrid`). Small, mechanical; candidate for
a polish pass or fold into the next milestone touching /knowledge.

## Resolution

Closed by Phase 51 plan 51-04 (RSKN-03). Both items resolved exactly per the proposed solution:
all four `bg-background/70 backdrop-blur-md` surfaces converted to solid `bg-background/95`
(no blur utility remains), and `graph-toolbar.tsx:73`'s raw `⊞` glyph replaced with a
`lucide-react` `LayoutGrid` icon. D-48-06 hover/active convention also applied to the
toolbar's zoom-to-fit/layout-toggle buttons and the filter-rail's node-type checkbox rows
(neutral/ghost recipe: `hover:bg-accent hover:text-accent-foreground` +
`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`, the checkbox's
focus ring routed through a `peer`/`peer-focus-visible` pair since the native input is
visually `sr-only`). Tier/graph badges (`tier-filter-control.tsx`, `node-detail-pane.tsx`'s
Instance/Component badges) confirmed already on their `TOKN-04/05` `color.graph.*` tokens —
untouched, no drift found. `edge-detail-popover.tsx` was not opened (out of this plan's
`files_modified`, content order LOCKED). Verified: zero `backdrop-blur`/`⊞`/raw-palette
classes across all four files, `token-contrast.test.ts` + `token-registration.test.ts` green,
`tsc --noEmit` clean outside the pre-existing `apps/web/src/app/dev/design/` scratch exclusion.
See `.planning/phases/51-total-ui-re-skin/51-04-SUMMARY.md` for full detail.
