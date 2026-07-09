"use client";

/**
 * panel-action-bridge.ts — the STATE-01 write bridge (23-06 Task 2 / VERIFICATION.md missing
 * item 1). Builds a per-panel `ActionRegistry` whose ONLY entry is `setState`, routing writes
 * through the existing bounded write surface — never a new one:
 *   - a plain key    -> usePanelData().dispatch("set", key, value)  (lands at panels.{panelId}.{key})
 *   - a `shared.`-prefixed key -> the store's mutate("set", path, value) (lands at shared.{key})
 *
 * Why ONLY setState is registered here (navigate/query-refresh intentionally absent):
 *   navigate/query-refresh would add router/tRPC dependencies a memoized canvas node body should
 *   not carry, and neither is required by STATE-01/STATE-02 — an unresolved action ID already
 *   resolves to SpecRenderer's own safe noop default (`ActionRegistryContext`'s empty-object
 *   default). `mutate` is absent because `ALLOWED_MUTATIONS` is `[]` (SEAM-02,
 *   packages/genui/src/schema/action-schema.ts) — no valid spec can ever carry a `mutate` action,
 *   so registering a handler for it here would be dead code.
 *
 * The mutation argument passed to EITHER dependency is ALWAYS the literal "set" — this bridge can
 * never smuggle an arbitrary reducer name into the store. Value/primitive constraints on
 * `setState.value` are already enforced upstream by `ActionSchema` at spec-validation time;
 * FORBIDDEN_KEYS path segments are no-op'd inside the store's own `mutate` (canvas-store.ts) — no
 * duplicate guard is needed in this bridge.
 */

import { useMemo } from "react";

import type { ActionRegistry } from "@polytoken/genui/renderer";

import { useCanvasStore, type UsePanelDataResult } from "./canvas-store-context";

const SHARED_PREFIX = "shared.";

export interface PanelActionBridgeDeps {
  readonly dispatchPanel: (mutation: string, key: string, value?: unknown) => void;
  readonly mutateShared: (mutation: string, path: string, value?: unknown) => void;
}

interface SetStatePayloadShape {
  readonly key?: unknown;
  readonly value?: unknown;
}

/** Narrows an unknown setState action payload — mirrors
 * packages/genui/src/renderer/action-handlers.ts's setState narrowing (object check, key is a
 * non-empty string) — never throws on a malformed payload. */
function isValidSetStatePayload(
  payload: SetStatePayloadShape,
): payload is { readonly key: string; readonly value?: unknown } {
  return typeof payload.key === "string" && payload.key.length > 0;
}

/**
 * buildPanelActionRegistry — pure. Returns a frozen `ActionRegistry` with exactly one key,
 * `setState`, routing to `deps.dispatchPanel` or `deps.mutateShared` depending on the
 * `shared.`-prefix namespace convention.
 */
export function buildPanelActionRegistry(deps: PanelActionBridgeDeps): ActionRegistry {
  const setState = (action?: unknown): void => {
    if (action === null || typeof action !== "object") return;
    const payload = action as SetStatePayloadShape;
    if (!isValidSetStatePayload(payload)) return;

    const { key, value } = payload;
    if (key.startsWith(SHARED_PREFIX)) {
      deps.mutateShared("set", key, value);
    } else {
      deps.dispatchPanel("set", key, value);
    }
  };

  return Object.freeze({ setState });
}

/**
 * usePanelActionRegistry(dispatch) — memoized per-panel `ActionRegistry` built from
 * `usePanelData().dispatch` (panel-scoped writes) plus the raw store's `mutate` (for
 * `shared.*` writes, which are NOT panel-scoped). Threaded into `GenuiPanelNodeBody` ->
 * `GenuiPartBoundary`'s new `actions` prop -> the UNMODIFIED `SpecRenderer`'s existing `actions`
 * prop.
 */
export function usePanelActionRegistry(
  dispatch: UsePanelDataResult["dispatch"],
): ActionRegistry {
  const store = useCanvasStore();

  return useMemo(
    () =>
      buildPanelActionRegistry({
        dispatchPanel: dispatch,
        mutateShared: (mutation, path, value) => store.getState().mutate(mutation, path, value),
      }),
    [dispatch, store],
  );
}
