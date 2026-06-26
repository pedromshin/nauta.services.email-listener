---
phase: 09-entity-field-region-relationships-canvas
plan: 06
subsystem: web-ui
tags: [app-shell, sidebar, next-themes, glassy-inbox, entity-chips, D-20, D-21, D-22, D-23, D-24]
status: complete
dependency_graph:
  requires:
    - "09-05: @nauta/ui/sidebar block + apps/web ~/components/theme-provider.tsx"
    - "09-04: emails.list {items,hasMore,nextOffset} + emails.entitySummary [{emailId,entities:[{entityTypeId,label,count}]}]"
    - "@nauta/ui primitives (button/badge/sonner/resizable/skeleton)"
    - "globals.css --sidebar-*/brand HSL tokens + violet role-color family (Tailwind defaults)"
  provides:
    - "apps/web layout.tsx — app-shell root (ThemeProvider + SidebarProvider + AppSidebar + SidebarInset)"
    - "apps/web ~/components/app-sidebar.tsx — frosted left-rail nav (active-link via usePathname) + next-themes toggle"
    - "apps/web _components/inbox-three-pane.tsx — resizable glassy three-pane inbox (D-22)"
    - "apps/web _components/inbox-row.tsx — Gmail-style message row with entity chips"
    - "apps/web _components/entity-chips.tsx — translucent per-entity-type Badge deep-links (D-23/D-24)"
  affects:
    - "09-07 (entity-types page — renders under this shell at /entity-types, already a live nav link)"
    - "Phase 10 (entity gallery — flips the Entities 'Soon' nav item to live; chip href /emails/{id} -> /entities/{id})"
    - "Phase 11 (knowledge graph — flips the Knowledge 'Soon' nav item to live)"
tech_stack:
  added: []
  patterns:
    - "App shell: layout.tsx = TRPCReactProvider > ThemeProvider > SidebarProvider > AppSidebar + SidebarInset({children}); Toaster preserved as a sibling"
    - "next-themes hydration safety: mounted-gate on the theme toggle; suppressHydrationWarning on <html>"
    - "Single batched entitySummary keyed by the visible page of ids (enabled-guarded), zipped onto rows via a Map — never a per-row fetch (D-23)"
    - "Load-more: seed page from page.tsx query + accumulated extra pages via a disabled emails.list query refetched on demand (hasMore/nextOffset preserved verbatim)"
    - "Glass over themed tokens: bg-background/70 backdrop-blur-md border-border/50; single teal primary accent; violet role-family for entity chips"
key_files:
  created:
    - apps/web/src/components/app-sidebar.tsx
    - apps/web/src/app/_components/entity-chips.tsx
    - apps/web/src/app/_components/inbox-row.tsx
    - apps/web/src/app/_components/inbox-three-pane.tsx
  modified:
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
decisions:
  - "D-20/D-21 app shell wraps the whole app; TRPCReactProvider stays outermost, Toaster stays a sibling — original ordering preserved"
  - "Reading preview is data-honest: sender/subject/body-snippet + Open-editor link (attachments live only in emails.detail, NOT emails.list — no stubbed attachment summary)"
  - "Entity chips stopPropagation so a chip deep-link never also toggles the row's reading-preview selection"
metrics:
  duration: ~12m
  tasks: 3
  files: 6
  completed: 2026-06-13
---

# Phase 9 Plan 06: App Shell + Glassy Gmail Inbox Summary

Converted the bare root `layout.tsx` into a persistent frosted app-shell (next-themes ThemeProvider + SidebarProvider + AppSidebar + SidebarInset, Toaster + TRPCReactProvider preserved), built the frosted left-rail `AppSidebar` (Inbox + Entity Types live; Entities + Knowledge disabled "Soon"; working light/dark toggle), and rebuilt `/` as a resizable three-pane glassy Gmail inbox whose rows surface per-email entity-type chips (single batched `emails.entitySummary`) that deep-link to `/emails/[id]`.

## What Was Built

