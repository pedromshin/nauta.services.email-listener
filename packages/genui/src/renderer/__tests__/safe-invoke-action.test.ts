/**
 * safe-invoke-action.test.ts — a failing action handler is NORMAL, never a crash.
 *
 * The ActionRegistry is the host-injection seam: host handlers do real, often-async work
 * and can throw synchronously or return a rejected promise. safeInvokeAction must neutralise
 * BOTH so a malformed/failing model-driven action never escapes into the React surface, while
 * still logging the failure server-side (never silently swallowed).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { safeInvokeAction } from "../safe-invoke-action";

describe("safeInvokeAction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes a synchronous handler through and does not log on success", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn(() => undefined);

    safeInvokeAction(() => handler(), "button:navigate");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("catches a synchronous throw — the failure never escapes, and is logged", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      safeInvokeAction(() => {
        throw new Error("boom-sync");
      }, "button:setState"),
    ).not.toThrow();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("[genui/action]");
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("button:setState");
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("boom-sync");
  });

  it("catches a rejected-promise return — no unhandled rejection, logged once", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const unhandled = vi.fn();
    // If safeInvokeAction failed to consume the rejection, this would fire.
    process.on("unhandledRejection", unhandled);

    safeInvokeAction(
      () => Promise.reject(new Error("boom-async")),
      "form:submit",
    );

    // Let the rejection microtask settle.
    await Promise.resolve();
    await Promise.resolve();

    process.off("unhandledRejection", unhandled);

    expect(unhandled).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("form:submit");
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("boom-async");
  });

  it("passes a resolving-promise handler through without logging", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    safeInvokeAction(() => Promise.resolve("ok"), "button:query-refresh");
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("ignores a non-thenable return value (e.g. a plain object)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      safeInvokeAction(() => ({ not: "a promise" }), "button:navigate"),
    ).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
