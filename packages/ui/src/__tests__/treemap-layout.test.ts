/**
 * treemap-layout.test.ts — the pure d3.treemap() layout math behind the
 * `Treemap` primitive (jsdom = behaviour only, no visual claim). Asserts the
 * hierarchy → positioned-rectangle contract: one rect per node, stable path ids,
 * containment (every child inside its parent's box), full-box tiling, leaf-value
 * summation, and that drilling to a focus re-tiles that subtree to fill the box
 * while keeping GLOBAL ids so the shared zoom machine keeps working.
 */

import { describe, expect, it } from "vitest";

import { indexTree, layoutTreemap, type TreeNode } from "../treemap/treemap-layout";

const SAMPLE: TreeNode = {
  name: "root",
  children: [
    {
      name: "alice",
      children: [
        { name: "t1", value: 3 },
        { name: "t2", value: 1 },
      ],
    },
    {
      name: "bob",
      children: [{ name: "t3", value: 4 }],
    },
  ],
};

const OPTS = { width: 300, height: 200, paddingInner: 0, paddingOuter: 0, paddingTop: 0 } as const;

describe("layoutTreemap — hierarchy → rectangle count & ids", () => {
  it("emits exactly one rect per node (root + 2 senders + 3 leaves = 6)", () => {
    const { rects } = layoutTreemap(SAMPLE, "0", OPTS);
    expect(rects).toHaveLength(6);
    expect(rects.filter((r) => r.isLeaf)).toHaveLength(3);
    expect(rects.find((r) => r.id === "0")?.parentId).toBeNull();
  });

  it("assigns stable path ids and links parents to children", () => {
    const { rects } = layoutTreemap(SAMPLE, "0", OPTS);
    const root = rects.find((r) => r.id === "0")!;
    expect(root.childIds).toHaveLength(2);
    for (const childId of root.childIds) {
      expect(rects.find((r) => r.id === childId)?.parentId).toBe("0");
    }
  });
});

describe("layoutTreemap — tiling & containment", () => {
  it("fills the whole box with the root rectangle", () => {
    const { rects } = layoutTreemap(SAMPLE, "0", OPTS);
    const root = rects.find((r) => r.id === "0")!;
    expect(root.x0).toBe(0);
    expect(root.y0).toBe(0);
    expect(root.x1).toBe(300);
    expect(root.y1).toBe(200);
  });

  it("keeps every child rectangle inside its parent's box", () => {
    const { rects } = layoutTreemap(SAMPLE, "0", OPTS);
    const byId = new Map(rects.map((r) => [r.id, r]));
    for (const r of rects) {
      if (r.parentId === null) continue;
      const parent = byId.get(r.parentId)!;
      expect(r.x0).toBeGreaterThanOrEqual(parent.x0 - 1e-6);
      expect(r.y0).toBeGreaterThanOrEqual(parent.y0 - 1e-6);
      expect(r.x1).toBeLessThanOrEqual(parent.x1 + 1e-6);
      expect(r.y1).toBeLessThanOrEqual(parent.y1 + 1e-6);
    }
  });

  it("gives the whole area to the leaves (no wasted box, unlike packed circles)", () => {
    const { rects } = layoutTreemap(SAMPLE, "0", OPTS);
    const leafArea = rects
      .filter((r) => r.isLeaf)
      .reduce((sum, r) => sum + (r.x1 - r.x0) * (r.y1 - r.y0), 0);
    // Squarified tiling with zero padding covers the full 300×200 box.
    expect(leafArea).toBeCloseTo(300 * 200, 0);
  });
});

describe("layoutTreemap — leaf value summation", () => {
  it("sums leaf values into internal nodes and the root", () => {
    const { rects } = layoutTreemap(SAMPLE, "0", OPTS);
    expect(rects.find((r) => r.id === "0")?.value).toBe(8); // 3+1+4
    const senders = rects.filter((r) => r.parentId === "0");
    expect(senders.reduce((n, r) => n + r.value, 0)).toBe(8);
  });

  it("treats negative/absent leaf values as zero (never negative area)", () => {
    const { rects } = layoutTreemap(
      { name: "r", children: [{ name: "a", value: -5 }, { name: "b", value: 2 }] },
      "0",
      OPTS,
    );
    for (const r of rects) {
      expect(r.x1 - r.x0).toBeGreaterThanOrEqual(0);
      expect(r.y1 - r.y0).toBeGreaterThanOrEqual(0);
    }
    expect(rects.find((r) => r.id === "0")?.value).toBe(2);
  });
});

describe("layoutTreemap — drilling re-tiles a focus subtree to fill the box", () => {
  it("fills the box with the focused container and keeps GLOBAL ids", () => {
    // The larger sender is bob (value 4) vs alice (3+1=4) — equal, so ids are
    // sort-stable; pick whichever the index resolves as the first child.
    const { rects } = layoutTreemap(SAMPLE, "0/0", OPTS);
    const focus = rects.find((r) => r.id === "0/0")!;
    // The focused container now fills the whole box...
    expect(focus.x0).toBe(0);
    expect(focus.y0).toBe(0);
    expect(focus.x1).toBe(300);
    expect(focus.y1).toBe(200);
    // ...and its true parent is still the root, so zoom-out steps above it.
    expect(focus.parentId).toBe("0");
    // Every emitted rect is within the focus subtree (global ids stay prefixed).
    for (const r of rects) expect(r.id.startsWith("0/0")).toBe(true);
  });

  it("an unknown focus id falls back to the root (never throws / empties)", () => {
    const { rects } = layoutTreemap(SAMPLE, "0/9/9", OPTS);
    expect(rects.find((r) => r.id === "0")).toBeDefined();
    expect(rects).toHaveLength(6);
  });
});

describe("indexTree — full-tree read model for the zoom reducer", () => {
  it("indexes every node with parent/child/leaf/datum, independent of focus", () => {
    const index = indexTree(SAMPLE);
    expect(index.ids.size).toBe(6);
    expect(index.parentOf.get("0")).toBeNull();
    expect(index.childrenOf.get("0")).toHaveLength(2);
    expect(index.isLeaf.get("0")).toBe(false);
    expect(index.datumOf.get("0")?.name).toBe("root");
    // Leaves carry their own value; the root sums them.
    expect(index.valueOf.get("0")).toBe(8);
  });
});
