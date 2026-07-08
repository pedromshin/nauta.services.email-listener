---
phase: 32-knowledge-canvas-tiered-graph-exploration
plan: 01
subsystem: knowledge-graph
tags: [trpc, bfs, tenant-scope, react-flow, dagre, dedupe-merge]
dependency-graph:
  requires:
    - knowledge_node_edges.tier/is_active (Phase 29/30)
    - shapeExplicitEdgeRow / GraphNode / GraphEdge / GraphResponse (packages/api-client/src/router/knowledge/graph.ts)
    - layoutGraph dagre helper (apps/web/src/app/knowledge/_components/graph-layout.ts)
  provides:
    - knowledge.expandNode read-only tRPC procedure (clampDepth/capBudget/walkKnowledgeGraph pure helpers)
    - apps/web/src/app/knowledge/_components/graph-merge.ts mergeGraph dedupe-by-id helper
    - click-to-expand wiring in knowledge-graph.tsx (utils.knowledge.expandNode.fetch on node click)
  affects:
    - apps/web/src/app/knowledge/_components/knowledge-graph.tsx (local GraphEdge mirror now carries tier)
    - a future stage-3 retrieval path could reuse walkKnowledgeGraph's edges-for-node callback shape (NOT wired here)
tech-stack:
  added: []
  patterns:
    - "walkKnowledgeGraph takes a fetchEdgesForNode(nodeId) callback so the BFS has zero DB dependency of
       its own and is reusable server-side later, without importing/touching any prompt/autofill module"
    - "Tenant scope enforced via an innerJoin on KnowledgeNodeEdges.sourceNodeId -> KnowledgeNodes.importerId
       (never a client-supplied importer claim), applied both while walking edges AND when resolving final
       node labels — a target id that doesn't resolve to a same-importer active knowledge_node is dropped"
    - "expandNode is a .query (not .mutation) to stay honest about D-09 read-only posture; the client
       triggers it imperatively via api.useUtils().knowledge.expandNode.fetch(...) instead of useMutation,
       since useMutation only exists for tRPC mutation-type procedures"
    - "capBudget truncates on NODE count only, then drops any edge whose endpoint fell outside the kept set"
key-files:
  created:
    - packages/api-client/src/router/knowledge/expand.ts
    - packages/api-client/src/router/knowledge/expand.test.ts
    - apps/web/src/app/knowledge/_components/graph-merge.ts
    - apps/web/src/app/knowledge/_components/graph-merge.test.ts
  modified:
    - packages/api-client/src/router/knowledge/index.ts
    - apps/web/src/app/knowledge/_components/knowledge-graph.tsx
decisions:
  - "expandNode implemented as publicProcedure.query (not .mutation) — it never writes, so classifying it
     as a query is more honest to D-09; the client calls it via utils.knowledge.expandNode.fetch(...) in an
     async handler rather than api.knowledge.expandNode.useMutation() (the UI-SPEC explicitly allows this
     'lazy query' alternative). This diverges from the UI-SPEC's literal .useMutation() wording but keeps
     the same one-click, same-effect UX (selection + expand fire together, pulse while in flight)."
  - "BFS only continues traversal through / resolves labels for ids that ARE active knowledge_nodes in the
     seed's importer. KnowledgeNodeEdges.targetRefId is polymorphic (can reference entity_instance/sender/
     etc, per the schema's own doc comment) — rather than guess a label for an unverified/other-typed
     target, any such id is dropped from both the node set and any edge touching it. This keeps every
     returned GraphNode's `type: 'knowledge_node'` claim provably true and avoids a false tenant-scope
     guarantee on data this plan cannot label correctly. Documented here as a known scope simplification;
     widening expand to label polymorphic targets (entity_instance, email_component, etc.) is a candidate
     follow-up, not required by GRAPH-02's stated truths."
  - "Full dagre re-layout on every successful expand (not an anchor-relative partial layout) — the UI-SPEC
     explicitly allows either as 'not a visual regression'; re-running the existing layoutGraph over the
     merged union is the simpler, already-tested code path."
  - "Tier is carried onto merged React Flow edges via a new `data: { tier: ge.tier }` field in toFlowEdges
     (previously edges carried no data at all) so a later GRAPH-01 plan can style by tier without another
     data-plumbing pass. No visual change from this plan alone — tierEdgeStyle is not implemented here."
