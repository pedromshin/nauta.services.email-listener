/**
 * expand.test.ts — unit tests for the knowledge.expandNode pure helpers and
 * input schema (DB-free, mirrors graph.test.ts's conventions).
 *
 * Test plan:
 *   Test 1-3: clampDepth — undefined defaults to 1, values clamp to [1,2].
 *   Test 4-6: capBudget — truncates a >cap set (reports truncated=true),
 *             leaves a <=cap set untouched (truncated=false), drops edges
 *             that touch a truncated-away node.
 *   Test 7-9: expandInputSchema — rejects a non-uuid nodeId, accepts an
 *             optional integer depth, depth is undefined when omitted
 *             (clampDepth(undefined) defaults it to 1 downstream).
 *   Test 10: walkKnowledgeGraph — a seed with no edges returns just the
 *            seed id and no edges (no throw).
 *   Test 11: walkKnowledgeGraph — walks one hop and stops at maxDepth=1.
 */

import { describe, expect, it } from "vitest";

import type { ExplicitEdgeRow, GraphEdge, GraphNode } from "./graph";
import {
  capBudget,
  clampDepth,
  expandInputSchema,
  walkKnowledgeGraph,
} from "./expand";

// ---------------------------------------------------------------------------
// clampDepth
// ---------------------------------------------------------------------------

describe("clampDepth", () => {
  it("Test 1: undefined defaults to 1", () => {
    expect(clampDepth(undefined)).toBe(1);
  });

  it("Test 2: a depth above the max (5) clamps to 2", () => {
    expect(clampDepth(5)).toBe(2);
  });

  it("Test 3: a depth of 0 or negative clamps to 1", () => {
    expect(clampDepth(0)).toBe(1);
    expect(clampDepth(-3)).toBe(1);
  });

  it("Test 3b: a valid in-range depth passes through unchanged", () => {
    expect(clampDepth(1)).toBe(1);
    expect(clampDepth(2)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// capBudget
// ---------------------------------------------------------------------------

function makeNodes(count: number): GraphNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: "knowledge_node" as const,
    label: `Node ${i}`,
  }));
}

describe("capBudget", () => {
  it("Test 4: truncates a >50-item node set and reports truncated=true", () => {
    const nodes = makeNodes(60);
    const result = capBudget(nodes, [], 50);

    expect(result.nodes).toHaveLength(50);
    expect(result.truncated).toBe(true);
  });

  it("Test 5: does NOT truncate a <=50-item set", () => {
    const nodes = makeNodes(50);
    const result = capBudget(nodes, [], 50);

    expect(result.nodes).toHaveLength(50);
    expect(result.truncated).toBe(false);
  });

  it("Test 6: drops an edge whose endpoint was truncated away", () => {
    const nodes = makeNodes(51);
    const edges: GraphEdge[] = [
      { id: "e1", source: "node-0", target: "node-1", relationType: "r" },
      { id: "e2", source: "node-0", target: "node-50", relationType: "r" },
    ];
    const result = capBudget(nodes, edges, 50);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.id).toBe("e1");
    expect(result.truncated).toBe(true);
  });

  it("Test 6b: does not mutate the input arrays", () => {
    const nodes = makeNodes(60);
    const originalLength = nodes.length;
    capBudget(nodes, []);
    expect(nodes).toHaveLength(originalLength);
  });
});

// ---------------------------------------------------------------------------
// expandInputSchema
// ---------------------------------------------------------------------------

describe("expandInputSchema", () => {
  it("Test 7: rejects a non-uuid nodeId", () => {
    expect(() =>
      expandInputSchema.parse({ nodeId: "not-a-uuid" }),
    ).toThrow();
  });

  it("Test 8: accepts an optional integer depth", () => {
    const parsed = expandInputSchema.parse({
      nodeId: "00000000-0000-0000-0000-000000000001",
      depth: 2,
    });
    expect(parsed.depth).toBe(2);
  });

  it("Test 9: depth is undefined when omitted (clampDepth defaults it to 1)", () => {
    const parsed = expandInputSchema.parse({
      nodeId: "00000000-0000-0000-0000-000000000001",
    });
    expect(parsed.depth).toBeUndefined();
    expect(clampDepth(parsed.depth)).toBe(1);
  });

  it("Test 9b: rejects a non-integer depth", () => {
    expect(() =>
      expandInputSchema.parse({
        nodeId: "00000000-0000-0000-0000-000000000001",
        depth: 1.5,
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// walkKnowledgeGraph
// ---------------------------------------------------------------------------

describe("walkKnowledgeGraph", () => {
  const SEED = "00000000-0000-0000-0000-000000000001";
  const NEIGHBOUR = "00000000-0000-0000-0000-000000000002";
  const NEIGHBOUR2 = "00000000-0000-0000-0000-000000000003";

  it("Test 10: a seed with no active edges returns just the seed (no throw)", async () => {
    const result = await walkKnowledgeGraph(SEED, 2, async () => []);

    expect(result.nodeIds.has(SEED)).toBe(true);
    expect(result.nodeIds.size).toBe(1);
    expect(result.edges).toHaveLength(0);
  });

  it("Test 11: walks one hop and stops at maxDepth=1", async () => {
    const rowsBySource = new Map<string, ExplicitEdgeRow[]>([
      [
        SEED,
        [
          {
            id: "edge-1",
            sourceNodeId: SEED,
            targetRefId: NEIGHBOUR,
            relationType: "co_occurs_with",
            tier: "INFERRED",
            isActive: true,
          },
        ],
      ],
      [
        NEIGHBOUR,
        [
          {
            id: "edge-2",
            sourceNodeId: NEIGHBOUR,
            targetRefId: NEIGHBOUR2,
            relationType: "co_occurs_with",
            tier: "INFERRED",
            isActive: true,
          },
        ],
      ],
    ]);

    const fetchEdgesForNode = async (
      nodeId: string,
    ): Promise<ExplicitEdgeRow[]> => rowsBySource.get(nodeId) ?? [];

    const result = await walkKnowledgeGraph(SEED, 1, fetchEdgesForNode);

    expect(result.nodeIds.has(SEED)).toBe(true);
    expect(result.nodeIds.has(NEIGHBOUR)).toBe(true);
    // Second hop never walked (maxDepth=1) — NEIGHBOUR2 is not reachable.
    expect(result.nodeIds.has(NEIGHBOUR2)).toBe(false);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.id).toBe("kne-edge-1");
  });

  it("Test 12: an inactive edge row is excluded from the walk", async () => {
    const fetchEdgesForNode = async (
      nodeId: string,
    ): Promise<ExplicitEdgeRow[]> =>
      nodeId === SEED
        ? [
            {
              id: "edge-inactive",
              sourceNodeId: SEED,
              targetRefId: NEIGHBOUR,
              relationType: "co_occurs_with",
              tier: "AMBIGUOUS",
              isActive: false,
            },
          ]
        : [];

    const result = await walkKnowledgeGraph(SEED, 2, fetchEdgesForNode);

    expect(result.nodeIds.has(NEIGHBOUR)).toBe(false);
    expect(result.edges).toHaveLength(0);
  });
});
