/**
 * binding/__tests__/bind-capability.test.ts — the D2 proof, tested (REG-04 / INV-1,4,5).
 *
 * A genui spec that NAMES a capability must be able to perform a REAL query, and — gated by risk — a
 * REAL mutation; and an UNREGISTERED capability must FAIL CLOSED. These tests build a small in-test
 * registry (`createCapabilityRegistry` with fake capabilities), mirroring the capabilities package's
 * own test style, and drive the exact resolution path a canvas panel / chat runtime uses.
 *
 * Proven here:
 *   1. a registered capability binds and invokes (real query + real "mutation")
 *   2. an UNREGISTERED id fails closed (throwing + non-throwing variants)
 *   3. args failing the input schema are rejected (the Zod boundary, INV-1)
 *   4. risk is surfaced so a consumer can require a confirm for non-read (INV-4)
 *   5. output failing the output schema is refused; executor throws are caught
 */

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createCapabilityRegistry,
  defineCapability,
  type Capability,
} from "@polytoken/capabilities";

import {
  bindCapability,
  tryBindCapability,
} from "../bind-capability";
import { requiresConfirm } from "../risk-gate";
import { CapabilityBindingSchema } from "../descriptor";
import { CapabilityBindingError, isCapabilityBindingError } from "../errors";

// ---------------------------------------------------------------------------
// In-test registry — a fake read capability (a query) and a write capability (a mutation).
// The consumer's binding context (TCtx) and scope shape (TScope) are trivial stand-ins; the binding
// machinery is generic over both, so these exercise the SAME code a real consumer resolves through.
// ---------------------------------------------------------------------------

type TestCtx = { readonly tenant: string };
type TestScope = { readonly touches: readonly string[] };

const searchOrders = defineCapability<
  { query: string },
  { count: number; ids: readonly string[] },
  TestCtx,
  TestScope
>({
  id: "orders.search",
  input: z.object({ query: z.string().min(1) }).strict(),
  output: z.object({ count: z.number(), ids: z.array(z.string()) }).strict(),
  risk: "read",
  cost: "cheap",
  describe: "Search orders by free-text query — a real read a generated panel can run on render.",
  source: "builtin",
  trust: "first-party",
  scope: (input) => ({ touches: [`orders?q=${input.query}`] }),
  execute: async (input, ctx) => ({
    count: 2,
    ids: [`${ctx.tenant}:order-1:${input.query}`, `${ctx.tenant}:order-2`],
  }),
});

const cancelOrder = defineCapability<
  { orderId: string },
  { cancelled: boolean },
  TestCtx,
  TestScope
>({
  id: "orders.cancel",
  input: z.object({ orderId: z.string().min(1) }).strict(),
  output: z.object({ cancelled: z.boolean() }).strict(),
  risk: "write",
  cost: "moderate",
  describe: "Cancel an order — a real mutation, gated behind a confirm by INV-4.",
  source: "builtin",
  trust: "first-party",
  scope: (input) => ({ touches: [`orders/${input.orderId}`] }),
  execute: async () => ({ cancelled: true }),
});

const caps = [searchOrders, cancelOrder] as unknown as readonly Capability<
  never,
  never,
  TestCtx,
  TestScope
>[];
const registry = createCapabilityRegistry<TestCtx, TestScope>(caps);
const ctx: TestCtx = { tenant: "acme" };

// ---------------------------------------------------------------------------

