# Frontend snappiness plan — perceived performance for apps/web

Date: 2026-07-23. Scope: **apps/web only** (Next 15.3, React 19.2, tRPC 11.8, TanStack Query 5.62, xyflow 12, zustand). Grounds and operationalizes §6 of `.planning/research/2026-07-22-ecosystem/app-packages.md` ("Next.js 15 / React 19 snappiness") against the actual routing/data-fetch shape of the app. Targets vision-doc line 189 ("reducing frontend clunkiness… snappier").

**Stack rules that constrain every item here** (from CLAUDE.md / RUN-LOCAL.md):
- npm workspaces, **never pnpm**. Node >= 20.12.
- Build while a dev server is live only via `npm run build:local` (`.next-verify`) — plain `next build` corrupts `.next` (999.22 trap).
- jsdom/vitest proves nothing visual. Every measurement below uses the **real-browser gates**: `npm run test:geometry` and `npm run screenshot:review` in `apps/web`, against an **already-running** server on :3000 (`npm run web:dev` at repo root). Never bare `npx playwright test`; never add a `webServer` block.

---

## 0. Baseline reality (what the code actually does today)

Findings from the current tree — these are the levers:

1. **Zero `loading.tsx` files.** `find src/app -name loading.tsx` → none. Every route paints *nothing* between click and first client render. Skeletons exist (`packages/ui` `Skeleton`, `chat/_canvas/canvas-skeleton.tsx`) but they are gated behind a client `isLoading` flag *inside* an already-hydrated component — they never cover the navigation gap itself.
2. **Most list/index pages are `"use client"`** and fetch on the client after hydration. `src/app/page.tsx` (the inbox) is `"use client"`, calls `api.emails.listThreads.useQuery(...)` — so the sequence is: navigate → download route JS → hydrate → *then* fire the tRPC request → spinner → data. Same shape for `knowledge/page.tsx`, `files/page.tsx`, `capabilities/page.tsx`, `entity-types/page.tsx`, `references/page.tsx`, `chat/page.tsx`.
3. **Detail routes are RSC but do no server work.** `emails/[id]/page.tsx`, `entities/[id]/page.tsx`, `documents/[id]/page.tsx`, `sessions/[id]/page.tsx` are `async` server components that only `await params` and hand the id to a client component. No server prefetch, no streamed shell.
4. **No server prefetch / HydrationBoundary anywhere.** `grep HydrationBoundary|prefetch` over `src/app` → nothing. `src/trpc/query-client.ts` already wires `dehydrate`/`hydrate` + SuperJSON and `shouldDehydrateQuery` includes `pending` queries — the plumbing for streamed SSR prefetch exists and is unused.
5. **`httpBatchLink`, not `httpBatchStreamLink`** (`src/trpc/react.tsx:43`, and a second client in `files/_lib/vault-api.tsx:106`). A batch of queries resolves as one unit — the slowest query blocks delivery of the fast ones (head-of-line blocking).
6. **No `experimental.staleTimes`** in `next.config.mjs`. Next 15 defaults `staleTimes.dynamic = 0`; back/forward and re-navigation always tear down and refetch the client subtree.
7. **No `router.prefetch` / hover-prefetch** for inbox→detail. `next/link` is used in inbox/entities/sessions but dynamic authed routes get little benefit from the default viewport prefetch.
8. **Optimistic mutations are strong in the email-detail surface, thin elsewhere.** Real `onMutate`+rollback: `use-role-mutations.ts`, `use-region-edit.ts`, `entities/[id]/use-entity-curation.ts`, `entity-types/use-entity-type-admin.ts`, `references-surface.tsx`. No `useOptimistic` anywhere. Mutation sites with **no** optimism (audit targets): `chat/_canvas/use-canvas-persistence.ts`, `files/_components/vault-surface.tsx` + `files/_lib/use-vault-upload.ts`, `knowledge/_components/knowledge-graph.tsx`, `chat/_components/conversation-rail.tsx`, `chat/_hooks/use-conversation-controller.ts`, `chat/_components/model-picker.tsx`, `emails/[id]/use-autofill*.ts`.
9. **Canvas jank baseline is partly handled:** `nodeTypes`/`edgeTypes` are already module-scope (`chat-canvas.tsx` imports `./node-types`, `./edge-types`) — the #1 xyflow footgun is avoided. Remaining canvas risks are selector granularity and layout thrash, addressed in §6.
10. **No React Compiler, no View Transitions** enabled (`next.config.mjs` has neither flag).

