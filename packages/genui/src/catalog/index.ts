/**
 * catalog/index.ts — Public re-exports for @nauta/genui/catalog
 *
 * This file re-exports types only. The manifest constant value-export
 * (NAUTA_CATALOG, COMPONENT_REGISTRY) is added in Plan 02 (catalog/manifest.ts).
 */

export type {
  SpecNodeType,
  ManifestEntry,
  AnyManifestEntry,
  ComponentRegistry,
} from "./types";
