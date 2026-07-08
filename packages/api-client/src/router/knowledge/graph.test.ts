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
  buildProvenanceSummary,
  graphInputSchema,
  shapeExplicitEdgeRow,
  shapeGraphResponse,
  type ExplicitEdgeRow,
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

// ---------------------------------------------------------------------------
// Phase 30 (30-01): shapeExplicitEdgeRow — tier visibility + inactive exclusion
// ---------------------------------------------------------------------------

describe("shapeExplicitEdgeRow", () => {
  it("Test 9: an active edge carries its tier", () => {
    const row: ExplicitEdgeRow = {
      id: "edge-active-inferred",
      sourceNodeId: "00000000-0000-0000-0000-000000000001",
      targetRefId: "00000000-0000-0000-0000-000000000002",
      relationType: "co_occurs_with",
      tier: "INFERRED",
      isActive: true,
    };

    const shaped = shapeExplicitEdgeRow(row);

    expect(shaped).not.toBeNull();
    expect(shaped?.id).toBe("kne-edge-active-inferred");
    expect(shaped?.tier).toBe("INFERRED");
  });

  it("Test 10: an inactive edge is not shaped (excluded entirely)", () => {
    const row: ExplicitEdgeRow = {
      id: "edge-inactive-extracted",
      sourceNodeId: "00000000-0000-0000-0000-000000000001",
      targetRefId: "00000000-0000-0000-0000-000000000002",
      relationType: "evidenced_by",
      tier: "EXTRACTED",
      isActive: false,
    };

    expect(shapeExplicitEdgeRow(row)).toBeNull();
  });

  it("Test 11: a row with no targetRefId is not shaped", () => {
    const row: ExplicitEdgeRow = {
      id: "edge-no-target",
      sourceNodeId: "00000000-0000-0000-0000-000000000001",
      targetRefId: null,
      relationType: "co_occurs_with",
      tier: "EXTRACTED",
      isActive: true,
    };

    expect(shapeExplicitEdgeRow(row)).toBeNull();
  });

  it("Test 12: an active edge carries its confidence", () => {
    const row: ExplicitEdgeRow = {
      id: "edge-confidence",
      sourceNodeId: "00000000-0000-0000-0000-000000000001",
      targetRefId: "00000000-0000-0000-0000-000000000002",
      relationType: "co_occurs_with",
      tier: "INFERRED",
      isActive: true,
      confidence: 0.82,
    };

    const shaped = shapeExplicitEdgeRow(row);

    expect(shaped?.confidence).toBe(0.82);
  });

  it("Test 13: provenanceSummary is a plain string when provenance/source is present", () => {
    const row: ExplicitEdgeRow = {
      id: "edge-provenance",
      sourceNodeId: "00000000-0000-0000-0000-000000000001",
      targetRefId: "00000000-0000-0000-0000-000000000002",
      relationType: "co_occurs_with",
      tier: "INFERRED",
      isActive: true,
      source: "synthesis",
      provenance: { component_id: "c-1", page_index: 0, polygon: [], tokens: [] },
    };

    const shaped = shapeExplicitEdgeRow(row);

    expect(shaped?.provenanceSummary).toBe("Synthesized from region confirmation");
    expect(shaped?.provenanceSummary).not.toContain("{");
  });

  it("Test 14: provenanceSummary is undefined when provenance is null", () => {
    const row: ExplicitEdgeRow = {
      id: "edge-no-provenance",
      sourceNodeId: "00000000-0000-0000-0000-000000000001",
      targetRefId: "00000000-0000-0000-0000-000000000002",
      relationType: "co_occurs_with",
      tier: "EXTRACTED",
      isActive: true,
      source: "manual",
      provenance: null,
    };

    const shaped = shapeExplicitEdgeRow(row);

    expect(shaped?.provenanceSummary).toBeUndefined();
  });

  it("Test 15: inactive and null-target regressions preserved with the new optional fields present", () => {
    const inactiveRow: ExplicitEdgeRow = {
      id: "edge-inactive-2",
      sourceNodeId: "00000000-0000-0000-0000-000000000001",
      targetRefId: "00000000-0000-0000-0000-000000000002",
      relationType: "evidenced_by",
      tier: "EXTRACTED",
      isActive: false,
      confidence: 1,
      source: "manual",
      provenance: { anything: true },
    };
    expect(shapeExplicitEdgeRow(inactiveRow)).toBeNull();

    const nullTargetRow: ExplicitEdgeRow = {
      id: "edge-null-target-2",
      sourceNodeId: "00000000-0000-0000-0000-000000000001",
      targetRefId: undefined,
      relationType: "co_occurs_with",
      tier: "EXTRACTED",
      isActive: true,
      confidence: 1,
    };
    expect(shapeExplicitEdgeRow(nullTargetRow)).toBeNull();
  });
});

describe("buildProvenanceSummary", () => {
  it("Test 16: returns undefined when provenance is undefined", () => {
    expect(buildProvenanceSummary("synthesis", undefined)).toBeUndefined();
  });

  it("Test 17: returns undefined for an unrecognized source even with provenance present", () => {
    expect(buildProvenanceSummary("unknown_source", { a: 1 })).toBeUndefined();
  });

  it("Test 18: maps each known source to its plain-text descriptor", () => {
    expect(buildProvenanceSummary("synthesis", { a: 1 })).toBe(
      "Synthesized from region confirmation",
    );
    expect(buildProvenanceSummary("learned_from_correction", { a: 1 })).toBe(
      "Learned from a correction",
    );
    expect(buildProvenanceSummary("manual", { a: 1 })).toBe("Added manually");
  });
});