**One-time global baseline to capture before any change** (so every item has a before/after): a short client-side perf harness page-load script that records, per route, Navigation Timing + LCP + INP via `PerformanceObserver`, plus a manual React DevTools Profiler commit trace on the canvas and inbox. Store raw numbers in `.planning/ui-reviews/<timestamp>/perf-baseline.md` (gitignored dir, same place `screenshot:review` writes). This directory contains signed-in state — read the PNGs/notes locally, do not commit.

---

## 1. Route-transition audit — add `loading.tsx` skeletons (highest leverage, lowest risk)

**Problem:** items 1–3 above — the click-to-first-paint gap is 100% blank because there is no route-level fallback and index pages don't render until hydrated + fetched.

**Plan:**
- Add a `loading.tsx` next to every route segment that fetches on mount. Each renders the *same shell chrome* as the loaded page with `Skeleton` blocks where data lands — so the frame (sidebar inset height, three-pane split, toolbar) paints instantly and only the data region shimmers. Reuse existing skeletons where present.
- Target files (new):
  - `src/app/loading.tsx` — inbox three-pane skeleton (mirror `_components/inbox-three-pane.tsx` `isLoading` branch; the `Skeleton` + `ResizablePanelGroup` structure already exists there — lift it into the route fallback).
  - `src/app/knowledge/loading.tsx` — reuse `knowledge/_components/graph-states.tsx` loading state.
  - `src/app/files/loading.tsx`, `src/app/entities/loading.tsx`, `src/app/entity-types/loading.tsx`, `src/app/capabilities/loading.tsx`, `src/app/references/loading.tsx`, `src/app/sessions/loading.tsx`.
  - `src/app/emails/[id]/loading.tsx` — email-detail skeleton (the RSC page currently returns the client `EmailDetail` with its own internal spinner; a route fallback covers the params-await + hydration window).
  - `src/app/chat/loading.tsx` — reuse `chat/_canvas/canvas-skeleton.tsx`.
- Keep each fallback **layout-identical** to the real surface (same paddings, same `--app-tabbar-h` calc) so there is no layout shift when data swaps in (ties into §7 CLS).

**Before/after measurement:**
- Before: with server on :3000, `npm run screenshot:review` — capture the mid-navigation frame is not directly scriptable, so instead use `test:geometry` to assert the loaded frame's box, and a Playwright trace (`--trace on` is fine inside the existing geometry config invocation) navigating inbox→`/knowledge` to record the blank interval.
- After: same trace shows shell painted at first frame. Metric: time-to-first-meaningful-paint on navigation (Navigation Timing `responseEnd`→first contentful frame) should drop from "blank until fetch" to "<100 ms shell". Assert no CLS regression via `screenshot:review` diff (loaded frame pixel-identical to before).

---

## 2. RSC / streaming boundaries — move index fetches server-side with streamed prefetch

**Problem:** items 2–4. Client-only index pages serialize as: hydrate → fetch → paint. The `dehydrate`/`hydrate` config in `query-client.ts` is already built for the fix and unused.

**Plan (per surface, start with the inbox as the reference implementation):**
1. Convert the route `page.tsx` to an **RSC that prefetches** the first query into a server-side QueryClient and wraps the client subtree in `<HydrationBoundary state={dehydrate(queryClient)}>`. Requires a server-side tRPC caller. If `packages/api-client` doesn't already expose a server helper, add `src/trpc/server.ts` (a `createHydrationHelpers`/server caller using the same `AppRouter`) — mirror the `src/trpc/react.tsx` client but for RSC. The query streams to the browser and the client `useQuery` reads it from the hydrated cache with no second request (SSR + `staleTime: 30s` already set in `query-client.ts` prevents the immediate client refetch).
2. Keep the interactive parts client (`inbox-three-pane.tsx` stays `"use client"`) — only the *data fetch* moves to the server boundary. `src/app/page.tsx` becomes an RSC that prefetches `emails.listThreads` and renders `<HydrationBoundary>` around `<InboxThreePane>`.
3. Wrap slow secondary panels in `<Suspense>` so the shell paints before they resolve — e.g. the inbox entities rail (`inbox-entities-rail.tsx`, `emails.entitySummary`) and email-detail's heavier sub-queries. Detail route `emails/[id]/page.tsx` prefetches `emails.detail` and streams the region/entity panels behind Suspense boundaries so the email body paints first.
4. Surfaces to convert, in order of traffic/leverage: inbox (`page.tsx`) → `emails/[id]` → `knowledge` → `entities` → `files`.

