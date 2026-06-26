---
phase: 11-knowledge-node-graph-view-4e-knowledge-graph
reviewed: 2026-06-15T00:00:00Z
depth: deep
files_reviewed: 19
files_reviewed_list:
  - packages/api-client/src/router/knowledge/graph.ts
  - packages/api-client/src/router/knowledge/list.ts
  - packages/api-client/src/router/knowledge/detail.ts
  - packages/api-client/src/router/knowledge/index.ts
  - packages/api-client/src/root.ts
  - packages/db/src/schema/knowledge-node-edges.ts
  - packages/db/src/schema/index.ts
  - packages/db/migrations/0019_cold_energizer.sql
  - packages/db/migrations/meta/_journal.json
  - packages/db/scripts/assert-knowledge-node-edges.ts
  - apps/web/src/app/knowledge/page.tsx
  - apps/web/src/app/knowledge/_components/knowledge-graph.tsx
  - apps/web/src/app/knowledge/_components/knowledge-graph-island.tsx
  - apps/web/src/app/knowledge/_components/knowledge-graph-skeleton.tsx
  - apps/web/src/app/knowledge/_components/graph-nodes.tsx
  - apps/web/src/app/knowledge/_components/graph-layout.ts
  - apps/web/src/app/knowledge/_components/filter-rail.tsx
  - apps/web/src/app/knowledge/_components/node-detail-pane.tsx
  - apps/web/src/app/knowledge/_components/graph-toolbar.tsx
  - apps/web/src/app/knowledge/_components/taxonomy-banner.tsx
  - apps/web/src/app/knowledge/_components/graph-states.tsx
  - apps/web/src/components/app-sidebar.tsx
  - apps/web/src/app/_components/inbox-three-pane.tsx
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** deep (cross-file: tRPC router ↔ DB schema ↔ React Flow client)
**Files Reviewed:** 19 source files (+ schema/use-site cross-references)
**Status:** issues_found

## Summary

The phase ships a read-only knowledge-graph surface: a knowledge tRPC router (`graph`/`list`/`byId`), the `knowledge_node_edges` table + migration 0019 + a live-DB assert gate, and a React Flow client island with filter rail, node detail pane, toolbar, and loading/error/no-schema states. Immutability, Zod input validation, named exports, and the D-09 read-only invariant are all honored, and migration journal bookkeeping is correct. The dagre layout, node components, and state machinery are sound.

However the review surfaces **one CRITICAL correctness regression in the live-UAT-fixed inbox file** (the batched entity-summary query overflows its `.max(100)` Zod cap after two "Load more" clicks, breaking entity chips for the entire list), plus a **data-contract mismatch** between the `graph` procedure's node payloads and the fields the NodeDetailPane is built to render (many detail sections render permanently empty), a **duplicate-edge-id hazard** that React Flow will reject, and a **cross-tenant data exposure** (graph/list/byId run on unauthenticated `publicProcedure` and the client never passes `importerId`, so all importers' nodes are returned). The duplicate-id and dangling-edge issues are entirely untested — the only tests cover the pure helper and the Zod schema, not the query logic. Two router procedures (`list`, `byId`) and one validated input field (`nodeTypes`) are dead/unused in this phase.

## Critical Issues

### CR-01: Batched `entitySummary` query overflows `.max(100)` after two "Load more" clicks — breaks entity chips for the whole inbox

**File:** `apps/web/src/app/_components/inbox-three-pane.tsx:191-195` (consumer) ↔ `packages/api-client/src/router/emails/entity-summary.ts:166` (`emailIds: z.array(z.string().uuid()).max(100)`)
**Issue:** The seed page is 50 emails (`apps/web/src/app/page.tsx:11`, `limit: 50`) and each "Load more" appends another 50 (`PAGE_SIZE = 50`, line 40). `emailIds` is derived from `allItems` (seed + all extra pages) with no slicing/cap:
```ts
const emailIds = useMemo(() => allItems.map((item) => item.id), [allItems]);
const entitySummaryQuery = api.emails.entitySummary.useQuery(
  { emailIds: emailIds as string[] },
  { enabled: emailIds.length > 0 },
);
```
After the second "Load more" (50 + 50 + 50 = 150 ids), the input violates the procedure's `.max(100)` and tRPC rejects the call with a Zod error. Because `entitiesByEmailId` is rebuilt from `entitySummaryQuery.data ?? []`, a rejected query yields an empty map, so **every** inbox row loses its entity chips (not just the overflow rows), and the `with-entities` filter silently shows nothing. This is reachable in normal use and is in the live-UAT-fixed file the task flagged for re-check. (The memoization fix in commit 5e13862 itself is correct — this is a separate, pre-existing defect the re-check exposes.)
**Fix:** Cap the ids sent to the batched query to the procedure limit (and/or page the rollup). Minimal fix:
```ts
const SUMMARY_BATCH_CAP = 100;
const emailIds = useMemo(
  () => allItems.slice(0, SUMMARY_BATCH_CAP).map((item) => item.id),
  [allItems],
);
```
Better: chunk `allItems` into ≤100-id batches and merge results, or raise the server cap deliberately and confirm the query plan. Do not leave the unbounded array feeding a `.max(100)` input.