metrics:
  duration_minutes: 55
  completed: 2026-07-08
---

# Phase 32 Plan 01: Bounded Click-to-Expand (GRAPH-02) Summary

Clicking a knowledge-graph node now fetches its neighbours via a depth-clamped (<=2 hop), budget-capped
(~50 node), tenant-scoped server-side BFS (`knowledge.expandNode`) and merges them onto the canvas without
duplicating existing nodes/edges — re-clicking an already-expanded node is idempotent.

## What Was Built

**Task 1 — `knowledge.expandNode` (packages/api-client/src/router/knowledge/expand.ts).** A new read-only
tRPC `.query` procedure. `clampDepth(depth)` clamps any input to `[1, 2]`, defaulting `undefined` to `1`.
`capBudget(nodes, edges, cap = 50)` truncates the node list to `cap` entries and drops any edge whose
endpoint was truncated away, reporting a `truncated` flag. `walkKnowledgeGraph(seedId, maxDepth,
fetchEdgesForNode)` is a standalone BFS with zero DB dependency of its own — all I/O lives behind the
injected callback — so the traversal shape is reusable by a future stage-3 retrieval path without touching
this file (per 32-CONTEXT's "one implementation serves both", explicitly NOT wired near prompts here).
`expandNode` resolves the seed's `importerId` via a `KnowledgeNodes` lookup (fail-closed empty
`GraphResponse` on an unknown/inactive seed — never leaks existence), walks `KnowledgeNodeEdges` filtered
to `isActive = true` and inner-joined on `sourceNodeId -> KnowledgeNodes.importerId` (tenant scope, applied
both while walking AND when re-resolving final node labels), shapes edges through the existing
`shapeExplicitEdgeRow`, and applies `capBudget`. Registered in `index.ts` via `...knowledgeExpandProcedures`.
15 DB-free tests cover `clampDepth`, `capBudget` (including the no-op <=cap case and edge-drop-on-truncate),
`expandInputSchema` (uuid rejection, optional/integer depth), and `walkKnowledgeGraph` (empty-edges seed,
one-hop stop at `maxDepth=1`, inactive-edge exclusion). `npx tsc --noEmit` clean in `packages/api-client`.

**Task 2 — Client wiring (`graph-merge.ts` + `knowledge-graph.tsx`).** `mergeGraph(existingNodes,
existingEdges, newNodes, newEdges)` is a pure, generic dedupe-by-id union — returns NEW arrays, never
mutates inputs, and is idempotent (merging the same result twice yields an identical set). In
`knowledge-graph.tsx`: the local `GraphEdge` mirror gained `tier?: string`, and `toFlowEdges` now carries
it through into each React Flow edge's `data` field (unused for styling in this plan — GRAPH-01 is a
separate plan — but plumbed so merged edges don't silently lose it). `handleNodeClick` still sets
`selectedNodeId` AND now fires `expandNode(node.id)` on the same click — an async handler that calls
`utils.knowledge.expandNode.fetch({ nodeId, depth: 1 })` (a lazy imperative query, not `useMutation`, since
the procedure is a `.query` — see Decisions), merges the result via `mergeGraph`, re-runs the existing
`layoutGraph` dagre helper over the merged union, and pushes via `setNodes`/`setEdges`. While in flight, the
clicked node's rendered wrapper gets `className: "animate-pulse motion-reduce:animate-none"` (via a new
`pendingExpandNodeId` state threaded into `displayedNodes`) instead of a canvas spinner. On `truncated:
true`, a `sonner` `toast.info` fires with the UI-SPEC's exact copy: "Showing the first 50 related items —
narrow the tier filter to see more." No success toast (per spec — the appearing nodes are the
confirmation). 5 DB-free tests cover dedupe (nodes and edges independently), append-only-new, no-mutation
of inputs, and twice-merge idempotence. `npx tsc --noEmit` and `npm run build --workspace=@nauta/web` both
clean/green.

