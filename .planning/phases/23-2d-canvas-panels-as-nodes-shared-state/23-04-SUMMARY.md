---
phase: 23-2d-canvas-panels-as-nodes-shared-state
plan: 04
subsystem: web-ui, canvas, api-client
tags: [react-flow, persistence, debounce, streaming, zod, canvas, tRPC]

# Dependency graph
requires:
  - phase: 23-2d-canvas-panels-as-nodes-shared-state
    plan: 01
    provides: chat.getCanvasLayout/saveCanvasLayout tRPC procedures + CanvasSnapshotSchema (CANONICAL SNAPSHOT SHAPE)
  - phase: 23-2d-canvas-panels-as-nodes-shared-state
    plan: 02
    provides: NODE_TYPE_REGISTRY/resolveNodeType/NODE_REGISTRY_VERSION, CanvasSpecProvider/useCanvasSpec streamingByProvenance seam
  - phase: 23-2d-canvas-panels-as-nodes-shared-state
    plan: 03
    provides: ChatCanvas surface, useConversationController, layoutCanvasNodes/offsetCascadePosition, nodeTypes map
provides:
  - useCanvasPersistence (restore + reconcile + debounced save) — the full CANVAS-02 persistence loop, closing the seam 23-03 explicitly left open
  - reconcileNodesFromHistory/buildSnapshot/withDefaultChatNode — reusable pure functions for BOTH the initial restore and every later live historyRows delta
  - CanvasSnapshotSchema now importable client-side via @nauta/api-client/chat-canvas (split from the server-only canvas.ts)
  - buildStreamingByProvenance — the concrete, backend-constraint-honest realization of the CANVAS-04 streamingByProvenance seam
