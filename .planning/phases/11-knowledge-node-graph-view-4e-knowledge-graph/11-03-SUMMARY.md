---
phase: 11-knowledge-node-graph-view-4e-knowledge-graph
plan: "03"
subsystem: web-ui
tags: [knowledge-graph, react-flow, filter-rail, detail-pane, toolbar, taxonomy-banner, a11y, read-only]
dependency_graph:
  requires: ["11-02"]
  provides: []
  affects:
    - apps/web/src/app/knowledge/_components/knowledge-graph.tsx
    - apps/web/src/app/knowledge/_components/filter-rail.tsx
    - apps/web/src/app/knowledge/_components/node-detail-pane.tsx
    - apps/web/src/app/knowledge/_components/graph-toolbar.tsx
    - apps/web/src/app/knowledge/_components/taxonomy-banner.tsx
    - apps/web/src/app/knowledge/_components/graph-states.tsx
tech_stack:
  added: []
  patterns:
    - "three-zone ResizablePanelGroup (18/57/25 defaultSize)"
    - "prop-driven presentational chrome components"
    - "localStorage banner dismissal"
    - "React Flow node selection with Escape deselect"
    - "client-side type filtering + auto-show <50 threshold"
key_files:
  created:
    - apps/web/src/app/knowledge/_components/graph-toolbar.tsx
    - apps/web/src/app/knowledge/_components/filter-rail.tsx
    - apps/web/src/app/knowledge/_components/taxonomy-banner.tsx
    - apps/web/src/app/knowledge/_components/graph-states.tsx
    - apps/web/src/app/knowledge/_components/node-detail-pane.tsx
  modified:
    - apps/web/src/app/knowledge/_components/knowledge-graph.tsx
decisions:
  - "Presentational chrome pattern: all state (selectedNodeId, visibleTypes, showInstances, bannerDismissed) owned in knowledge-graph.tsx; chrome components are prop-driven — mirrors entities-gallery.tsx hook-owns-state convention"
  - "KnowledgeNode interface imported from entity-knowledge.tsx (not re-defined) for the knowledge_node detail branch — enforces structural parity with the entity detail surface"
  - "Auto-show instances threshold 50: when API returns <50 instance nodes, entity_instance is silently added to visibleTypes (no toggle required) — bounds the D-03 silent case per UI-SPEC"
  - "includeInstances derived from showInstances OR any of entity_instance/email/email_component/knowledge_node being visible — toggling any of those type filters triggers a re-fetch without a separate state flag"
  - "T-11-05 XSS mitigation: all DB-origin strings (knowledge_node.content, email subject, entity labels) rendered as plain escaped React text children; no dangerouslySetInnerHTML anywhere under _components/ — grep gate confirmed green"
metrics:
  duration: "~2h"
  completed: "2026-06-15T00:00:00Z"
  tasks_completed: 4
  files_created: 5
  files_modified: 1
---

# Phase 11 Plan 03: Knowledge Graph Chrome Surface Summary

Three-zone ResizablePanelGroup chrome (filter rail / canvas / detail pane) + h-11 toolbar, per-type node detail pane with /entities and /emails deep-links, dismissible taxonomy explainer banner, loading/error/no-schema states, full keyboard/aria contracts — browser-verified, strictly read-only (D-09), no dangerouslySetInnerHTML (T-11-05).

## What Was Built

- **`graph-toolbar.tsx`** (`GraphToolbar`): h-11 frosted toolbar (bg-background/70 backdrop-blur-md border-b border-border/50). Left: "Knowledge" text-sm font-semibold. Right: Maximize2 zoom-to-fit ghost button (aria-label "Zoom to fit", `onFitView` prop), disabled layout-toggle ghost button (aria-label "Toggle layout", aria-pressed, dagre-only), "{total} nodes" text-xs counter.

