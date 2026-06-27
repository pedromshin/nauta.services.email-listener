/**
 * studio/build-catalog-example-spec.ts — Wraps a catalog entry's example props
 * into a renderable SpecRoot.
 *
 * WHY THIS EXISTS (regression seam):
 *   The catalog browser island (apps/web) renders each catalog entry's `example`
 *   live via SpecRenderer. A genui spec node is FLAT — `{ type, ...props }` — NOT
 *   `{ type, props: {...} }`. An earlier version of the island nested the example
 *   under a `props:` key, which made renderNode extract `{ props: {...}, children: [] }`
 *   and fail propsSchema.safeParse for EVERY entry → every card showed the
 *   "[!] <type> node — prop validation failed" fallback.
 *
 *   This helper is the single source of truth for that wrapping. The island AND the
 *   genui regression test both import it so they can never drift (apps/web has no
 *   test runner; the test lives here in @nauta/genui where vitest exists).
 *
 * SHAPE (spec-schema.ts):
 *   - Leaf node schemas are .strict() — spreading the flat example matches the node
 *     schema directly; an unexpected `children` key would be rejected.
 *   - Layout containers (stack, grid) REQUIRE a `children` array; their catalog
 *     examples omit it. For entries that accept children but whose example provides
 *     none, we inject `children: []` so the wrapped node validates as an
 *     empty-but-valid container.
 */

import type { AnyManifestEntry } from "../catalog/types";
import type { SpecNode, SpecRoot } from "../schema/spec-schema";

/**
 * The minimal slice of a catalog entry needed to build its example spec.
 * Accepts a full {@link AnyManifestEntry} (structurally compatible).
 */
export interface CatalogExampleSource {
  /** The spec node type key (discriminant). */
  readonly type: string;
  /** A complete, valid example props object for this entry. */
  readonly example: Record<string, unknown>;
  /** True if the entry accepts positional children[] (stack, grid, card). */
  readonly acceptsChildren?: boolean;
}

/**
 * Builds a minimal, schema-valid {@link SpecRoot} that renders a catalog entry's
 * example prop set as a FLAT spec node (`{ type, ...example }`).
 *
 * @param entry — a catalog manifest entry (or compatible {@link CatalogExampleSource})
 * @returns a SpecRoot whose root node renders the example via renderNode
 */
export function buildCatalogExampleSpec(
  entry: CatalogExampleSource | AnyManifestEntry,
): SpecRoot {
  const node: Record<string, unknown> = {
    type: entry.type,
    ...entry.example,
  };

  // Layout containers (stack/grid) require a children array the example omits.
  // Only inject for children-accepting entries to avoid adding an unexpected
  // `children` key to .strict() leaf schemas.
  if (entry.acceptsChildren === true && !("children" in node)) {
    node["children"] = [];
  }

  return {
    v: 1,
    root: node as SpecNode,
  };
}
