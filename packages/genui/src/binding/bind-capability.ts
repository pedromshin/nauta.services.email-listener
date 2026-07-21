/**
 * binding/bind-capability.ts — the resolver: a spec's capability reference → a bound, typed invoker.
 *
 * This is the D2 PROOF (REG-04): a genui spec that NAMES a capability can, through this resolver,
 * perform a REAL query (risk "read") and — gated by a confirm the consumer owns (INV-4) — a REAL
 * mutation (risk "write"/"exec"). Resolution is a registry LOOKUP, never a switch. The four rules the
 * task pins live here and nowhere else:
 *
 *   1. FAIL CLOSED (INV-5): if the id is not in the registry, `bindCapability` throws and
 *      `tryBindCapability` returns `{ ok: false, code: "unregistered" }`. There is no partial bind and
 *      no silent no-op — an unregistered capability simply cannot become an invoker.
 *   2. RISK SURFACED (INV-4): the bound invoker carries `risk` and the derived `requiresConfirm`
 *      boolean so a consumer gates a non-read invocation behind a confirm. genui renders no UI.
 *   3. ZOD BOUNDARY (INV-1): args are parsed against `capability.input` BEFORE `execute`, and the
 *      returned value is parsed against `capability.output` after — the registry erases IO types to
 *      `never` (by construction), so this re-parse is the ONLY thing restoring safety at the boundary.
 *   4. TYPES: the invoker returns a discriminated result (invoke) or throws (invokeOrThrow); IO is
 *      `unknown` because the registry hands back `Capability<never, never, …>` — an honest reflection
 *      of "the id came from a spec/LLM string, so the value must be re-validated".
 */

import type { Capability, CapabilityRegistry, Risk } from "@polytoken/capabilities";

import { CapabilityBindingError } from "./errors";
import { requiresConfirm } from "./risk-gate";
import {
  CapabilityBindingSchema,
  type CapabilityArgs,
  type CapabilityBinding,
} from "./descriptor";

/** Runtime args accepted by an invoker — merged OVER the descriptor's static args. */
export type InvokeArgs = Record<string, unknown>;

/**
 * The outcome of an invocation. A discriminated result so a consumer branches without try/catch:
 * `{ ok: true, output }` on success, `{ ok: false, error }` on any refusal (unregistered is impossible
 * here — you already hold a bound capability — so `error.code` is invalid-args | invalid-output |
 * execute-failed). Mirrors zod's parse/safeParse ergonomics.
 */
export type CapabilityInvokeResult =
  | { readonly ok: true; readonly output: unknown }
  | { readonly ok: false; readonly error: CapabilityBindingError };

/**
 * A capability bound to a registry — the "bound, typed invoker" the resolver returns.
 *
 * Metadata (`id`/`risk`/`requiresConfirm`) is surfaced for the consumer's gate (INV-4) WITHOUT
 * exposing the executor's internals. The invoke methods are the only path to `execute`, and they are
 * fenced by the Zod boundary on both sides (INV-1).
 */
export type BoundCapability<TCtx> = {
  /** The resolved registry id (INV-2). */
  readonly id: string;
  /** INV-4: the capability's declared risk. Data — the consumer's confirm gate reads this. */
  readonly risk: Risk;
  /** INV-4: `true` for any non-read risk. A consumer MUST require a confirm before invoking. */
  readonly requiresConfirm: boolean;
  /**
   * Parse `args` (merged over the descriptor's static args) against `capability.input` WITHOUT
   * executing. Lets a consumer validate a form / show field errors before it even asks for a confirm.
   */
  parseArgs(
    args?: InvokeArgs,
  ): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: CapabilityBindingError };
  /**
   * Perform the capability: parse args → `execute(ctx)` → parse output. Returns a discriminated
   * result; never throws for a validation/execute failure (those become `{ ok: false }`).
   *
   * A consumer that must confirm (see `requiresConfirm`) is expected to have obtained that confirm
   * BEFORE calling this — the binding surfaces the gate but does not enforce the human decision.
   */
  invoke(ctx: TCtx, args?: InvokeArgs): Promise<CapabilityInvokeResult>;
  /** Throwing variant of {@link invoke} — resolves the output or throws a CapabilityBindingError. */
  invokeOrThrow(ctx: TCtx, args?: InvokeArgs): Promise<unknown>;
};

/** Result of a non-throwing bind. `unregistered` is the sole reason a bind itself can fail (INV-5). */
export type BindResult<TCtx> =
  | { readonly ok: true; readonly capability: BoundCapability<TCtx> }
  | { readonly ok: false; readonly error: CapabilityBindingError };

/**
 * Merge the descriptor's statically declared args UNDER the runtime args (runtime wins). Either may be
 * absent; the merged object is then parsed against `capability.input`, so any missing/extra field is
 * caught there, not here.
 */
const mergeArgs = (
  staticArgs: CapabilityArgs | undefined,
  runtimeArgs: InvokeArgs | undefined,
): InvokeArgs => ({ ...(staticArgs ?? {}), ...(runtimeArgs ?? {}) });

