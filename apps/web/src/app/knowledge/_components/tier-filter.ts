/**
 * tier-filter.ts — pure tier-visibility predicate for edge filtering (GRAPH-03).
 *
 * Structural (non-`kne-*`) edges are ALWAYS allowed regardless of filter state —
 * the filter only ever narrows/widens the tiered knowledge-node-edge set.
 */

/**
 * Cumulative filter breadth, narrowest -> widest:
 *   "confirmed" — EXTRACTED only
 *   "inferred"  — EXTRACTED + INFERRED
 *   "ambiguous" — EXTRACTED + INFERRED + AMBIGUOUS (all shown, default)
 */
export type TierFilterState = "confirmed" | "inferred" | "ambiguous";

interface TierFilterableEdge {
  readonly id: string;
  readonly data?: { readonly tier?: string } | undefined;
}

const TIER_RANK: Record<string, number> = {
  EXTRACTED: 0,
  INFERRED: 1,
  AMBIGUOUS: 2,
};

const STATE_RANK: Record<TierFilterState, number> = {
  confirmed: 0,
  inferred: 1,
  ambiguous: 2,
};

/**
 * A kne- edge with an unknown/undefined tier is treated conservatively — it is
 * only shown at the widest "ambiguous" state (rank 2), matching AMBIGUOUS's own
 * rank so an un-labelable edge never surfaces before the reviewer has opted into
 * the widest view.
 */
const UNKNOWN_TIER_RANK = TIER_RANK.AMBIGUOUS;

export function tierAllowsEdge(
  edge: TierFilterableEdge,
  state: TierFilterState,
): boolean {
  if (!edge.id.startsWith("kne-")) return true;

  const tier = edge.data?.tier;
  const tierRank = tier != null && tier in TIER_RANK ? TIER_RANK[tier] : UNKNOWN_TIER_RANK;

  return tierRank <= STATE_RANK[state];
}
