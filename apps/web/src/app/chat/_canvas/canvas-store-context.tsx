"use client";

/**
 * canvas-store-context.tsx — the STATE-01/STATE-02 seam: ONE `createCanvasStore`
 * instance per conversationId (a fresh store the moment the conversation
 * changes), hydrated from the persisted `chat_canvas_layouts.sharedState`
 * snapshot on mount (D-10). `usePanelData(panelId, incomingEdges?)` is the
 * per-panel read/write hook `GenuiPanelNode` uses to feed a store slice
 * (overlaid with any live data-carrying edges targeting it) into the
 * UNMODIFIED `SpecRenderer`'s `data` prop (via `GenuiPartBoundary`) — the
 * renderer itself never changes (D-09).
 *
 * `useCanvasStoreInstance` is called by `chat-canvas.tsx` itself (NOT inside
 * `CanvasStoreProvider`) so the SAME store instance is available both to
 * `CanvasStoreProvider` (context for panels) AND to `useCanvasPersistence`'s
 * debounced save (reads `store.getState().values` at fire time to persist
 * `sharedState`, D-10) — a single source of truth, never two stores.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { useStore } from "zustand";

import {
  createCanvasStore,
  resolveCanvasPath,
  type CanvasStore,
  type CanvasStoreSeed,
} from "./canvas-store";

// ---------------------------------------------------------------------------
// toCanvasStoreSeed — narrows an arbitrary persisted JSON record (the
// `chat_canvas_layouts.sharedState` column) into a `CanvasStoreSeed`. A
// `panels`/`shared` key that isn't itself a plain object is dropped rather
// than trusted (never throws; mirrors `validateSavedRow`'s degrade-instead-
// of-trust posture in use-canvas-persistence.ts, T-23-09).
// ---------------------------------------------------------------------------

export function toCanvasStoreSeed(raw: Record<string, unknown> | undefined): CanvasStoreSeed {
  if (raw === undefined) return {};
  const { panels, shared } = raw;
  return {
    panels: panels !== null && typeof panels === "object" ? (panels as Record<string, unknown>) : undefined,
    shared: shared !== null && typeof shared === "object" ? (shared as Record<string, unknown>) : undefined,
  };
}

// ---------------------------------------------------------------------------
// useCanvasStoreInstance — lazily creates ONE store per conversationId, but
// ONLY once `ready` (restore has resolved, so `seed` reflects the REAL
// persisted sharedState rather than an empty placeholder) — creating it
// eagerly on the first (pre-restore) render would permanently bake in an
// empty seed, since the ref-based "create once" pattern never re-seeds an
// already-built store.
// ---------------------------------------------------------------------------

interface CanvasStoreRef {
  readonly conversationId: string;
  readonly store: CanvasStore;
}

export function useCanvasStoreInstance(
  conversationId: string,
  seed: CanvasStoreSeed,
  ready: boolean,
): CanvasStore | null {
  const ref = useRef<CanvasStoreRef | null>(null);

  if (ready && (ref.current === null || ref.current.conversationId !== conversationId)) {
    ref.current = { conversationId, store: createCanvasStore(seed) };
  }
  if (!ready) return null;

  return ref.current?.store ?? null;
}

// ---------------------------------------------------------------------------
// CanvasStoreProvider — thin context passthrough for an externally-created
// store (see useCanvasStoreInstance above).
// ---------------------------------------------------------------------------

interface CanvasStoreContextValue {
  readonly store: CanvasStore;
}

const CanvasStoreContext = createContext<CanvasStoreContextValue | null>(null);

export interface CanvasStoreProviderProps {
  readonly children: ReactNode;
  readonly store: CanvasStore;
}

export function CanvasStoreProvider({
  children,
  store,
}: CanvasStoreProviderProps): ReactElement {
  const value = useMemo<CanvasStoreContextValue>(() => ({ store }), [store]);

  return (
    <CanvasStoreContext.Provider value={value}>{children}</CanvasStoreContext.Provider>
  );
}

function useCanvasStoreContext(): CanvasStoreContextValue {
  const ctx = useContext(CanvasStoreContext);
  if (ctx === null) {
    throw new Error(
      "usePanelData must be used inside a CanvasStoreProvider (canvas host wiring — see chat-canvas.tsx)",
    );
  }
  return ctx;
}

/** Exposes the raw store for callers that need direct access outside a
 * single panel's slice (e.g. the `EdgeCreationPicker`'s field discovery). */
export function useCanvasStore(): CanvasStore {
  return useCanvasStoreContext().store;
}