- **`filter-rail.tsx`** (`FilterRail`): w-60 frosted left rail. "Show" header (text-xs font-semibold uppercase tracking-wide). Six checkbox rows with 8×8 color dots: "Entity Types" (primary/80), "Fields" (muted-foreground/40), "Instances" (violet-500/80), "Emails" (slate-400/80), "Components" (amber-500/80), "Knowledge Rules" (primary/60). Each row uses a native `<input type="checkbox" className="sr-only">` + visual indicator — custom checkmark SVG. Separator. "Show all instances" Switch + "May slow rendering with large datasets" sub-label. Footer: "{N} types · {M} fields · {P} instances". Exports `NodeTypeKey` union type.

- **`taxonomy-banner.tsx`** (`TaxonomyBanner`): absolute bottom-0 inside canvas. role="status" aria-live="polite". Copy: "Your extraction schema — {N} entity types, {M} fields. Instances and knowledge rules appear as emails are processed." (em-dash via `&mdash;`). X dismiss button (aria-label "Dismiss"). Parent persists dismissal to localStorage key `nauta.knowledge.taxonomy-banner-dismissed` and manages dismissed state.

- **`graph-states.tsx`** (`GraphErrorState`, `GraphNoSchemaState`): `GraphErrorState` — role="alert", AlertCircle size-8 text-destructive, "Could not load the knowledge graph." (font-semibold), "Try refreshing the page." (text-muted-foreground), "Refresh page" outline sm button → `window.location.reload()`. `GraphNoSchemaState` — Shapes size-8, "No schema defined yet.", "Add entity types to see your knowledge network.", no button (entity-type creation out of scope per D-09). Both use font-normal/font-semibold only (no font-medium/500).

- **`node-detail-pane.tsx`** (`NodeDetailPane`, `SelectedNode`): w-80 frosted right pane. role="complementary" aria-label="Node details". No-selection empty state: Share2 size-6 + "Click any node to explore it". Selected state: header with truncated node label (font-semibold) + close X (aria-label "Close detail panel", `onClose` prop) + aria-live="polite" content region in a ScrollArea. Six per-type content blocks:
  - `entity_type` — Badge "Entity Type" (secondary); wrapping field chips (Badge variant="outline"); "View {N} instances →" next/link to `/entities?type={id}`.
  - `entity_type_field` — Badge "Field"; Type row; "Belongs to" parent name as a button that calls `onSelectNode(entityTypeId)`.
  - `entity_instance` — Badge "Instance" (violet bg/text/border classes); Entity Type row; "Open entity →" next/link to `/entities/{id}` (D-08).
  - `email_component` — Badge "Component" (amber classes); Email row (sender + truncated subject, max 40 chars); Match status row; "Open editor →" next/link to `/emails/{emailId}` when emailId present (D-08).
  - `email` — Badge "Email"; full subject (font-semibold wrapping); From row; Received row; "Open editor →" next/link to `/emails/{id}`.
  - `knowledge_node` — imports `KnowledgeNode` from `entity-knowledge.tsx` (not re-defined); Badge "Knowledge Rule" (teal: bg-primary/10 text-primary border-primary/30); content as plain escaped text (`{kn.content}`); Source Badge (secondary); "{Math.round(confidence*100)}% confidence"; `format(createdAt, "PP")` via date-fns.

- **`knowledge-graph.tsx`** (EXTENDED from 11-02): three-zone ResizablePanelGroup (direction="horizontal"). Zone 1: `<ResizablePanel defaultSize={18} minSize={12} maxSize={28}>` → `<FilterRail>`. Zone 2: `<ResizablePanel defaultSize={57} minSize={30}>` → ReactFlow canvas with `<TaxonomyBanner>` absolute bottom + Background/Controls/MiniMap + `<GraphErrorState>`/`<GraphNoSchemaState>` conditionals. Zone 3: `<ResizablePanel defaultSize={25} minSize={18} maxSize={40}>` → `<NodeDetailPane>`. State owned immutably: `selectedNodeId` (useState), `visibleTypes` (ReadonlySet, default {entity_type, entity_type_field}), `showInstances` (boolean), `bannerDismissed` (lazy-init from localStorage). Interactions: node click sets selectedNodeId; pane click + Escape deselect; double-click → `fitView({nodes:[node], padding:0.8, duration:400})`; toolbar fit-view → `fitView({padding:0.2, duration:400})`. Auto-show instances when `countByType(data.nodes, "entity_instance") < 50`. `includeInstances` derived from showInstances or any of the instance-type filter checkboxes being visible.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (toolbar + filter rail + banner + states) | `e88addf` | add graph toolbar, filter rail, taxonomy banner, and error/no-schema states |
| 2 (node detail pane) | `6c88196` | add NodeDetailPane with 6 per-type sections and deep-links |
| 3 (three-zone wiring) | `f2464ea` | wire three-zone ResizablePanelGroup into knowledge-graph.tsx |
| 4 (human-verify) | — | browser-verified by user (approved) |

