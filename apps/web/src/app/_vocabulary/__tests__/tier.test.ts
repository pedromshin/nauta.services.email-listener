/**
 * tier.test.ts — 61-02-PLAN.md Task 1 (tdd="true"): RED before
 * `_vocabulary/tier.ts` exists, GREEN after. Covers every `<behavior>` bullet.
 *
 * The load-bearing assertion in this file is the last describe block: that
 * `REGION_TIER`'s LITERAL classes agree with the shared FACTS. That is what
 * makes "one mapping, not two" (brand-guide.md §3) an executable claim rather
 * than a paragraph in a guide — see the header of `tier.ts` for why the shared
 * module cannot simply own the class strings itself.
 */

import { describe, expect, it } from "vitest";

import {
  REGION_TIER,
  tierOf as regionTierOf,
  type RegionTier,
} from "../../emails/[id]/_components/region-vocabulary";
import * as tierModule from "../tier";
import { TIER_HUE_FAMILY, TIER_IS_DASHED, tierOf, type Tier } from "../tier";

const TIERS: readonly Tier[] = ["confirmed", "suggested", "terminal"];

describe("tierOf — the ONE tier truth, now shared by three surfaces", () => {
  it('maps "confirmed" to "confirmed"', () => {
    expect(tierOf("confirmed")).toBe("confirmed");
  });

  it('maps "candidate" and "pending" to "suggested"', () => {
    expect(tierOf("candidate")).toBe("suggested");
    expect(tierOf("pending")).toBe("suggested");
  });

  it('maps "rejected" and "superseded" to "terminal"', () => {
    expect(tierOf("rejected")).toBe("terminal");
    expect(tierOf("superseded")).toBe("terminal");
  });

  it('defaults ANY unrecognized status to "suggested", NEVER "confirmed" (T-61-05)', () => {
    // Tested HERE, in the new module, and not merely inherited from
    // region-vocabulary.test.ts: tier is a claim that a HUMAN confirmed a
    // fact, and a promotion that quietly changed this default while moving
    // the function would hand every surface a confirmation the user never
    // gave. The suggest-only default is the product's stance in code.
    expect(tierOf("some-future-status")).toBe("suggested");
    expect(tierOf("")).toBe("suggested");
    expect(tierOf("CONFIRMED")).toBe("suggested"); // case-sensitive, not fuzzy
    expect(tierOf("confirmed ")).toBe("suggested"); // not trimmed, not fuzzy
  });

  it("never returns \"confirmed\" for any status other than the exact string", () => {
    const nonConfirming = [
      "candidate",
      "pending",
      "rejected",
      "superseded",
      "unknown",
      "Confirmed",
      "CONFIRMED",
      " confirmed",
      "confirmed-ish",
      "",
    ];
    for (const status of nonConfirming) {
      expect(tierOf(status), `tierOf(${JSON.stringify(status)})`).not.toBe("confirmed");
    }
  });
});

describe("the FACTS each surface's literal map must agree with (§C)", () => {
  it("TIER_HUE_FAMILY gives confirmed the conf family, suggested the sugg family, and terminal NONE", () => {
    // terminal is null, not a third hue: a rejected/superseded region makes no
    // tier claim at all, and law 1 says colour is earned.
    expect(TIER_HUE_FAMILY).toEqual({
      confirmed: "conf",
      suggested: "sugg",
      terminal: null,
    });
  });

  it("TIER_IS_DASHED encodes the signature mark language: solid = confirmed, dashed = suggested", () => {
    expect(TIER_IS_DASHED).toEqual({
      confirmed: false,
      suggested: true,
      terminal: true,
    });
  });

  it("has a fact for every member of the Tier union — no tier can be left undescribed", () => {
    for (const tier of TIERS) {
      expect(Object.hasOwn(TIER_HUE_FAMILY, tier), `TIER_HUE_FAMILY.${tier}`).toBe(true);
      expect(Object.hasOwn(TIER_IS_DASHED, tier), `TIER_IS_DASHED.${tier}`).toBe(true);
    }
  });
});

describe("the module holds FACTS, not classes (§C — the Tailwind purge constraint)", () => {
  /**
   * A colour-bearing Tailwind utility is a PREFIX plus a token. The family
   * names this module legitimately carries ("conf", "sugg") are bare facts and
   * must NOT match — that distinction is the whole point of the split, so the
   * pattern requires the prefix, exactly as `role-hue-ban.test.ts` does.
   */
  const CLASS_UTILITY_PATTERN =
    /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|caret|divide|placeholder|opacity|rounded)-[a-z]/;

  function collectStrings(value: unknown, seen: Set<unknown> = new Set()): string[] {
    if (typeof value === "string") return [value];
    if (typeof value === "function") return [value.toString()];
    if (value !== null && typeof value === "object") {
      if (seen.has(value)) return [];
      seen.add(value);
      return Object.values(value).flatMap((inner) => collectStrings(inner, seen));
    }
    return [];
  }

  it("no exported value anywhere contains a Tailwind class string", () => {
    // If a future reader "helpfully" centralizes the class strings here, they
    // would be composed at the call site (`border-${family}-line`), which
    // Tailwind v4's source scanner cannot see — the class is dropped at build
    // time with NO error and the element renders unstyled. This gate is the
    // only thing standing between that instinct and a silent purge.
    for (const [exportName, exportValue] of Object.entries(tierModule)) {
      for (const candidate of collectStrings(exportValue)) {
        expect(candidate, `export "${exportName}" contains a class string`).not.toMatch(
          CLASS_UTILITY_PATTERN,
        );
      }
    }
  });

  it("exports exactly the tier truth and nothing else", () => {
    expect(Object.keys(tierModule).sort()).toEqual(["TIER_HUE_FAMILY", "TIER_IS_DASHED", "tierOf"]);
  });
});

describe("the promotion is invisible to Phase 60's surface", () => {
  it("region-vocabulary re-exports the SAME tierOf — a re-export, never a copy", () => {
    // Reference equality is the strongest available proof that the promotion
    // did not leave a second implementation behind. Two functions that merely
    // behave alike today are two maps of one fact, and two maps drift.
    expect(regionTierOf).toBe(tierOf);
  });

  it("RegionTier and Tier are mutually assignable (compile-time)", () => {
    const asTier: Tier = "confirmed" satisfies RegionTier;
    const asRegionTier: RegionTier = "suggested" satisfies Tier;
    expect([asTier, asRegionTier]).toEqual(["confirmed", "suggested"]);
  });
});

describe("REGION_TIER's LITERALS agree with the shared FACTS — one mapping, not two", () => {
  for (const tier of TIERS) {
    it(`${tier}: box carries the family TIER_HUE_FAMILY names, and is dashed exactly when TIER_IS_DASHED says`, () => {
      const { box } = REGION_TIER[tier];
      const family = TIER_HUE_FAMILY[tier];

      if (family === null) {
        // No tier claim, so no colour is earned (law 1).
        expect(box, `${tier}.box must carry no tier hue`).not.toContain("conf");
        expect(box, `${tier}.box must carry no tier hue`).not.toContain("sugg");
      } else {
        expect(box, `${tier}.box must carry the ${family} family`).toContain(family);
      }

      // The email-detail surface spells "dashed" as `border-dashed` (a CSS
      // box). The canvas spells the same FACT as a stroke-dasharray (an SVG
      // path). The shared module holds the boolean; each surface holds its own
      // idiom — which is exactly why the fact, not the class, is what travels.
      expect(box.includes("border-dashed"), `${tier}.box dashedness`).toBe(TIER_IS_DASHED[tier]);
    });
  }
});
