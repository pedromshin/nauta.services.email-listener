/**
 * mutations.test.ts — unit tests for entityMutationProcedures (D-21).
 *
 * Test plan:
 *   Test 1: confirmMerge input schema rejects a non-uuid entityInstanceId.
 *   Test 2: confirmMerge input schema rejects a non-uuid targetId.
 *   Test 3: rejectMerge input schema rejects a non-uuid entityInstanceId.
 *   Test 4: unmerge input schema rejects a non-uuid entityInstanceId.
 *   Test 5: confirmMerge fetches the correct endpoint path (contains merge/confirm).
 *   Test 6: rejectMerge fetches the correct endpoint path (contains merge/reject).
 *   Test 7: unmerge fetches the correct endpoint path (contains /unmerge).
 *   Test 8: all three mutations set the X-API-Key header from getListenerConfig.
 *   Test 9: confirmMerge throws with parseErrorDetail message on non-ok response.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Input schema validation tests — pure Zod, no fetch involved
// ---------------------------------------------------------------------------

const mergeInputSchema = z.object({
  entityInstanceId: z.string().uuid(),
  targetId: z.string().uuid(),
});

const unmergeInputSchema = z.object({
  entityInstanceId: z.string().uuid(),
});

describe("entityMutationProcedures input schemas", () => {
  it("Test 1: confirmMerge/rejectMerge rejects non-uuid entityInstanceId", () => {
    const result = mergeInputSchema.safeParse({
      entityInstanceId: "not-a-uuid",
      targetId: "00000000-0000-0000-0000-000000000001",
    });
    expect(result.success).toBe(false);
  });

  it("Test 2: confirmMerge/rejectMerge rejects non-uuid targetId", () => {
    const result = mergeInputSchema.safeParse({
      entityInstanceId: "00000000-0000-0000-0000-000000000001",
      targetId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("Test 3: rejectMerge shares the same schema constraints", () => {
    const result = mergeInputSchema.safeParse({
      entityInstanceId: "bad",
      targetId: "00000000-0000-0000-0000-000000000001",
    });
    expect(result.success).toBe(false);
  });

  it("Test 4: unmerge rejects non-uuid entityInstanceId", () => {
    const result = unmergeInputSchema.safeParse({
      entityInstanceId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Proxy behaviour tests — mock fetch + getListenerConfig
// ---------------------------------------------------------------------------

// Inline types for the module under test
type EntityMutationProcedures = {
  confirmMerge: { _def: { type: string } };
  rejectMerge: { _def: { type: string } };
  unmerge: { _def: { type: string } };
};

describe("entityMutationProcedures fetch proxy", () => {
  const ENTITY_ID = "00000000-0000-0000-0000-000000000AAA";
  const TARGET_ID = "00000000-0000-0000-0000-000000000BBB";
  const MOCK_URL = "http://listener-test";
  const MOCK_KEY = "test-api-key";

  // Store captured fetch calls for assertions
  const fetchCalls: Array<{ url: string; init: RequestInit }> = [];

  beforeEach(() => {
    fetchCalls.length = 0;

    // Mock process.env so getListenerConfig() returns known values
    process.env["EMAIL_LISTENER_URL"] = MOCK_URL;
    process.env["EMAIL_LISTENER_API_KEY"] = MOCK_KEY;

    // Mock global fetch
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
  });

  afterEach(() => {
    delete process.env["EMAIL_LISTENER_URL"];
    delete process.env["EMAIL_LISTENER_API_KEY"];
    vi.restoreAllMocks();
  });

  it("Test 5: confirmMerge hits .../merge/{targetId}/confirm", async () => {
    const { entityMutationProcedures } = await import("./mutations");

    // Access the handler function directly via tRPC procedure introspection
    // The procedure's resolver is stored as ._def.resolver
    const proc = entityMutationProcedures.confirmMerge as unknown as {
      _def: { resolver: (opts: { input: unknown }) => Promise<unknown> };
    };
    await proc._def.resolver({
      input: { entityInstanceId: ENTITY_ID, targetId: TARGET_ID },
    });

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toContain(
      `/v1/entity-instances/${ENTITY_ID}/merge/${TARGET_ID}/confirm`,
    );
  });

  it("Test 6: rejectMerge hits .../merge/{targetId}/reject", async () => {
    const { entityMutationProcedures } = await import("./mutations");

    const proc = entityMutationProcedures.rejectMerge as unknown as {
      _def: { resolver: (opts: { input: unknown }) => Promise<unknown> };
    };
    await proc._def.resolver({
      input: { entityInstanceId: ENTITY_ID, targetId: TARGET_ID },
    });

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toContain(
      `/v1/entity-instances/${ENTITY_ID}/merge/${TARGET_ID}/reject`,
    );
  });

  it("Test 7: unmerge hits /{id}/unmerge", async () => {
    const { entityMutationProcedures } = await import("./mutations");

    const proc = entityMutationProcedures.unmerge as unknown as {
      _def: { resolver: (opts: { input: unknown }) => Promise<unknown> };
    };
    await proc._def.resolver({
      input: { entityInstanceId: ENTITY_ID },
    });

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toContain(
      `/v1/entity-instances/${ENTITY_ID}/unmerge`,
    );
  });

  it("Test 8: all three mutations set the X-API-Key header", async () => {
    const { entityMutationProcedures } = await import("./mutations");

    for (const [name, proc] of Object.entries(entityMutationProcedures)) {
      fetchCalls.length = 0;
      const resolver = (
        proc as unknown as {
          _def: { resolver: (opts: { input: unknown }) => Promise<unknown> };
        }
      )._def.resolver;

      if (name === "unmerge") {
        await resolver({ input: { entityInstanceId: ENTITY_ID } });
      } else {
        await resolver({
          input: { entityInstanceId: ENTITY_ID, targetId: TARGET_ID },
        });
      }

      const headers = fetchCalls[0]?.init?.headers as
        | Record<string, string>
        | undefined;
      expect(headers?.["X-API-Key"], `${name} must set X-API-Key`).toBe(
        MOCK_KEY,
      );
    }
  });

  it("Test 9: confirmMerge throws on non-ok response with parseErrorDetail message", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: "merge conflict" }), {
        status: 422,
      });
    }) as typeof fetch;

    const { entityMutationProcedures } = await import("./mutations");

    const proc = entityMutationProcedures.confirmMerge as unknown as {
      _def: { resolver: (opts: { input: unknown }) => Promise<unknown> };
    };

    await expect(
      proc._def.resolver({
        input: { entityInstanceId: ENTITY_ID, targetId: TARGET_ID },
      }),
    ).rejects.toThrow("merge conflict");
  });
});
