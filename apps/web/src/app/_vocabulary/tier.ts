/**
 * tier.ts — THE tier truth. One answer to "is this confirmed?", shared by
 * every surface that asks (61-02-PLAN.md Task 1).
 *
 * Promoted VERBATIM out of `emails/[id]/_components/region-vocabulary.ts`,
 * which is where Phase 60 first derived it. It moved because `/chat`'s canvas
 * (Phase 61), `/knowledge` (Phase 62) and Phase 63's provenance edges all need
 * the same answer, and the only alternative to a shared home is each surface
 * reaching into another surface's `_components` — which is precisely the
 * import people avoid by copying the map instead. Two maps of one fact drift,
 * and the drift reads to the user as two panels disagreeing.
 *
 * The directory is underscore-prefixed so Next never routes it.
 *
 * ────────────────────────────────────────────────────────────────────────
 * THIS MODULE HOLDS FACTS, NOT CLASSES. THAT IS DELIBERATE.
 * ────────────────────────────────────────────────────────────────────────
 *
 * The instinct on reading this file is to "finish the job" by moving the
 * Tailwind class strings here too. Do not. Tailwind v4 scans SOURCE FILES for
 * LITERAL class strings (see `globals.css`'s `@source` directives; 55-02
 * already ate one purge bug from exactly this). A class composed from a shared
 * token name — `` `border-${family}-line` `` — is invisible to that scanner and
 * is silently dropped at build time with NO error. The element renders
 * unstyled, the suite stays green, and the user finds it.
 *
 * So per-surface LITERAL class maps are unavoidable. What this module owns is
 * the tier TRUTH and the FACTS every surface's literal map must AGREE with;
 * each surface's own gate asserts its literals against those facts
 * (`_vocabulary/__tests__/tier.test.ts` for `REGION_TIER`,
 * `chat/_canvas/__tests__/canvas-vocabulary.test.ts` for `CANVAS_EDGE_TIER`).
 *
 * One truth, literal classes, drift caught by a test rather than by a user.
 *
 * ────────────────────────────────────────────────────────────────────────
 * `status` HERE MEANS `extractionStatus`. NOTHING ELSE.
 * ────────────────────────────────────────────────────────────────────────
 *
 * `tierOf` takes a component's raw `extractionStatus`. This codebase has
 * several other fields that are ALSO called "status" and mean something
 * entirely different — an attachment's `parseStatus` most of all, whose
 * "succeeded"/"failed" vocabulary shares not one value with this one. Routing
 * a `parseStatus` through `tierOf` compiles (both are `string`), passes every
 * type check, and paints a SUCCEEDED parse as pencil-amber "suggested"
 * (60-06 came one line from shipping exactly that). Now that this function is
 * app-level and easy to reach, that mistake got cheaper to make — check what
 * your "status" actually is before you pass it.
 */

/**
 * The tier a fact holds: has a human confirmed it, is it merely suggested, or
 * is it over (rejected/superseded)?
 */
export type Tier = "confirmed" | "suggested" | "terminal";

/**
 * tierOf — maps a component's raw `extractionStatus` to the tier truth
 * (§C, consistent with Plan 01's server-side mapping):
 *   "confirmed"               -> confirmed
 *   "candidate" | "pending"   -> suggested
 *   "rejected" | "superseded" -> terminal (no tier claim at all — a ghost)
 *
 * Any UNRECOGNIZED status defaults to "suggested", NEVER "confirmed"
 * (T-60-08 / T-61-05, Repudiation): tier is a claim about whether a human
 * confirmed a fact, so a new/unknown status value must never silently inherit
 * a confirmation the user never gave. The product's stance is suggest-only.
 *
 * Body moved verbatim in the promotion — a move that also changed behaviour
 * would be two changes wearing one commit, and this is the one function in the
 * app where a quiet behaviour change means claiming confirmations that never
 * happened.
 */
export function tierOf(status: string): Tier {
  if (status === "confirmed") return "confirmed";
  if (status === "rejected" || status === "superseded") return "terminal";
  return "suggested";
}

/**
 * TIER_HUE_FAMILY — which colour family a tier has EARNED, as a bare token
 * family name (never a class; see the header).
 *
 * `terminal` is `null`, not a third hue: a rejected/superseded fact makes no
 * tier claim at all, and law 1 says colour is earned, never decorative. A
 * surface reading `null` must render the tier with NO conf/sugg token
 * whatsoever — a ghost, not a "weakly confirmed" wash of either hue.
 */
export const TIER_HUE_FAMILY: Record<Tier, "conf" | "sugg" | null> = {
  confirmed: "conf",
  suggested: "sugg",
  terminal: null,
};

/**
 * TIER_IS_DASHED — the signature mark language of 58-IDENTITY.md, as a fact:
 * "Solid mark = confirmed. Dashed mark = suggested. One mark language
 * everywhere."
 *
 * This is the accessibility half of law 1: the tier is restated in SHAPE, so
 * it survives greyscale and colour-blindness instead of resting on hue alone.
 *
 * Each surface spells "dashed" in its own idiom — the email-detail overlay is
 * a CSS box, so it says `border-dashed`; a canvas edge is an SVG path, so it
 * says `stroke-dasharray`. The class could never have travelled between them;
 * the boolean does. That is the split working as intended.
 *
 * `terminal` is dashed AND uncoloured: it is not a solid confirmation, and the
 * one thing it must never look like is one.
 */
export const TIER_IS_DASHED: Record<Tier, boolean> = {
  confirmed: false,
  suggested: true,
  terminal: true,
};
