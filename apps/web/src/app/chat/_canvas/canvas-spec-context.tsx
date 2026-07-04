"use client";

/**
 * canvas-spec-context.tsx — the CANVAS-04 seam: volatile genui-spec content
 * flows to `GenuiPanelNode` via React context, NEVER via node.data (D-07).
 *
 * `node.data` carries only a provenance ref (`GenuiPanelNodeData`); the spec
 * text itself (and whether it's still streaming) is looked up by that ref
 * through `useCanvasSpec`, called INSIDE the node component. This is what
 * keeps a streamed token from forcing a full React Flow `setNodes` array
 * identity change — only the context value changes, so React re-renders just
 * the subscribed node(s), never triggers a `nodes` array re-layout.
 *
 * `CanvasSpecProvider`'s default implementation serves ONLY history-derived
 * (finalized, non-streaming) specs from a `specsByProvenance` map keyed by
 * `messageId:partIndex`. The optional `streamingByProvenance` prop is the
 * seam plan 23-04 layers live `useChatStream` content through — checked
 * FIRST, falling back to the historical map — without this hook's contract
 * ever changing.
 */

import * as React from "react";

import type { Provenance } from "./node-data-schemas";

export interface CanvasSpecEntry {
  readonly specJson: string;
  readonly isStreaming: boolean;
}

interface CanvasSpecContextValue {
  readonly specsByProvenance: ReadonlyMap<string, string>;
  readonly streamingByProvenance?: ReadonlyMap<string, CanvasSpecEntry>;
}

const CanvasSpecContext = React.createContext<CanvasSpecContextValue | null>(
  null,
);

/** Stable lookup key for a provenance ref — `messageId:partIndex`. */
function provenanceKey(provenance: Provenance): string {
  return `${provenance.messageId}:${provenance.partIndex}`;
}

export interface CanvasSpecProviderProps {
  readonly children: React.ReactNode;
  /** Finalized specs keyed by `messageId:partIndex`, JSON-stringified (same
   * treatment the existing history-island web boundary applies to a
   * persisted genui_spec message part). */
  readonly specsByProvenance: ReadonlyMap<string, string>;
  /** Optional live-streaming override seam (CANVAS-04) — plan 23-04 supplies
   * this from `useChatStream` WITHOUT this contract changing. Checked
   * FIRST; falls back to `specsByProvenance` when a key is absent. */
  readonly streamingByProvenance?: ReadonlyMap<string, CanvasSpecEntry>;
}

export function CanvasSpecProvider({
  children,
  specsByProvenance,
  streamingByProvenance,
}: CanvasSpecProviderProps): React.ReactElement {
  const value = React.useMemo<CanvasSpecContextValue>(
    () => ({ specsByProvenance, streamingByProvenance }),
    [specsByProvenance, streamingByProvenance],
  );
  return (
    <CanvasSpecContext.Provider value={value}>
      {children}
    </CanvasSpecContext.Provider>
  );
}

/** Safe fallback when no provider wraps the tree, or a provenance ref has no
 * matching entry yet (e.g. layout restored before chat history finished
 * loading) — an empty text spec, never streaming. GenuiPartBoundary's own
 * SAFE_FALLBACK_SPEC gate handles anything downstream; this never throws. */
const EMPTY_SPEC: CanvasSpecEntry = {
  specJson: JSON.stringify({ v: 1, root: { type: "text", content: "" } }),
  isStreaming: false,
};

/**
 * useCanvasSpec — resolves `{ specJson, isStreaming }` for a genui-panel
 * node's provenance ref. Must be called from inside a component rendered
 * under `CanvasSpecProvider` (e.g. `GenuiPanelNode`); a missing provider or
 * an unresolved ref degrades to `EMPTY_SPEC` rather than throwing (D-04
 * "never breaks" ethos extended to this seam).
 */
export function useCanvasSpec(provenance: Provenance): CanvasSpecEntry {
  const ctx = React.useContext(CanvasSpecContext);
  const key = provenanceKey(provenance);

  if (ctx === null) {
    return EMPTY_SPEC;
  }

  const streamingEntry = ctx.streamingByProvenance?.get(key);
  if (streamingEntry !== undefined) {
    return streamingEntry;
  }

  const historySpecJson = ctx.specsByProvenance.get(key);
  if (historySpecJson !== undefined) {
    return { specJson: historySpecJson, isStreaming: false };
  }

  return EMPTY_SPEC;
}
