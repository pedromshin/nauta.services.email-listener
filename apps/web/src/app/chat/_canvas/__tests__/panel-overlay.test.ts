/**
 * panel-overlay.test.ts — TDD RED/GREEN coverage for the overlay data model
 * + pure resolution/mutation helpers (52-01-PLAN.md Task 1).
 *
 * Pure unit tests — zero mocks, zero React render (mirrors canvas-store.test.ts
 * / panel-action-bridge.test.ts style).
 */

import { describe, expect, it } from "vitest";

import {
  appendVersion,
  listPriorVersions,
  parseOverlay,
  PanelOverlaySchema,
  resolveActivePanel,
  restoreVersion,
  setPack,
  type PanelOverlay,
} from "../panel-overlay";

const BASE_SPEC_JSON = JSON.stringify({
  v: 1,
  root: { type: "stack", children: [] },
});

const BASE_SPEC_WITH_PACK_JSON = JSON.stringify({
  v: 1,
  style_pack_id: "linear-clean",
  root: { type: "stack", children: [] },
});

describe("PanelOverlaySchema", () => {
  it("is exported and strict", () => {
    expect(PanelOverlaySchema).toBeDefined();
    const parsed = PanelOverlaySchema.safeParse({
      activeVersionId: null,
      versions: [],
      unexpectedKey: "nope",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("resolveActivePanel", () => {
  it("falls back to the base spec + default pack when overlay is undefined", () => {
    const resolved = resolveActivePanel(undefined, BASE_SPEC_JSON, false);
    expect(resolved).toEqual({
      specJson: BASE_SPEC_JSON,
      packId: "polytoken-teal",
      tokenOverrides: {},
    });
  });

  it("falls back to the base spec's OWN style_pack_id when overlay has no pack override", () => {
    const resolved = resolveActivePanel(undefined, BASE_SPEC_WITH_PACK_JSON, false);
    expect(resolved.packId).toBe("linear-clean");
    expect(resolved.specJson).toBe(BASE_SPEC_WITH_PACK_JSON);
  });

  it("an overlay pack override wins over the base spec's own pack (no active version)", () => {
    const overlay: PanelOverlay = {
      activeVersionId: null,
      stylePackId: "brutalist",
      versions: [],
    };
    const resolved = resolveActivePanel(overlay, BASE_SPEC_WITH_PACK_JSON, false);
    expect(resolved.packId).toBe("brutalist");
    expect(resolved.specJson).toBe(BASE_SPEC_WITH_PACK_JSON);
  });

  it("streaming forces the base spec even when an active version exists", () => {
    let overlay = appendVersion(undefined, {
      generatedBy: "regenerate",
      specJson: JSON.stringify({ v: 1, root: { type: "stack", children: [] } }),
      stylePackId: "playful-rounded",
    });
    const resolved = resolveActivePanel(overlay, BASE_SPEC_JSON, true);
    expect(resolved).toEqual({
      specJson: BASE_SPEC_JSON,
      packId: "polytoken-teal",
      tokenOverrides: {},
    });
  });

  it("resolves the active version's spec/pack/tokenOverrides when not streaming", () => {
    const versionSpecJson = JSON.stringify({ v: 1, root: { type: "stack", children: [] } });
    const overlay = appendVersion(undefined, {
      generatedBy: "retheme",
      specJson: versionSpecJson,
      stylePackId: "warm-editorial",
      tokenOverrides: { primary: "12 80% 50%" },
    });

    const resolved = resolveActivePanel(overlay, BASE_SPEC_JSON, false);
    expect(resolved).toEqual({
      specJson: versionSpecJson,
      packId: "warm-editorial",
      tokenOverrides: { primary: "12 80% 50%" },
    });
  });

  it("an overlay-level pack override wins over the active version's own pack", () => {
    const versionSpecJson = JSON.stringify({ v: 1, root: { type: "stack", children: [] } });
    let overlay = appendVersion(undefined, {
      generatedBy: "retheme",
      specJson: versionSpecJson,
      stylePackId: "warm-editorial",
    });
    overlay = setPack(overlay, "corporate-saas");

    const resolved = resolveActivePanel(overlay, BASE_SPEC_JSON, false);
    expect(resolved.packId).toBe("corporate-saas");
    expect(resolved.specJson).toBe(versionSpecJson);
  });

  it("degrades to base-spec fallback when activeVersionId points at an unknown version id", () => {
    const overlay: PanelOverlay = {
      activeVersionId: "00000000-0000-0000-0000-000000000000",
      versions: [],
    };
    const resolved = resolveActivePanel(overlay, BASE_SPEC_JSON, false);
    expect(resolved.specJson).toBe(BASE_SPEC_JSON);
  });
});

describe("setPack", () => {
  it("creates a minimal overlay when none exists yet", () => {
    const overlay = setPack(undefined, "brutalist");
    expect(overlay.stylePackId).toBe("brutalist");
    expect(overlay.activeVersionId).toBeNull();
    expect(overlay.versions).toEqual([]);
  });

  it("does not add a version", () => {
    const overlay = setPack(undefined, "brutalist");
    expect(overlay.versions).toHaveLength(0);
  });

  it("is immutable — never mutates the input overlay", () => {
    const original: PanelOverlay = { activeVersionId: null, versions: [] };
    const updated = setPack(original, "linear-clean");
    expect(original.stylePackId).toBeUndefined();
    expect(updated).not.toBe(original);
    expect(updated.stylePackId).toBe("linear-clean");
  });
});

describe("appendVersion", () => {
  it("sets the new version active and clears stylePackId to null", () => {
    let overlay = setPack(undefined, "brutalist");
    overlay = appendVersion(overlay, {
      generatedBy: "edit",
      specJson: BASE_SPEC_JSON,
    });

    expect(overlay.stylePackId).toBeNull();
    expect(overlay.activeVersionId).toBe(overlay.versions[overlay.versions.length - 1]?.id);
  });

  it("appends (never replaces) prior versions and links parentVersionId to the prior active id", () => {
    const first = appendVersion(undefined, { generatedBy: "regenerate", specJson: BASE_SPEC_JSON });
    const firstActiveId = first.activeVersionId;

    const second = appendVersion(first, { generatedBy: "edit", specJson: BASE_SPEC_JSON });

    expect(second.versions).toHaveLength(2);
    expect(second.versions[0]?.id).toBe(first.versions[0]?.id);
    expect(second.versions[1]?.parentVersionId).toBe(firstActiveId);
    expect(second.activeVersionId).toBe(second.versions[1]?.id);
  });

  it("is immutable — never mutates the input overlay", () => {
    const original = appendVersion(undefined, { generatedBy: "regenerate", specJson: BASE_SPEC_JSON });
    const originalVersionsRef = original.versions;
    const updated = appendVersion(original, { generatedBy: "edit", specJson: BASE_SPEC_JSON });

    expect(original.versions).toBe(originalVersionsRef);
    expect(original.versions).toHaveLength(1);
    expect(updated).not.toBe(original);
    expect(updated.versions).toHaveLength(2);
  });

  it("stamps a fresh uuid id and an ISO createdAt", () => {
    const overlay = appendVersion(undefined, { generatedBy: "regenerate", specJson: BASE_SPEC_JSON });
    const version = overlay.versions[0];
    expect(version?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(() => new Date(version?.createdAt ?? "").toISOString()).not.toThrow();
  });
});

describe("restoreVersion", () => {
  it("supersede-never-mutate: clones the target version as a NEW version and sets it active", () => {
    const v1 = appendVersion(undefined, {
      generatedBy: "regenerate",
      specJson: "spec-v1",
      stylePackId: "brutalist",
      tokenOverrides: { primary: "0 0% 0%" },
    });
    const v2 = appendVersion(v1, { generatedBy: "edit", specJson: "spec-v2" });
    const targetId = v1.versions[0]!.id;

    const restored = restoreVersion(v2, targetId);

    expect(restored.versions).toHaveLength(3);
    const clone = restored.versions[2]!;
    expect(clone.id).not.toBe(targetId);
    expect(clone.specJson).toBe("spec-v1");
    expect(clone.stylePackId).toBe("brutalist");
    expect(clone.tokenOverrides).toEqual({ primary: "0 0% 0%" });
    expect(clone.generatedBy).toBe("regenerate");
    expect(clone.parentVersionId).toBe(targetId);
    expect(restored.activeVersionId).toBe(clone.id);
    expect(restored.stylePackId).toBeNull();
  });

  it("never deletes or mutates the original versions", () => {
    const v1 = appendVersion(undefined, { generatedBy: "regenerate", specJson: "spec-v1" });
    const targetId = v1.versions[0]!.id;

    const restored = restoreVersion(v1, targetId);

    expect(restored.versions[0]).toEqual(v1.versions[0]);
    expect(v1.versions).toHaveLength(1);
  });

  it("is a no-op returning the overlay unchanged for an unknown versionId", () => {
    const overlay = appendVersion(undefined, { generatedBy: "regenerate", specJson: "spec-v1" });
    const result = restoreVersion(overlay, "00000000-0000-0000-0000-000000000000");
    expect(result).toBe(overlay);
  });
});

describe("listPriorVersions", () => {
  it("returns [] when overlay is undefined", () => {
    expect(listPriorVersions(undefined)).toEqual([]);
  });

  it("returns [] when only the active version exists", () => {
    const overlay = appendVersion(undefined, { generatedBy: "regenerate", specJson: "spec-v1" });
    expect(listPriorVersions(overlay)).toEqual([]);
  });

  it("excludes the active version and orders the rest newest-first", async () => {
    let overlay = appendVersion(undefined, { generatedBy: "regenerate", specJson: "spec-v1" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    overlay = appendVersion(overlay, { generatedBy: "edit", specJson: "spec-v2" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    overlay = appendVersion(overlay, { generatedBy: "retheme", specJson: "spec-v3" });

    const prior = listPriorVersions(overlay);
    expect(prior).toHaveLength(2);
    expect(prior[0]?.specJson).toBe("spec-v2");
    expect(prior[1]?.specJson).toBe("spec-v1");
    expect(prior.some((v) => v.specJson === "spec-v3")).toBe(false);
  });
});

describe("parseOverlay", () => {
  it("returns the parsed overlay for valid input", () => {
    const raw = { activeVersionId: null, versions: [] };
    expect(parseOverlay(raw)).toEqual(raw);
  });

  it("degrades a malformed record to undefined instead of throwing", () => {
    expect(parseOverlay({ activeVersionId: 42, versions: "not-an-array" })).toBeUndefined();
    expect(parseOverlay(null)).toBeUndefined();
    expect(parseOverlay("a string")).toBeUndefined();
    expect(parseOverlay({ activeVersionId: null, versions: [], extraKey: true })).toBeUndefined();
  });
});