**Target files:** `src/app/page.tsx`, `src/app/emails/[id]/page.tsx`, `src/app/knowledge/page.tsx`, `src/app/entities/page.tsx`, `src/app/files/page.tsx`; new `src/trpc/server.ts`; Suspense wrappers inside `inbox-three-pane.tsx`, `emails/[id]/_components/email-detail.tsx`.

**Before/after measurement:**
- Instrument each converted route with the §0 PerformanceObserver harness: record LCP and the timestamp of the first `emails.listThreads` network call. Before: a client `/api/trpc` request fires ~after hydration. After: **no** client request for the initial data (served from hydrated cache) — verify in a Playwright network-log assertion that `/api/trpc?batch=1&...listThreads` is absent on first paint.
- LCP target: index-route LCP improves by roughly the client fetch round-trip (the tRPC request currently on the critical path). Confirm the frame is pixel-stable with `screenshot:review`.

---

## 3. tRPC transport — switch to `httpBatchStreamLink`

**Problem:** item 5. `httpBatchLink` holds the whole batch until every query in it resolves.

**Plan:** swap `httpBatchLink` → `httpBatchStreamLink` in `src/trpc/react.tsx` (and the vault client `files/_lib/vault-api.tsx`), keeping `transformer: SuperJSON`, the logger link, and headers. Streaming delivers each query's payload as it resolves, so a fast `emails.list` isn't blocked by a slow `emails.entitySummary` batched with it. Low risk — same wire protocol family, purely additive to perceived latency on multi-query pages (inbox fires list + entitySummary together; email detail fans out several).

**Target files:** `src/trpc/react.tsx:43`, `src/app/files/_lib/vault-api.tsx:106`.

**Before/after measurement:** with the server running, open the inbox with DevTools/Playwright network capture. Before: the batched `/api/trpc` response arrives as one chunk at `max(query latencies)`. After: chunked transfer, first query's data usable at `min(query latency)`. Metric: time from request start to first query settled in the TanStack cache (instrument via a QueryClient `queryCache.subscribe` logger in dev). Assert no correctness regression via existing `test:geometry`.

---

## 4. Router cache + deliberate prefetch (inbox → detail)

**Problem:** items 6–7. Re-navigation refetches (staleTimes.dynamic=0); inbox rows don't warm the detail route.

**Plan:**
1. In `next.config.mjs` add `experimental: { staleTimes: { dynamic: 30, static: 180 } }` so back/forward and quick re-visits reuse the client router cache for dashboard-like surfaces. Conservative 30s dynamic — pair with the tRPC-layer `staleTime: 30s` already in `query-client.ts` so the two caches agree.
2. **Hover/focus prefetch** on inbox rows and entity/session lists: call `router.prefetch('/emails/'+id)` on `onPointerEnter`/`onFocus`, and in parallel `utils.emails.detail.prefetch({ id })` (TanStack prefetch) so both the route JS/RSC payload *and* the tRPC data are warm before the click. Debounce (~80 ms) to avoid prefetch storms on fast mouse travel; cap concurrent prefetches.
3. Target the highest-frequency transition first (inbox row → email detail), then entities-table → entity detail, sessions-list → session.

**Target files:** `next.config.mjs`; `src/app/_components/inbox-row.tsx` / `inbox-thread-group.tsx` (row hover handler), `src/app/_components/inbox-three-pane.tsx`; `src/app/entities/_components/entities-table.tsx` + `entities-mosaic.tsx`; `src/app/sessions/_components/sessions-list.tsx`. Prefetch helper could live in a small `src/hooks/use-hover-prefetch.ts`.

**Before/after measurement:** Playwright script: hover an inbox row for 200 ms, then click, and record click→detail-LCP. Before: click triggers cold route + cold fetch. After: click→interactive should approach zero network on the critical path (both caches warm). Also assert back-navigation (`goBack`) shows the inbox instantly with no `/api/trpc` refire (network-log assertion) once `staleTimes` is set.

---

## 5. Optimistic UI audit — canvas + inbox + the thin mutation sites

**Problem:** item 8. Email-detail is a good template; other surfaces mutate then wait for a refetch (visible lag).

