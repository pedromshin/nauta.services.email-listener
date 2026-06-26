/**
 * list.test.ts — unit tests for the knowledge.list input schema.
 *
 * DB-free: validates the Zod input schema bounds, defaults, and allow-lists.
 *
 * Test plan:
 *   Test 1: listKnowledgeInputSchema limit defaults to 25.
 *   Test 2: listKnowledgeInputSchema limit rejects values below 1.
 *   Test 3: listKnowledgeInputSchema limit rejects values above 100.
 *   Test 4: listKnowledgeInputSchema offset defaults to 0.
 *   Test 5: listKnowledgeInputSchema offset rejects negative values.
 *   Test 6: listKnowledgeInputSchema importerId is optional.
 *   Test 7: listKnowledgeInputSchema importerId must be a UUID when provided.
 */

import { describe, expect, it } from "vitest";

import { listKnowledgeInputSchema } from "./list";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listKnowledgeInputSchema — limit", () => {
  it("Test 1: limit defaults to 25", () => {
    const parsed = listKnowledgeInputSchema.parse({});
    expect(parsed.limit).toBe(25);
  });

  it("Test 2: limit rejects values below 1", () => {
    expect(() => listKnowledgeInputSchema.parse({ limit: 0 })).toThrow();
  });

  it("Test 3: limit rejects values above 100", () => {
    expect(() => listKnowledgeInputSchema.parse({ limit: 101 })).toThrow();
    expect(listKnowledgeInputSchema.parse({ limit: 100 }).limit).toBe(100);
  });
});

describe("listKnowledgeInputSchema — offset", () => {
  it("Test 4: offset defaults to 0", () => {
    const parsed = listKnowledgeInputSchema.parse({});
    expect(parsed.offset).toBe(0);
  });

  it("Test 5: offset rejects negative values", () => {
    expect(() => listKnowledgeInputSchema.parse({ offset: -1 })).toThrow();
  });
});

describe("listKnowledgeInputSchema — importerId", () => {
  it("Test 6: importerId is optional (omitting is valid)", () => {
    const parsed = listKnowledgeInputSchema.parse({});
    expect(parsed.importerId).toBeUndefined();
  });

  it("Test 7: importerId must be a UUID when provided", () => {
    expect(() =>
      listKnowledgeInputSchema.parse({ importerId: "not-a-uuid" }),
    ).toThrow();

    const parsed = listKnowledgeInputSchema.parse({
      importerId: "00000000-0000-0000-0000-000000000001",
    });
    expect(parsed.importerId).toBe("00000000-0000-0000-0000-000000000001");
  });
});
