---
phase: 23-2d-canvas-panels-as-nodes-shared-state
plan: 02
subsystem: web-ui, canvas
tags: [react-flow, zod, registry, content-hash, genui, canvas, node-type]

# Dependency graph
requires:
  - phase: 23-2d-canvas-panels-as-nodes-shared-state
    plan: 01
    provides: CANONICAL SNAPSHOT SHAPE (CanvasSnapshotSchema, node.data provenance-only D-05 convention) that node-data-schemas.ts mirrors verbatim
provides:
  - NODE_TYPE_REGISTRY + resolveNodeType allowlist (chat, genui-panel; unknown -> placeholder marker, never throws)
  - NODE_REGISTRY_VERSION — browser-safe FNV-1a content-hash that flips on any registry entry change (id/description/schema shape)
  - GenuiPanelNodeDataSchema / ChatNodeDataSchema — the node.data Zod boundary (provenance ref only, no spec content)
  - UnknownNodeTypePlaceholder — inert degrade-gracefully card for a registry miss
  - GenuiPanelNode — memoized custom React Flow node rendering a genui spec via the unmodified SpecRenderer/GenuiPartBoundary
  - CanvasSpecProvider/useCanvasSpec — the CANVAS-04 seam keeping volatile spec content OUT of node.data
affects: [23-03, 23-04, 23-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry content-hash MUST stay browser-safe when imported by client components — packages/genui's registry-version.ts uses Node crypto.createHash (server-only), so node-registry-version.ts instead uses a pure FNV-1a 32-bit hash (no Buffer/crypto) over a JSON-serializable structural summary"
    - "Zod schema structural summarization via ONLY documented public Zod v3 APIs (.shape, .innerType(), .unwrap(), _def.typeName, _def.checks[].kind, _def.unknownKeys) — avoids relying on .toString() (which returns \"[object Object]\" for ZodObject and carries no structural signal) while staying free of new dependencies (no zod-to-json-schema)"
    - "CanvasSpecContext: volatile/streaming content read via React context INSIDE the node component (useCanvasSpec), never lifted into the React Flow nodes array's data field — this is the general pattern D-07 requires everywhere a streamed value would otherwise force a full setNodes identity change"

key-files:
  created:
    - apps/web/src/app/chat/_canvas/node-data-schemas.ts
    - apps/web/src/app/chat/_canvas/node-type-registry.ts
    - apps/web/src/app/chat/_canvas/node-registry-version.ts
    - apps/web/src/app/chat/_canvas/unknown-node-type-placeholder.tsx
    - apps/web/src/app/chat/_canvas/canvas-spec-context.tsx
    - apps/web/src/app/chat/_canvas/genui-panel-node.tsx
    - apps/web/src/app/chat/_canvas/__tests__/node-type-registry.test.ts
  modified: []

key-decisions:
  - "computeNodeRegistryHash hashes a structural schema-shape SUMMARY (built by walking Zod's own public API), not the raw Zod object — Zod object instances aren't JSON-serializable (internal defs mix plain data with functions/lazy shape getters), and a naive JSON.stringify(schema) or schema.toString() would not detect real shape changes"
  - "GenuiPanelNodeDataSchema keeps the explicit .refine() rejecting spec/root keys even though .strict() alone already rejects an unrecognized top-level key — kept for verbatim parity with 23-01's CanvasSnapshotSchema nodeDataSchema pattern and a clearer failure message"
  - "GenuiPanelNode's Handles are left at React Flow's default visible styling (not hidden via opacity-0 like /knowledge's decorative-only handles) since this canvas's edges are user-created via interactive drag-to-connect (EdgeCreationPicker, later plan) — /knowledge's hidden-handle convention is specific to that non-interactive auto-layout graph"

requirements-completed: [CANVAS-03]

# Metrics
duration: ~25min
completed: 2026-07-04
---

# Phase 23 Plan 02: Node-Type Registry + GenuiPanelNode Summary

**Versioned `NODE_TYPE_REGISTRY` (chat/genui-panel) with a browser-safe FNV-1a content-hash `NODE_REGISTRY_VERSION`, plus `GenuiPanelNode` — a memoized React Flow node rendering a genui spec by provenance through the unmodified `SpecRenderer`, reading volatile content from a new `CanvasSpecContext` seam instead of `node.data`.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files created:** 7 (4 registry/schema/placeholder modules, 2 node/context modules, 1 test file)

## Accomplishments

- Built `node-data-schemas.ts`: `GenuiPanelNodeDataSchema` (`.strict()`, provenance ref `{messageId, partIndex, runId}` + `turnIndex`, `.refine()`-rejects `spec`/`root` keys) and `ChatNodeDataSchema` (`.strict()`, `conversationId` only) — both mirror 23-01's CANONICAL SNAPSHOT SHAPE in lockstep (D-05: node.data never carries spec content).
- Built `node-type-registry.ts`: `NODE_TYPE_REGISTRY` (id + Zod dataSchema + description per entry, FOUND-2's one-registry-contract shape) and `resolveNodeType(type)`, which NEVER throws — an unregistered type resolves to `{ kind: "unknown", nodeType }` so the render path degrades to a placeholder instead of crashing (T-23-05, D-04).
- Built `node-registry-version.ts`: `computeNodeRegistryHash` — a pure, browser-safe FNV-1a hash (explicitly NOT Node `crypto`, since this module is imported by client components) over sorted entry ids + descriptions + a structural Zod schema-shape summary built from ONLY documented public Zod v3 APIs (`.shape`, `.innerType()`, `.unwrap()`, `_def.typeName`, `_def.checks[].kind`, `_def.unknownKeys`) with bounded recursion depth. Verified sensitive to field add/remove, field-type change, nullability change, and Zod-check change (e.g. `.min()`), and insensitive to registration order.
- Built `unknown-node-type-placeholder.tsx`: `UnknownNodeTypePlaceholder` — an inert card (`bg-muted/40 border-destructive/30`, `AlertTriangle` icon, exact UI-SPEC copy including the `Type: {nodeType}` caption), honors the persisted node's position/size (React Flow applies those independent of this component), no action button, no interactive content.
- Built `canvas-spec-context.tsx`: `CanvasSpecProvider`/`useCanvasSpec(provenance)` — the CANVAS-04 seam. The default provider serves only history-derived (non-streaming) specs from a `specsByProvenance` map keyed by `messageId:partIndex`; an optional `streamingByProvenance` override prop is the seam plan 23-04 layers live `useChatStream` content through without this contract changing.
- Built `genui-panel-node.tsx`: `GenuiPanelNode` — `memo`-wrapped custom React Flow node with an `h-9` `.node-drag-handle` header (`bg-muted/60 border-border/60`, "From turn {n}" provenance caption, `text-primary motion-safe:animate-pulse` streaming dot with `aria-label="Streaming"`), a fixed-min-dimension (320×240) `ScrollArea` body rendering `<GenuiPartBoundary specJson isStreaming />` (the unmodified SpecRenderer wrapper), and the `ring-2 ring-primary ring-offset-1` selection idiom. `node.data` carries only the provenance ref — no `spec` field anywhere in the file.
- TDD (Task 1): RED (implementation files temporarily moved aside — 14 tests failed on unresolved imports) → GREEN (files restored — all 14 tests pass). Task 2 (`type="auto"`, no `tdd` flag) implemented directly and verified via `tsc --noEmit` + `next build`.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: add failing tests for node-type-registry + registry-hash + GenuiPanelNodeDataSchema** - `7655159` (test)
1. **Task 1 GREEN: implement NODE_TYPE_REGISTRY + content-hash version + node-data schemas + unknown-type placeholder** - `47c4ff2` (feat)
2. **Task 2: implement GenuiPanelNode + CanvasSpecContext seam** - `8c5fdbc` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `apps/web/src/app/chat/_canvas/node-data-schemas.ts` - `ProvenanceSchema`, `GenuiPanelNodeDataSchema`, `ChatNodeDataSchema` + inferred types
- `apps/web/src/app/chat/_canvas/node-type-registry.ts` - `NODE_TYPE_REGISTRY`, `resolveNodeType`, `ResolvedNodeType`, `NodeTypeRegistryEntry`
- `apps/web/src/app/chat/_canvas/node-registry-version.ts` - `computeNodeRegistryHash`, `NODE_REGISTRY_VERSION`
- `apps/web/src/app/chat/_canvas/unknown-node-type-placeholder.tsx` - `UnknownNodeTypePlaceholder`, `UnknownNodeTypeNodeData`/`UnknownNodeTypeNodeType`
- `apps/web/src/app/chat/_canvas/canvas-spec-context.tsx` - `CanvasSpecProvider`, `useCanvasSpec`, `CanvasSpecEntry`
- `apps/web/src/app/chat/_canvas/genui-panel-node.tsx` - `GenuiPanelNode`, `GenuiPanelNodeType`
- `apps/web/src/app/chat/_canvas/__tests__/node-type-registry.test.ts` - 14 tests covering hash determinism/order-insensitivity/flip-on-change, `resolveNodeType` allowlist semantics, `GenuiPanelNodeDataSchema` boundary

## Decisions Made

- **Schema-shape hash walks Zod's public API, not `.toString()`/raw object** — see key-decisions above; this is the one place this plan deviated from a literal reading of the plan's interface note ("`.toString()`/description") because `.toString()` on a `ZodObject` instance returns `"[object Object]"` and would make the hash blind to real schema changes, defeating D-04's "ANY registry entry change flips the version" requirement. Verified via 4 dedicated tests (description change, schema field-add change, id change, order-insensitivity).
- **`.refine()` kept alongside `.strict()` on `GenuiPanelNodeDataSchema`** — redundant with `.strict()`'s own unrecognized-key rejection, kept for verbatim contract parity with 23-01's `CanvasSnapshotSchema.nodeDataSchema`.
- **Handles left visible (not hidden via `opacity-0`)** — see key-decisions above.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. No Rule 1/2/3/4 deviations encountered; both tasks completed without blockers.

## Issues Encountered

None.

## User Setup Required

None — no new dependencies, no env vars, no infra changes. All new files are pure client-side TypeScript/TSX consumed by later canvas plans (23-03 mounts `GenuiPanelNode` into the `nodeTypes` map and wires `CanvasSpecProvider` around the surface).

## Threat Flags

None — all new surface (node-type registry allowlist, unknown-type placeholder, node.data Zod boundary, spec-render path through the unmodified `GenuiPartBoundary`) was already enumerated in the plan's `<threat_model>` (T-23-05, T-23-06, T-23-02) and implemented exactly as dispositioned. No new trust-boundary surface introduced beyond what the plan anticipated.

## Next Phase Readiness

- `NODE_TYPE_REGISTRY`/`NODE_REGISTRY_VERSION`/`resolveNodeType` are ready for plan 23-03 to assemble into the mounted `nodeTypes` map and persist alongside `chat_canvas_layouts.nodeRegistryVersion`.
- `GenuiPanelNode` + `CanvasSpecProvider` are ready to mount inside the `ChatCanvas` surface (23-03) — the surface plan supplies the `specsByProvenance` map (derived from that conversation's history) and, later, `ChatNode` alongside it.
- `useCanvasSpec`'s `streamingByProvenance` seam is ready for plan 23-04 to wire live `useChatStream` content through without touching this plan's contract.

---
*Phase: 23-2d-canvas-panels-as-nodes-shared-state*
*Completed: 2026-07-04*

## Self-Check: PASSED

All 7 created files confirmed present on disk; all 3 task commits (`7655159`, `47c4ff2`, `8c5fdbc`) confirmed present in `git log --oneline`. `pnpm vitest run src/app/chat/_canvas` — 14/14 tests pass. `pnpm tsc --noEmit` clean. `pnpm next build` compiles. No-eval grep (`eval\(|new Function`) returns 0 across all 6 `_canvas` source files.
