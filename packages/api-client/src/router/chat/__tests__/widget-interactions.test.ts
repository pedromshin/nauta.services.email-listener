/**
 * widget-interactions.test.ts — DB-free unit tests for the
 * getWidgetInteractions input schema (Task 3, 24-03).
 */

import { describe, expect, it } from "vitest";

import { getWidgetInteractionsInputSchema } from "../widget-interactions";

describe("getWidgetInteractionsInputSchema", () => {
  it("Test 1: requires a uuid conversationId", () => {
    const parsed = getWidgetInteractionsInputSchema.parse({
      conversationId: "00000000-0000-0000-0000-000000000001",
    });
    expect(parsed.conversationId).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("Test 2: rejects a non-uuid conversationId", () => {
    expect(() =>
      getWidgetInteractionsInputSchema.parse({ conversationId: "not-a-uuid" }),
    ).toThrow();
  });
});
