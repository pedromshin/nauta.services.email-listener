---
phase: 09-entity-field-region-relationships-canvas
plan: 05
subsystem: web-ui
tags: [shadcn, sidebar, next-themes, app-shell, theming, D-21]
status: complete
dependency_graph:
  requires:
    - "@nauta/ui shadcn primitives (button/input/separator/sheet/skeleton/tooltip)"
    - "globals.css --sidebar-* HSL tokens (already present, :root + .dark)"
    - "packages/ui/tailwind.config.ts sidebar.* color family mapping (already present)"
    - "next-themes ^0.3.0 (already a @nauta/ui dependency)"
  provides:
    - "@nauta/ui/sidebar — canonical shadcn sidebar block (SidebarProvider/Sidebar/SidebarInset/SidebarTrigger/SidebarContent/SidebarHeader/SidebarFooter/SidebarMenu/SidebarMenuItem/SidebarMenuButton/useSidebar + full family)"
    - "apps/web ~/components/theme-provider.tsx — typed next-themes ThemeProvider wrapper"
  affects:
    - "09-06 (app shell — wires SidebarProvider/AppSidebar/SidebarInset + ThemeProvider into layout.tsx)"
    - "09-07 (entity-types page — renders under the shell)"
tech_stack:
  added: []
  patterns:
    - "Hand-vendored shadcn block into @nauta/ui (resizable.tsx precedent) — no shadcn CLI init, no new dependency"
    - "cn from @nauta/ui barrel; sibling primitives via relative imports (./button, ./sheet, ...)"
    - "Consumption via the @nauta/ui/* subpath wildcard export (@nauta/ui/sidebar) — barrel index.ts keeps exporting only cn"
    - "next-themes wrapper forwards ComponentProps<typeof NextThemesProvider>, explicitly typed"
key_files:
  created:
    - packages/ui/src/sidebar.tsx
    - apps/web/src/components/theme-provider.tsx
  modified: []
decisions:
  - "D-21 sidebar + theming primitives added with zero new design tokens and zero new npm dependencies"
metrics:
  duration: ~3m
  tasks: 2
  files: 2
  completed: 2026-06-13
---

# Phase 9 Plan 05: Sidebar Primitive + Theming Wrapper Summary

Added the two missing app-shell prerequisites for D-21: a hand-vendored canonical shadcn `sidebar` block in `@nauta/ui` (consumed via `@nauta/ui/sidebar`) reusing the already-present `--sidebar-*` HSL tokens, and a typed `next-themes` ThemeProvider wrapper in `apps/web` — both with no new design tokens and no new npm dependency.

## What Was Built

### Task 1 — `@nauta/ui` shadcn sidebar block (commit `4311d42`)
- `packages/ui/src/sidebar.tsx`: the canonical shadcn `sidebar` block, authored by hand from the published block source (the `resizable.tsx` vendoring precedent — no shadcn CLI init was run, `components.json` interactive init avoided per T-09-40).
- Imports adapted to the `@nauta/ui` convention: `cn` from the `@nauta/ui` barrel; `Button`, `Input`, `Separator`, `Sheet`/`SheetContent`/`SheetTitle`/`SheetDescription`, `Skeleton`, `Tooltip`/`TooltipContent`/`TooltipProvider`/`TooltipTrigger` from their relative sibling modules (`./button`, `./sheet`, …) — matching how `alert-dialog.tsx`, `command.tsx`, and `theme.tsx` reference siblings in this package.
- `useIsMobile` hook provided **inline** (matchMedia at the 768px breakpoint) rather than a separate `use-mobile.ts`, since it is only consumed by the block.
- Styling uses the existing `bg-sidebar` / `text-sidebar-foreground` / `bg-sidebar-accent` / `border-sidebar-border` / `ring-sidebar-ring` utilities. These resolve against the `--sidebar-*` HSL vars (already defined in `globals.css` for both `:root` and `.dark`) via the `sidebar.*` color family already mapped in `packages/ui/tailwind.config.ts`. **No new tokens, no tailwind-config change.**
- Exports the full sidebar family, including all app-shell members the plan required: `SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar` (plus `SidebarRail`, `SidebarSeparator`, `SidebarGroup*`, `SidebarMenuSub*`, `SidebarMenuAction/Badge/Skeleton`, `SidebarInput`).