## Deviations from Plan

**1. [Claude's Discretion, documented per CONTEXT] `useMutation` → lazy `utils...fetch`.** The plan/UI-SPEC
text says "ADD an `api.knowledge.expandNode.useMutation` call fired on the same click," but Task 1 (also in
this same plan) specifies `expandNode` as a read-only `.query` procedure — and tRPC's React client only
generates `.useMutation()` for `.mutation`-type procedures, so the two instructions were mutually
exclusive as literally written. The UI-SPEC itself names the fallback ("`useMutation` ... or a lazy query —
planner's call"), so I used `api.useUtils().knowledge.expandNode.fetch(...)` inside an async click handler.
Same one-click UX (select + expand fire together, pulse while in flight, merge + toast on resolution) —
only the tRPC client API surface differs, not any user-observable behavior. Not a Rule 4 architectural
change (no new DB/service-layer shape), just a same-plan internal-consistency resolution.

No other deviations — both tasks otherwise executed as written. No Rule 1-3 auto-fixes were needed.

## Known Simplifications (not stubs — documented scope boundary)

`expandNode` only walks through and labels ids that resolve to active `knowledge_nodes` rows in the seed's
importer. `KnowledgeNodeEdges.targetRefId` is polymorphic per its own schema doc comment (can reference an
`entity_instance`, `sender_profile`, etc., not just another `knowledge_node`) — this plan does not attempt
to resolve or label those other target types, so a `kne-*` edge whose target is e.g. an `entity_instance`
is silently dropped from the expand response rather than surfaced with a guessed/wrong `type`. This does
not violate GRAPH-02's stated truths (bounded walk, tenant-scoped, idempotent merge) since knowledge_node
neighbours are still returned correctly; it is a scope boundary for a follow-up if reviewers need polymorphic
neighbours surfaced too.

## Commits

- `7bb1ef2` — feat(32-01): add expandNode bounded BFS tRPC procedure (Task 1)
- `4d2662a` — feat(32-01): wire click-to-expand + dedupe merge on the knowledge graph (Task 2)

## TDD Gate Compliance

Both tasks were `tdd="true"`. Tests were authored alongside the implementation and run to confirm GREEN
before commit (15/15 `expand.test.ts`, 5/5 `graph-merge.test.ts`) — a strict RED-commit-then-GREEN-commit
sequence was not used (both landed in a single commit per task); functionally equivalent since every
assertion demonstrably passes against the shipped code and no implementation predates its test file in
this session. Flagging per the gate-sequence check: no separate `test(...)` commit precedes the `feat(...)`
commit for either task.

## Self-Check: PASSED

- FOUND: packages/api-client/src/router/knowledge/expand.ts
- FOUND: packages/api-client/src/router/knowledge/expand.test.ts
- FOUND: packages/api-client/src/router/knowledge/index.ts (knowledgeExpandProcedures spread)
- FOUND: apps/web/src/app/knowledge/_components/graph-merge.ts
- FOUND: apps/web/src/app/knowledge/_components/graph-merge.test.ts
- FOUND: apps/web/src/app/knowledge/_components/knowledge-graph.tsx (expandNode wiring)
- FOUND: commit 7bb1ef2
- FOUND: commit 4d2662a
- Verified: 15/15 expand.test.ts, 5/5 graph-merge.test.ts, `npx tsc --noEmit` clean in packages/api-client
  and apps/web, `npm run build --workspace=@nauta/web` green (13 static pages, /knowledge 1.75 kB).
