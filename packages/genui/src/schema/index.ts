/**
 * schema/index.ts — Public re-exports for @nauta/genui/schema
 *
 * Exports all schemas, inferred types, bound constants, and walker utilities
 * from spec-schema.ts. Downstream plans (renderer, demo) import from here.
 *
 * Phase 13 additions:
 *   - DataBindingSchema (D-13 / SAFE-03)
 *   - ActionSchema + variants (D-14 / SAFE-04)
 *   - Allowlist symbols (D-12/D-13/D-14)
 *   - SAFE_FALLBACK_SPEC (D-07 / GEN-03)
 */

export {
  // Schemas
  StateDeclarationSchema,
  SpecNodeSchema,
  SpecRootSchema,
  ChildrenSchema,
  // Bound constants (D-24)
  MAX_SPEC_NODES,
  MAX_SPEC_DEPTH,
  // Bound walkers
  countNodes,
  specDepth,
} from "./spec-schema";

export type {
  // Inferred types
  SpecNode,
  SpecRoot,
  StateDeclaration,
} from "./spec-schema";

// Phase 13: DataBinding schema (D-13 / SAFE-03)
export { DataBindingSchema } from "./data-binding-schema";
export type { DataBinding } from "./data-binding-schema";

// Phase 13: Action schema (D-14 / SAFE-04)
export { ActionSchema, ALLOWED_MUTATIONS } from "./action-schema";
export type {
  Action,
  NavigateAction,
  SetStateAction,
  MutateAction,
} from "./action-schema";

// Phase 13: Allowlist surface (D-12/D-13/D-14/D-15)
// Phase 17: Allowlist 4 — token aliases + style pack ids (D-06/STYLE-03/D-08/STYLE-04)
export {
  RegisteredTypeSchema,
  REGISTERED_TYPES,
  AllowedProcedureSchema,
  ALLOWED_PROCEDURES,
  TokenAliasSchema,
  StylePackIdSchema,
  TokenPropsSchema,
  TOKEN_ALIAS_VALUES,
} from "./allowlists";
export type { AllowedProcedure, TokenAlias, StylePackId, TokenProps } from "./allowlists";

// Phase 13: Safe fallback spec (GEN-03 / D-07)
export { SAFE_FALLBACK_SPEC } from "./safe-fallback-spec";