affects: [23-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Package subpath exports must isolate pure/client-safe modules from server-only transitive imports — packages/api-client's chat/canvas.ts imported '../../trpc' -> '@nauta/db' (server-only Postgres client reading env vars via @t3-oss/env-core), so any client-side import of CanvasSnapshotSchema through it crashed with 'Attempted to access a server-side environment variable on the client'; split into canvas-schema.ts (zero imports beyond zod) re-exported verbatim from canvas.ts, and pointed the new './chat-canvas' package export at the schema-only file"
    - "reconcileNodesFromHistory is a single, generically-reusable two-pass pure function: Pass 1 restores every saved/current node at its EXACT position (degrading an unrecognized type to the inert placeholder); Pass 2 places any genui_spec part missing from that set via a fresh dagre-seed + offsetCascadePosition nudge. Called with a PERSISTED row's nodes at restore time, and with the CURRENT nodes array (mapped back to the same plain shape) on every later historyRows change — one function, two callers, no duplicated placement logic"
    - "A degraded node's ORIGINAL type/data is reconstructed (not discarded) when re-persisting via buildSnapshot — the synthetic `nodeType` marker used only for the placeholder's render-time copy is stripped back out, so a future registry addition can still 'heal' a previously-unknown node type instead of the placeholder identity being baked in forever"
    - "A brand-new genui_spec part has NO stable messageId until its turn's assistant row is inserted at finalize (confirmed by reading run_chat_turn.py — the backend never optimistically inserts an in-progress row) — so live streaming responsiveness for a NEW turn is delivered by the ChatNode's own embedded MessageList (reads controller.turns directly, unaffected by canvas node state), while the settled genui-panel node materializes once the turn completes via the historyRows reconcile effect; streamingByProvenance's real, honest use case is overlaying a REGENERATE's live partial content onto its EXISTING already-materialized node (a stable, already-real provenance key)"

key-files:
  created:
    - apps/web/src/app/chat/_canvas/use-canvas-persistence.ts
    - apps/web/src/app/chat/_canvas/__tests__/use-canvas-persistence.test.ts
    - apps/web/src/app/chat/_canvas/__tests__/chat-canvas.test.ts
    - apps/web/src/app/chat/_canvas/save-status-indicator.tsx
    - packages/api-client/src/router/chat/canvas-schema.ts
  modified:
    - apps/web/src/app/chat/_canvas/chat-canvas.tsx
    - apps/web/src/app/chat/_canvas/chat-canvas-island.tsx
    - apps/web/src/app/chat/_canvas/node-types.ts
    - apps/web/src/app/chat/page.tsx
    - apps/web/src/app/chat/_hooks/use-conversation-controller.ts
    - packages/api-client/src/router/chat/canvas.ts
    - packages/api-client/package.json

key-decisions:
  - "reconcileNodesFromHistory's signature stays exactly (savedNodes, historyRows) per the plan's quoted interface — it has NO knowledge of conversationId/the chat node. A separate small pure helper, withDefaultChatNode(nodes, conversationId), synthesizes the D-02 default chat node only when absent, called once at the initial seed step"
  - "ChatCanvas restructured around ONE seed-and-reconcile effect (not two) — the very first run seeds from useCanvasPersistence's restored initialNodes; every later run (a historyRows change) re-reconciles the CURRENT nodes state instead, so a user's drag position is never lost. This collapsed what would otherwise be two effects racing on the same first render"
  - "SaveStatusIndicator is lifted to page.tsx's conversation toolbar (next to CostMeter, the literal '23-UI-SPEC.md toolbar right zone') via an onSaveStatusChange callback threaded through ChatCanvasIsland, rather than rendered inside the canvas pane itself — matches the UI-SPEC's stated placement faithfully; resets to idle when switching back to Chat view"
  - "The 'Saved' label's 2s dismissal is a plain unmount (no exit-fade animation) — an entrance-only motion-safe fade (the established pattern already used for new-panel materialization) was judged proportionate for this ambient text label; a true two-phase fade-out would need a new animation primitive this codebase doesn't otherwise use"
  - "streamingByProvenance is fed from a NEW, additive ConversationController field, regeneratingMessageId (exposing the existing internal regeneratingActiveId state) — the one stable, already-real provenance key available while a turn streams; live progress for a brand-new (non-regenerate) turn is intentionally NOT mirrored onto a temporary canvas node (see tech-stack pattern above) to avoid a client-only node whose non-UUID id would need special-casing everywhere buildSnapshot/CanvasSnapshotSchema touch node.data"

requirements-completed: [CANVAS-02, CANVAS-04]

# Metrics
duration: ~55min
completed: 2026-07-04
---

# Phase 23 Plan 04: Canvas Persistence + Streaming Responsiveness Summary

**`useCanvasPersistence` closes the CANVAS-02 loop (exact restore, unknown-type degrade, live historyRows reconciliation, ~800ms debounced coalesced save) and CANVAS-04's responsiveness contract (volatile genui content flows through `CanvasSpecProvider`'s context seam, never the React Flow `nodes` array).**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3 completed
- **Files created:** 5 (2 canvas modules + 2 test files + 1 client-safe schema split)
- **Files modified:** 7 (canvas surface wiring, node-type registry, page toolbar, controller, api-client package)

## Accomplishments