describe("CapabilityBindingSchema — how a spec references a capability", () => {
  it("validates a descriptor naming a registry id (with optional static args)", () => {
    const parsed = CapabilityBindingSchema.safeParse({
      capabilityId: "orders.search",
      args: { query: "unshipped" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty id and stray keys (.strict / D-22)", () => {
    expect(CapabilityBindingSchema.safeParse({ capabilityId: "" }).success).toBe(false);
    expect(
      CapabilityBindingSchema.safeParse({ capabilityId: "orders.search", shell: true }).success,
    ).toBe(false);
  });

  it("validates SHAPE only — a well-formed descriptor may still name an unregistered id", () => {
    // The descriptor parses; failing closed happens at BIND time, not schema-parse time (INV-5).
    expect(CapabilityBindingSchema.safeParse({ capabilityId: "orders.ghost" }).success).toBe(true);
  });
});

describe("bindCapability — a registered capability binds and invokes (the real query)", () => {
  it("resolves the id and runs a real read, Zod-fenced on both sides", async () => {
    const bound = bindCapability(registry, { capabilityId: "orders.search" });
    expect(bound.id).toBe("orders.search");

    const result = await bound.invoke(ctx, { query: "unshipped" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).toEqual({
        count: 2,
        ids: ["acme:order-1:unshipped", "acme:order-2"],
      });
    }
  });

  it("accepts a bare id string as shorthand for a descriptor", async () => {
    const bound = bindCapability(registry, "orders.search");
    const output = await bound.invokeOrThrow(ctx, { query: "paid" });
    expect(output).toMatchObject({ count: 2 });
  });

  it("merges the descriptor's static args under runtime args (runtime wins)", async () => {
    const bound = bindCapability(registry, {
      capabilityId: "orders.search",
      args: { query: "default" },
    });
    // No runtime args → static args are used.
    const a = await bound.invoke(ctx);
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.output).toMatchObject({ ids: ["acme:order-1:default", "acme:order-2"] });
    // Runtime args override the static default.
    const b = await bound.invoke(ctx, { query: "override" });
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.output).toMatchObject({ ids: ["acme:order-1:override", "acme:order-2"] });
  });

  it("binds and (once confirmed by the consumer) runs a real mutation", async () => {
    const bound = bindCapability(registry, { capabilityId: "orders.cancel" });
    // INV-4: the consumer owns the confirm; the binding only tells it a confirm is required.
    expect(bound.requiresConfirm).toBe(true);
    const result = await bound.invoke(ctx, { orderId: "order-1" });
    expect(result).toEqual({ ok: true, output: { cancelled: true } });
  });
});

describe("INV-5 — an unregistered capability FAILS CLOSED", () => {
  it("bindCapability THROWS a CapabilityBindingError with code 'unregistered'", () => {
    let thrown: unknown;
    try {
      bindCapability(registry, { capabilityId: "orders.ghost" });
    } catch (e) {
      thrown = e;
    }
    expect(isCapabilityBindingError(thrown)).toBe(true);
    expect((thrown as CapabilityBindingError).code).toBe("unregistered");
    expect((thrown as CapabilityBindingError).capabilityId).toBe("orders.ghost");
  });

  it("tryBindCapability returns { ok: false } — a refusal, never a partial or silent no-op", () => {
    const result = tryBindCapability(registry, { capabilityId: "orders.ghost" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unregistered");
      expect(result.error.capabilityId).toBe("orders.ghost");
    }
  });

  it("ids are exact — a case variant does not resolve (matches the registry's contract)", () => {
    expect(tryBindCapability(registry, "ORDERS.SEARCH").ok).toBe(false);
  });

  it("an empty registry binds nothing (no capabilities = no universe)", () => {
    const empty = createCapabilityRegistry<TestCtx, TestScope>([]);
    expect(tryBindCapability(empty, "orders.search").ok).toBe(false);
  });

  it("a malformed descriptor is refused (still fail-closed, cannot become an invoker)", () => {
    // Missing capabilityId entirely.
    expect(() => bindCapability(registry, {} as never)).toThrow(CapabilityBindingError);
  });
});

describe("INV-1 — the Zod boundary rejects bad args BEFORE the executor runs", () => {
  it("args failing capability.input yield code 'invalid-args' and never call execute", async () => {
    // defineCapability freezes the descriptor, so we cannot spy a shared capability's execute —
    // instead the executor IS a mock fn (its reference is fixed; the mock records calls).
    const execFn = vi.fn(async () => ({ count: 1, ids: [] as string[] }));
    const probe = defineCapability<
      { query: string },
      { count: number; ids: string[] },
      TestCtx,
      TestScope
    >({
      id: "orders.probe",
      input: z.object({ query: z.string().min(1) }).strict(),
      output: z.object({ count: z.number(), ids: z.array(z.string()) }).strict(),
      risk: "read",
      cost: "free",
      describe: "A probe capability whose executor is a mock, to prove args gate before execute.",
      source: "builtin",
      trust: "first-party",
      scope: () => ({ touches: [] }),
      execute: execFn,
    });
    const reg = createCapabilityRegistry<TestCtx, TestScope>([
      probe,
    ] as unknown as readonly Capability<never, never, TestCtx, TestScope>[]);

    const bound = bindCapability(reg, { capabilityId: "orders.probe" });
    const result = await bound.invoke(ctx, { query: "" }); // fails .min(1)
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid-args");
    expect(execFn).not.toHaveBeenCalled();
  });

  it("a stray arg key is rejected (input schema is .strict())", async () => {
    const bound = bindCapability(registry, { capabilityId: "orders.search" });
    const result = await bound.invoke(ctx, { query: "ok", shell: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid-args");
  });

  it("parseArgs validates without executing — lets a consumer pre-check a form", () => {
    const bound = bindCapability(registry, { capabilityId: "orders.search" });
    expect(bound.parseArgs({ query: "ok" }).ok).toBe(true);
    expect(bound.parseArgs({ query: "" }).ok).toBe(false);
  });
});

describe("INV-1 — the output boundary refuses a mis-behaving executor", () => {
  // Purpose-built fakes (defineCapability freezes the descriptor, so executors are baked in, not spied).
  const badOutput = defineCapability<{ q: string }, { count: number }, TestCtx, TestScope>({
    id: "orders.badOutput",
    input: z.object({ q: z.string() }).strict(),
    output: z.object({ count: z.number() }).strict(),
    risk: "read",
    cost: "free",
    describe: "An executor that returns a value violating its own output schema.",
    source: "builtin",
    trust: "first-party",
    scope: () => ({ touches: [] }),
    execute: async () => ({ count: "two" } as unknown as { count: number }),
  });
  const thrower = defineCapability<{ q: string }, { count: number }, TestCtx, TestScope>({
    id: "orders.thrower",
    input: z.object({ q: z.string() }).strict(),
    output: z.object({ count: z.number() }).strict(),
    risk: "read",
    cost: "free",
    describe: "An executor that throws at runtime.",
    source: "builtin",
    trust: "first-party",
    scope: () => ({ touches: [] }),
    execute: async () => {
      throw new Error("db down");
    },
  });
  const reg = createCapabilityRegistry<TestCtx, TestScope>([
    badOutput,
    thrower,
  ] as unknown as readonly Capability<never, never, TestCtx, TestScope>[]);

  it("output failing capability.output yields code 'invalid-output'", async () => {
    const bound = bindCapability(reg, { capabilityId: "orders.badOutput" });
    const result = await bound.invoke(ctx, { q: "ok" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid-output");
  });

  it("an executor throw is caught and surfaced as code 'execute-failed'", async () => {
    const bound = bindCapability(reg, { capabilityId: "orders.thrower" });
    const result = await bound.invoke(ctx, { q: "ok" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("execute-failed");
  });

  it("invokeOrThrow throws the CapabilityBindingError on failure", async () => {
    const bound = bindCapability(registry, { capabilityId: "orders.search" });
    await expect(bound.invokeOrThrow(ctx, { query: "" })).rejects.toBeInstanceOf(
      CapabilityBindingError,
    );
  });
});

describe("INV-4 — risk is surfaced so a consumer can gate a confirm", () => {
  it("the bound capability carries its declared risk", () => {
    expect(bindCapability(registry, "orders.search").risk).toBe("read");
    expect(bindCapability(registry, "orders.cancel").risk).toBe("write");
  });

  it("requiresConfirm is false for read, true for every non-read tier", () => {
    expect(bindCapability(registry, "orders.search").requiresConfirm).toBe(false);
    expect(bindCapability(registry, "orders.cancel").requiresConfirm).toBe(true);
  });

  it("the requiresConfirm predicate expresses 'non-read gates' once (INV-4)", () => {
    expect(requiresConfirm("read")).toBe(false);
    expect(requiresConfirm("write")).toBe(true);
    expect(requiresConfirm("exec")).toBe(true);
  });
});
