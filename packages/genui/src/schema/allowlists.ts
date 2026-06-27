/**
 * schema/allowlists.ts — Single allowlist surface for the spec schema (D-12/D-13/D-14/D-15).
 *
 * This module re-exports all three allowlist symbols so consumers import from
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
 * Enforcement is primary at the Zod schema layer (D-15): a single safeParse
 * rejects all three violation classes. Runtime re-checks in the binding/action
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
