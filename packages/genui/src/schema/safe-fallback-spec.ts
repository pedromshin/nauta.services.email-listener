/**
 * schema/safe-fallback-spec.ts — Static fail-closed fallback spec (GEN-03 / D-07).
 *
 * SAFE_FALLBACK_SPEC is returned by the generator on persistent failure after
 * all repair attempts. It is:
 *   - Schema-valid: SpecRootSchema.safeParse(SAFE_FALLBACK_SPEC).success === true
 *   - Fail-closed: single alert node, no data bindings, no actions, no state
 *   - Renderable: maps to the `alert` catalog entry (always present, D-01)
 *   - Deterministic: a static constant, not generated at runtime
 *
 * "Reject-don't-repair" principle (SAFETY-PITFALLS §4c / D-07):
 * Never structurally repair a bad model spec — return this static spec instead.
 * This prevents injection payloads from surviving partial repair and reaching render.
 *
 * The rendered output shows a user-friendly message. The server logs the failure detail.
 */

import type { SpecRoot } from "./spec-schema";

/**
 * Static, fail-closed SpecRoot returned on generator failure (GEN-03 / D-07).
 *
 * Invariants:
 *   - v: 1 (schema version)
 *   - root.type: "alert" (always present in the catalog)
 *   - root.title: user-friendly message (a11y-required, D-04)
 *   - No data, state, or _plan fields
 *
 * This object is deeply readonly — never mutate it.
 */
export const SAFE_FALLBACK_SPEC: SpecRoot = Object.freeze({
  v: 1,
  root: Object.freeze({
    type: "alert" as const,
    title: "Could not generate a view for this request",
  }),
}) as SpecRoot;