## Read-Only Invariant Verification (D-09 / T-11-04)

Static checks confirmed by orchestrator prior to human-verify:
- `knowledge-graph.tsx` contains no `useMutation` and no `.mutate(` call — the only `useMutation`-pattern match in the repo is a D-09 comment explaining the invariant.
- No node-create, node-edit, or edges-table write affordance exists anywhere under `_components/`.
- `npm run web:build` exits 0; `/knowledge` route appears in build output at ~1.7 kB first-load JS.
- `tsc --noEmit` exits 0.

## XSS Mitigation Verification (T-11-05)

Automated grep gate (`! grep -rqF 'dangerouslySetInnerHTML' src/app/knowledge/_components/`) confirmed green after each of Tasks 2 and 3. All DB-origin strings — `knowledge_node.content`, email subjects, entity labels — are rendered as plain escaped React text children (`{value}` in JSX). Mirrors the Phase 9 T-09-80 pattern from `entity-knowledge.tsx`.

## Browser Verification (Task 4)

User-approved after visual inspection. Checklist items from the plan:
1. Graph renders taxonomy on load (never blank — D-02).
2. Taxonomy banner reads correct copy with live entity-type and field counts.
3. Node click → detail pane opens with per-type content; canvas click → deselects; Escape → deselects.
4. Entity-type node "View N instances →" deep-links to /entities; instance node "Open entity →" to /entities/{id}; email/component node to /emails/{id}.
5. "Show all instances" toggle re-fetches with includeInstances:true and re-lays out.
6. Toolbar Zoom-to-fit (Maximize2) → fitView executes.
7. Taxonomy banner dismiss (X) → disappears; persists across reload via localStorage.
8. Sidebar "Knowledge" item active on this route; no node create/edit control present.

## Deviations from Plan

None. Plan executed exactly as written. The plan's chrome components were presentational with state in knowledge-graph.tsx; the implementation follows this convention exactly. No new npm packages were required. No architectural changes were needed.

## Known Stubs

None. All six node-type detail branches render real data from `api.knowledge.graph.useQuery`. The filter rail footer counts derive from live node arrays. The taxonomy banner counts derive from the same query. No placeholder text or empty-value stubs exist in the rendered output.

## Threat Flags

None. No new network endpoints, auth paths, file-access patterns, or schema changes were introduced. The /knowledge surface remains strictly read-only, consuming only the `api.knowledge.graph` tRPC query established in plan 11-01. Deep-links route to existing /entities and /emails surfaces that enforce their own Phase 9/10 tenant rules (T-11-01, inherited).

## Self-Check: PASSED

Files verified:
- `apps/web/src/app/knowledge/_components/graph-toolbar.tsx` — FOUND
- `apps/web/src/app/knowledge/_components/filter-rail.tsx` — FOUND
- `apps/web/src/app/knowledge/_components/taxonomy-banner.tsx` — FOUND
- `apps/web/src/app/knowledge/_components/graph-states.tsx` — FOUND
- `apps/web/src/app/knowledge/_components/node-detail-pane.tsx` — FOUND
- `apps/web/src/app/knowledge/_components/knowledge-graph.tsx` — FOUND (modified)

Commits verified:
- `e88addf` — FOUND (Task 1)
- `6c88196` — FOUND (Task 2)
- `f2464ea` — FOUND (Task 3)

Build: `npm run web:build` exits 0; /knowledge present (~1.7 kB). Typecheck: `tsc --noEmit` exits 0. dangerouslySetInnerHTML grep gate: GREEN (0 matches).
