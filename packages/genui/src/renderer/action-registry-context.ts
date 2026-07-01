"use client";

/**
 * action-registry-context.ts — the ActionRegistry seam (SEAM-02), defined standalone.
 *
 * Extracted from spec-renderer.tsx so catalog components (e.g. the Phase-19 FormComponent) can
 * consume `ActionRegistryContext` WITHOUT importing spec-renderer — which pulls
 * COMPONENT_REGISTRY → manifest and would create a manifest ↔ renderer import cycle. This module
 * imports only React. spec-renderer re-exports these for backward compatibility.
 */

import * as React from "react";

/** A single action handler function signature. */
export type ActionHandler = (value?: unknown) => void;

/** Map from action ID string to its handler function (empty by default — SEAM-02). */
export type ActionRegistry = Readonly<Record<string, ActionHandler>>;

/**
 * React context carrying the action registry. Default `{}` — all action IDs resolve to a no-op,
 * which is safe (callers check for handler existence before calling). Wire real handlers via
 * `<ActionRegistryContext.Provider value={handlers}>`.
 */
export const ActionRegistryContext = React.createContext<ActionRegistry>({});

ActionRegistryContext.displayName = "ActionRegistryContext";
