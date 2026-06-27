/**
 * schema/__tests__/allowlists.test.ts — Three allowlist enforcement tests (Task 1).
 *
 * Covers STRIDE threats T-13-01..T-13-07 and success criteria 1-6 from 13-01-PLAN.md:
 *   1. DataBindingSchema rejects non-allowlisted procedure (SAFE-03 / T-13-01)
 *   2. DataBindingSchema rejects UUID-shaped param value (GR-15 / T-13-02)
 *   3. navigate rejects javascript:/external/non-slash href; accepts "/path" (SAFE-04 / T-13-03)
 *   4. mutate cannot name any procedure — ALLOWED_MUTATIONS is empty (SEAM-02 / T-13-04)
 *   5. SpecRootSchema.safeParse(SAFE_FALLBACK_SPEC).success === true (GEN-03 / D-07)
 *   6. A spec with an unregistered node type fails safeParse (SAFE-02 / T-13-07)
 *
 * Bounds regression (SAFE-06 / D-20):
 *   7. Over-node-budget spec (201 nodes) fails safeParse
 *   8. Over-depth-budget spec (depth 9) fails safeParse
 */

import { describe, expect, it } from "vitest";

import { DataBindingSchema } from "../data-binding-schema";
import { ActionSchema } from "../action-schema";
import { ALLOWED_PROCEDURES, ALLOWED_MUTATIONS } from "../allowlists";
import { SAFE_FALLBACK_SPEC } from "../safe-fallback-spec";
import { SpecRootSchema } from "../spec-schema";

// ===========================================================================
// Block 1: DataBindingSchema — procedure allowlist (T-13-01 / SAFE-03)
// ===========================================================================

