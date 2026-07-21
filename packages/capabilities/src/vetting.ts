/**
 * EXTERNAL CAPABILITY VETTING — the v2.3 seam made concrete (999.27 / INV-3).
 *
 * The OSS/MCP ontology is a registry POPULATE, not an architecture: external candidates arrive as
 * {@link ExternalCapabilityCandidate} (metadata claims only — nothing here can execute), pass
 * through a human-attributed promotion gate ({@link vetCandidate}), and only then may enter a live
 * registry via {@link registerExternal}, which FAILS CLOSED on `trust: "unvetted"`.
 *
 * Stance is SUGGEST-ONLY: the machine can hold, describe, and rank candidates, but a trust
 * promotion exists ONLY as a record naming the human who made it. There is no auto-promote path.
 */
import type { Capability, CapabilityCost, CapabilityRegistry, Risk } from "./capability.js";
import { createCapabilityRegistry } from "./capability.js";

/** Trust states an EXTERNAL candidate can hold. `"first-party"` is unreachable by construction. */
export type ExternalTrust = "unvetted" | "claimed" | "verified";

/**
 * An external capability CANDIDATE — pure metadata claims harvested from an OSS/MCP source.
 * Deliberately has NO `input`/`output`/`scope`/`execute`: a candidate cannot run, cannot be
 * registered, cannot be described to an LLM as callable. `risk`/`cost` are prefixed `claimed*`
 * because they are the publisher's assertion, not ours.
 */
export type ExternalCapabilityCandidate = {
  /** Stable id the candidate would occupy in the registry if ever admitted. */
  readonly id: string;
  /** The publisher's human/LLM-readable purpose statement. A claim, not a vetted description. */
  readonly describe: string;
  /** Where the candidate came from (MCP server manifest, OSS repo, skill listing…). */
  readonly originUrl: string;
  /** The publisher's asserted risk tier — treated as a CLAIM until a human verifies it. */
  readonly claimedRisk: Risk;
  /** The publisher's asserted cost — a claim, same stance. */
  readonly claimedCost: CapabilityCost;
  /** Always `"external"`. First-party capabilities never travel this path. */
  readonly source: "external";
  readonly trust: ExternalTrust;
};

/**
 * The audit record of a single trust promotion. `vettedBy` is REQUIRED and must be non-empty:
 * a promotion without a human name attached is not a promotion.
 */
export type PromotionRecord = {
  readonly candidateId: string;
  readonly from: ExternalTrust;
  readonly to: ExternalTrust;
  /** The human who made the call. Never a machine identity. */
  readonly vettedBy: string;
  /** Why they made it — the reviewable substance of the decision. */
  readonly rationale: string;
  /** ISO-8601 timestamp of the decision. */
  readonly at: string;
};

/** Result of {@link vetCandidate}: the promoted candidate plus its audit record. */
export type VetResult = {
  readonly candidate: ExternalCapabilityCandidate;
  readonly record: PromotionRecord;
};

/** The ONLY legal promotions. One rung at a time; no dem-by-vet, no skip, no self-promotion. */
const LEGAL_PROMOTIONS: ReadonlyMap<ExternalTrust, ExternalTrust> = new Map([
  ["unvetted", "claimed"],
  ["claimed", "verified"],
]);

/**
 * Promote a candidate's trust ONE rung (`unvetted → claimed → verified`), producing a new frozen
 * candidate and a {@link PromotionRecord} attributing the decision to a named human.
 *
 * Throws on: skipping rungs, promoting past `verified`, or a missing/blank `vettedBy`/`rationale`.
 * This function never touches a registry — vetting and registration are separate acts.
 */
export const vetCandidate = (
  candidate: ExternalCapabilityCandidate,
  attribution: { readonly vettedBy: string; readonly rationale: string },
): VetResult => {
  const vettedBy = attribution.vettedBy.trim();
  const rationale = attribution.rationale.trim();
  if (vettedBy.length === 0) {
    throw new Error(
      `[capabilities/vetting] refusing to promote "${candidate.id}": a promotion must name the human who made it (vettedBy is empty)`,
    );
  }
  if (rationale.length === 0) {
    throw new Error(
      `[capabilities/vetting] refusing to promote "${candidate.id}": a promotion must carry a rationale`,
    );
  }

  const to = LEGAL_PROMOTIONS.get(candidate.trust);
  if (to === undefined) {
    throw new Error(
      `[capabilities/vetting] "${candidate.id}" is already at trust "${candidate.trust}" — no further promotion exists`,
    );
  }

  return Object.freeze({
    candidate: Object.freeze({ ...candidate, trust: to }),
    record: Object.freeze({
      candidateId: candidate.id,
      from: candidate.trust,
      to,
      vettedBy,
      rationale,
      at: new Date().toISOString(),
    }),
  });
};

/**
 * An executable descriptor for an admitted external capability: the full {@link Capability} shape
 * with `source`/`trust` pinned to the external lattice. A consumer builds this by binding an
 * execution adapter (e.g. an MCP client call) to a candidate that has cleared vetting.
 */
export type ExternalCapability<TCtx = unknown, TScope = unknown> = Capability<
  never,
  never,
  TCtx,
  TScope
> & {
  readonly source: "external";
  readonly trust: ExternalTrust;
};

/**
 * Admit external capabilities into a live registry alongside the builtin set. FAILS CLOSED:
 * any entry still at `trust: "unvetted"` is refused with an error naming it — an unvetted
 * capability must never become resolvable, describable-as-callable, or executable.
 *
 * Returns a NEW registry (the builtin one is immutable and untouched). Duplicate-id collisions
 * with builtins are rejected by the underlying registry constructor.
 */
export const registerExternal = <TCtx = unknown, TScope = unknown>(
  base: CapabilityRegistry<TCtx, TScope>,
  externals: readonly ExternalCapability<TCtx, TScope>[],
): CapabilityRegistry<TCtx, TScope> => {
  const unvetted = externals.filter((e) => e.trust === "unvetted");
  if (unvetted.length > 0) {
    throw new Error(
      `[capabilities/vetting] refusing to register unvetted external capabilities: ${unvetted
        .map((e) => `"${e.id}"`)
        .join(", ")} — promote via vetCandidate() with human attribution first`,
    );
  }

  const builtins = base.ids
    .map((id) => base.get(id))
    .filter((c): c is Capability<never, never, TCtx, TScope> => c !== undefined);

  return createCapabilityRegistry<TCtx, TScope>([...builtins, ...externals]);
};