- **Task 1 — `useCanvasPersistence` restore + reconcile + snapshot (TDD):** Built `reconcileNodesFromHistory(savedNodes, historyRows)` — a two-pass pure function: Pass 1 restores every saved node at its EXACT position, degrading any type unrecognized by the current `NODE_TYPE_REGISTRY` to the inert `unknown-node-type` placeholder (position honored, never throws — even for an arbitrary/legacy type simulating a stale `node_registry_version`); Pass 2 places any `genui_spec` part missing a saved node via a fresh dagre-seed + `offsetCascadePosition` nudge clear of every already-placed rect. Built `buildSnapshot(nodes, edges, viewport)` — a `CanvasSnapshotSchema`-valid, `NODE_REGISTRY_VERSION`-stamped object containing no spec content, reconstructing a degraded node's ORIGINAL type/data (heal-ready) before persisting. Built `withDefaultChatNode` (D-02's always-present chat node). The `useCanvasPersistence` hook fetches `chat.getCanvasLayout`, re-validates the row against `CanvasSnapshotSchema` on the READ side too (T-23-09 — a tampered/legacy row degrades to an empty restore rather than being trusted), and returns `{ initialNodes, initialEdges, initialViewport, isRestoring }`. `chat-canvas.tsx` was restructured so ReactFlow itself never mounts until restore resolves (`CanvasSkeleton` in the interim) — one effect seeds from the restored data reconciled against the CURRENT `historyRows`, then re-reconciles the live `nodes` state on every later `historyRows` change (drag positions never lost).
- **Task 2 — Debounced coalesced save + `SaveStatusIndicator`:** Extended the hook with `scheduleSave()` — a single trailing ~800ms timer (cleared on unmount) that reads the LATEST `nodes`/`edges`/`viewport` via a ref, builds a snapshot, and calls `chat.saveCanvasLayout`; `saveStatus` (`idle`/`saving`/`saved`/`error`) drives the new `SaveStatusIndicator` (ambient `text-xs text-muted-foreground`, "Saved" 2s motion-safe fade-in / "Not saved — retrying…" with no retry button — the debounce auto-retries). Wired `onNodeDragStop`, an `onEdgesChange` wrapper (add/remove only), `onMoveEnd`, and the keyboard pan/zoom/fitView fallback to `scheduleSave()`. Lifted `saveStatus` to `page.tsx`'s conversation toolbar (next to `CostMeter`, canvas view only) via a threaded `onSaveStatusChange` callback.
- **Task 3 — Streaming responsiveness:** Confirmed (and closed) the CANVAS-04/D-07 contract: `GenuiPanelNode` already read spec content exclusively via `useCanvasSpec` (context), never `node.data` — no code path calls `setNodes` in response to a streamed token. Investigated the backend (`run_chat_turn.py`) and confirmed a brand-new turn has NO stable messageId until its assistant row is inserted at finalize, so `buildStreamingByProvenance` realizes the `streamingByProvenance` seam honestly: it overlays the live streaming pseudo-turn's `genui_spec_streaming`/`genui_spec` parts onto an EXISTING, already-materialized genui-panel node during a REGENERATE (`controller.regeneratingMessageId`, a new additive `ConversationController` field) — never creating a node mid-stream. A first-time send's live progress is visible through the `ChatNode`'s own embedded `MessageList`; the settled panel materializes via Task 1's historyRows-reconcile effect, which now also announces "New panel added" (comparing the node-id set across renders) the moment a genuinely new node lands.
- **Cross-cutting fix (Rule 3 — blocking):** `packages/api-client/src/router/chat/canvas.ts` imported `../../trpc` -> `@nauta/db`'s server-only Postgres client, so any client-side import of `CanvasSnapshotSchema` crashed with "Attempted to access a server-side environment variable on the client" (reproduced via a real failing test before the fix). Split the schema/guards into a new zero-import (beyond zod) `canvas-schema.ts`, re-exported verbatim from `canvas.ts` (existing procedures/tests untouched), and added a `"./chat-canvas"` package export pointing at the schema-only module.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: add failing test for canvas restore/reconcile/snapshot helpers** — `473586b` (test)
1. **Task 1 GREEN: implement useCanvasPersistence restore + reconcile + snapshot** — `8997e9b` (feat)
2. **Task 2: debounced coalesced canvas save + SaveStatusIndicator** — `90a4e87` (feat)
3. **Task 3: stream volatile genui content through context, never nodes** — `3b925ce` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `apps/web/src/app/chat/_canvas/use-canvas-persistence.ts` — `reconcileNodesFromHistory`, `buildSnapshot`, `withDefaultChatNode`, `chatNodeId`, `genuiPanelNodeId`, `useCanvasPersistence` (+ `SaveStatus`, `ReconciledNode`, `PersistedCanvasNode/Edge/Viewport` types)
- `apps/web/src/app/chat/_canvas/__tests__/use-canvas-persistence.test.ts` — 13 tests (restore/reconcile/degrade/snapshot)
- `apps/web/src/app/chat/_canvas/__tests__/chat-canvas.test.ts` — 7 tests (`buildSpecsByProvenance`/`buildStreamingByProvenance`)
- `apps/web/src/app/chat/_canvas/save-status-indicator.tsx` — `SaveStatusIndicator`
- `apps/web/src/app/chat/_canvas/chat-canvas.tsx` — seed/reconcile/save/streaming wiring, `buildStreamingByProvenance`, "New panel added"/"Layout saved"/"Canvas layout restored" announcements
- `apps/web/src/app/chat/_canvas/chat-canvas-island.tsx` — threads `onSaveStatusChange`
- `apps/web/src/app/chat/_canvas/node-types.ts` — registers `"unknown-node-type"` in the module-level `nodeTypes` map
- `apps/web/src/app/chat/page.tsx` — `SaveStatusIndicator` in the toolbar's right zone
- `apps/web/src/app/chat/_hooks/use-conversation-controller.ts` — exposes `regeneratingMessageId`
- `packages/api-client/src/router/chat/canvas-schema.ts` — `CanvasSnapshotSchema` + guards (zero non-zod imports)
- `packages/api-client/src/router/chat/canvas.ts` — re-exports from `canvas-schema.ts`, keeps `chatCanvasProcedures`
- `packages/api-client/package.json` — new `"./chat-canvas"` subpath export