**Plan — bring each unoptimistic mutation up to the `use-role-mutations.ts` pattern** (`onMutate`: `cancel()` → snapshot → `setData()` → return ctx; `onError`: revert + toast; `onSuccess`: single trailing `invalidate`). Prioritized:
1. **Canvas layout persistence** (`chat/_canvas/use-canvas-persistence.ts`): node drag/resize/create should feel instant. The xyflow store already updates locally on drag; ensure the *persistence* mutation never blocks or reverts the on-screen node except on real error, and debounce the save (already a `save-status-indicator.tsx` exists — verify it reflects optimistic state, not request state). This is local-state-first, so the fit is React's `useOptimistic` **only** if there's an action-state view; otherwise keep the local zustand store authoritative and treat the server as write-behind.
2. **Inbox** (`src/app/page.tsx` / `inbox-three-pane.tsx`): mark-read / archive / rule-accept (`mail-rule-review.tsx`) should optimistically patch the `emails.listThreads` cache (remove/flag the row) with rollback — today these round-trip. This is where inbox "clunk" is most felt.
3. **Files/vault** (`files/_components/vault-surface.tsx`, `files/_lib/use-vault-upload.ts`): show the file row immediately on upload start (optimistic insert with an "uploading" state) rather than after the signed-URL round-trip + list refetch. Rename/delete optimistic with rollback.
4. **Knowledge** (`knowledge/_components/knowledge-graph.tsx`): node/edge promote/reject optimistic.
5. **Chat** (`conversation-rail.tsx` new-conversation, `model-picker.tsx`): optimistic list insert / selection.

`useOptimistic` (React 19) is the right tool **only** for component-local action state (e.g. chat composer send pending bubble) — not for the shared tRPC cache, which stays on the `onMutate`/`setData` pattern.

**Target files:** the seven mutation sites listed in §0 item 8.

**Before/after measurement:** Playwright interaction latency — click the affected control and measure time to visual state change (poll for the DOM class/text flip). Before: change appears after the mutation + invalidate settle (network-bound). After: <16 ms (next frame), network happening in the background; and an injected-failure path (mock the tRPC endpoint to 500) shows the rollback + toast. Verify the optimistic frame visually with `screenshot:review`.

---

## 6. Canvas-specific snappiness (xyflow)

**Problem:** canvas is the heaviest surface; nodeTypes identity is already handled (§0 item 9), so remaining wins are selector granularity, render volume, and drag smoothness.

**Plan:**
1. **zustand selector granularity** (`chat/_canvas/canvas-store-context.tsx`): confirm every node subscribes only to its own slice (`useStore(s => s.nodes[id])`-style) rather than the whole nodes array — a coarse selector re-renders all nodes on any single-node change. Split selectors; use `useShallow` for object returns. Grep the `_canvas` components for `useStore(`/`useCanvasStore(` calls returning arrays/objects without a shallow comparator.
2. **Memoize node bodies**: the heavy nodes (`genui-panel-node.tsx`, `email-thread-node.tsx`, `document-node.tsx`, `editor-node.tsx`, spreadsheet host) should be `React.memo` with stable props; verify handlers passed in are stable (module-scope or `useCallback` with correct deps). This is exactly the class of missed-memo the **React Compiler** would erase — see §8.
3. **Virtualize off-viewport nodes**: xyflow's `onlyRenderVisibleElements` for large canvases so panning doesn't render nodes far outside the viewport.
4. **Drag/pan = compositor, not layout**: ensure node transforms use `transform` (xyflow does) and that no node body triggers layout-affecting style changes during drag (§7).

**Target files:** `chat/_canvas/canvas-store-context.tsx`, `chat-canvas.tsx`, `genui-panel-node.tsx`, `email-thread-node.tsx`, `document-node.tsx`, `editor-node.tsx`.

**Before/after measurement:** React DevTools Profiler commit trace while dragging one node across a canvas of N nodes — before: commit touches ~all nodes; after: commit touches ~1. Frame-rate: capture a Playwright trace during a scripted pan and check for long tasks / dropped frames. Because this is geometric, gate the final result with `npm run test:geometry` (node boxes unchanged) and `screenshot:review` (no visual regression).

---

## 7. Avoiding layout thrash / CLS

**Problem:** skeleton→data swaps and font/theme changes can shift layout; jsdom can't see any of it (CLAUDE.md rule).

