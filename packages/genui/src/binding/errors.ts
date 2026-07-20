/**
 * binding/errors.ts — the fail-closed vocabulary of the capability-binding layer (REG-04 / INV-5).
 *
 * Every way a genui spec's capability reference can fail to become a real, executed query/mutation
 * is ONE of these codes. A binding never partially succeeds and never silently no-ops: if the id is
 * not in the registry, or the args do not satisfy `capability.input`, or the returned value does not
 * satisfy `capability.output`, the boundary produces a `CapabilityBindingError` — a refusal, not a
 * best-effort. This is the genui side of the D2 contract "if the registry doesn't resolve it, refuse".
 */

/**
 * Why a capability binding refused.
 *
 *   - `"unregistered"`     — the spec named an id the CapabilityRegistry does not contain (INV-5).
 *                            THE central fail-closed case: an unregistered capability can never run.
 *   - `"invalid-args"`     — args did not parse against `capability.input` (the Zod boundary, INV-1).
 *   - `"invalid-output"`   — the executor returned a value that did not parse against
 *                            `capability.output` (the executor mis-behaved; we refuse to surface it).
 *   - `"execute-failed"`   — `capability.execute` threw (a real runtime failure inside the executor).
 */
export type CapabilityBindingErrorCode =
  | "unregistered"
  | "invalid-args"
  | "invalid-output"
  | "execute-failed";

/**
 * A refusal from the binding boundary. Carries the offending capability id and a machine-readable
 * `code` so a consumer can branch (e.g. render a "capability unavailable" fallback for
 * `"unregistered"` vs a validation message for `"invalid-args"`) without string-matching messages.
 *
 * `cause` preserves the underlying Zod error / thrown value for diagnostics, without leaking it into
 * the consumer's happy path.
 */
export class CapabilityBindingError extends Error {
  readonly code: CapabilityBindingErrorCode;
  readonly capabilityId: string;

  constructor(
    code: CapabilityBindingErrorCode,
    capabilityId: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "CapabilityBindingError";
    this.code = code;
    this.capabilityId = capabilityId;
  }
}

/** Narrowing guard — lets a consumer distinguish a binding refusal from an unrelated throw. */
export const isCapabilityBindingError = (
  value: unknown,
): value is CapabilityBindingError => value instanceof CapabilityBindingError;
