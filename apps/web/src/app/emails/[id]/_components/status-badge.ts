/**
 * getStatusBadge — the shared status-badge resolver for the email-detail
 * review surface, now a LOOKUP through the one tier vocabulary rather than a
 * second, private opinion about what a status means (60-05-PLAN.md Task 2).
 *
 * WHAT WAS WRONG: pre-60 this file mapped `candidate` to the `default`
 * variant, which paints full --primary ink — LOUDER than a confirmed fact,
 * which is the tier ladder upside down. `confirmed` had no case at all and
 * fell through to `secondary`, so the surface's most important claim rendered
 * as its quietest badge. Both are gone.
 *
 * T-60-08 (Repudiation): tier resolves through `tierOf` and ONLY `tierOf`,
 * whose unknown-status default is "suggested". A second, divergent
 * status->tier mapping living here is exactly how a UI starts claiming
 * confirmations that never happened.
 *
 * Colour comes from `REGION_TIER[tier].badge` — the SANS chrome treatment,
 * deliberately not `chip`: both callers render the raw STATUS WORD
 * ("candidate", "pending") inside this badge, and a status word is
 * polytoken's own vocabulary, not the document's, so law 2 gives it the sans.
 * `chip` carries `pmark`, which would force the serif onto chrome.
 *
 * Structural signals survive untouched, because neither makes a tier claim in
 * colour: `rejected` keeps its line-through (a struck-through record is a
 * structural fact, not a chromatic one) and `superseded` keeps its opacity.
 * Both are hue-free, which is correct.
 *
 * The `destructive` variant is GONE from the return type. It was never
 * returned, and law 1 reserves madder for irreversible ACTIONS — never for a
 * status. Leaving it in the type was a standing invitation for a future edit
 * to paint a status madder, which law 1 forbids by name.
 */

import { REGION_TIER, tierOf } from "./region-vocabulary";

export function getStatusBadge(status: string): {
  variant: "default" | "secondary" | "outline";
  className?: string;
} {
  const tier = tierOf(status);

  /**
   * `outline` is the hue-free base variant: `default`/`secondary` both carry a
   * filled --primary/--secondary background that would fight the tier wash.
   * Badge composes via `cn()` (clsx + tailwind-merge), so the tier classes
   * returned here win over the variant's own conflicting utilities
   * deterministically — by merge order, not by cascade luck.
   */
  const { badge } = REGION_TIER[tier];

  if (status === "rejected") {
    return { variant: "outline", className: `${badge} line-through` };
  }
  if (status === "superseded") {
    return { variant: "outline", className: `${badge} opacity-60` };
  }
  return { variant: "outline", className: badge };
}