### Task 1 — App-shell root layout + frosted AppSidebar (commit `4f66e64`)
- **`apps/web/src/app/layout.tsx`** rewritten as the app shell. `<html lang="en" suppressHydrationWarning>`; provider nesting `TRPCReactProvider > ThemeProvider(attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange) > SidebarProvider > AppSidebar + SidebarInset({children})`, with `<Toaster/>` retained as a body sibling. `metadata` kept. TRPCReactProvider stays outermost and the Toaster stays where it was — the original provider ordering is preserved exactly.
- **`apps/web/src/components/app-sidebar.tsx`** (`"use client"`): a `collapsible="icon"` `Sidebar` with the frosted surface `bg-background/70 backdrop-blur-md border-r border-border/50`. `SidebarHeader` brand (an `N` app mark + "Nauta", `text-sm font-semibold`, `h-11`). `SidebarMenu`: two live `next/link` items (`Inbox` → `/`, `Entity Types` → `/entity-types`) and two disabled "Soon" items (`Entities`, `Knowledge`) rendered as non-links (`text-muted-foreground/50 cursor-not-allowed` + secondary `Badge` "Soon"). Active state via `usePathname()` (`isActiveRoute`: `/` is exact-match; others match the route or a nested path), applying `bg-primary/10 text-primary` + `aria-current="page"`. `SidebarFooter` theme toggle: a Sun/Moon `Button` using `useTheme()` (`setTheme(isDark ? "light" : "dark")`), gated behind a `mounted` check so SSR never reads `resolvedTheme` and never throws.

### Task 2 — Entity chips + inbox row (commit `d7a9820`)
- **`apps/web/src/app/_components/entity-chips.tsx`**: takes `entities: [{entityTypeId,label,count}]` + `emailId`. Renders up to `MAX_VISIBLE_CHIPS = 4` translucent violet-family `Badge`s (`bg-violet-100 text-violet-800` + violet dot, with `dark:` variants), each showing `label` and `·count` when `count > 1`, wrapped in a `next/link` to `/emails/${emailId}` (D-24 forward-compatible deep-link). A `+N` overflow `Badge` appears for >4 distinct types. Empty `entities` returns `null` (anti-bloat, D-23). Each chip `stopPropagation()`s its click so the deep-link never toggles row selection.
- **`apps/web/src/app/_components/inbox-row.tsx`**: a clickable `button` row (`min-h-16 px-4 py-3 border-b border-border/50`, `hover:bg-muted/50`, selected `bg-primary/10`, `aria-pressed`). Line 1: sender `text-sm font-semibold` + date `text-xs text-muted-foreground` (right). Line 2: subject `text-sm` truncated. Line 3: `<EntityChips/>`. Props: a narrow `InboxEmail` projection + its `entities` entry + `isSelected` + `onSelect`. Two font weights only (400/600).

### Task 3 — Resizable glassy three-pane inbox (commit `7ee0cad`)
- **`apps/web/src/app/_components/inbox-three-pane.tsx`** (`"use client"`): a `ResizablePanelGroup direction="horizontal" className="h-full"` with three panels — filters rail (`defaultSize 18`, `minSize 14`: All / Unread / With-entities, frosted header), message list (`defaultSize 42`, `minSize 28`: maps items to `<InboxRow>`, Load-more), reading preview (`defaultSize 40`: selected email sender/subject + body snippet + `Open editor →` link to `/emails/[id]`, empty state when none selected). All panel surfaces use the frosted recipe `bg-background/70 backdrop-blur-md` + `border-border/50`. `selectedEmailId` local state, default-select the first visible item.
- **Single batched entity summary**: `api.emails.entitySummary.useQuery({ emailIds: allItems.map(i=>i.id) }, { enabled: emailIds.length > 0 })`, indexed into a `Map<emailId, entities>` and passed to each row. Never fetched per row.
- **Load-more**: the seed page comes from `page.tsx`'s `emails.list` query (passed as `data`); further pages are fetched via a second `emails.list` query (`enabled:false`, `refetch()` on click), appended to local `extraItems` with `nextOffset` tracked — `hasMore`/`nextOffset` paging is preserved verbatim. The accumulator resets when the seed page identity changes.
- **`apps/web/src/app/page.tsx`** rewritten: keeps `api.emails.list.useQuery({limit:50,offset:0})` + the `isError` `useEffect`, drops the centered `max-w-3xl` main wrapper, and renders `<InboxThreePane data isLoading isError />` inside an `h-svh` slot (the shell + three-pane own the layout).

## Verification