### Task 2 — next-themes ThemeProvider wrapper (commit `f97371b`)
- `apps/web/src/components/theme-provider.tsx`: a `"use client"` wrapper that re-exports `next-themes`' `ThemeProvider as NextThemesProvider`, forwarding all props (`ComponentProps<typeof NextThemesProvider>`), explicitly typed with a `ReactElement` return.
- Created the `apps/web/src/components/` directory (this is its first occupant; resolves via the `~/components/*` alias used by 09-06).
- `layout.tsx` deliberately left untouched — 09-06 wires the provider with `attribute="class" defaultTheme="system" enableSystem` + `suppressHydrationWarning`.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| packages/ui typecheck | `cd packages/ui && npx tsc --noEmit` | exit 0 |
| apps/web typecheck | `cd apps/web && npx tsc --noEmit` | exit 0 (next-themes resolves; new sidebar block doesn't break web tsc) |
| api-client build | `cd packages/api-client && npm run build` | exit 0 (no cross-package regression) |
| No new dependency | `git diff packages/ui/package.json` | empty (T-09-40 / T-09-SC satisfied) |
| Required exports present | grep of 11 named exports | all FOUND |
| `layout.tsx` untouched | `git diff apps/web/src/app/layout.tsx` | empty |

## Deviations from Plan

### [Rule 3 - Alignment with established codebase convention] Sidebar consumed via subpath wildcard, NOT a barrel re-export

- **Found during:** Task 1.
- **Plan instruction:** "Add the sidebar exports to `packages/ui/src/index.ts` following the existing barrel pattern" and acceptance criterion "`packages/ui/src/index.ts` re-exports the sidebar module."
- **Reality:** `packages/ui/src/index.ts` exports **only** `cn`. No component in this package is re-exported from the barrel. Every component is consumed via the per-file subpath wildcard declared in `package.json` (`"./*": ["./src/*.tsx", "./src/*.ts"]`), e.g. `@nauta/ui/button`, `@nauta/ui/resizable`. Verified across all existing consumers in `apps/web` (`@nauta/ui/button`, `@nauta/ui/tooltip`, `@nauta/ui/skeleton`, …).
- **Decision:** Followed the real convention — `@nauta/ui/sidebar` is already exposed by the existing `"./*"` wildcard with no change to `index.ts`. Re-exporting client components from the barrel would (a) be inconsistent with every other primitive, (b) risk pulling a client-only component into the `cn`-only barrel that server code imports. The plan's own interface note ("match the existing re-export style") points at this convention; the established style is *not* barrel re-export. No barrel edit, no `package.json` edit.
- **Files modified:** none beyond the created `sidebar.tsx`.
- **Impact:** 09-06 must import the shell members from `@nauta/ui/sidebar` (the subpath), exactly as the Pattern map already shows (`import { SidebarProvider } from "@nauta/ui/sidebar"`). No downstream change.

### [Minor] theme-provider path — followed PLAN over a stale UI-SPEC line

- The plan frontmatter, Task 2 action, and the Pattern map all specify `apps/web/src/components/theme-provider.tsx` (and the 09-06 layout import is `~/components/theme-provider`). One line of `09-UI-SPEC.md` (§Component Inventory) lists `apps/web/src/app/_components/` instead. Followed the PLAN (the authoritative execution artifact) — `apps/web/src/components/theme-provider.tsx`.

No auto-fixed bugs (Rule 1), no auto-added critical functionality (Rule 2), no architectural changes (Rule 4), no authentication gates. No new dependency was required, so no package-legitimacy checkpoint (T-09-40 default path held).

## Known Stubs

None. Both files are complete, typed, and gate-green. The sidebar block and theme wrapper are intentionally not yet *wired* into `layout.tsx` — that wiring is 09-06's explicit scope (the plan's `done` criteria say "ready to wire into the root layout"), not a stub.

## Threat Flags

None. Both artifacts are pure presentational client components — no network endpoints, no auth paths, no file access, no schema changes. T-09-41 (Information Disclosure) disposition `accept` holds: no secrets, no data access. T-09-40 / T-09-SC (Tampering via new dependency) mitigated — `git diff package.json` is empty.

## Self-Check: PASSED

- packages/ui/src/sidebar.tsx — FOUND
- apps/web/src/components/theme-provider.tsx — FOUND
- Commit 4311d42 — FOUND
- Commit f97371b — FOUND
