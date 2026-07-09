/**
 * redirect.test.ts — unit tests for the pure route-guard + open-redirect
 * decision logic (T-43-P2-01, T-43-P2-04). Every case in the plan's
 * behavior block is asserted here before redirect.ts exists (RED).
 */

import { describe, expect, it } from "vitest";

import { resolveAuthRedirect, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("allows a same-origin relative path", () => {
    expect(safeNextPath("/emails/123")).toBe("/emails/123");
  });

  it("rejects a protocol-relative path (falls back home)", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
  });

  it("rejects an absolute URL (falls back home)", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
  });

  it("falls back home when the value is missing", () => {
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("resolveAuthRedirect", () => {
  it("redirects a signed-out visitor from a protected path to /login with redirectTo", () => {
    expect(
      resolveAuthRedirect({ pathname: "/chat", hasUser: false }),
    ).toEqual({ redirectTo: "/login?redirectTo=%2Fchat" });
  });

  it("does not redirect a signed-out visitor already on /login", () => {
    expect(
      resolveAuthRedirect({ pathname: "/login", hasUser: false }),
    ).toBeNull();
  });

  it("does not redirect a signed-out visitor on an /auth route", () => {
    expect(
      resolveAuthRedirect({ pathname: "/auth/callback", hasUser: false }),
    ).toBeNull();
  });

  it("passes an authenticated visitor through unredirected", () => {
    expect(
      resolveAuthRedirect({ pathname: "/chat", hasUser: true }),
    ).toBeNull();
  });
});
