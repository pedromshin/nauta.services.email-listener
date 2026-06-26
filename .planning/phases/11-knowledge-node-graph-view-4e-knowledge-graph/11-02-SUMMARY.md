---
phase: 11-knowledge-node-graph-view-4e-knowledge-graph
plan: "02"
subsystem: web-ui
tags: [knowledge-graph, react-flow, dagre, ssr-island, navigation]
dependency_graph:
  requires: ["11-01"]
  provides: ["11-03"]
  affects: ["apps/web/src/app/knowledge", "apps/web/src/components/app-sidebar.tsx"]
tech_stack:
  added: ["@xyflow/react ^12.11.0", "@dagrejs/dagre ^3.0.0"]
  patterns: ["dynamic(ssr:false) client island", "dagre TB layout util", "custom React Flow node types"]
key_files:
  created:
    - apps/web/src/app/knowledge/page.tsx
    - apps/web/src/app/knowledge/_components/knowledge-graph-island.tsx
    - apps/web/src/app/knowledge/_components/knowledge-graph.tsx
    - apps/web/src/app/knowledge/_components/knowledge-graph-skeleton.tsx
    - apps/web/src/app/knowledge/_components/graph-layout.ts
    - apps/web/src/app/knowledge/_components/graph-nodes.tsx
  modified:
    - apps/web/package.json
    - apps/web/src/components/app-sidebar.tsx
    - packages/api-client/dist/ (rebuilt — knowledge router now in dist)
decisions:
  - "D-08 island split: dynamic(ssr:false) cannot live in a Server Component in Next.js 15; resolved by introducing knowledge-graph-island.tsx as a thin 'use client' wrapper"
  - "ReactFlow JSX cast: moduleResolution:bundler causes TS to treat named re-export as module namespace; cast via React.ComponentType<ReactFlowProps<...>> restores call signature"
  - "Local type mirrors for GraphNode/GraphEdge: @nauta/api-client has no subpath export for router internals; inlining minimal interfaces avoids brittle dist-path imports"
  - "api-client dist rebuilt: knowledge router existed in src but not dist; npm run build --workspace=@nauta/api-client regenerated the types"
metrics:
  duration: "~3h (across two sessions)"
  completed: "2026-06-15T06:36:30Z"
  tasks_completed: 3
  files_created: 6
  files_modified: 2
---

# Phase 11 Plan 02: Knowledge Graph Route and React Flow Island Summary

React Flow v12 @xyflow/react knowledge graph island on `/knowledge` using dagre TB layout with six custom node components; `ssr:false` pattern split into a `"use client"` wrapper to comply with Next.js 15.

## What Was Built

- **`/knowledge` route** (`page.tsx`): server component with metadata; mounts `KnowledgeGraphIsland` for layout/SEO with no canvas logic.
- **`knowledge-graph-island.tsx`**: `"use client"` thin wrapper holding `dynamic(ssr:false)` — required by Next.js 15 which forbids `ssr:false` in Server Components.
- **`knowledge-graph.tsx`**: full client island — `api.knowledge.graph.useQuery({ includeInstances: false, includeEmails: false })`, maps GraphNode/GraphEdge to React Flow nodes/edges, runs `layoutGraph`, renders `<ReactFlowJSX>` with `<Background>`, `<Controls>`, `<MiniMap>`. ArrowClosed size-6 markers on non-taxonomy edges; `has_field` edges have no arrowhead. Key-based remount resets internal state when data identity changes.
- **`knowledge-graph-skeleton.tsx`**: `role="status"` animated div ghost — 3 entity_type blocks (160×48) + 5 entity_type_field blocks (128×32); pure static divs, no canvas.
- **`graph-layout.ts`**: pure `layoutGraph<NodeData>` using dagre `rankdir:"TB"`, `ranksep:64`, `nodesep:32`, `edgesep:16`; returns new node objects with dagre center-offset positions (immutable).
- **`graph-nodes.tsx`**: six custom node components per UI-SPEC Node Visual Language (exact dimensions, role-colors, lucide icons, typography — no font-medium/500); selected ring; hover shadow; invisible `<Handle>` top/bottom. Exports `nodeTypes` map.
- **`app-sidebar.tsx`**: Knowledge promoted from `SOON_NAV_ITEMS` to `LIVE_NAV_ITEMS` with `href: "/knowledge"`.
- **`apps/web/package.json`**: `@xyflow/react ^12.11.0` + `@dagrejs/dagre ^3.0.0` added.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `aa533f0` | install @xyflow/react + @dagrejs/dagre; promote Knowledge nav to live |
| 2 | `ca4e0df` | add dagre layout util and six React Flow node components |
| 3 | `2de84e1` | create /knowledge route with React Flow graph island |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js 15 forbids `ssr:false` in Server Components**
- **Found during:** Task 3 production build (`npm run web:build`)
- **Issue:** `Error: 'ssr: false' is not allowed with next/dynamic in Server Components.` — Next.js 15 enforces this at compile time; prior plans and the PATTERNS file described the pattern as living directly in `page.tsx`.
- **Fix:** Introduced `knowledge-graph-island.tsx` as a `"use client"` wrapper component that holds the `dynamic(ssr:false)` call; `page.tsx` imports `<KnowledgeGraphIsland>` (a client component) instead of calling `dynamic` itself.
- **Files modified:** `apps/web/src/app/knowledge/_components/knowledge-graph-island.tsx` (created), `apps/web/src/app/knowledge/page.tsx` (updated import)
- **Commit:** `2de84e1`

