/**
 * THE CAPABILITY REGISTRY — the D2 seam.
 *
 * ## Why this file is shaped the way it is
 *
 * The user's D2 directive: the repo is INFRASTRUCTURE; the product EMANATES from it. genui
 * composes typed primitives into real features, bounded only by what the infrastructure exposes.
 * The architectural consequence (INV-2): **the daemon's ToolExecutor and the future capability
 * registry are the same abstraction seen from two sides.** So this is NOT a switch statement over
 * tool names — it is a registry of self-describing capabilities, resolved by `id`.
 *
 * Every capability declares itself with a zod schema + metadata so that ONE declaration can be
 * read by all four consumers, later, without a rewrite:
 *   - the LLM        → as a tool definition (`describe` + `input`)
 *   - genui          → as a composable block (`input`/`output` shapes)
 *   - the daemon     → as an executable (`execute`)  ← the only consumer wired TONIGHT
 *   - the canvas     → as a node type
 *
 * ## The Phase 68 seam (READ THIS BEFORE LIFTING)
 *
 * `packages/capabilities` does not exist yet. The descriptor field names below are EXACTLY the
 * frozen INV-1/INV-3 names (`id`/`input`/`output`/`risk`/`cost`/`describe`/`source`/`trust`), so
 * lifting this type into that package is an **import change, not a rewrite**.
 *
 * The ONE daemon-private thing here is `execute`'s `ExecCtx` (it carries a filesystem-shaped
 * context) and `scope` (which computes what a permission rule would be scoped to). When this
 * type moves to `packages/capabilities`, `ExecCtx` becomes the generic parameter — the descriptor
 * METADATA (everything an LLM/genui/canvas reads) has no daemon coupling at all, by construction.
 *
 * `source`/`trust` are constants today (`"builtin"`/`"first-party"`) and cost nothing. They exist
 * so v2.3's OSS/skills ontology — the same registry pointed outward — is a POPULATE, not a
 * re-architecture (INV-3).
 *
 * ## INV-4: risk is DATA, not code
 *
 * `risk` is a FIELD here. No capability implements its own confirm flow; the broker reads this
 * field and drives the ONE permission model from it. A registry where risk lives at each call
 * site cannot deliver "ONE permission model" — that is the whole point.
 */
import type { Risk } from "@polytoken/daemon-protocol";
import type { ZodType } from "zod";

/**
 * Declared cost. Nominal/constant today — no metering exists tonight — but declared from day one
 * so planners and the LLM can reason about it later without a schema migration.
 */
export type CapabilityCost = "free" | "cheap" | "moderate" | "expensive";

/** Where the capability came from. `"external"` is Phase 68 / v2.3 territory (INV-3). */
export type CapabilitySource = "builtin" | "external";

/** How much the capability is trusted. Everything shipped in-repo is first-party (INV-3). */
export type CapabilityTrust = "first-party" | "verified" | "claimed" | "unvetted";

/**
 * What a permission decision would be scoped to, plus every path the action touches.
 * Returned by the descriptor so the BROKER (not the call site) decides.
 */
export type CapabilityScope = {
  /** A canonical path prefix (fs/git) or an executable basename (terminal) — see store.ts. */
  readonly scope: string;
  /** Every path this action would touch. ALL must be inside roots or the broker denies. */
  readonly pathsToCheck: readonly string[];
};

/** The daemon-private execution context. In Phase 68 this becomes the generic parameter. */
export type ExecCtx = {
  readonly maxOutputBytes: number;
  readonly defaultTimeoutMs: number;
};

/**
 * A self-describing capability. The metadata half (id/input/output/risk/cost/describe/source/
 * trust) is plain data with NO daemon coupling — that half is what Phase 68 lifts.
 */
export type CapabilityDescriptor<TInput = unknown, TOutput = unknown> = {
  /** The stable registry id — THE RESOLUTION KEY (INV-2). Also the allowlist's key. */
  readonly id: string;
  readonly input: ZodType<TInput>;
  readonly output: ZodType<TOutput>;
  /** INV-4: drives the ONE permission model's prompt. Data, not code. */
  readonly risk: Risk;
  /** INV-1: declared even though it is nominal today. */
  readonly cost: CapabilityCost;
  /** Human/LLM-readable purpose. This is what an LLM reads to decide whether to call it. */
  readonly describe: string;
  /** INV-3: constant today; the hook v2.3's ontology populates. */
  readonly source: CapabilitySource;
  /** INV-3: constant today. */
  readonly trust: CapabilityTrust;

  // ── daemon-side halves (become the generic parameter in Phase 68) ──
  /** What the broker checks. Pure — no side effects, no permission logic. */
  readonly scope: (input: TInput) => CapabilityScope;
  /** Runs ONLY after the broker has allowed it. Never consults permissions itself. */
  readonly execute: (input: TInput, ctx: ExecCtx) => Promise<TOutput>;
};

/** A registry is a plain, immutable id→descriptor map. Resolution is a lookup, never a switch. */
export type CapabilityRegistry = {
  readonly ids: readonly string[];
  get(id: string): CapabilityDescriptor | undefined;
  /** Everything an LLM / genui / the canvas needs, with no executable coupling. */
  list(): readonly CapabilityManifestEntry[];
};

/**
 * The describable projection — the registry "pointed outward". This is deliberately the shape a
 * tool-definition emitter or a genui block catalogue would consume. Nothing here can execute.
 */
export type CapabilityManifestEntry = {
  readonly id: string;
  readonly describe: string;
  readonly risk: Risk;
  readonly cost: CapabilityCost;
  readonly source: CapabilitySource;
  readonly trust: CapabilityTrust;
};

export const createCapabilityRegistry = (
  descriptors: readonly CapabilityDescriptor<never, never>[],
): CapabilityRegistry => {
  const byId = new Map<string, CapabilityDescriptor>();

  for (const descriptor of descriptors) {
    if (byId.has(descriptor.id)) {
      // Two capabilities with one id would make resolution ambiguous — and the allowlist keys on
      // that id, so ambiguity here is a permission bug waiting to happen.
      throw new Error(`[daemon:registry] duplicate capability id "${descriptor.id}"`);
    }
    // Descriptors are contravariant in their input type, so a heterogeneous registry cannot be
    // typed without erasure here. The safety is restored at the boundary: handler.ts re-parses
    // the args against `capability.input` before `execute` ever sees them.
    byId.set(descriptor.id, descriptor as unknown as CapabilityDescriptor);
  }

  return Object.freeze({
    ids: Object.freeze([...byId.keys()]),
    get: (id: string) => byId.get(id),
    list: () =>
      Object.freeze(
        [...byId.values()].map((d) =>
          Object.freeze({
            id: d.id,
            describe: d.describe,
            risk: d.risk,
            cost: d.cost,
            source: d.source,
            trust: d.trust,
          }),
        ),
      ),
  });
};

/** Helper preserving inference while pinning the descriptor shape. */
export const defineCapability = <TInput, TOutput>(
  descriptor: CapabilityDescriptor<TInput, TOutput>,
): CapabilityDescriptor<TInput, TOutput> => Object.freeze(descriptor);