## Warnings

### WR-01: NodeDetailPane reads fields the `graph` procedure never emits — most detail sections render permanently empty

**File:** `apps/web/src/app/knowledge/_components/node-detail-pane.tsx:179-355` ↔ `packages/api-client/src/router/knowledge/graph.ts:168-409`
**Issue:** The detail pane is built against a node shape the backend does not produce. Concretely:
- `EntityInstanceContent` (pane:214) reads `data.entityTypeName`; the instance node emits only `{id, type, label, entityTypeId}` (graph.ts:240-245) — the "Entity Type" row never renders.
- `EntityTypeFieldContent` (pane:183) requires `data.entityTypeName && data.entityTypeId`; the field node emits `{label, slug, fieldType, isRequired}` (graph.ts:195-202), no `entityTypeName`/`entityTypeId` — "Belongs to" never renders.
- `EmailComponentContent` (pane:232,243,257-274) reads `emailId`, `emailSender`, `emailSubject`, `matched`, `matchedInstanceName`; the component node emits only `{role, location}` (graph.ts:329-335) — the Email row is absent, Match status is hard-stuck on "Unmatched", and "Open editor →" never appears.
- `EmailContent` (pane:289-295) reads `data.sender`/`data.receivedAt`; the email node emits only `{id, type, label}` (graph.ts:354-358).
- `KnowledgeNodeContent` (pane:316,335) reads `data.content`; the knowledge node emits `{scope, source, confidence}` but NOT `content` (graph.ts:391-398) — the rule body never shows.

The UI silently degrades rather than crashing, so it looks "done" while several documented per-type sections are dead branches.
**Fix:** Make the contract explicit on one side. Either extend the `graph` node payloads to include the fields the pane renders (e.g. add `entityTypeName` to instance nodes via a join, `content` to knowledge nodes, `emailId`/`emailSubject` to component nodes), or trim the pane to only the fields actually emitted. Pick one and align both files; add a shared type so drift is caught at compile time.

### WR-02: Duplicate React Flow edge IDs when a component selects multiple instances of the same entity type

**File:** `packages/api-client/src/router/knowledge/graph.ts:290-295`
**Issue:** The component→entity_type edge id is `comp-type-${row.componentId}-${row.entityTypeId}`. `ComponentEntityCandidateLinks` is unique on `(componentId, entityInstanceId)` (component-links.ts:103-105), not on `(componentId, entityTypeId)`, and nothing constrains `wasSelected=true` to a single row per component. A component with two selected candidate links to two different instances **of the same entity type** produces two edges with identical ids. React Flow requires unique edge ids and will warn and drop the duplicate, silently losing an edge.
**Fix:** Make the id unique per source row, e.g. `comp-type-${row.componentId}-${row.entityInstanceId}` (or `${componentId}-${entityTypeId}-${entityInstanceId}`), or de-duplicate component→type edges into a Set keyed by `(componentId, entityTypeId)` before emitting.

### WR-03: Cross-tenant data exposure — graph/list/byId are unauthenticated and the client never scopes by importer

**File:** `packages/api-client/src/router/knowledge/graph.ts:133` (`publicProcedure`), `list.ts:44`, `detail.ts:30`; consumer `apps/web/src/app/knowledge/_components/knowledge-graph.tsx:199-202` (no `importerId` passed)
**Issue:** `importerId` is optional (graph.ts:65) and applied only as an `eq()` data filter; the client calls `api.knowledge.graph.useQuery({ includeInstances, includeEmails })` with no `importerId`, and `publicProcedure` has no auth/tenant context (`trpc.ts:63`). With no filter, every `where` collapses to "all rows", so the response contains entity types, instances, components, emails, and knowledge nodes for **all importers**. `byId` (detail.ts) does no importer scoping at all. This is consistent with the app-wide `publicProcedure` posture (entities/gallery.ts also optional-`importerId`), so it is a pre-existing architectural stance rather than a new bug — but this phase newly exposes importer-wide knowledge/email content on an unauthenticated endpoint, widening the blast radius.
**Fix:** Resolve `importerId` from server-side session/context (not a caller claim, per D-12) and require it, or gate these procedures behind an authenticated procedure. At minimum, document the single-tenant deployment assumption and ensure the deployment actually enforces one importer per environment before this ships to a multi-tenant context.

### WR-04: `String(row.location)` produces `"[object Object]"` as a component label fallback