**2. [Rule 3 - Blocking] ReactFlow JSX cast — moduleResolution:bundler re-export TS issue**
- **Found during:** Task 3 typecheck
- **Issue:** `JSX element type 'ReactFlow' does not have any construct or call signatures` — `moduleResolution:bundler` treats the `export { default as ReactFlow }` pattern as a module namespace re-export, stripping the call signature.
- **Fix:** `const ReactFlowJSX = ReactFlow as React.ComponentType<ReactFlowProps<FlowNode, FlowEdge>>` cast; JSX uses `<ReactFlowJSX>`. Added `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment per convention.
- **Files modified:** `apps/web/src/app/knowledge/_components/knowledge-graph.tsx`
- **Commit:** `2de84e1`

**3. [Rule 3 - Blocking] `@nauta/api-client` has no subpath export for router internals**
- **Found during:** Task 3 typecheck
- **Issue:** `Cannot find module '@nauta/api-client/router/knowledge/graph'` — package.json only exports `.` and `./geometry`; router internals are not exposed via subpath exports.
- **Fix:** Removed the subpath import; inlined minimal `GraphNode` and `GraphEdge` interface definitions locally in `knowledge-graph.tsx` (mirrors of the api-client shapes — same field names and types). These are stable structural types unlikely to diverge.
- **Files modified:** `apps/web/src/app/knowledge/_components/knowledge-graph.tsx`
- **Commit:** `2de84e1`

**4. [Rule 3 - Blocking] api-client dist stale — knowledge router not in dist**
- **Found during:** Task 3 typecheck
- **Issue:** `Property 'knowledge' does not exist on type 'CreateTRPCReactBase...'` — the knowledge router was added to `packages/api-client/src/` in plan 11-01 but the dist was never rebuilt.
- **Fix:** Ran `npm run build --workspace=@nauta/api-client` to regenerate dist; `packages/api-client/dist/router/knowledge/` and updated `root.d.ts` now include the knowledge procedure.
- **Files modified:** `packages/api-client/dist/` (rebuilt, not staged — build output)
- **Resolution:** api-client build now runs as part of `npm run web:build` via the root script.

**5. [Rule 1 - Bug] NodeProps generic mismatch in @xyflow/react v12**
- **Found during:** Task 2 typecheck
- **Issue:** `Type 'EntityTypeNodeData' does not satisfy constraint 'Node<...>'` — @xyflow/react v12 `NodeProps<T>` expects the full `Node<DataType, TypeName>` type, not just the data shape. Also caused `data` to be typed as `unknown`.
- **Fix:** Defined full node types: `type EntityTypeNodeType = Node<EntityTypeNodeData, "entity_type">` and used `NodeProps<EntityTypeNodeType>` for each of the six components.
- **Files modified:** `apps/web/src/app/knowledge/_components/graph-nodes.tsx`
- **Commit:** `ca4e0df`

**6. [Rule 1 - Bug] `aria-pressed` type error with null-coalescing on `selected`**
- **Found during:** Task 2 typecheck
- **Issue:** `Types of property '"aria-pressed"' are incompatible; Type '{}' not assignable` — `selected` in `NodeProps` is `Required<boolean>` (always boolean, never undefined), so `selected ?? false` evaluated to `{}` in the JSX attribute context.
- **Fix:** Used `aria-pressed={selected}` directly (no null coalescing needed since `selected` is always boolean).
- **Files modified:** `apps/web/src/app/knowledge/_components/graph-nodes.tsx`
- **Commit:** `ca4e0df`

## Known Stubs

None. The graph renders real data from `api.knowledge.graph.useQuery` with `includeInstances: false, includeEmails: false` (taxonomy-only default per D-02). The `onNodeClick` handler is a no-op pending plan 11-03's detail pane — documented with a comment; not a rendering stub.

## Threat Flags

None. The `/knowledge` route is read-only (`useQuery` only, no mutations). No new network endpoints introduced. The supply-chain gate (T-11-SC) for `@xyflow/react` and `@dagrejs/dagre` was cleared by the orchestrator prior to execution.

## Self-Check: PASSED

Files verified:
- `apps/web/src/app/knowledge/page.tsx` — FOUND
- `apps/web/src/app/knowledge/_components/knowledge-graph-island.tsx` — FOUND
- `apps/web/src/app/knowledge/_components/knowledge-graph.tsx` — FOUND
- `apps/web/src/app/knowledge/_components/knowledge-graph-skeleton.tsx` — FOUND
- `apps/web/src/app/knowledge/_components/graph-layout.ts` — FOUND
- `apps/web/src/app/knowledge/_components/graph-nodes.tsx` — FOUND

Commits verified:
- `aa533f0` — FOUND (Task 1)
- `ca4e0df` — FOUND (Task 2)
- `2de84e1` — FOUND (Task 3)

Build: `npm run web:build` exits 0. `/knowledge` route present in build output (1.68 kB first load).
Typecheck: `tsc --noEmit` exits 0.
