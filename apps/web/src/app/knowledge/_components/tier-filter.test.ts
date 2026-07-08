import { describe, expect, it } from "vitest";

import { tierAllowsEdge } from "./tier-filter";

describe("tierAllowsEdge", () => {
  it("'confirmed' allows only EXTRACTED kne- edges", () => {
    expect(tierAllowsEdge({ id: "kne-1", data: { tier: "EXTRACTED" } }, "confirmed")).toBe(true);
    expect(tierAllowsEdge({ id: "kne-2", data: { tier: "INFERRED" } }, "confirmed")).toBe(false);
    expect(tierAllowsEdge({ id: "kne-3", data: { tier: "AMBIGUOUS" } }, "confirmed")).toBe(false);
  });

  it("'inferred' allows EXTRACTED + INFERRED, drops AMBIGUOUS", () => {
    expect(tierAllowsEdge({ id: "kne-1", data: { tier: "EXTRACTED" } }, "inferred")).toBe(true);
    expect(tierAllowsEdge({ id: "kne-2", data: { tier: "INFERRED" } }, "inferred")).toBe(true);
    expect(tierAllowsEdge({ id: "kne-3", data: { tier: "AMBIGUOUS" } }, "inferred")).toBe(false);
  });

  it("'ambiguous' allows all three tiers", () => {
    expect(tierAllowsEdge({ id: "kne-1", data: { tier: "EXTRACTED" } }, "ambiguous")).toBe(true);
    expect(tierAllowsEdge({ id: "kne-2", data: { tier: "INFERRED" } }, "ambiguous")).toBe(true);
    expect(tierAllowsEdge({ id: "kne-3", data: { tier: "AMBIGUOUS" } }, "ambiguous")).toBe(true);
  });

  it("a structural (non-kne-) edge passes in every filter state", () => {
    const structuralEdge = { id: "field-abc" };
    expect(tierAllowsEdge(structuralEdge, "confirmed")).toBe(true);
    expect(tierAllowsEdge(structuralEdge, "inferred")).toBe(true);
    expect(tierAllowsEdge(structuralEdge, "ambiguous")).toBe(true);
  });

  it("a kne- edge with undefined tier only passes at 'ambiguous'", () => {
    const untieredEdge = { id: "kne-4", data: {} };
    expect(tierAllowsEdge(untieredEdge, "confirmed")).toBe(false);
    expect(tierAllowsEdge(untieredEdge, "inferred")).toBe(false);
    expect(tierAllowsEdge(untieredEdge, "ambiguous")).toBe(true);
  });

  it("a kne- edge with no data object at all only passes at 'ambiguous'", () => {
    const noDataEdge = { id: "kne-5" };
    expect(tierAllowsEdge(noDataEdge, "confirmed")).toBe(false);
    expect(tierAllowsEdge(noDataEdge, "ambiguous")).toBe(true);
  });
});