## Decisions Made

See `key-decisions` in frontmatter. Summarized: `reconcileNodesFromHistory` stays a strict 2-arg pure function (chat-node defaulting is a separate helper); one seed-and-reconcile effect (not two) in `ChatCanvas`; `SaveStatusIndicator` lives in the page-level toolbar (not the canvas pane) to match the UI-SPEC's literal placement; the "Saved" label's disappearance is a plain unmount, not an animated exit; `streamingByProvenance` is honestly scoped to the regenerate-in-place case given the backend's finalize-only message-id assignment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@nauta/api-client/chat-canvas` crashed any client import — server-only trpc/db chain**
- **Found during:** Task 1, first `vitest run` of the new persistence test (reproduced live: `Error: ❌ Attempted to access a server-side environment variable on the client` from `@t3-oss/env-core` via `packages/db/src/client.ts`)
- **Issue:** The plan's own `<interfaces>` note pointed at `chat.getCanvasLayout`/`chat.saveCanvasLayout`'s `CanvasSnapshotSchema` for client-side read-side re-validation (T-23-09's stated mitigation), but `canvas.ts` (where that schema lived) imports `../../trpc`, which transitively pulls in `@nauta/db`'s server-only Postgres client — unimportable from any client bundle or jsdom test.
- **Fix:** Split the schema/guards into `packages/api-client/src/router/chat/canvas-schema.ts` (zero imports beyond `zod`); `canvas.ts` now imports from it and re-exports everything verbatim (its own procedures + the existing `__tests__/canvas.test.ts` are unaffected — verified 11/11 still green). Added a new `"./chat-canvas"` package export pointing at the schema-only file (mirrors the existing `"./geometry"` precedent), and rebuilt `packages/api-client`'s local `dist/` so the new subpath's `.d.ts`/`.js` exist for `apps/web`'s type resolution.
- **Files modified:** `packages/api-client/src/router/chat/canvas-schema.ts` (new), `packages/api-client/src/router/chat/canvas.ts`, `packages/api-client/package.json`
- **Commit:** `8997e9b` (Task 1 GREEN)

**2. [Rule 2 - Missing critical functionality] `node-types.ts` had no entry for the degrade-to-placeholder marker**
- **Found during:** Task 1, wiring `reconcileNodesFromHistory`'s degrade path into `chat-canvas.tsx`
- **Issue:** A reconciled node's rendered `type` is rewritten to the fixed string `"unknown-node-type"` on a registry miss, but the module-level `nodeTypes` map (fed to React Flow's `nodeTypes` prop) only had `{chat, genui-panel}` — without a matching entry, React Flow would fall back to its own default node renderer instead of `UnknownNodeTypePlaceholder`, silently breaking CANVAS-03's "never breaks, always degrades gracefully" guarantee this very plan is meant to close.
- **Fix:** Added `"unknown-node-type": UnknownNodeTypePlaceholder` to the `nodeTypes` map (the component was already imported for `resolveNodeComponent`'s fallback — no new import needed).
- **Files modified:** `apps/web/src/app/chat/_canvas/node-types.ts`
- **Commit:** `8997e9b` (Task 1 GREEN)

---

**Total deviations:** 2 auto-fixed (1 blocking cross-package import chain, 1 missing registry entry) — both required to reach the plan's own acceptance criteria (client-side `CanvasSnapshotSchema` re-validation; degraded nodes actually rendering as placeholders). No scope creep, no architectural changes.

## Issues Encountered

None beyond the two Rule 2/3 items above.

## User Setup Required

None — no new dependencies, no env vars, no infra/migration changes. `packages/api-client/dist/` was rebuilt locally (gitignored, not committed) so this session's typecheck resolves the new subpath; any fresh clone/CI run regenerates it via the existing `build`/`typecheck` scripts.

## Known Scope Notes (not stubs — explicit, backend-constraint-driven decisions)

- **Live materialization of a genui-panel node mid-stream for a brand-new (non-regenerate) turn is NOT implemented** — confirmed via `run_chat_turn.py` that the backend has no stable messageId for an in-progress turn (the assistant row is inserted only at finalize). The user still sees that turn's live text/partial-spec progress in the `ChatNode`'s own embedded `MessageList` (unchanged, reused wholesale since 23-03); the SEPARATE spatial genui-panel node for that turn appears the moment it completes, via Task 1's historyRows-reconcile effect (dagre-seeded + offset-cascade-placed, fade-in entrance, "New panel added" announced). `streamingByProvenance` IS wired and delivers real value for the one case that has a stable id available: an in-place regenerate of an already-materialized panel.
- **Edge creation/data-carrying edges are out of scope** (23-05) — `buildSnapshot`/`CanvasSnapshotSchema` already round-trip an `edges` array correctly (covered by a dedicated test), but no UI creates one yet; `edges` stays `[]` in practice this plan.

## Threat Flags

None — all new surface (client-side `CanvasSnapshotSchema` re-validation on restore, the debounced save's snapshot construction, the degrade-to-placeholder path, the streaming-provenance overlay) was already enumerated in the plan's `<threat_model>` (T-23-09, T-23-10, T-23-02) and implemented exactly as dispositioned:
- T-23-09 (tampered/legacy restored layout) — `validateSavedRow` re-parses the persisted row against `CanvasSnapshotSchema` before use, degrading to an empty restore on failure; per-node `resolveNodeType` degrade never throws regardless of `node_registry_version` drift.
- T-23-10 (save spam / streamed-token relayout thrash) — a single trailing ~800ms debounce timer coalesces edits; streamed content flows exclusively through `CanvasSpecProvider`'s context seam, never `node.data`/`setNodes`.
- T-23-02 (spec content persisted into the saved snapshot) — `buildSnapshot` never includes spec content; the split `canvas-schema.ts`'s `.refine()` guard (mirrored from 23-01) still rejects `spec`/`root` keys at the tRPC boundary.

## Next Phase Readiness

- `chat_canvas_layouts` now has a full, live, tested E2E loop: restore → reconcile → drag/edge/viewport → debounced save → restore again — ready for 23-05 to layer STATE-01/02 (shared per-chat state, data-carrying edges) on top of the SAME `sharedState`/`edges` columns this plan's `buildSnapshot`/`CanvasSnapshotSchema` already round-trip (currently always `{}`/`[]` in practice, since no UI writes to them yet).
- `ConversationController.regeneratingMessageId` and `CanvasSpecProvider`'s `streamingByProvenance` seam are both proven, real wiring 23-05 (or a future dual-channel plan) can extend without touching either contract.
- `reconcileNodesFromHistory`/`withDefaultChatNode`/`buildSnapshot` are pure, well-tested, and reusable — any future canvas-mutating feature (e.g. an edge-creation picker in 23-05) should route its persistence through the SAME `useCanvasPersistence.scheduleSave()` seam rather than a new save path.

---
*Phase: 23-2d-canvas-panels-as-nodes-shared-state*
*Completed: 2026-07-04*

## Self-Check: PASSED

All 5 created files confirmed present on disk; all 4 task commits (`473586b`, `8997e9b`, `90a4e87`, `3b925ce`) confirmed present in `git log --oneline`. `apps/web` vitest: 62/62 tests green (7 files, incl. the 13 new persistence tests + 7 new chat-canvas tests). `packages/api-client` vitest: 184/184 green (incl. the pre-existing 11 canvas.test.ts tests, unaffected by the schema split). `apps/web` and `packages/api-client` `tsc --noEmit` both clean. `next build` compiles (`/chat` route, 124 kB / 329 kB First Load JS). No-eval grep (`eval\(|new Function`) returns 0 across all `_canvas` source files.
