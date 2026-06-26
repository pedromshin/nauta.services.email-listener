/**
 * graph.test.ts — unit tests for the knowledge.graph pure helper and input schema.
 *
 * DB-free: shapeGraphResponse is an exported pure helper tested without a DB connection.
 * Schema tests verify the Zod allow-lists, defaults, and bounds.
 *
 * Test plan:
 *   Test 1: shapeGraphResponse returns { nodes, edges } with the correct data.
 *   Test 2: shapeGraphResponse returns NEW arrays (not same reference as inputs).
 *   Test 3: graphInputSchema nodeTypes rejects a value outside the 6-item allow-list.
 *   Test 4: graphInputSchema nodeTypes accepts all six valid node types.
 *   Test 5: graphInputSchema includeInstances defaults to false.
 *   Test 6: graphInputSchema includeEmails defaults to false.
 *   Test 7: graphInputSchema importerId must be a UUID when provided.
 *   Test 8: graphInputSchema nodeTypes must be an array (not a string).
 */

import { describe, expect, it } from "vitest";

import {
  graphInputSchema,
  shapeGraphResponse,
  type GraphEdge,
  type GraphNode,
} from "./graph";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_NODES: GraphNode[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    type: "entity_type",
    label: "Shipper",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    type: "entity_type_field",
    label: "PO Number",
  },
];

const SAMPLE_EDGES: GraphEdge[] = [
  {
    id: "edge-1",
    source: "00000000-0000-0000-0000-000000000001",
    target: "00000000-0000-0000-0000-000000000002",
    relationType: "has_field",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("shapeGraphResponse", () => {
  it("Test 1: returns { nodes, edges } with the correct data", () => {
    const result = shapeGraphResponse(SAMPLE_NODES, SAMPLE_EDGES);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes[0]?.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(result.edges[0]?.relationType).toBe("has_field");
  });

  it("Test 2: returns NEW arrays — not same reference as inputs (immutability)", () => {
    const result = shapeGraphResponse(SAMPLE_NODES, SAMPLE_EDGES);

    expect(result.nodes).not.toBe(SAMPLE_NODES);
    expect(result.edges).not.toBe(SAMPLE_EDGES);
  });

  it("Test 2b: result object is not mutated by a subsequent call", () => {
    const result1 = shapeGraphResponse(SAMPLE_NODES, SAMPLE_EDGES);
    const snapshot = JSON.stringify(result1);
    shapeGraphResponse(SAMPLE_NODES, SAMPLE_EDGES);
    expect(JSON.stringify(result1)).toBe(snapshot);
  });
});

describe("graphInputSchema — nodeTypes", () => {
  it("Test 3: rejects a value outside the 6-item allow-list", () => {
    expect(() =>
      graphInputSchema.parse({ nodeTypes: ["invalid_type"] }),
    ).toThrow();
  });

  it("Test 4: accepts all six valid node types", () => {
    const validTypes = [
      "entity_type",
      "entity_type_field",
      "entity_instance",
      "email_component",
      "email",
      "knowledge_node",
    ] as const;

    for (const nodeType of validTypes) {
      const parsed = graphInputSchema.parse({ nodeTypes: [nodeType] });
      expect(parsed.nodeTypes).toContain(nodeType);
    }
  });

  it("Test 4b: nodeTypes is optional (omitting it is valid)", () => {
    const parsed = graphInputSchema.parse({});
    expect(parsed.nodeTypes).toBeUndefined();
  });
});

describe("graphInputSchema — defaults", () => {
  it("Test 5: includeInstances defaults to false", () => {
    const parsed = graphInputSchema.parse({});
    expect(parsed.includeInstances).toBe(false);
  });

  it("Test 6: includeEmails defaults to false", () => {
    const parsed = graphInputSchema.parse({});
    expect(parsed.includeEmails).toBe(false);
  });
});

describe("graphInputSchema — importerId", () => {
  it("Test 7: importerId must be a UUID when provided", () => {
    expect(() =>
      graphInputSchema.parse({ importerId: "not-a-uuid" }),
    ).toThrow();

    const parsed = graphInputSchema.parse({
      importerId: "00000000-0000-0000-0000-000000000001",
    });
    expect(parsed.importerId).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("Test 7b: importerId is optional (omitting is valid)", () => {
    const parsed = graphInputSchema.parse({});
    expect(parsed.importerId).toBeUndefined();
  });
});

describe("graphInputSchema — nodeTypes type check", () => {
  it("Test 8: nodeTypes must be an array (a plain string is rejected)", () => {
    expect(() =>
      graphInputSchema.parse({ nodeTypes: "entity_type" }),
    ).toThrow();
  });
});
