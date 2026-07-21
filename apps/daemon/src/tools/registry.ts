/**
 * THE CAPABILITY REGISTRY — the daemon-local specialization over the D2 spine (INV-2).
 *
 * ## Why this file is shaped the way it is
 *
 * The user's D2 directive: the repo is INFRASTRUCTURE; the product EMANATES from it. genui
 * composes typed primitives into real features, bounded only by what the infrastructure exposes.
 * The architectural consequence (INV-2): **the daemon's ToolExecutor and the capability registry
 * are the same abstraction seen from two sides.** So this is NOT a switch statement over tool
 * names — it is a registry of self-describing capabilities, resolved by `id`.
 *
 * Every capability declares itself with a zod schema + metadata so that ONE declaration can be
 * read by all four consumers, later, without a rewrite:
 *   - the LLM        → as a tool definition (`describe` + `input`)
 *   - genui          → as a composable block (`input`/`output` shapes)
 *   - the daemon     → as an executable (`execute`)  ← the only consumer wired TONIGHT
 *   - the canvas     → as a node type
 *
 * ## Phase 68 (INV-2): the generic machinery now lives in `@polytoken/capabilities`
 *
 * The daemon (Phase 65) shipped first and deliberately used the frozen INV-1/INV-3 field names
 * (`id`/`input`/`output`/`risk`/`cost`/`describe`/`source`/`trust`), so lifting its descriptor into
 * the shared package was an IMPORT CHANGE, not a rewrite. This file is now a THIN daemon-local
 * specialization: the generic `Capability`, `CapabilityRegistry`, `createCapabilityRegistry`, and
 * `defineCapability` come from `@polytoken/capabilities`; the ONE daemon-private thing — the
 * filesystem-shaped execution context (`ExecCtx`) and scope-decision shape (`CapabilityScope`) —
 * stays here as the concrete `TCtx`/`TScope` the daemon binds.
 *
 * `source`/`trust` are constants today (`"builtin"`/`"first-party"`) and cost nothing. They exist
 * so v2.3's OSS/skills ontology — the same registry pointed outward — is a POPULATE, not a
 * re-architecture (INV-3).
 *
 * ## INV-4: risk is DATA, not code
 *
 * `risk` is a FIELD on the descriptor. No capability implements its own confirm flow; the broker
 * reads this field and drives the ONE permission model from it. A registry where risk lives at each
 * call site cannot deliver "ONE permission model" — that is the whole point.
 *
 * Consumers (capabilities.ts, handler.ts) import the daemon-local aliases below from "./registry.js"
 * and are untouched by the lift.
 */
import {
  createCapabilityRegistry as createGenericRegistry,
  defineCapability as defineGenericCapability,
  type Capability,
  type CapabilityRegistry as GenericRegistry,
} from "@polytoken/capabilities";

// The metadata half — cost/source/trust/manifest — is consumer-agnostic and lives in the shared
// package. Re-exported here so daemon code keeps a single import surface ("./registry.js").
export type {
  CapabilityCost,
  CapabilitySource,
  CapabilityTrust,
  CapabilityManifestEntry,
} from "@polytoken/capabilities";

/**
 * What a permission decision would be scoped to, plus every path the action touches.
 * Returned by the descriptor so the BROKER (not the call site) decides. This is the daemon's
 * concrete `TScope` — the filesystem-shaped specialization of the generic scope parameter.
 */
export type CapabilityScope = {
  /** A canonical path prefix (fs/git) or an executable basename (terminal) — see store.ts. */
  readonly scope: string;
  /** Every path this action would touch. ALL must be inside roots or the broker denies. */
  readonly pathsToCheck: readonly string[];
};

/**
 * The daemon-private execution context — the daemon's concrete `TCtx`. A future genui/chat
 * executor binds its own; the shared package never sees this shape.
 */
export type ExecCtx = {
  readonly maxOutputBytes: number;
  readonly defaultTimeoutMs: number;
};

/**
 * A self-describing capability, specialized to the daemon's context and scope. The metadata half
 * (id/input/output/risk/cost/describe/source/trust) is plain data with NO daemon coupling — it
 * comes verbatim from the shared `Capability`; the daemon-side halves (`scope`/`execute`) are
 * pinned to `CapabilityScope`/`ExecCtx` here.
 */
export type CapabilityDescriptor<TInput = unknown, TOutput = unknown> = Capability<
  TInput,
  TOutput,
  ExecCtx,
  CapabilityScope
>;

/** A registry is a plain, immutable id→descriptor map. Resolution is a lookup, never a switch. */
export type CapabilityRegistry = GenericRegistry<ExecCtx, CapabilityScope>;

/**
 * Build an immutable registry from descriptors. Duplicate ids throw (the shared registry enforces
 * it): two capabilities with one id would make resolution ambiguous — and the allowlist keys on
 * that id, so ambiguity is a permission bug waiting to happen (INV-2). The `never` inputs are
 * deliberate erasure: the descriptors are heterogeneous and contravariant in their input type, and
 * safety is restored at the boundary — handler.ts re-parses args against `capability.input` before
 * `execute` ever sees them.
 */
export const createCapabilityRegistry = (
  descriptors: readonly CapabilityDescriptor<never, never>[],
): CapabilityRegistry => createGenericRegistry(descriptors);

/** Helper preserving inference while pinning the descriptor shape and freezing it. */
export const defineCapability = <TInput, TOutput>(
  descriptor: CapabilityDescriptor<TInput, TOutput>,
): CapabilityDescriptor<TInput, TOutput> => defineGenericCapability(descriptor);
