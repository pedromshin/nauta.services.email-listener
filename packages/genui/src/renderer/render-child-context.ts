"use client";

/**
 * renderer/render-child-context.ts — the RenderChild seam, defined standalone.
 *
 * Mirrors action-registry-context.ts (SEAM-02): catalog components that need to render a
 * nested SpecNode carried in their own props (e.g. TabsComponent's `tab.content`) cannot import
 * renderNode from render-node.tsx directly — that would create a manifest <-> renderer import
 * cycle. Instead they consume this context, which render-node.tsx binds to the CURRENT
 * RenderContext (data/state/dispatch/registry) at the point of registry dispatch.
 *
 * This module imports ONLY React — no manifest, no render-node, no schema — so no cycle is
 * possible regardless of which side imports it. render-node.tsx re-exports as needed.
 */

import * as React from "react";

/**
 * Renders a nested child SpecNode using the CURRENT render context, producing a keyed React
 * element.
 *
 * @param node      — the child SpecNode to render (typed `unknown` here — catalog components do
 *                     not import the schema type; render-node.tsx narrows it before recursing).
 * @param keySuffix — combined with the enclosing keyPrefix by the provider's implementation.
 *                     Structural only — never derived from spec node.id/key (D-15).
 */
export type RenderChild = (node: unknown, keySuffix: string) => React.ReactElement;

/**
 * Default no-op: renders an empty, keyed fragment. Safe when no provider is mounted (e.g. a
 * catalog component rendered outside the interpreter, such as in isolated component tests).
 */
const defaultRenderChild: RenderChild = (_node, keySuffix) =>
  React.createElement(React.Fragment, { key: keySuffix });

/**
 * React context carrying the current child-render function. Defaults to the safe no-op above.
 * render-node.tsx provides the real implementation via
 * `<RenderChildContext.Provider value={...}>`, scoped to the current ctx/keyPrefix so nested
 * renders (e.g. tabs nested inside a `list`) resolve data against the correct item context.
 */
export const RenderChildContext = React.createContext<RenderChild>(defaultRenderChild);

RenderChildContext.displayName = "RenderChildContext";
