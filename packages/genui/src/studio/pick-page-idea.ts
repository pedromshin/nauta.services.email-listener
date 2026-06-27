/**
 * studio/pick-page-idea.ts — Pure, seedable weighted sampler for Page Ideas (D-20).
 *
 * PURE: No Math.random internally, no Date, no side effects.
 * The caller supplies an rng function so tests can stub it for determinism.
 *
 * Weights (D-20, IDEA-01):
 *   Curveball multiplier : 3×  (surfacing weird ideas more often)
 *   Tier-B multiplier    : 2×  (interactive ideas are harder to generate — good stress test)
 *   Tier-A multiplier    : 1×  (static baseline)
 *   Composed multiplicatively → curveball Tier-B = 3 × 2 = 6
 *
 * Algorithm:
 *   1. Compute weight for every idea via weightFor().
 *   2. Build a cumulative-normalised weight array.
 *   3. Draw r = rng() in [0, 1).
 *   4. Return the FIRST idea whose cumulative normalised weight strictly exceeds r.
 */

import type { PageIdea } from "../eval/page-ideas-schema";

// ---------------------------------------------------------------------------
// Weight constants (committed — never change without updating tests + CONTEXT)
// ---------------------------------------------------------------------------

/** Weight multiplier for curveball ideas. */
export const CURVEBALL_WEIGHT = 3;

/** Weight multiplier for Tier-B (interactive) ideas. */
export const TIER_B_WEIGHT = 2;

/** Weight multiplier for Tier-A (static) ideas (baseline). */
export const TIER_A_WEIGHT = 1;

// ---------------------------------------------------------------------------
// weightFor
// ---------------------------------------------------------------------------

/**
 * Returns the sampling weight for a single PageIdea.
 *
 * Weight = (curveball ? CURVEBALL_WEIGHT : 1) × (tier === "B" ? TIER_B_WEIGHT : TIER_A_WEIGHT)
 *
 * Examples:
 *   curveball Tier-B  → 3 × 2 = 6
 *   curveball Tier-A  → 3 × 1 = 3
 *   straight  Tier-B  → 1 × 2 = 2
 *   straight  Tier-A  → 1 × 1 = 1
 *
 * @param idea — a PageIdea entry (type-safe, no mutation)
 * @returns a positive integer weight
 */
export function weightFor(idea: PageIdea): number {
  const curveballMultiplier = idea.curveball ? CURVEBALL_WEIGHT : 1;
  const tierMultiplier = idea.tier === "B" ? TIER_B_WEIGHT : TIER_A_WEIGHT;
  return curveballMultiplier * tierMultiplier;
}

// ---------------------------------------------------------------------------
// pickPageIdea
// ---------------------------------------------------------------------------

/**
 * Samples one PageIdea from the provided array, weighted by weightFor().
 *
 * @param ideas — a non-empty readonly array of PageIdea entries
 * @param rng   — an injected random-number function returning a value in [0, 1)
 *                (inject () => Math.random() at call sites; inject a stub in tests)
 * @returns the selected PageIdea
 * @throws {Error} if the ideas array is empty
 *
 * PURE: does not call Math.random internally; relies solely on the injected rng.
 */
export function pickPageIdea(
  ideas: readonly PageIdea[],
  rng: () => number,
): PageIdea {
  if (ideas.length === 0) {
    throw new Error(
      "pickPageIdea: cannot sample from an empty array of ideas.",
    );
  }

  // Step 1: compute raw weights (positive integers)
  const weights = ideas.map(weightFor);

  // Step 2: compute total weight for normalization
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Step 3: build cumulative normalised weight thresholds
  // cumulativeThresholds[i] = sum of normalised weights for ideas 0..i
  const cumulativeThresholds: number[] = [];
  let runningSum = 0;
  for (const w of weights) {
    runningSum += w / totalWeight;
    cumulativeThresholds.push(runningSum);
  }

  // Step 4: draw r in [0, 1) from the injected rng
  const r = rng();

  // Step 5: return the first idea whose cumulative threshold strictly exceeds r
  for (let i = 0; i < ideas.length; i++) {
    const threshold = cumulativeThresholds[i];
    if (threshold !== undefined && r < threshold) {
      const idea = ideas[i];
      if (idea !== undefined) {
        return idea;
      }
    }
  }

  // Fallback: floating-point precision edge case — return the last idea
  // (this can only happen when r ≥ 1.0 due to FP accumulation rounding)
  const lastIdea = ideas[ideas.length - 1];
  if (lastIdea === undefined) {
    // Unreachable because we checked ideas.length > 0 above
    throw new Error("pickPageIdea: unexpected undefined last idea.");
  }
  return lastIdea;
}
