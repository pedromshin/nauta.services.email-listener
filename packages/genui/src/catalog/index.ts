/**
 * catalog/index.ts — Public re-exports for @polytoken/genui/catalog
 *
 * Re-exports:
 *   - Types from types.ts (Plan 01)
 *   - NAUTA_CATALOG value + compact-encoding helpers from manifest.ts (Plan 02)
 */

export type {
  SpecNodeType,
  ManifestEntry,
  AnyManifestEntry,
  ComponentRegistry,
} from "./types";

export {
  NAUTA_CATALOG,
  compactEntry,
  toCompactCatalog,
} from "./manifest";

export type { CompactEntry } from "./manifest";
