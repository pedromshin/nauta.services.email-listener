/**
 * binding/descriptor.ts — how a genui spec REFERENCES a capability (REG-04).
 *
 * A spec does not embed an executor; it names one. `CapabilityBindingSchema` is the wire-level
 * descriptor a spec node (or a spec-root field) carries: a registry id plus optional statically
 * declared args. It is deliberately a small, `.strict()` Zod object so it slots into the existing
 * Bedrock-structured-output discipline (every object `.strict()`, no `$ref`, stable module-level
 * schema) WITHOUT touching the core discriminated union in spec-schema.ts.
 *
 * The descriptor validates SHAPE only — that a string id and a primitive-args record are present.
 * It intentionally does NOT know whether the id resolves; that is the resolver's job (bind-capability.ts),
 * and an unresolvable id must fail closed at bind time (INV-5), not at schema-parse time. A spec can be
 * grammatically valid yet name a capability that isn't registered — and the binder refuses it.
 */

import { z } from "zod";

/**
 * Static args a spec may declare on a binding. Primitives only (string/number/boolean/null): a spec
 * is DATA, never executable code, so args are typed literals — the same posture as DataBinding params
 * and declared-state values. The real per-capability arg schema is `capability.input`, enforced at
 * invocation (bind-capability.ts); this record is only the outer transport shape.
 */
export const CapabilityArgsSchema = z
  .record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  );

export type CapabilityArgs = z.infer<typeof CapabilityArgsSchema>;

/**
 * CapabilityBindingSchema — the descriptor a spec uses to bind a capability.
 *
 * Fields:
 *   capabilityId — the registry resolution key (matches `Capability.id`). A non-empty string; whether
 *                  it actually resolves is decided at bind time and fails closed if it does not (INV-5).
 *   args         — optional statically declared args, merged UNDER any runtime args at invocation and
 *                  re-parsed against `capability.input` before the executor ever runs (INV-1 boundary).
 *
 * `.strict()` — no stray keys can ride along (Bedrock additionalProperties:false / D-22).
 */
export const CapabilityBindingSchema = z
  .object({
    capabilityId: z.string().min(1, {
      message: "capabilityId must be a non-empty registry id",
    }),
    args: CapabilityArgsSchema.optional(),
  })
  .strict();

export type CapabilityBinding = z.infer<typeof CapabilityBindingSchema>;