/**
 * Wrap a resolved capability into a BoundCapability. Private — callers reach it through
 * `bindCapability` / `tryBindCapability`, which own the fail-closed resolution step.
 */
const makeBound = <TCtx, TScope>(
  capability: Capability<never, never, TCtx, TScope>,
  staticArgs: CapabilityArgs | undefined,
): BoundCapability<TCtx> => {
  const id = capability.id;

  const parseArgs: BoundCapability<TCtx>["parseArgs"] = (args) => {
    const merged = mergeArgs(staticArgs, args);
    const parsed = capability.input.safeParse(merged);
    if (!parsed.success) {
      return {
        ok: false,
        error: new CapabilityBindingError(
          "invalid-args",
          id,
          `args for capability "${id}" failed input validation: ${parsed.error.message}`,
          { cause: parsed.error },
        ),
      };
    }
    return { ok: true, value: parsed.data };
  };

  const invoke: BoundCapability<TCtx>["invoke"] = async (ctx, args) => {
    const parsedArgs = parseArgs(args);
    if (!parsedArgs.ok) {
      return { ok: false, error: parsedArgs.error };
    }

    let raw: unknown;
    try {
      // `input`/`output` types are erased to `never` by the registry (by construction), so the
      // parsed args are cast through to `execute`; the re-parse above is what makes this sound.
      raw = await capability.execute(parsedArgs.value as never, ctx);
    } catch (cause) {
      return {
        ok: false,
        error: new CapabilityBindingError(
          "execute-failed",
          id,
          `capability "${id}" threw during execution`,
          { cause },
        ),
      };
    }

    const parsedOut = capability.output.safeParse(raw);
    if (!parsedOut.success) {
      return {
        ok: false,
        error: new CapabilityBindingError(
          "invalid-output",
          id,
          `capability "${id}" returned a value that failed output validation: ${parsedOut.error.message}`,
          { cause: parsedOut.error },
        ),
      };
    }
    return { ok: true, output: parsedOut.data };
  };

  const invokeOrThrow: BoundCapability<TCtx>["invokeOrThrow"] = async (ctx, args) => {
    const result = await invoke(ctx, args);
    if (!result.ok) throw result.error;
    return result.output;
  };

  return Object.freeze({
    id,
    risk: capability.risk,
    requiresConfirm: requiresConfirm(capability.risk),
    parseArgs,
    invoke,
    invokeOrThrow,
  });
};

/**
 * Normalize a `descriptor` argument that may arrive as a validated `CapabilityBinding`, a raw object
 * from a spec, or a bare id string. Throws a `CapabilityBindingError` if the shape is not a valid
 * binding descriptor (still a fail-closed refusal — a malformed reference cannot bind).
 */
const asBinding = (descriptor: CapabilityBinding | string): CapabilityBinding => {
  if (typeof descriptor === "string") {
    return { capabilityId: descriptor };
  }
  const parsed = CapabilityBindingSchema.safeParse(descriptor);
  if (!parsed.success) {
    const id =
      typeof (descriptor as { capabilityId?: unknown })?.capabilityId === "string"
        ? (descriptor as { capabilityId: string }).capabilityId
        : "<malformed>";
    throw new CapabilityBindingError(
      "unregistered",
      id,
      `capability binding descriptor is malformed: ${parsed.error.message}`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
};

/**
 * Resolve a spec's capability reference against a registry — THROWING variant.
 *
 * Fails closed (INV-5): if `descriptor.capabilityId` is not in `registry`, this throws a
 * `CapabilityBindingError` with `code: "unregistered"`. There is no partial bind. On success it
 * returns a {@link BoundCapability} whose invoker is fenced by the Zod boundary (INV-1) and whose
 * `risk`/`requiresConfirm` surface the confirm gate (INV-4).
 */
export const bindCapability = <TCtx, TScope>(
  registry: CapabilityRegistry<TCtx, TScope>,
  descriptor: CapabilityBinding | string,
): BoundCapability<TCtx> => {
  const binding = asBinding(descriptor);
  const capability = registry.get(binding.capabilityId);
  if (!capability) {
    throw new CapabilityBindingError(
      "unregistered",
      binding.capabilityId,
      `capability "${binding.capabilityId}" is not registered — refused (fail closed, INV-5)`,
    );
  }
  return makeBound<TCtx, TScope>(capability, binding.args);
};

/**
 * Resolve a spec's capability reference against a registry — NON-THROWING variant.
 *
 * Same fail-closed guarantee as {@link bindCapability}, returned as a discriminated `BindResult`
 * (`{ ok: false, error }` with `error.code === "unregistered"` when the id is absent) so a consumer
 * that resolves LLM/spec-supplied ids can branch without try/catch.
 */
export const tryBindCapability = <TCtx, TScope>(
  registry: CapabilityRegistry<TCtx, TScope>,
  descriptor: CapabilityBinding | string,
): BindResult<TCtx> => {
  try {
    return { ok: true, capability: bindCapability<TCtx, TScope>(registry, descriptor) };
  } catch (error) {
    if (error instanceof CapabilityBindingError) {
      return { ok: false, error };
    }
    throw error;
  }
};
