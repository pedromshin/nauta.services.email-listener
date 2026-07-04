# Phase 23: 2D Canvas + Panels-as-Nodes + Shared State - Context

**Gathered:** 2026-07-04 (autonomous smart-discuss — all decisions auto-selected with recommended defaults, grounded in prior locked decisions and v1.3 research; marked `[auto]`)
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see and interact with a chat's genui outputs spatially — a persistent, responsive 2D
infinite canvas where panels carry live-streaming content without lag, and panels share state and
data across each other. Requirements: CANVAS-01..04, STATE-01, STATE-02.

Depends on Phase 22 (chat data model + unmodified `SpecRenderer`). Dual-channel round-trips are
Phase 24; orchestration-viz nodes are v1.5 (seams only).
</domain>

<decisions>
## Implementation Decisions

### Canvas library & topology
- **D-01 `[auto]`:** Canvas = **`@xyflow/react` (React Flow)** — already a dependency (used by
  `/knowledge`), node/edge graph model maps directly onto panels + data edges + future run-trees
  (R2 research leaning; tldraw explicitly excluded in REQUIREMENTS Out of Scope).
- **D-02 `[auto]`:** **Chat is a first-class node on the canvas** (R2 leaning): the canvas is the
  conversation's workspace view. `/chat/[conversation]` gains a **view toggle: "Chat" (docked
  classic view, Phase 22 UI unchanged) ↔ "Canvas"** (React Flow surface hosting a chat node + genui
  panel nodes). The docked view remains the default; canvas is opt-in per conversation.
- **D-03 `[auto]`:** **Every `genui_spec` message part materializes as a genui-panel node** on that
  conversation's canvas, carrying FOUND-5 provenance (message id, run id, spec). New specs from
  live turns appear as new panels (auto-placed via the existing `@dagrejs/dagre` layout muscle,
  offset-cascade fallback); user drag positions persist.

### Node-type registry (CANVAS-03, FOUND-2)
- **D-04 `[auto]`:** `NODE_TYPE_REGISTRY` instantiates the proven registry contract: entry = id
  (`chat`, `genui-panel`), Zod schema for node `data`, content-hash `NODE_REGISTRY_VERSION`
  (mirroring `registry-version.ts`), allowlist semantics (unknown node types render an inert
  placeholder card, never crash the canvas). Persisted layouts record the registry version;
  loading a layout with unknown types degrades gracefully (placeholder + warning), never breaks.

### Persistence (CANVAS-02)
- **D-05 `[auto]`:** New Drizzle table `chat_canvas_layouts` (migration 0024): one row per
  conversation — `nodes` jsonb (positions/sizes/type/data-refs, NOT spec content — panels
  rehydrate specs from `chat_messages` by provenance id), `edges` jsonb, `viewport` jsonb,
  `node_registry_version`, timestamps. RLS deny-all + IF NOT EXISTS per house style.
- **D-06 `[auto]`:** Save = **debounced snapshot** (~800ms after drag/connect/viewport settle) via
  a tRPC/Drizzle mutation (`chat.saveCanvasLayout`); restore = exact (`toObject()`-style snapshot →
  positions, edges, viewport). Single-user local — last-write-wins, no CRDT (Out of Scope).

### Responsiveness under streaming (CANVAS-04)
- **D-07 `[auto]`:** Volatile streaming content lives **outside the React Flow `nodes` array**
  (explicitly named by the requirement): nodes carry only stable ids/refs; streaming text/partial
  specs flow through the Phase-22 `useChatStream` state + the shared store, consumed inside
  memoized node components (`React.memo`, stable `nodeTypes` map defined at module level).
  Node dimensions stay fixed during streaming (inner scroll) so the graph doesn't relayout per token.

### Shared state + data edges (STATE-01/02, FOUND-4)
- **D-08 `[auto]`:** Shared per-chat store = **Zustand store instantiated per conversation**,
  implementing a **superset of the v1.1 declared-state model**: same bounded mutation enum
  (toggle/set/reset/increment/decrement — no arbitrary reducers), same dotted-path binding grammar
  (`resolveDataRef`, FORBIDDEN_KEYS guards). One state system, never two (FOUND-4). Panel-scoped
  namespaces: `panels.{panelId}.{key}` + a `shared.*` namespace.
