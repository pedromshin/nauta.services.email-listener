import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createCapabilityRegistry,
  defineCapability,
  type Capability,
} from "../capability.js";
import {
  registerExternal,
  vetCandidate,
  type ExternalCapability,
  type ExternalCapabilityCandidate,
} from "../vetting.js";

type TestCtx = { readonly now: number };
type TestScope = { readonly touches: readonly string[] };

const candidate = (
  trust: ExternalCapabilityCandidate["trust"],
): ExternalCapabilityCandidate => ({
  id: "mcp.weather.lookup",
  describe: "Looks up current weather via an external MCP server.",
  originUrl: "https://example.com/mcp/weather",
  claimedRisk: "read",
  claimedCost: "cheap",
  source: "external",
  trust,
});

const external = (
  trust: ExternalCapability<TestCtx, TestScope>["trust"],
  id = "mcp.weather.lookup",
): ExternalCapability<TestCtx, TestScope> =>
  defineCapability<{ q: string }, { a: string }, TestCtx, TestScope>({
    id,
    input: z.object({ q: z.string() }).strict(),
    output: z.object({ a: z.string() }).strict(),
    risk: "read",
    cost: "cheap",
    describe: "External adapter for tests.",
    source: "external",
    trust,
    scope: (input) => ({ touches: [input.q] }),
    execute: async (input) => ({ a: input.q }),
  }) as unknown as ExternalCapability<TestCtx, TestScope>;

const builtinRegistry = () => {
  const descriptors: readonly Capability<never, never, TestCtx, TestScope>[] = [
    defineCapability<{ v: string }, { v: string }, TestCtx, TestScope>({
      id: "builtin.echo",
      input: z.object({ v: z.string() }).strict(),
      output: z.object({ v: z.string() }).strict(),
      risk: "read",
      cost: "free",
      describe: "Builtin echo.",
      source: "builtin",
      trust: "first-party",
      scope: (input) => ({ touches: [input.v] }),
      execute: async (input) => input,
    }),
  ] as unknown as readonly Capability<never, never, TestCtx, TestScope>[];
  return createCapabilityRegistry<TestCtx, TestScope>(descriptors);
};

describe("vetCandidate", () => {
  it("promotes unvetted -> claimed with a human-attributed record", () => {
    const { candidate: promoted, record } = vetCandidate(candidate("unvetted"), {
      vettedBy: "pedro",
      rationale: "Read the manifest; claims look coherent.",
    });
    expect(promoted.trust).toBe("claimed");
    expect(record).toMatchObject({
      candidateId: "mcp.weather.lookup",
      from: "unvetted",
      to: "claimed",
      vettedBy: "pedro",
    });
    expect(Date.parse(record.at)).not.toBeNaN();
  });

  it("promotes claimed -> verified", () => {
    const { candidate: promoted } = vetCandidate(candidate("claimed"), {
      vettedBy: "pedro",
      rationale: "Exercised against the live server; risk claim holds.",
    });
    expect(promoted.trust).toBe("verified");
  });

  it("does not mutate the input candidate", () => {
    const original = candidate("unvetted");
    vetCandidate(original, { vettedBy: "pedro", rationale: "ok" });
    expect(original.trust).toBe("unvetted");
  });

  it("refuses to promote past verified", () => {
    expect(() =>
      vetCandidate(candidate("verified"), { vettedBy: "pedro", rationale: "again" }),
    ).toThrow(/no further promotion/);
  });

  it("refuses a promotion without a named human", () => {
    expect(() =>
      vetCandidate(candidate("unvetted"), { vettedBy: "  ", rationale: "looks fine" }),
    ).toThrow(/vettedBy is empty/);
  });

  it("refuses a promotion without a rationale", () => {
    expect(() =>
      vetCandidate(candidate("unvetted"), { vettedBy: "pedro", rationale: "" }),
    ).toThrow(/rationale/);
  });
});

describe("registerExternal", () => {
  it("fails closed on unvetted entries, naming them", () => {
    expect(() => registerExternal(builtinRegistry(), [external("unvetted")])).toThrow(
      /unvetted.*"mcp\.weather\.lookup"/,
    );
  });

  it("fails closed even when unvetted entries are mixed with vetted ones", () => {
    expect(() =>
      registerExternal(builtinRegistry(), [
        external("verified", "mcp.ok"),
        external("unvetted", "mcp.bad"),
      ]),
    ).toThrow(/"mcp\.bad"/);
  });

  it("admits claimed and verified entries alongside builtins", () => {
    const registry = registerExternal(builtinRegistry(), [
      external("claimed", "mcp.claimed"),
      external("verified", "mcp.verified"),
    ]);
    expect(registry.ids).toEqual(["builtin.echo", "mcp.claimed", "mcp.verified"]);
    expect(registry.get("mcp.verified")?.trust).toBe("verified");
    expect(registry.list().map((e) => e.trust)).toEqual([
      "first-party",
      "claimed",
      "verified",
    ]);
  });

  it("leaves the base registry untouched", () => {
    const base = builtinRegistry();
    registerExternal(base, [external("verified")]);
    expect(base.ids).toEqual(["builtin.echo"]);
    expect(base.get("mcp.weather.lookup")).toBeUndefined();
  });

  it("rejects id collisions with builtins via the underlying constructor", () => {
    expect(() =>
      registerExternal(builtinRegistry(), [external("verified", "builtin.echo")]),
    ).toThrow(/duplicate capability id/);
  });
});