describe("DataBindingSchema — procedure allowlist (SAFE-03 / T-13-01)", () => {
  it("accepts an allowlisted procedure without params", () => {
    const result = DataBindingSchema.safeParse({ procedure: "emails.list" });
    expect(result.success).toBe(true);
  });

  it("accepts an allowlisted procedure with valid params", () => {
    const result = DataBindingSchema.safeParse({
      procedure: "emails.byId",
      params: { folderId: "inbox" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts all ALLOWED_PROCEDURES values", () => {
    for (const proc of ALLOWED_PROCEDURES) {
      const result = DataBindingSchema.safeParse({ procedure: proc });
      expect(result.success, `Expected ${proc} to be accepted`).toBe(true);
    }
  });

  it("rejects a non-allowlisted procedure (admin.deleteAll)", () => {
    const result = DataBindingSchema.safeParse({ procedure: "admin.deleteAll" });
    expect(result.success).toBe(false);
  });

  it("rejects an arbitrary procedure not in the allowlist", () => {
    const result = DataBindingSchema.safeParse({ procedure: "users.create" });
    expect(result.success).toBe(false);
  });

  it("rejects empty string as procedure", () => {
    const result = DataBindingSchema.safeParse({ procedure: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing procedure field", () => {
    const result = DataBindingSchema.safeParse({ params: { key: "value" } });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = DataBindingSchema.safeParse({
      procedure: "emails.list",
      unknownField: true,
    });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Block 2: DataBindingSchema — UUID param rejection (T-13-02 / GR-15)
// ===========================================================================

describe("DataBindingSchema — UUID param rejection (GR-15 / T-13-02)", () => {
  it("rejects params containing a UUID-shaped string value", () => {
    const result = DataBindingSchema.safeParse({
      procedure: "emails.byId",
      params: { id: "11111111-1111-1111-1111-111111111111" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects params containing a UUID-shaped string (v4 format)", () => {
    const result = DataBindingSchema.safeParse({
      procedure: "entities.byId",
      params: { entityId: "550e8400-e29b-41d4-a716-446655440000" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts params with non-UUID string values", () => {
    const result = DataBindingSchema.safeParse({
      procedure: "emails.list",
      params: { folderId: "inbox", limit: 20, archived: false },
    });
    expect(result.success).toBe(true);
  });

  it("accepts params with numeric values (not UUID-shaped)", () => {
    const result = DataBindingSchema.safeParse({
      procedure: "emails.list",
      params: { page: 1 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts params with boolean values", () => {
    const result = DataBindingSchema.safeParse({
      procedure: "emails.list",
      params: { archived: true },
    });
    expect(result.success).toBe(true);
  });
});

// ===========================================================================
// Block 3: ActionSchema — navigate href allowlist (T-13-03 / SAFE-04)
// ===========================================================================

describe("ActionSchema — navigate href validation (SAFE-04 / T-13-03)", () => {
  it("accepts a relative path starting with /", () => {
    const result = ActionSchema.safeParse({
      type: "navigate",
      href: "/emails/42",
    });
    expect(result.success).toBe(true);
  });

  it("accepts / (root path)", () => {
    const result = ActionSchema.safeParse({ type: "navigate", href: "/" });
    expect(result.success).toBe(true);
  });

  it("accepts nested relative path", () => {
    const result = ActionSchema.safeParse({
      type: "navigate",
      href: "/entities/email/detail",
    });
    expect(result.success).toBe(true);
  });

  it("rejects javascript: scheme", () => {
    const result = ActionSchema.safeParse({
      type: "navigate",
      href: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("rejects data: scheme", () => {
    const result = ActionSchema.safeParse({
      type: "navigate",
      href: "data:text/html,<script>alert(1)</script>",
    });
    expect(result.success).toBe(false);
  });

  it("rejects https:// (external absolute URL)", () => {
    const result = ActionSchema.safeParse({
      type: "navigate",
      href: "https://evil.com/steal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects http:// (external absolute URL)", () => {
    const result = ActionSchema.safeParse({
      type: "navigate",
      href: "http://evil.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects protocol-relative // (allows MITM)", () => {
    const result = ActionSchema.safeParse({
      type: "navigate",
      href: "//evil.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects path without leading / (would be relative-to-current)", () => {
    const result = ActionSchema.safeParse({
      type: "navigate",
      href: "emails",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty href", () => {
    const result = ActionSchema.safeParse({
      type: "navigate",
      href: "",
    });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Block 4: ActionSchema — setState validation
// ===========================================================================

describe("ActionSchema — setState (D-14)", () => {
  it("accepts a valid setState action", () => {
    const result = ActionSchema.safeParse({
      type: "setState",
      key: "isOpen",
      value: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts setState with a string value", () => {
    const result = ActionSchema.safeParse({
      type: "setState",
      key: "filter",
      value: "inbox",
    });
    expect(result.success).toBe(true);
  });

  it("accepts setState with a numeric value", () => {
    const result = ActionSchema.safeParse({
      type: "setState",
      key: "count",
      value: 42,
    });
    expect(result.success).toBe(true);
  });

  it("rejects setState with key exceeding 64 characters", () => {
    const result = ActionSchema.safeParse({
      type: "setState",
      key: "a".repeat(65),
      value: true,
    });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Block 5: ActionSchema — mutate is empty seam (SEAM-02 / T-13-04)
// ===========================================================================

describe("ActionSchema — mutate is empty seam (SEAM-02 / T-13-04)", () => {
  it("ALLOWED_MUTATIONS is empty (no live mutations in v1.1)", () => {
    expect(ALLOWED_MUTATIONS).toHaveLength(0);
  });

  it("mutate with any procedure name fails safeParse (empty seam)", () => {
    // The branch is grammar-present but no procedure name is allowlisted
    const result = ActionSchema.safeParse({
      type: "mutate",
      procedure: "emails.archive",
      params: {},
    });
    expect(result.success).toBe(false);
  });

  it("mutate with an empty string procedure fails safeParse", () => {
    const result = ActionSchema.safeParse({
      type: "mutate",
      procedure: "",
      params: {},
    });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Block 6: SAFE_FALLBACK_SPEC — valid SpecRoot (GEN-03 / D-07)
// ===========================================================================

describe("SAFE_FALLBACK_SPEC (GEN-03 / D-07)", () => {
  it("SAFE_FALLBACK_SPEC passes SpecRootSchema.safeParse", () => {
    const result = SpecRootSchema.safeParse(SAFE_FALLBACK_SPEC);
    expect(result.success).toBe(true);
  });

  it("SAFE_FALLBACK_SPEC has v: 1", () => {
    expect(SAFE_FALLBACK_SPEC.v).toBe(1);
  });

  it("SAFE_FALLBACK_SPEC root is an alert node", () => {
    expect(SAFE_FALLBACK_SPEC.root.type).toBe("alert");
  });

  it("SAFE_FALLBACK_SPEC has no data bindings", () => {
    expect((SAFE_FALLBACK_SPEC as Record<string, unknown>).data).toBeUndefined();
  });

  it("SAFE_FALLBACK_SPEC has no state", () => {
    expect((SAFE_FALLBACK_SPEC as Record<string, unknown>).state).toBeUndefined();
  });
});

// ===========================================================================
// Block 7: Unregistered component type fails safeParse (SAFE-02 / T-13-07)
// ===========================================================================

describe("SpecRootSchema — unregistered node type rejected (SAFE-02 / T-13-07)", () => {
  it("rejects a spec with an unknown component type", () => {
    const result = SpecRootSchema.safeParse({
      v: 1,
      root: { type: "data-table", caption: "Hello" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a spec with a hallucinated type", () => {
    const result = SpecRootSchema.safeParse({
      v: 1,
      root: { type: "custom-widget-xyz" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a spec with a valid registered type", () => {
    const result = SpecRootSchema.safeParse({
      v: 1,
      root: {
        type: "alert",
        title: "Hello",
      },
    });
    expect(result.success).toBe(true);
  });
});

// ===========================================================================
// Block 8: Bounds regression (SAFE-06 / D-20)
// ===========================================================================

describe("SpecRootSchema — depth/node bounds still active (SAFE-06 / D-20)", () => {
  it("rejects a spec with 201 nodes (over MAX_SPEC_NODES)", () => {
    // Build a flat stack of 200 text children + 1 container = 201 total
    const children = Array.from({ length: 200 }, () => ({
      type: "text" as const,
      content: "x",
    }));
    const result = SpecRootSchema.safeParse({
      v: 1,
      root: { type: "stack", children },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a spec with depth 9 (over MAX_SPEC_DEPTH)", () => {
    // Build a nested stack 9 deep
    const buildNested = (depth: number): Record<string, unknown> => {
      if (depth === 0) return { type: "text", content: "leaf" };
      return { type: "stack", children: [buildNested(depth - 1)] };
    };
    const result = SpecRootSchema.safeParse({
      v: 1,
      root: buildNested(9), // depth 9 = stack(stack(stack(... text))) 9 levels
    });
    expect(result.success).toBe(false);
  });
});
