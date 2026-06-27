/**
 * eval-assets.test.ts — CI gate for page-ideas.json and golden-set.json
 *
 * Enforces:
 *   - No AI-invented prompts (provenance rule D-19): every entry has a non-empty source
 *   - Corpus completeness: exactly 76 entries in PAGE_IDEAS (IDEA-01)
 *   - Golden-set is a strict subset of PAGE_IDEAS (byte-identical per id)
 *   - D-03 coverage quotas: >=10 Tier-A, >=20 Tier-B, all 8 curveballs, >=1 per category
 *   - Zod schema validates both assets (shared PageIdeaSchema / PageIdeaSetSchema)
 */

import { describe, it, expect } from "vitest";
import { PAGE_IDEAS, GOLDEN_SET, PageIdeaSetSchema } from "../eval/index";

// ───────────── constants ─────────────────────────────────────────────────────

/** Ids that are curveballs per design decision (D-03 definition) */
const CURVEBALL_IDS = [22, 28, 30, 54, 57, 61, 66, 69] as const;

// ───────────── PAGE_IDEAS (superset) ─────────────────────────────────────────

describe("PAGE_IDEAS", () => {
  it("has exactly 76 entries", () => {
    expect(PAGE_IDEAS.length).toBe(76);
  });

  it("passes Zod schema validation", () => {
    const result = PageIdeaSetSchema.safeParse(PAGE_IDEAS);
    expect(result.success).toBe(true);
  });

  it("has unique sequential ids from 1 to 76", () => {
    const ids = PAGE_IDEAS.map((e) => e.id).sort((a, b) => a - b);
    const expected = Array.from({ length: 76 }, (_, i) => i + 1);
    expect(ids).toEqual(expected);
  });

  it("every entry has a non-empty source (no AI-invented prompts, D-19)", () => {
    const missing = PAGE_IDEAS.filter((e) => !e.source || e.source.trim() === "");
    expect(missing).toHaveLength(0);
  });

  it("every entry has a non-empty prompt", () => {
    const empty = PAGE_IDEAS.filter((e) => !e.prompt || e.prompt.trim() === "");
    expect(empty).toHaveLength(0);
  });

  it("all tier values are 'A' or 'B'", () => {
    const invalid = PAGE_IDEAS.filter((e) => e.tier !== "A" && e.tier !== "B");
    expect(invalid).toHaveLength(0);
  });

  it("all complexity values are 'simple' | 'medium' | 'complex'", () => {
    const valid = new Set(["simple", "medium", "complex"]);
    const invalid = PAGE_IDEAS.filter((e) => !valid.has(e.complexity));
    expect(invalid).toHaveLength(0);
  });

  it("curveball field is boolean on every entry", () => {
    const invalid = PAGE_IDEAS.filter((e) => typeof e.curveball !== "boolean");
    expect(invalid).toHaveLength(0);
  });
});

// ───────────── GOLDEN_SET (curated subset) ───────────────────────────────────

describe("GOLDEN_SET", () => {
  it("passes Zod schema validation", () => {
    const result = PageIdeaSetSchema.safeParse(GOLDEN_SET);
    expect(result.success).toBe(true);
  });

  it("is a strict subset of PAGE_IDEAS — every golden entry byte-matches its page-ideas counterpart", () => {
    const byId = new Map(PAGE_IDEAS.map((e) => [e.id, e]));
    for (const entry of GOLDEN_SET) {
      const source = byId.get(entry.id);
      expect(source).toBeDefined();
      expect(JSON.stringify(entry)).toBe(JSON.stringify(source));
    }
  });

  it("has no duplicate ids", () => {
    const ids = GOLDEN_SET.map((e) => e.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it("satisfies Tier-A quota: >= 10 entries", () => {
    const count = GOLDEN_SET.filter((e) => e.tier === "A").length;
    expect(count).toBeGreaterThanOrEqual(10);
  });

  it("satisfies Tier-B quota: >= 20 entries", () => {
    const count = GOLDEN_SET.filter((e) => e.tier === "B").length;
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it("contains all 8 mandatory curveball ids", () => {
    const goldenIds = new Set(GOLDEN_SET.map((e) => e.id));
    for (const id of CURVEBALL_IDS) {
      expect(goldenIds.has(id)).toBe(true);
    }
  });

  it("all 8 curveball entries have curveball:true", () => {
    const byId = new Map(GOLDEN_SET.map((e) => [e.id, e]));
    for (const id of CURVEBALL_IDS) {
      const entry = byId.get(id);
      if (entry !== undefined) {
        expect(entry.curveball).toBe(true);
      }
    }
  });

  it("covers >= 1 entry per distinct category in PAGE_IDEAS", () => {
    const corpusCategories = new Set(PAGE_IDEAS.map((e) => e.category));
    const goldenCategories = new Set(GOLDEN_SET.map((e) => e.category));
    for (const cat of corpusCategories) {
      expect(goldenCategories.has(cat)).toBe(true);
    }
  });
});
