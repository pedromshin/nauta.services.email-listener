/**
 * knowledge-preview-layout.test.ts — unit tests for the pure hop-distance /
 * cap-trim / two-hop-ordering / two-ring-ellipse layout math backing the
 * `knowledge-preview` canvas node (PREV-01, 41-UI-SPEC.md §2/§3).
 */

import { describe, expect, it } from "vitest";

import {
  computeHopDistances,
  layoutPreview,
  MAX_PREVIEW_NODES,
  orderTwoHopByParent,
  trimPreviewGraph,
  type PreviewGraphEdge,
  type PreviewGraphNode,
} from "../knowledge-preview-layout";

// ---------------------------------------------------------------------------
// Local fixture helpers
// ---------------------------------------------------------------------------

function node(id: string): PreviewGraphNode {
  return { id };
}

function edge(id: string, source: string, target: string): PreviewGraphEdge {
  return { id, source, target };
}

// ---------------------------------------------------------------------------
// computeHopDistances
// ---------------------------------------------------------------------------

describe("computeHopDistances", () => {
  it("computes shortest hop distances treating every edge as undirected", () => {
    const edges = [
      edge("e1", "f", "a"),
      edge("e2", "a", "b"),
      edge("e3", "c", "f"),
    ];

    const distances = computeHopDistances("f", edges);

    expect(distances.get("f")).toBe(0);
    expect(distances.get("a")).toBe(1);
    expect(distances.get("c")).toBe(1);
    expect(distances.get("b")).toBe(2);
  });

  it("resolves a node reachable via two different-length paths to the SHORTER distance", () => {
    const edges = [
      edge("e1", "f", "a"), // direct, 1 hop
      edge("e2", "f", "x"),
      edge("e3", "x", "a"), // indirect, would be 2 hops
    ];

    const distances = computeHopDistances("f", edges);

    expect(distances.get("a")).toBe(1);
  });

  it("omits a node with no path to focus from the returned map (never Infinity)", () => {
    const edges = [edge("e1", "f", "a")];

    const distances = computeHopDistances("f", edges);

    expect(distances.has("z")).toBe(false);
    expect(distances.get("z")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// trimPreviewGraph
// ---------------------------------------------------------------------------

describe("trimPreviewGraph", () => {
  it("returns all nodes/edges unchanged when under cap", () => {
    const nodes = [node("f"), node("a"), node("b"), node("c"), node("d")];
    const edges = [
      edge("e1", "f", "a"),
      edge("e2", "f", "b"),
      edge("e3", "a", "c"),
      edge("e4", "b", "d"),
    ];

    const result = trimPreviewGraph("f", nodes, edges, 25);

    expect(result.nodes).toHaveLength(5);
    expect(result.edges).toHaveLength(4);
    expect(result.oneHopIds).toEqual(["a", "b"]);
    expect(result.twoHopIds).toEqual(["c", "d"]);
    expect(result.overflowCount).toBe(0);
  });

  it("fills the remaining budget with 2-hop nodes when 1-hop fits under budget", () => {
    const oneHopIds = Array.from({ length: 20 }, (_, i) => `o${i}`);
    const twoHopIds = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const nodes = [
      node("f"),
      ...oneHopIds.map((id) => node(id)),
      ...twoHopIds.map((id) => node(id)),
    ];
    const edges = [
      ...oneHopIds.map((id, i) => edge(`fo${i}`, "f", id)),
      ...twoHopIds.map((id, i) => edge(`ot${i}`, oneHopIds[i % oneHopIds.length]!, id)),
    ];

    const result = trimPreviewGraph("f", nodes, edges, 25);

    // remaining budget after focus = 24; 20 one-hop fit, leaving 4 for two-hop
    expect(result.oneHopIds).toEqual(oneHopIds);
    expect(result.twoHopIds).toEqual(twoHopIds.slice(0, 4));
    expect(result.nodes).toHaveLength(1 + 20 + 4);
    expect(result.overflowCount).toBe(Math.max(0, nodes.length - 25));
  });

  it("trims 1-hop itself to the first N and keeps ZERO 2-hop nodes when 1-hop alone exceeds budget", () => {
    const oneHopIds = Array.from({ length: 30 }, (_, i) => `o${i}`);
    const twoHopIds = Array.from({ length: 5 }, (_, i) => `t${i}`);
    const nodes = [
      node("f"),
      ...oneHopIds.map((id) => node(id)),
      ...twoHopIds.map((id) => node(id)),
    ];
    const edges = [
      ...oneHopIds.map((id, i) => edge(`fo${i}`, "f", id)),
      ...twoHopIds.map((id, i) => edge(`ot${i}`, oneHopIds[i]!, id)),
    ];

    const result = trimPreviewGraph("f", nodes, edges, 25);

    expect(result.oneHopIds).toEqual(oneHopIds.slice(0, 24));
    expect(result.twoHopIds).toEqual([]);
    expect(result.nodes).toHaveLength(1 + 24);
  });

  it("drops any edge whose endpoint fell outside the kept node set (no dangling edges)", () => {
    const nodes = [node("f"), node("a"), node("b"), node("c"), node("x")];
    const edges = [
      edge("fa", "f", "a"),
      edge("fb", "f", "b"),
      edge("fc", "f", "c"), // c gets trimmed away
      edge("ax", "a", "x"), // x (2-hop) gets trimmed away too
    ];

    const result = trimPreviewGraph("f", nodes, edges, 3);

    const keptIds = new Set(result.nodes.map((n) => n.id));
    expect(keptIds).toEqual(new Set(["f", "a", "b"]));
    expect(result.edges.map((e) => e.id).sort()).toEqual(["fa", "fb"]);
    for (const keptEdge of result.edges) {
      expect(keptIds.has(keptEdge.source)).toBe(true);
      expect(keptIds.has(keptEdge.target)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// orderTwoHopByParent
// ---------------------------------------------------------------------------

describe("orderTwoHopByParent", () => {
  it("sorts twoHop ids by their connecting 1-hop parent's rank within oneHop", () => {
    const oneHop = ["p1", "p2"];
    const twoHop = ["c2", "c1"];
    const edges = [edge("e1", "c1", "p1"), edge("e2", "c2", "p2")];

    const ordered = orderTwoHopByParent(oneHop, twoHop, edges);

    expect(ordered).toEqual(["c1", "c2"]);
  });

  it("sorts a twoHop id with no resolvable parent edge to the END, never throwing", () => {
    const oneHop = ["p1"];
    const twoHop = ["c2", "c1"]; // c2 has no connecting edge; c1 does
    const edges = [edge("e1", "c1", "p1")];

    expect(() => orderTwoHopByParent(oneHop, twoHop, edges)).not.toThrow();
    const ordered = orderTwoHopByParent(oneHop, twoHop, edges);

    expect(ordered).toEqual(["c1", "c2"]);
  });
});

// ---------------------------------------------------------------------------
// layoutPreview
// ---------------------------------------------------------------------------

describe("layoutPreview", () => {
  it("places the sole focus node at the box center when there are no neighbours", () => {
    const positions = layoutPreview("f", [], [], { width: 280, height: 140 });

    expect(Object.keys(positions)).toEqual(["f"]);
    expect(positions.f).toEqual({ x: 140, y: 70 });
  });

  it("places ring-1 nodes on the inner ellipse (rx=0.38*width, ry=0.38*height), evenly spaced", () => {
    const positions = layoutPreview("f", ["a", "b"], []);

    const rx = 0.38 * 280;
    const ry = 0.38 * 140;
    const tolerance = 1e-6;

    for (const id of ["a", "b"]) {
      const pos = positions[id]!;
      const ellipseValue =
        ((pos.x - 140) / rx) ** 2 + ((pos.y - 70) / ry) ** 2;
      expect(ellipseValue).toBeCloseTo(1, 6);
    }

    expect(
      Math.abs(positions.a!.x - positions.b!.x) +
        Math.abs(positions.a!.y - positions.b!.y),
    ).toBeGreaterThan(tolerance);
  });

  it("places ring-2 nodes on the outer ellipse (rx=0.62*width, ry=0.62*height)", () => {
    const positions = layoutPreview("f", [], ["x"]);

    const rx = 0.62 * 280;
    const ry = 0.62 * 140;
    const pos = positions.x!;
    const ellipseValue = ((pos.x - 140) / rx) ** 2 + ((pos.y - 70) / ry) ** 2;

    expect(ellipseValue).toBeCloseTo(1, 6);
  });

  it("is deterministic — identical arguments produce bit-identical positions", () => {
    const first = layoutPreview("f", ["a", "b"], ["x", "y"]);
    const second = layoutPreview("f", ["a", "b"], ["x", "y"]);

    expect(first).toEqual(second);
  });
});

// ---------------------------------------------------------------------------
// MAX_PREVIEW_NODES sanity
// ---------------------------------------------------------------------------

describe("MAX_PREVIEW_NODES", () => {
  it("is locked to 25 (41-UI-SPEC.md §3)", () => {
    expect(MAX_PREVIEW_NODES).toBe(25);
  });
});
