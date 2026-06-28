/**
 * schema/allowlists.ts — Single allowlist surface for the spec schema (D-12/D-13/D-14/D-15/D-06).
 *
 * This module re-exports all four allowlist symbols so consumers import from
 * one place. It is the authoritative entry point for:
 *
 *   Allowlist 1 — component types (D-12):
 *     RegisteredTypeSchema  — z.enum derived from COMPONENT_REGISTRY keys
 *     REGISTERED_TYPES      — readonly string[]
 *
 *   Allowlist 2 — tRPC procedures (D-13):
 *     AllowedProcedureSchema — z.enum over ALLOWED_PROCEDURES
 *     ALLOWED_PROCEDURES     — readonly tuple of query-only procedure names
 *
 *   Allowlist 3 — action href (D-14) + mutation seam (SEAM-02):
 *     ActionSchema           — discriminated union (navigate/setState/mutate)
 *     ALLOWED_MUTATIONS      — readonly empty tuple in v1.1 (SEAM-02)
 *
 *   Allowlist 4 — token aliases (D-06/STYLE-03):
 *     TokenAliasSchema       — z.enum derived from TOKEN_ALIASES (the closed alias set)
 *     TokenPropsSchema       — strict object with optional token alias keys
 *     StylePackIdSchema      — z.enum derived from STYLE_PACK_IDS
 *     TOKEN_ALIAS_VALUES     — readonly string[] of valid alias names
 *
 * Enforcement is primary at the Zod schema layer (D-15): a single safeParse
 * rejects all four violation classes. Runtime re-checks in the binding/action
 * layer add defense-in-depth (D-15).
 */

// Allowlist 1: component types (D-12)
// RegisteredTypeSchema is derived from Object.keys(COMPONENT_REGISTRY) at module load
// so it auto-updates when the catalog changes — no manual sync required.
export {
  RegisteredTypeSchema,
  REGISTERED_TYPES,
} from "../registry/component-registry";

// Allowlist 2: tRPC procedures (D-13)
export {
  AllowedProcedureSchema,
  ALLOWED_PROCEDURES,
} from "../generation/allowed-procedures";

export type { AllowedProcedure } from "../generation/allowed-procedures";

// Allowlist 3: actions + mutation seam (D-14 / SEAM-02)
export {
  ActionSchema,
  ALLOWED_MUTATIONS,
} from "./action-schema";

export type { Action, NavigateAction, SetStateAction, MutateAction } from "./action-schema";

// DataBinding schema (D-13)
export { DataBindingSchema } from "./data-binding-schema";

export type { DataBinding } from "./data-binding-schema";

// Allowlist 4: token aliases + style pack ids (D-06/STYLE-03/D-08/STYLE-04)
export {
  TokenAliasSchema,
  StylePackIdSchema,
  TokenPropsSchema,
  TOKEN_ALIAS_VALUES,
} from "./token-props-schema";

export type {
  TokenAlias,
  StylePackId,
  TokenProps,
} from "./token-props-schema";