**Plan:**
1. **Reserve space in every skeleton** (§1): fallback blocks must match the loaded content's box (fixed row heights in inbox, fixed detail header height) so the swap is zero-CLS. The layout already sets `--app-tabbar-h` via `calc()` — skeletons must subtract the same var (`inbox-three-pane.tsx` already does `h-[calc(100svh-var(--app-tabbar-h))]`).
2. **Fonts**: `Archivo` is `next/font/google` with `display: "swap"` and self-hosted (layout.tsx) — good, but `swap` still causes a FOUT reflow. Confirm the fallback stack in `globals.css` `--font-sans` is metric-close to Archivo; if not, add `adjustFontFallback`/size-adjust to neutralize the swap reflow.
3. **Batch DOM reads/writes** in any imperative measure-then-mutate code (canvas fit-view, resizable panels, region-overlay geometry in `emails/[id]/_components`): read all geometry in one pass, then write — never interleave `getBoundingClientRect()` with style writes in a loop (forces synchronous reflow).
4. **`content-visibility: auto`** on long off-screen lists (inbox thread groups, entities table rows) to skip rendering/layout of off-screen content.

**Target files:** all `loading.tsx` from §1; `apps/web/globals.css` (`--font-sans`); `emails/[id]/_components/region-overlay-*` and `chat/_canvas` measure code; list components.

**Before/after measurement:** this is the canonical "jsdom can't see it" case — use the **real-browser gates only**. Add a CLS assertion to the geometry harness (PerformanceObserver `layout-shift` entries, assert cumulative < 0.02 on inbox load and detail load). `screenshot:review` diff before/after each skeleton confirms the loaded frame is pixel-identical (no shift on data swap). Never claim a CLS fix from a passing vitest run.

---

## 8. React Compiler + View Transitions (staged, flagged, measure-gated)

Lower priority / higher coordination cost — schedule after §§1–5 land.

1. **React Compiler** (stable 1.0): enable behind `experimental.reactCompiler` in a **verify build** (`npm run build:local`, per the 999.22 rule — never plain `build` against a live dev `.next`). The canvas + grid are memo-heavy hand-written `useMemo`/`useCallback`; the compiler removes whole classes of missed-memo re-renders and reduces the §6 hand-memoization burden. Strongest argument to schedule the Next 16 upgrade (stable integration there). Measure with the §6 Profiler traces + `test:geometry`.
   - Target files: `next.config.mjs` (flag), then remove now-redundant manual memoization incrementally.
2. **View Transitions** (`experimental.viewTransition: true` + React `<ViewTransition>`): adopt **narrowly** for one shared-element polish — inbox row → email-detail header — behind the flag. Do **not** build core UX on it (experimental in Next 15). Coordinate ownership with the `motion` library already in `packages/ui`: one owner per transition, or motion and VT fight. Keep it disable-able.
   - Target files: `next.config.mjs`; the inbox row + `emails/[id]/_components/email-detail.tsx` header.

**Before/after measurement:** Compiler — Profiler commit counts on canvas drag + inbox interaction before/after; bundle-size delta from `build:local` output. View Transitions — Playwright trace of the inbox→detail navigation showing a compositor-thread transition; `screenshot:review` on both themes (light + dark) to confirm no visual regression, since VT reparents elements.

---

## Sequencing (leverage per risk)

| Order | Item | Risk | Payoff |
|---|---|---|---|
| 1 | §1 `loading.tsx` skeletons | very low | kills the blank-navigation gap everywhere |
| 2 | §3 `httpBatchStreamLink` | very low | multi-query pages stop head-of-line blocking |
| 3 | §4 `staleTimes` + hover prefetch | low | instant back/forward + warm inbox→detail |
| 4 | §5 optimistic audit (inbox, vault, canvas) | medium | removes the felt "clunk" on writes |
| 5 | §2 RSC/streamed prefetch (inbox first) | medium | removes client fetch from first-paint critical path |
| 6 | §6 canvas selectors/memo/virtualize | medium | canvas drag/pan frame-rate |
| 7 | §7 CLS hardening | low (rides on §1) | zero-shift swaps |
| 8 | §8 React Compiler / View Transitions | higher (flagged) | structural re-render wins + polish |

Every item is gated by the **real-browser** measurement it names — a passing vitest/jsdom suite is never sufficient evidence for any of this work (CLAUDE.md "jsdom does no layout"). All perf artifacts go to the gitignored `.planning/ui-reviews/<timestamp>/` (signed-in state — do not commit).
