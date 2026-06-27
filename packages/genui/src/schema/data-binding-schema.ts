/**
 * schema/data-binding-schema.ts — Allowlist 2: DataBinding Zod schema (D-13 / SAFE-03).
 *
 * DataBindingSchema validates the shape of a data binding declared in SpecRoot.bindings.
 * A binding references an allowlisted tRPC query procedure and optional params.
 *
 * Security controls:
 *   - procedure: z.enum(ALLOWED_PROCEDURES) — only allowlisted query procedures accepted
 *   - params: strict record of primitives with a .refine() that rejects any UUID-shaped
 *     string value (D-13a / GR-15). Live IDs are resolved from session/route context at
 *     render time; the model MUST NOT embed literal entity IDs.
 *
 * Every object ends in .strict() (Bedrock additionalProperties:false, D-22).
 */

import { z } from "zod";

import { AllowedProcedureSchema } from "../generation/allowed-procedures";

// ---------------------------------------------------------------------------
// UUID rejection refine (D-13a / GR-15)
//
// Rejects any param value that is a string matching the RFC-4122 UUID pattern.
// Prevents cross-user data leakage: live IDs are resolved at render time, never
// embedded in model output.
// ---------------------------------------------------------------------------

/**
 * RFC-4122 UUID pattern (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
 * Used to reject literal UUIDs in DataBinding params.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if none of the param values are UUID-shaped strings.
 * Used by DataBindingSchema .refine() (GR-15 / D-13a).
 */
function noUuidValues(
  params: Record<string, string | number | boolean> | undefined,
): boolean {
  if (params == null) return true;
  for (const value of Object.values(params)) {
    if (typeof value === "string" && UUID_PATTERN.test(value)) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// DataBindingSchema
// ---------------------------------------------------------------------------

/**
 * DataBindingSchema — validates a single data binding reference.
 *
 * Fields:
 *   procedure — an allowlisted tRPC query procedure name (D-13b enum)
 *   params    — optional record of primitive param values (no UUIDs, D-13a)
 *
 * The binding resolves at render time via the tRPC client; the model only
 * names the procedure and provides non-ID query params.
 */
export const DataBindingSchema = z
  .object({
    procedure: AllowedProcedureSchema,
    params: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  })
  .strict()
  .refine(
    (binding) => noUuidValues(binding.params),
    {
      message:
        "DataBinding params must not contain literal UUID-shaped values (GR-15 / D-13a). " +
        "Live entity IDs are resolved from session/route context at render time.",
      path: ["params"],
    },
  );

export type DataBinding = z.infer<typeof DataBindingSchema>;