// ---------------------------------------------------------------------------
// CanvasEdgesContext — the STATE-02 seam: maps a target panelId to its
// currently-wired incoming data-carrying edges. React Flow's `NodeProps`
// only ever carries `{id, data, selected, ...}` for a custom node — there is
// no channel to pass a computed "edges targeting me" list as a prop, so the
// canvas host (chat-canvas.tsx) threads it through context instead (mirrors
// `CanvasSpecContext`'s own seam shape).
// ---------------------------------------------------------------------------

export interface IncomingDataEdge {
  readonly sourcePath: string;
  readonly targetKey: string;
}

interface CanvasEdgesContextValue {
  readonly edgesByTarget: ReadonlyMap<string, readonly IncomingDataEdge[]>;
}

const CanvasEdgesContext = createContext<CanvasEdgesContextValue | null>(null);

export interface DataCarryingEdge extends IncomingDataEdge {
  readonly target: string;
}

export interface CanvasEdgesProviderProps {
  readonly children: ReactNode;
  readonly edges: ReadonlyArray<DataCarryingEdge>;
}

/** Wraps the canvas tree with a live `target panelId -> incoming edges[]`
 * lookup, recomputed whenever the canvas's `edges` array changes (add/
 * remove/re-pick) — never touches `panels.*`/`shared.*` itself; resolution
 * of the actual VALUES happens per-subscriber in `usePanelData` below. */
export function CanvasEdgesProvider({
  children,
  edges,
}: CanvasEdgesProviderProps): ReactElement {
  const edgesByTarget = useMemo(() => {
    const map = new Map<string, IncomingDataEdge[]>();
    for (const edge of edges) {
      const existing = map.get(edge.target) ?? [];
      existing.push({ sourcePath: edge.sourcePath, targetKey: edge.targetKey });
      map.set(edge.target, existing);
    }
    return map as ReadonlyMap<string, readonly IncomingDataEdge[]>;
  }, [edges]);

  const value = useMemo<CanvasEdgesContextValue>(() => ({ edgesByTarget }), [edgesByTarget]);

  return (
    <CanvasEdgesContext.Provider value={value}>{children}</CanvasEdgesContext.Provider>
  );
}

const EMPTY_INCOMING_EDGES: readonly IncomingDataEdge[] = [];

/** Returns the CURRENT list of data-carrying edges targeting `panelId` — a
 * missing provider (e.g. a standalone test render) degrades to an empty
 * list rather than throwing (mirrors `useCanvasSpec`'s degrade posture). */
export function useIncomingEdgesForPanel(panelId: string): readonly IncomingDataEdge[] {
  const ctx = useContext(CanvasEdgesContext);
  if (ctx === null) return EMPTY_INCOMING_EDGES;
  return ctx.edgesByTarget.get(panelId) ?? EMPTY_INCOMING_EDGES;
}

// ---------------------------------------------------------------------------
// usePanelData — per-panel read/write into the canvas store
// ---------------------------------------------------------------------------

export interface UsePanelDataResult {
  readonly data: Record<string, unknown>;
  readonly dispatch: (mutation: string, key: string, value?: unknown) => void;
}

/**
 * usePanelData(panelId, incomingEdges?) — `data` is the panel's own
 * `panels.{panelId}.*` slice, overlaid with any `incomingEdges`' resolved
 * source values at their `targetKey` (STATE-02's live data-edge
 * subscription — re-resolves whenever the store changes, since the selector
 * reads the CURRENT `state.values` on every store update — D-09).
 * `dispatch(mutation, key, value)` mutates `panels.{panelId}.{key}` through
 * the store's own bounded mutation enum.
 */
export function usePanelData(
  panelId: string,
  incomingEdges: readonly IncomingDataEdge[] = EMPTY_INCOMING_EDGES,
): UsePanelDataResult {
  const { store } = useCanvasStoreContext();

  const data = useStore(store, (state) => {
    const panels = state.values.panels as Record<string, unknown> | undefined;
    const own = (panels?.[panelId] as Record<string, unknown> | undefined) ?? {};
    if (incomingEdges.length === 0) return own;

    const overlay: Record<string, unknown> = {};
    for (const edge of incomingEdges) {
      overlay[edge.targetKey] = resolveCanvasPath(state.values, edge.sourcePath);
    }
    return { ...own, ...overlay };
  });

  const mutate = useStore(store, (state) => state.mutate);

  const dispatch = useCallback(
    (mutation: string, key: string, value?: unknown) => {
      mutate(mutation, `panels.${panelId}.${key}`, value);
    },
    [mutate, panelId],
  );

  return { data, dispatch };
}
