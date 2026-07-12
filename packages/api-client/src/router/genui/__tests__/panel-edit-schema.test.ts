/**
 * panel-edit-schema.test.ts — PANL-02's authoritative, DB-free param
 * whitelist + pure application function (52-03-PLAN.md Task 1, TDD).
 *
 * Covers: card title/description applied + re-validated; grid cols
 * clamped-rejected outside 1-12 (schema rejects 0 and 13); a param key not
 * valid for the root type is ignored (result equals base for that key);
 * applying to a `text` root yields [] fields and a no-op; a param that would
 * break SpecRootSchema returns { ok:false } (defense-in-depth against a
 * value that bypassed PanelEditParamsSchema, proven via a type-bypassing
 * cast — mirrors this repo's own SAFE-02/03/04 rejection-test style in
 * generate.test.ts); baseSpec is never mutated.
 */

import { describe, expect, it } from "vitest";

import type { SpecRoot } from "@polytoken/genui/schema";

import {
  applyWhitelistedParams,
  editableFieldsFor,
  PanelEditParamsSchema,
  type PanelEditParams,
} from "../panel-edit-schema";

const CARD_SPEC: SpecRoot = {
  v: 1,
  root: { type: "card", title: "Old title", description: "Old description" },
};

const GRID_SPEC: SpecRoot = {
  v: 1,
  root: { type: "grid", cols: 3, gap: "md", children: [] },
};

const TEXT_SPEC: SpecRoot = {
  v: 1,
  root: { type: "text", content: "Hello" },
};

describe("PanelEditParamsSchema", () => {
  it("accepts a valid card title/description patch", () => {
    const result = PanelEditParamsSchema.safeParse({
      title: "New title",
      description: "New description",
    });
    expect(result.success).toBe(true);
  });

  it("rejects grid cols=0 (below the 1-12 bound)", () => {
    const result = PanelEditParamsSchema.safeParse({ cols: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects grid cols=13 (above the 1-12 bound)", () => {
    const result = PanelEditParamsSchema.safeParse({ cols: 13 });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown key (.strict())", () => {
    const result = PanelEditParamsSchema.safeParse({ rawJson: "{}" });
    expect(result.success).toBe(false);
  });
});

describe("editableFieldsFor", () => {
  it("returns [] for a root type with no editable params (e.g. text)", () => {
    expect(editableFieldsFor("text")).toEqual([]);
  });

  it("returns [] for an unknown/unregistered root type", () => {
    expect(editableFieldsFor("some-future-node-type")).toEqual([]);
  });

  it("returns the card fields", () => {
    expect(editableFieldsFor("card").map((f) => f.key)).toEqual(["title", "description"]);
  });

  it("returns the grid fields, including cols bounded 1-12", () => {
    const fields = editableFieldsFor("grid");
    const cols = fields.find((f) => f.key === "cols");
    expect(cols).toMatchObject({ kind: "number", min: 1, max: 12 });
  });
});

describe("applyWhitelistedParams", () => {
  it("applies a card title + description patch and re-validates", () => {
    const params: PanelEditParams = { title: "New title", description: "New description" };
    const result = applyWhitelistedParams(CARD_SPEC, params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.root).toMatchObject({
        type: "card",
        title: "New title",
        description: "New description",
      });
    }
  });

  it("ignores a param key not valid for the root type (result equals base for that key)", () => {
    // `cols` is globally valid per PanelEditParamsSchema (a grid field) but not a card field.
    const params: PanelEditParams = { cols: 6 };
    const result = applyWhitelistedParams(CARD_SPEC, params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.root).not.toHaveProperty("cols");
      expect(result.spec.root).toMatchObject({
        title: "Old title",
        description: "Old description",
      });
    }
  });

  it("applying to a text root (no editable fields) is a no-op", () => {
    const params: PanelEditParams = { title: "Should never apply" };
    const result = applyWhitelistedParams(TEXT_SPEC, params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec).toEqual(TEXT_SPEC);
    }
  });

  it("a param that would break SpecRootSchema returns { ok:false }", () => {
    // Bypasses PanelEditParamsSchema's own enum bound via a cast — proves the
    // pure function's OWN re-validation is the real safety net (FOUND-6),
    // not merely trusting a value that already passed some upstream schema.
    const params = { gap: "invalid-gap" } as unknown as PanelEditParams;
    const result = applyWhitelistedParams(GRID_SPEC, params);

    expect(result.ok).toBe(false);
  });

  it("never mutates baseSpec", () => {
    const original: SpecRoot = JSON.parse(JSON.stringify(CARD_SPEC)) as SpecRoot;
    applyWhitelistedParams(CARD_SPEC, { title: "Mutated?" });
    expect(CARD_SPEC).toEqual(original);
  });
});