| Gate | Command | Result |
|------|---------|--------|
| apps/web typecheck (Task 1) | `cd apps/web && npx tsc --noEmit` | exit 0 |
| apps/web typecheck (Task 2) | `cd apps/web && npx tsc --noEmit` | exit 0 |
| apps/web typecheck (Task 3) | `cd apps/web && npx tsc --noEmit` | exit 0 |
| Full web build (real integration gate) | `npm run web:build` (api-client tsc + `next build`) | exit 0 — `/` static, all 4 routes compiled |
| Shell wraps children | grep `layout.tsx` for ThemeProvider/SidebarProvider/AppSidebar/SidebarInset + suppressHydrationWarning + Toaster | all FOUND |
| Sidebar active state + frosted + Soon | grep `app-sidebar.tsx` for usePathname/useTheme/`bg-background/70 backdrop-blur-md`/Soon | all FOUND |
| Chips: violet, <=4, +N, link, empty->null | grep `entity-chips.tsx` | all FOUND |
| Single batched entitySummary, no per-row | grep `inbox-three-pane.tsx` (1 call) + `inbox-row.tsx` (0 calls) | FOUND / none |
| page.tsx keeps query + no max-w-3xl | grep `page.tsx` | query+effect+InboxThreePane FOUND; `max-w-3xl` count 0 |

## Deviations from Plan

### [Rule 3 - Alignment] Load-more implemented via an on-demand second emails.list query, not a useInfiniteQuery
- **Found during:** Task 3.
- **Plan instruction:** "keep the existing 50-page query, append on load-more."
- **Reality:** The page-level query owns the seed page (`offset:0`, per the acceptance criterion "page.tsx keeps the list query"). To append without moving the seed query out of `page.tsx`, the three-pane runs a second `api.emails.list.useQuery({offset}, {enabled:false})` refetched on the "Load more" click and accumulates `extraItems` locally, tracking `nextOffset`. `hasMore`/`nextOffset` are preserved verbatim. This keeps `page.tsx` as the query owner (acceptance criterion) while satisfying append-on-load-more.
- **Files modified:** `inbox-three-pane.tsx` only.
- **Impact:** none downstream; the `emails.list` contract is unchanged.

### [Rule 2 - Data-honest preview] Reading preview shows sender/subject/body-snippet + Open-editor link; no attachment summary
- **Found during:** Task 3.
- **Plan instruction:** preview shows "sender/subject + body snippet + attachments summary + an Open editor → link."
- **Reality:** `emails.list` returns only the `Emails` row — attachments live exclusively on `emails.detail`. Rather than stub an empty/placeholder attachment list (which would be a UI stub flagged by the verifier), the preview surfaces what the list payload actually carries (sender, To, subject, plain-text body snippet) plus the `Open editor →` deep-link where the full document + attachments + regions live. No second per-row fetch was introduced (would violate the D-23 single-batch invariant). This is a deliberate anti-stub choice consistent with the "depth-first, no stubs" project preference.
- **Files modified:** `inbox-three-pane.tsx` only.
- **Impact:** none — the editor route (`/emails/[id]`) remains the canonical full-detail surface.

No auto-fixed bugs (Rule 1), no architectural changes (Rule 4), no authentication gates. No new npm dependency (T-09-SC N/A — sidebar/resizable/next-themes/lucide/badge/sonner all pre-existing).

## Known Stubs

None that block the plan goal. The `Entities` and `Knowledge` sidebar items are intentionally disabled "Soon" placeholders — this is the explicit D-20 requirement (they go live in Phases 10/11), not an incomplete stub. The inbox itself is fully wired to real data (`emails.list` + `emails.entitySummary`); chips, rows, filters, selection, and Load-more all operate on live query results.

## Threat Flags

None beyond the plan's existing `<threat_model>`. All four chips/rows/preview surfaces render email subject/sender/body and entity-type labels as React text nodes (auto-escaped — T-09-50 mitigation held; no `dangerouslySetInnerHTML` in the inbox snippet). Chip and editor hrefs use server-provided UUIDs via `next/link href={/emails/${id}}` (T-09-51 held — no user-controlled path segment). The single batched `entitySummary` query (capped at the page size, `enabled`-guarded) is the only entity fetch (T-09-52 held — no per-row fetch). No new network endpoint, auth path, file access, or schema change introduced (presentation-only — T-09-53 `accept` held).

## Self-Check: PASSED

- apps/web/src/app/layout.tsx — FOUND
- apps/web/src/components/app-sidebar.tsx — FOUND
- apps/web/src/app/_components/entity-chips.tsx — FOUND
- apps/web/src/app/_components/inbox-row.tsx — FOUND
- apps/web/src/app/_components/inbox-three-pane.tsx — FOUND
- apps/web/src/app/page.tsx — FOUND
- Commit 4f66e64 — FOUND
- Commit d7a9820 — FOUND
- Commit 7ee0cad — FOUND