**File:** `packages/api-client/src/router/knowledge/graph.ts:326-332`
**Issue:** `EmailComponents.location` is `jsonb` (components.ts:73) — an object like `{ page_index, polygon, ... }`. When `row.role` is null, the label falls back to `String(row.location)`, which renders the literal string `"[object Object]"` for any component whose role is unset. The comment acknowledges "coerce to string for label" but `String()` on an object is not a meaningful label.
**Fix:** Drop the `location` fallback (use `row.role ?? "component"`), or derive a real label from a known field (e.g. `location.page_index`). Do not `String()` a jsonb object.

### WR-05: `nodeTypes` is validated but never used — silent no-op input

**File:** `packages/api-client/src/router/knowledge/graph.ts:68` (declared) and query body (graph.ts:135-471, never referenced)
**Issue:** `graphInputSchema` declares and Zod-validates `nodeTypes: z.array(z.enum(NODE_TYPES)).optional()`, and a test asserts the allow-list (graph.test.ts:82-103), but the query body never reads `input.nodeTypes`. A caller passing `nodeTypes: ["email"]` gets the full default graph regardless. This is a misleading API contract — the field looks like a server-side filter but is inert (all filtering happens client-side via `visibleTypes`).
**Fix:** Either implement server-side filtering on `input.nodeTypes` or remove the field from the schema so the contract reflects reality.

### WR-06: `proOptions.hideAttribution: false` plus a non-functional disabled toolbar control

**File:** `apps/web/src/app/knowledge/_components/knowledge-graph.tsx:446`; `graph-toolbar.tsx:54-65`
**Issue:** Two minor robustness/UX defects: (1) `proOptions={{ hideAttribution: false }}` is the default; if the intent was to suppress the React Flow watermark it does the opposite — verify intent. (2) The toolbar renders a permanently `disabled` "Toggle layout" button with `aria-pressed={true}` and a placeholder `⊞` glyph (graph-toolbar.tsx:60-65). A disabled control with a pressed state and a placeholder icon is a confusing affordance shipped to users.
**Fix:** Confirm the attribution intent (set `hideAttribution: true` only if licensed to). Remove the dead layout-toggle button until a second layout exists, rather than shipping a disabled placeholder.

## Info

### IN-01: `knowledge.list` and `knowledge.byId` are unused dead exports in this phase

**File:** `packages/api-client/src/router/knowledge/list.ts:44`, `detail.ts:30`
**Issue:** A repo-wide search finds only `api.knowledge.graph.useQuery` consumed (knowledge-graph.tsx:199); neither `list` nor `byId` has a caller. They are wired into the router (index.ts:14-16) but exercise no UI. Intentional as forward seams, but currently dead surface area.
**Fix:** Keep if they back a planned screen; otherwise defer until consumed to avoid untested live endpoints.

### IN-02: Backend can emit edges with no corresponding visible node (dangling endpoints)

**File:** `packages/api-client/src/router/knowledge/graph.ts:281-296`, `431-438`, `460-468`
**Issue:** Component↔instance, component↔type, and component↔knowledge edges reference `componentId` source nodes that are only emitted when `includeEmails` is true. With `includeInstances=true, includeEmails=false`, these edges have a source id that is never an emitted node. The client defends against this by filtering edges to visible endpoints (knowledge-graph.tsx:255-258, 262-268), so nothing breaks today — but the procedure's response is internally inconsistent and any non-defensive consumer would render dangling edges.
**Fix:** Either emit a lightweight stub node for referenced components, or gate these edges behind the same `includeEmails` condition that emits component nodes.

### IN-03: Redundant `new Date(new Date(...))` in knowledge detail content

**File:** `apps/web/src/app/knowledge/_components/node-detail-pane.tsx:319-323, 353`
**Issue:** `kn.createdAt` is built as `new Date(data.createdAt)` (line 320), then line 353 calls `format(new Date(kn.createdAt), "PP")` — wrapping a `Date` in `new Date()` again. Harmless but redundant; `format(kn.createdAt, "PP")` suffices.
**Fix:** Drop the inner `new Date()` wrap.

### IN-04: `graphKey` remount heuristic can collide and skip a needed remount

**File:** `apps/web/src/app/knowledge/_components/knowledge-graph.tsx:391-394`
**Issue:** `graph-${data.nodes.length}-${data.edges.length}` keys the ReactFlow remount on counts only. Two distinct datasets with identical node+edge counts produce the same key, so the forced remount (and its fitView) is skipped. Edge case, but the key does not actually identify the dataset.
**Fix:** Include the request flags (`includeInstances`/`includeEmails`) or a content hash if a deterministic remount is required.

### IN-05: `EmailNode` truncates label but other nodes rely on CSS `truncate` — inconsistent

**File:** `apps/web/src/app/knowledge/_components/graph-nodes.tsx:197-198`
**Issue:** `EmailNode` hard-slices the label at 20 chars in JS (`data.label.slice(0, 20)`), while every other node type relies on CSS `truncate`. The JS slice is redundant with the CSS `truncate` already on the span (line 215) and can cut mid-grapheme. Minor inconsistency.
**Fix:** Remove the manual slice and let CSS `truncate` handle overflow uniformly.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
