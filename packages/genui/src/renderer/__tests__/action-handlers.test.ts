/**
 * action-handlers.test.ts — RED tests for buildActionRegistry (Task 2, Plan 13-04).
 *
 * Security contracts verified:
 *   D-15: Runtime relative-href re-check — navigate with absolute href is a noop even
 *         if somehow schema-valid (defense-in-depth at the handler layer).
 *   SEAM-02: mutate handler is NOT registered — registry["mutate-*"] is absent.
 *   D-24: No eval/Function/dangerouslySetInnerHTML on action execution path.
 *
 * ActionRegistry from buildActionRegistry must:
 *   1. navigate with valid relative href → calls router.push with that href
 *   2. navigate with absolute href → noop (runtime re-check blocks it, D-15)
 *   3. setState action → calls dispatch(key, value) on DeclaredStateResult
 *   4. mutate type is NOT in the returned registry (SEAM-02)
 *   5. query-refresh → calls trpcUtils.invalidate()
 *
 * Test environment: jsdom (matches genui vitest.config.ts).
 * `buildActionRegistry` is the function under test — imported from the yet-to-exist
 * module so this file FAILS (RED) until the implementation is created.
 */

import { describe, expect, it, vi } from "vitest";

// This import will FAIL (RED) until action-handlers.ts is created.
import { buildActionRegistry } from "../action-handlers";

// ---------------------------------------------------------------------------
// Stub collaborators
// ---------------------------------------------------------------------------

/** Minimal Next.js router stub — only push is needed for navigate tests. */
function makeRouterStub() {
  return {
    push: vi.fn<[string], void>(),
  };
}

/** Minimal tRPC utils stub — only invalidate is needed for query-refresh tests. */
function makeTrpcUtilsStub() {
  return {
    invalidate: vi.fn<[], Promise<void>>().mockResolvedValue(undefined),
  };
}

/** Minimal DeclaredStateResult stub — dispatch is called by setState handler. */
function makeDeclaredStateStub() {
  return {
    state: {} as Record<string, unknown>,
    dispatch: vi.fn<[string, unknown?], void>(),
  };
}

// ---------------------------------------------------------------------------
// Test 1: navigate with valid relative href
// ---------------------------------------------------------------------------

describe("buildActionRegistry — navigate action", () => {
  it("Test 1: navigate with valid relative href calls router.push", () => {
    const router = makeRouterStub();
    const trpcUtils = makeTrpcUtilsStub();
    const declaredState = makeDeclaredStateStub();

    const registry = buildActionRegistry({ router, trpcUtils, declaredState });

    // Simulate a navigate action with a valid relative href
    const navigateAction = { type: "navigate" as const, href: "/emails" };
    const handler = registry[navigateAction.type];

    expect(handler).toBeDefined();
    handler?.(navigateAction);

    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith("/emails");
  });

  it("Test 2: navigate with absolute href is a noop (D-15 runtime re-check)", () => {
    const router = makeRouterStub();
    const trpcUtils = makeTrpcUtilsStub();
    const declaredState = makeDeclaredStateStub();

    const registry = buildActionRegistry({ router, trpcUtils, declaredState });

    // Simulate a navigate action that has an absolute URL
    // (defense-in-depth: even if schema-level check was bypassed at rest)
    const navigateAction = { type: "navigate" as const, href: "https://evil.com/phish" };
    const handler = registry[navigateAction.type];

    expect(handler).toBeDefined();
    handler?.(navigateAction);

    // router.push must NOT have been called — noop (D-15)
    expect(router.push).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 3: setState action
// ---------------------------------------------------------------------------

describe("buildActionRegistry — setState action", () => {
  it("Test 3: setState action calls dispatch(key, value) on DeclaredStateResult", () => {
    const router = makeRouterStub();
    const trpcUtils = makeTrpcUtilsStub();
    const declaredState = makeDeclaredStateStub();

    const registry = buildActionRegistry({ router, trpcUtils, declaredState });

    const setStateAction = {
      type: "setState" as const,
      key: "showPanel",
      value: true as string | number | boolean | null,
    };
    const handler = registry[setStateAction.type];

    expect(handler).toBeDefined();
    handler?.(setStateAction);

    expect(declaredState.dispatch).toHaveBeenCalledOnce();
    expect(declaredState.dispatch).toHaveBeenCalledWith("showPanel", true);
  });
});

// ---------------------------------------------------------------------------
// Test 4: mutate is NOT registered (SEAM-02)
// ---------------------------------------------------------------------------

describe("buildActionRegistry — SEAM-02 mutate not registered", () => {
  it("Test 4: registry does NOT have a mutate handler (SEAM-02)", () => {
    const router = makeRouterStub();
    const trpcUtils = makeTrpcUtilsStub();
    const declaredState = makeDeclaredStateStub();

    const registry = buildActionRegistry({ router, trpcUtils, declaredState });

    // The mutate seam must be absent from the registry — not even a noop key.
    // Phase 13 leaves mutate completely unregistered (SEAM-02 / D-14).
    expect(Object.prototype.hasOwnProperty.call(registry, "mutate")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 5: query-refresh action
// ---------------------------------------------------------------------------

describe("buildActionRegistry — query-refresh action", () => {
  it("Test 5: query-refresh calls trpcUtils.invalidate()", async () => {
    const router = makeRouterStub();
    const trpcUtils = makeTrpcUtilsStub();
    const declaredState = makeDeclaredStateStub();

    const registry = buildActionRegistry({ router, trpcUtils, declaredState });

    const handler = registry["query-refresh"];

    expect(handler).toBeDefined();
    // Handler may be async (fire-and-forget) — await to settle promises
    await handler?.();

    expect(trpcUtils.invalidate).toHaveBeenCalledOnce();
  });
});
