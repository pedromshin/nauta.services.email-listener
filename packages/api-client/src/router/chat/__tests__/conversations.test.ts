/**
 * conversations.test.ts — DB-free unit tests for the chat conversation input
 * schemas + the D-10 remember-last-used pure helper (mirrors
 * entities/gallery.test.ts's shapeGalleryItem / listInputSchema pattern).
 *
 * Test plan:
 *   Test 1: resolveDefaultModelId returns the explicitly requested modelId when provided.
 *   Test 2: resolveDefaultModelId falls back to the last-used modelId when none requested (D-10).
 *   Test 3: resolveDefaultModelId falls back to DEFAULT_CHAT_MODEL_ID with no request and no history.
 *   Test 4: createConversationInputSchema accepts an omitted modelId (optional).
 *   Test 5: createConversationInputSchema rejects a non-uuid importerId.
 *   Test 6: renameConversationInputSchema requires a non-empty title, capped at 200 chars.
 *   Test 7: renameConversationInputSchema rejects a non-uuid id.
 *   Test 8: deleteConversationInputSchema requires a uuid id.
 *   Test 9: listConversationsInputSchema importerId is optional and uuid-validated.
 *   Test 10: duplicateConversationInputSchema requires a uuid id.
 *   Test 11: duplicateTitleFor prefixes "Copy of " and caps at 200 chars.
 *   Test 12: remapSiblingGroupIds mints ONE fresh uuid per source group,
 *            keeps null groups null, and never reuses a source id.
 */

import { describe, expect, it } from "vitest";

import {
  createConversationInputSchema,
  DEFAULT_CHAT_MODEL_ID,
  deleteConversationInputSchema,
  duplicateConversationInputSchema,
  duplicateTitleFor,
  listConversationsInputSchema,
  remapSiblingGroupIds,
  renameConversationInputSchema,
  resolveDefaultModelId,
} from "../conversations";

describe("resolveDefaultModelId (D-10 remember-last-used)", () => {
  it("Test 1: returns the explicitly requested modelId when provided", () => {
    expect(resolveDefaultModelId("some-model", "last-used-model")).toBe(
      "some-model",
    );
  });

  it("Test 2: falls back to the last-used modelId when none requested", () => {
    expect(resolveDefaultModelId(undefined, "last-used-model")).toBe(
      "last-used-model",
    );
  });

  it("Test 3: falls back to DEFAULT_CHAT_MODEL_ID with no request and no history", () => {
    expect(resolveDefaultModelId(undefined, null)).toBe(
      DEFAULT_CHAT_MODEL_ID,
    );
    expect(resolveDefaultModelId(undefined, undefined)).toBe(
      DEFAULT_CHAT_MODEL_ID,
    );
  });
});

describe("createConversationInputSchema", () => {
  it("Test 4: accepts an omitted modelId (optional, resolved server-side)", () => {
    const parsed = createConversationInputSchema.parse({});
    expect(parsed.modelId).toBeUndefined();
  });

  it("Test 5: rejects a non-uuid importerId", () => {
    expect(() =>
      createConversationInputSchema.parse({ importerId: "not-a-uuid" }),
    ).toThrow();
  });
});

describe("renameConversationInputSchema", () => {
  const VALID_ID = "00000000-0000-0000-0000-000000000001";

  it("Test 6: requires a non-empty title, capped at 200 chars", () => {
    expect(() =>
      renameConversationInputSchema.parse({ id: VALID_ID, title: "" }),
    ).toThrow();
    expect(() =>
      renameConversationInputSchema.parse({
        id: VALID_ID,
        title: "a".repeat(201),
      }),
    ).toThrow();
    expect(
      renameConversationInputSchema.parse({
        id: VALID_ID,
        title: "a".repeat(200),
      }).title,
    ).toHaveLength(200);
  });

  it("Test 7: rejects a non-uuid id", () => {
    expect(() =>
      renameConversationInputSchema.parse({ id: "not-a-uuid", title: "x" }),
    ).toThrow();
  });
});

describe("deleteConversationInputSchema", () => {
  it("Test 8: requires a uuid id", () => {
    expect(() =>
      deleteConversationInputSchema.parse({ id: "not-a-uuid" }),
    ).toThrow();
    expect(
      deleteConversationInputSchema.parse({
        id: "00000000-0000-0000-0000-000000000001",
      }).id,
    ).toBe("00000000-0000-0000-0000-000000000001");
  });
});

describe("duplicateConversationInputSchema", () => {
  it("Test 10: requires a uuid id", () => {
    expect(() =>
      duplicateConversationInputSchema.parse({ id: "not-a-uuid" }),
    ).toThrow();
    expect(
      duplicateConversationInputSchema.parse({
        id: "00000000-0000-0000-0000-000000000001",
      }).id,
    ).toBe("00000000-0000-0000-0000-000000000001");
  });
});

describe("duplicateTitleFor", () => {
  it('Test 11: prefixes "Copy of " and caps at 200 chars', () => {
    expect(duplicateTitleFor("Freight quote")).toBe("Copy of Freight quote");
    const long = duplicateTitleFor("a".repeat(200));
    expect(long).toHaveLength(200);
    expect(long.startsWith("Copy of ")).toBe(true);
  });
});

describe("remapSiblingGroupIds (D-16 fresh per-group uuids)", () => {
  const GROUP_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const GROUP_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  it("Test 12: one fresh id per source group, null stays null, no source id reused", () => {
    const minted: string[] = [];
    let n = 0;
    const mint = (): string => {
      const id = `fresh-${++n}`;
      minted.push(id);
      return id;
    };

    const rows = [
      { siblingGroupId: null, turnIndex: 0 },
      { siblingGroupId: GROUP_A, turnIndex: 1 },
      { siblingGroupId: GROUP_A, turnIndex: 1 },
      { siblingGroupId: GROUP_B, turnIndex: 2 },
    ] as const;

    const remapped = remapSiblingGroupIds(rows, mint);

    // Null group untouched.
    expect(remapped[0]?.siblingGroupId).toBeNull();
    // Both GROUP_A rows share ONE fresh id (the navigator's grouping survives).
    expect(remapped[1]?.siblingGroupId).toBe(remapped[2]?.siblingGroupId);
    // Distinct source groups get distinct fresh ids.
    expect(remapped[3]?.siblingGroupId).not.toBe(remapped[1]?.siblingGroupId);
    // Exactly one mint per distinct source group.
    expect(minted).toHaveLength(2);
    // No source id survives into the output.
    for (const row of remapped) {
      expect([GROUP_A, GROUP_B]).not.toContain(row.siblingGroupId ?? "");
    }
    // Input rows are not mutated.
    expect(rows[1].siblingGroupId).toBe(GROUP_A);
    // Non-sibling fields ride along untouched.
    expect(remapped[3]?.turnIndex).toBe(2);
  });
});

describe("listConversationsInputSchema", () => {
  it("Test 9: importerId is optional and uuid-validated", () => {
    expect(listConversationsInputSchema.parse({}).importerId).toBeUndefined();
    expect(() =>
      listConversationsInputSchema.parse({ importerId: "not-a-uuid" }),
    ).toThrow();
  });
});
