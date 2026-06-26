---
phase: "10"
plan: "05"
subsystem: web-ui
tags: [entities-gallery, next-js, trpc, table-view, mosaic-view, navigation]
dependency_graph:
  requires: [10-04]
  provides: [entities-gallery-page, entities-table-D15, entities-mosaic-D14, sidebar-live-D21]
  affects: [apps/web/src/app/entities, apps/web/src/components/app-sidebar.tsx]
tech_stack:
  added: []
  patterns:
    - limit+1 pagination idiom for hasMore detection
    - useRef-based filter-change detection to reset accumulated pages
    - GalleryItem interface exported from table component, imported by gallery + mosaic
key_files:
  created:
    - apps/web/src/app/entities/page.tsx
    - apps/web/src/app/entities/_components/entities-gallery.tsx
    - apps/web/src/app/entities/_components/entities-table.tsx
    - apps/web/src/app/entities/_components/entities-mosaic.tsx
  modified:
    - apps/web/src/components/app-sidebar.tsx
decisions:
  - "GalleryItem interface lives in entities-table.tsx and is re-exported — avoids duplication across gallery + mosaic"
  - "Filter-reset via useRef prev-values comparison — more explicit than dependency array side-effects"
  - "formatRelativeDate and formatKeyIdentifiers duplicated in table and mosaic (small pure helpers, no cross-component import needed)"
  - "D-02: status filter default = 'confirmed' hides candidates by default"
metrics:
  duration: "~30 minutes (continuation from prior session)"
  completed_date: "2026-06-14"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 10 Plan 05: Entities Gallery Page Summary

Entities gallery at `/entities` with dual-view (table D-15 + mosaic D-14), full filter bar (entity type, status, sort, debounced search), load-more pagination via `api.entities.list`, and sidebar nav promotion from Soon to Live (D-21).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | `/entities` page wrapper + gallery client shell | c860395 | page.tsx, entities-gallery.tsx |
| 2 | 7-column entities table + responsive mosaic grid | c860395 | entities-table.tsx, entities-mosaic.tsx |
| 3 | Promote Entities sidebar nav item to live | cc5f57c | app-sidebar.tsx |

## What Was Built

### Task 1 — Page Wrapper + Gallery Shell (`entities-gallery.tsx`)

- Next.js App Router server-component page at `apps/web/src/app/entities/page.tsx` with `metadata` (`title: "Entities — Nauta"`).
- `"use client"` gallery shell with:
  - `useDebounce<string>(searchRaw, 300)` hook for 300 ms search debounce feeding pg_trgm
  - State: `view: 'table'|'mosaic'` (default 'table'), `searchRaw`, `entityTypeId`, `status: StatusFilter` (default 'confirmed' per D-02), `sort: SortOption` (default 'last_seen'), `offset`, `allItems`
  - `useRef`-based prev-filter comparison to reset `offset` + `allItems` on any filter change
  - `api.entityTypes.list.useQuery({ includeInactive: false })` for type filter Select options
  - `api.entities.list.useQuery(...)` with limit+1 idiom (`limit: 25`, `offset`)
  - `useEffect` appending new page to `allItems` (offset > 0) or replacing (offset = 0)
  - Glass header with `role="main" aria-label="Entities gallery"`, h1 + live count badge + view toggle `role="group" aria-label="Gallery view"`
  - Filter bar: Search `type="search" aria-label="Search entities"`, entity-type Select, status Select (4 options including "Needs review" = `has-pending-duplicates`), sort Select
  - "Clear filters" ghost Button visible only when filters deviate from defaults
  - Content states: TableSkeleton/MosaicSkeleton, ErrorState, EmptyState (Boxes icon), SparseState (candidate-only tip), table/mosaic + Load-more button with Loader2 spinner

### Task 2 — Table (D-15) + Mosaic (D-14)

**`entities-table.tsx`**:
- Exports `GalleryItem` interface (re-used by gallery + mosaic)
- `SortableHead` with `aria-sort="ascending|descending|none"`, ChevronUp/ChevronDown affordance
- 7 columns: Display name (violet dot + Link), Entity type (violet Badge), Key identifiers (truncated + title tooltip), Occurrences (tabular-nums right-align), Last seen (relative date + ISO title), Status badge, Pending duplicates orange Badge
- Candidate rows: `bg-amber-50/50 dark:bg-amber-950/10`
- Status badges: confirmed = `bg-primary/10 text-primary border-primary/20`, candidate = amber tokens
- Row `onClick` → `router.push('/entities/[id]')`; Link `onClick` stops propagation

**`entities-mosaic.tsx`**:
- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6`
- `MosaicCard` with `role="article" aria-label="{displayName} entity"`, click navigation
- Candidate cards: `bg-amber-50/60 dark:bg-amber-950/10 border-amber-200/60`
- Card anatomy: entity-type violet badge + status badge row → CardTitle (line-clamp-2) → identifiers → occurrences + last seen → conditional pending-duplicates orange badge

### Task 3 — Sidebar Nav Promotion

Moved `{ label: "Entities", icon: Boxes, soon: true }` from `SOON_NAV_ITEMS` to `LIVE_NAV_ITEMS` as `{ href: "/entities", label: "Entities", icon: Boxes }`. Knowledge remains the only Soon item. The existing `isActiveRoute` prefix-match handles `/entities/[id]` highlighting.

## Verification

- `npx tsc --noEmit`: clean (zero output)
- `npm run build`: succeeded — `/entities` compiled as static route at 6.96 kB + 179 kB First Load JS
- Sidebar assertions: `href: "/entities", label: "Entities"` FOUND in LIVE_NAV_ITEMS; `label: "Entities", icon: Boxes, soon` NOT present in SOON_NAV_ITEMS

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `api.entities.list` and `api.entityTypes.list` are wired to real tRPC procedures from Phase 10-04. No hardcoded placeholder data flows to the UI.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. All data flows through the existing tRPC appRouter. No XSS vectors (no `dangerouslySetInnerHTML`). No fetch/X-API-Key calls in gallery components.

## Self-Check: PASSED

- `apps/web/src/app/entities/page.tsx`: EXISTS
- `apps/web/src/app/entities/_components/entities-gallery.tsx`: EXISTS
- `apps/web/src/app/entities/_components/entities-table.tsx`: EXISTS
- `apps/web/src/app/entities/_components/entities-mosaic.tsx`: EXISTS
- `apps/web/src/components/app-sidebar.tsx`: MODIFIED (Entities → LIVE_NAV_ITEMS)
- Commit c860395: EXISTS (Tasks 1+2)
- Commit cc5f57c: EXISTS (Task 3)
- Build: `/entities` route compiled successfully
