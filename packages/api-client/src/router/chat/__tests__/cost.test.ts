/**
 * cost.test.ts — DB-free unit tests for shapeSessionCost (the pure helper
 * sessionCost delegates to) + sessionCostInputSchema (mirrors
 * conversations.test.ts's DB-free convention — this codebase has no
 * precedent for mocking ctx.db chains, only pure-helper + Zod-schema tests).
 *
 * Test plan:
 *   Test 1: shapeSessionCost returns 0 total + empty breakdown for no rows.
 *   Test 2: shapeSessionCost sums string costUsd values into a numeric total.
 *   Test 3: shapeSessionCost preserves per-row shape/order (run_id, model_id,
 *     input_tokens, output_tokens, cost_usd) with costUsd coerced to number.
 *   Test 4: sessionCostInputSchema requires a uuid conversationId.
 *   Test 5: sessionCostInputSchema importerId is optional and uuid-validated.
 */

import { describe, expect, it } from "vitest";

import {
  sessionCostInputSchema,
  shapeSessionCost,
  type CostLedgerRawRow,
} from "../cost";

describe("shapeSessionCost", () => {
  it("Test 1: returns 0 total and empty breakdown for no rows", () => {
    const result = shapeSessionCost([]);
    expect(result.totalCostUsd).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it("Test 2: sums string cost_usd values into a numeric total", () => {
    const rows: CostLedgerRawRow[] = [
      {
        runId: "run-1",
        modelId: "us.anthropic.claude-sonnet-4-6",
        inputTokens: 100,
        outputTokens: 50,
        costUsd: "0.001500",
      },
      {
        runId: "run-2",
        modelId: "deepseek/deepseek-chat",
        inputTokens: 200,
        outputTokens: 80,
        costUsd: "0.000350",
      },
    ];

    const result = shapeSessionCost(rows);

    expect(result.totalCostUsd).toBeCloseTo(0.00185, 6);
  });

  it("Test 3: preserves per-row shape/order with cost_usd coerced to number", () => {
    const rows: CostLedgerRawRow[] = [
      {
        runId: "run-1",
        modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        inputTokens: 10,
        outputTokens: 5,
        costUsd: "0.000020",
      },
      {
        runId: null,
        modelId: "webllm-gemma-3-4b",
        inputTokens: 40,
        outputTokens: 20,
        costUsd: "0",
      },
    ];

    const result = shapeSessionCost(rows);

    expect(result.breakdown).toEqual([
      {
        runId: "run-1",
        modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 0.00002,
      },
      {
        runId: null,
        modelId: "webllm-gemma-3-4b",
        inputTokens: 40,
        outputTokens: 20,
        costUsd: 0,
      },
    ]);
  });
});

describe("sessionCostInputSchema", () => {
  it("Test 4: requires a uuid conversationId", () => {
    expect(() =>
      sessionCostInputSchema.parse({ conversationId: "not-a-uuid" }),
    ).toThrow();
    expect(
      sessionCostInputSchema.parse({
        conversationId: "00000000-0000-0000-0000-000000000001",
      }).conversationId,
    ).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("Test 5: importerId is optional and uuid-validated", () => {
    expect(
      sessionCostInputSchema.parse({
        conversationId: "00000000-0000-0000-0000-000000000001",
      }).importerId,
    ).toBeUndefined();
    expect(() =>
      sessionCostInputSchema.parse({
        conversationId: "00000000-0000-0000-0000-000000000001",
        importerId: "not-a-uuid",
      }),
    ).toThrow();
  });
});