- **D-09 `[auto]`:** **Data-carrying edges**: an edge from panel A → panel B declares
  `{ sourcePath, targetKey }` — B's `data` context receives A's output value at `targetKey` via the
  store (edge = live subscription, re-resolves on source change). Edge payloads are Zod-validated;
  values cross the same binding grammar as declared-state (FOUND-6 posture — no arbitrary code).
  SpecRenderer stays UNMODIFIED — panels pass `data`/`declaredState` through the existing props.
- **D-10 `[auto]`:** Shared-store contents persist in the `chat_canvas_layouts` row (`shared_state`
  jsonb) so panel wiring survives reload; streaming/derived values are recomputed, not persisted.

### Claude's Discretion
- Exact debounce timing, snapshot shape details, dagre layout params
- Edge-creation UX (drag from handle; picker for sourcePath/targetKey)
- Canvas chrome (zoom controls, minimap on/off), empty-canvas state
- How the chat node embeds the message list (reuse Phase-22 components read-only vs full composer
  in-node — recommend full composer so canvas view is self-sufficient)
</decisions>

<specifics>
## Specific Ideas

- R2 leaning honored: "chat is a first-class node on the canvas (so the orchestration-viz pillar
  composes), with a convenience docked view."
- Seams for v1.5 (R4): node model admits future `agent`/`run` node types via D-04's registry;
  edges already transport data/context (the later dataflow-between-agents substrate).
- Canvas stays inside `/chat` — no separate top-level nav item (the canvas is a view of a
  conversation, not a separate product surface).
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & foundation decisions
- `.planning/ROADMAP.md` §"Phase 23" — goal + 5 success criteria
- `.planning/REQUIREMENTS.md` §Canvas / §Shared State — CANVAS-01..04, STATE-01..02
- `.planning/PROJECT.md` §Key Decisions — FOUND-2 (registry contract), FOUND-4 (shared state
  extends declared-state), FOUND-5 (provenance), FOUND-6 (schema gate) — binding

### Research + prior phase
- `.planning/research/v1.3/V1.3-RESEARCH-SYNTHESIS.md` §R2 + §R4 seams 1–3 (flagged [MODEL —
  pending web-validation]; researcher should validate React Flow perf-at-scale + live-updating
  React inside nodes if research runs)
- `.planning/phases/22-chat-spine-persistence-streaming/22-CONTEXT.md` + `22-0*-SUMMARY.md` —
  chat data model, typed parts, useChatStream, GenuiPartBoundary — the substrate this phase mounts
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@xyflow/react` + `@dagrejs/dagre` already deps — `/knowledge` graph
  (`apps/web/src/app/knowledge/`) is the in-repo React Flow reference (custom nodes, setEdges
  sync lesson from Phase 11 review: edges-not-rendering fix c936ea1, memoized seed items 5e13862)
- Phase 22: `useChatStream` hook, `MessageList`/`MessageTurn`/`Composer`, `GenuiPartBoundary`
  (progressive genui), `chat.getHistory`/CRUD tRPC router, `chat_messages` typed parts with
  provenance ids
- `packages/genui` renderer: `SpecRenderer` (UNMODIFIED — consume as-is), `useDeclaredState`
  5-mutation enum + `resolveDataRef` (the grammar D-08/D-09 extends)
- `registry-version.ts` content-hash pattern → NODE_REGISTRY_VERSION
- Drizzle migration pattern: latest is 0023; this phase = 0024

### Integration Points
- `/chat` page (`apps/web/src/app/chat/page.tsx`) — view toggle mounts the canvas
- tRPC chat router (`packages/api-client/src/router/chat/`) — add canvas-layout queries/mutations
- No Python/FastAPI changes expected this phase (canvas is a web+db concern)

### Established Patterns
- tRPC/Drizzle direct for CRUD (Phase 22 pattern); Zod at every boundary; immutable-only;
  named exports; dynamic(ssr:false) islands for client-heavy components
</code_context>

<deferred>
## Deferred Ideas

- Agent/run/remote-desktop node types (v1.5 — registry admits them, none built)
- Multiplayer/CRDT canvas (explicitly out of scope)
- Freeform drawing/ink (excluded — tldraw rejected)
- Cross-conversation/global canvas (canvas is strictly per-conversation in v1.3)
</deferred>

---

*Phase: 23-2d-canvas-panels-as-nodes-shared-state*
*Context gathered: 2026-07-04 (autonomous)*
