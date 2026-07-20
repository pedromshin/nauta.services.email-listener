/**
 * __tests__/vendored-and-mustache.test.tsx — Backlog slices 999.13 / 999.2 / 999.8b.
 *
 * Block 1 (999.13): the 5 vendored @polytoken/ui components (number-ticker,
 *   spinner, avatar-stack, animated-list, marquee) are registered as spec types —
 *   wire schema round-trip + live render without NodeErrorFallback (CTLG-04 pattern).
 * Block 2 (999.2): grid colSpan — interpreter emits a clamped grid-column span
 *   wrapper (bounded 1-12, floor'd, no eval).
 * Block 3 (999.8b): text-node {{mustache}} interpolation — declared-state/data
 *   refs resolved via resolveDataRef, bounded, eval-free, fail-safe.
 */

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { COMPONENT_REGISTRY } from "../registry/component-registry";
import { SpecNodeSchema } from "../schema/spec-schema";
import { SpecRenderer } from "../renderer/spec-renderer";
import { resolveTemplateString } from "../renderer/render-node";
import type { RenderContext } from "../renderer/render-node";
import type { SpecRoot } from "../schema/spec-schema";

const FALLBACK_MARKER = "[!]";

function renderSpec(spec: SpecRoot): string {
  return renderToStaticMarkup(
    <SpecRenderer spec={spec} registry={COMPONENT_REGISTRY} />,
  );
}

function makeCtx(
  data: Record<string, unknown> = {},
  state: Record<string, unknown> = {},
): RenderContext {
  return { data, state, dispatch: () => undefined, registry: COMPONENT_REGISTRY };
}

// ===========================================================================
// Block 1: 999.13 — vendored components registered as spec types
// ===========================================================================

describe("999.13 — vendored components: wire schema round-trip", () => {
  it("SpecNodeSchema accepts a minimal valid 'number-ticker' node", () => {
    const result = SpecNodeSchema.safeParse({
      type: "number-ticker",
      value: 1284,
      "aria-label": "Total active users",
    });
    expect(result.success).toBe(true);
  });

  it("SpecNodeSchema rejects 'number-ticker' without required aria-label", () => {
    const result = SpecNodeSchema.safeParse({ type: "number-ticker", value: 5 });
    expect(result.success).toBe(false);
  });

  it("SpecNodeSchema rejects 'number-ticker' with out-of-bounds decimalPlaces", () => {
    const result = SpecNodeSchema.safeParse({
      type: "number-ticker",
      value: 5,
      "aria-label": "Count",
      decimalPlaces: 9,
    });
    expect(result.success).toBe(false);
  });

  it("SpecNodeSchema accepts a minimal valid 'spinner' node (requires label)", () => {
    expect(
      SpecNodeSchema.safeParse({ type: "spinner", label: "Loading results" }).success,
    ).toBe(true);
    expect(SpecNodeSchema.safeParse({ type: "spinner" }).success).toBe(false);
  });

  it("SpecNodeSchema accepts a minimal valid 'avatar-stack' node (requires aria-label + item alt)", () => {
    expect(
      SpecNodeSchema.safeParse({
        type: "avatar-stack",
        "aria-label": "Meeting attendees",
        items: [{ alt: "Alice Johnson" }],
      }).success,
    ).toBe(true);
    expect(
      SpecNodeSchema.safeParse({
        type: "avatar-stack",
        items: [{ alt: "Alice Johnson" }],
      }).success,
    ).toBe(false);
  });

  it("SpecNodeSchema accepts 'animated-list' with nested SpecNode children", () => {
    const result = SpecNodeSchema.safeParse({
      type: "animated-list",
      delay: 1500,
      children: [
        { type: "feed-item", title: "Alice replied" },
        { type: "feed-item", title: "Bob commented" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("SpecNodeSchema rejects 'animated-list' with out-of-bounds delay", () => {
    const result = SpecNodeSchema.safeParse({
      type: "animated-list",
      delay: 99999,
      children: [],
    });
    expect(result.success).toBe(false);
  });

  it("SpecNodeSchema accepts 'marquee' with children; rejects out-of-bounds repeat", () => {
    expect(
      SpecNodeSchema.safeParse({
        type: "marquee",
        pauseOnHover: true,
        children: [{ type: "badge", label: "Polytoken" }],
      }).success,
    ).toBe(true);
    expect(
      SpecNodeSchema.safeParse({ type: "marquee", repeat: 0, children: [] }).success,
    ).toBe(false);
  });
});

describe("999.13 — vendored components: live render (no NodeErrorFallback)", () => {
  it("number-ticker renders with its aria-label and no fallback", () => {
    const html = renderSpec({
      v: 1,
      root: {
        type: "number-ticker",
        value: 1284,
        "aria-label": "Total active users",
      },
    } as SpecRoot);
    expect(html).not.toContain(FALLBACK_MARKER);
    expect(html).toContain('aria-label="Total active users"');
  });

  it("spinner renders role=status with the provided label", () => {
    const html = renderSpec({
      v: 1,
      root: { type: "spinner", label: "Loading results", size: "lg" },
    } as SpecRoot);
    expect(html).not.toContain(FALLBACK_MARKER);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading results"');
  });

  it("avatar-stack renders a labelled group with initials fallbacks", () => {
    const html = renderSpec({
      v: 1,
      root: {
        type: "avatar-stack",
        "aria-label": "Meeting attendees",
        items: [{ alt: "Alice Johnson" }, { alt: "Bob Smith" }],
      },
    } as SpecRoot);
    expect(html).not.toContain(FALLBACK_MARKER);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Meeting attendees"');
    expect(html).toContain("AL"); // initials fallback from "Alice Johnson"
    expect(html).toContain("BO"); // initials fallback from "Bob Smith"
  });

  it("animated-list renders nested feed-item children through the interpreter", () => {
    const html = renderSpec({
      v: 1,
      root: {
        type: "animated-list",
        delay: 1500,
        children: [
          { type: "feed-item", title: "Alice replied" },
          { type: "feed-item", title: "Bob commented" },
        ],
      },
    } as unknown as SpecRoot);
    expect(html).not.toContain(FALLBACK_MARKER);
    // SSR shows the first (index 0) reveal — the item content renders via renderNode
    expect(html).toContain("Alice replied");
  });

  it("marquee renders repeated child content", () => {
    const html = renderSpec({
      v: 1,
      root: {
        type: "marquee",
        repeat: 3,
        children: [{ type: "badge", label: "Polytoken" }],
      },
    } as unknown as SpecRoot);
    expect(html).not.toContain(FALLBACK_MARKER);
    // repeat: 3 → three copies of the child strip
    expect(html.match(/Polytoken/g)?.length).toBe(3);
  });
});

// ===========================================================================
// Block 2: 999.2 — grid colSpan clamping (interpreter wrapper, no eval)
// ===========================================================================

describe("999.2 — grid colSpan clamping", () => {
  it("clamps colSpan above 12 down to span 12", () => {
    const html = renderSpec({
      v: 1,
      root: {
        type: "grid",
        cols: 12,
        children: [
          { type: "text", content: "Huge", colSpan: 40 },
          { type: "text", content: "Rest", colSpan: 4 },
        ],
      },
    } as unknown as SpecRoot);
    expect(html).toContain("span 12");
    expect(html).not.toContain("span 40");
  });

  it("clamps colSpan below 1 up to span 1", () => {
    const html = renderSpec({
      v: 1,
      root: {
        type: "grid",
        cols: 3,
        children: [
          { type: "text", content: "Tiny", colSpan: -5 },
          { type: "text", content: "Other", colSpan: 2 },
        ],
      },
    } as unknown as SpecRoot);
    expect(html).toContain("span 1");
    expect(html).not.toContain("span -5");
  });

  it("floors fractional colSpan values", () => {
    const html = renderSpec({
      v: 1,
      root: {
        type: "grid",
        cols: 4,
        children: [
          { type: "text", content: "Frac", colSpan: 2.9 },
          { type: "text", content: "Other", colSpan: 1 },
        ],
      },
    } as unknown as SpecRoot);
    expect(html).toContain("span 2");
    expect(html).not.toContain("span 2.9");
  });

  it("wire schema rejects colSpan 0 and 13 on a grid child", () => {
    expect(
      SpecNodeSchema.safeParse({ type: "text", content: "x", colSpan: 0 }).success,
    ).toBe(false);
    expect(
      SpecNodeSchema.safeParse({ type: "text", content: "x", colSpan: 13 }).success,
    ).toBe(false);
  });

  it("colSpan validates on the new vendored node types too (grid stat tiles)", () => {
    expect(
      SpecNodeSchema.safeParse({
        type: "number-ticker",
        value: 42,
        "aria-label": "Revenue",
        colSpan: 4,
      }).success,
    ).toBe(true);
  });
});

// ===========================================================================
// Block 3: 999.8b — {{mustache}} interpolation in text node content
// ===========================================================================

describe("999.8b — resolveTemplateString (unit)", () => {
  it("resolves {{data.*}} dotted-path refs", () => {
    const ctx = makeCtx({ user: { name: "Ada" } });
    expect(resolveTemplateString("Hello {{data.user.name}}!", ctx)).toBe("Hello Ada!");
  });

  it("resolves {{state.*}} declared-state refs", () => {
    const ctx = makeCtx({}, { count: 5 });
    expect(resolveTemplateString("Count: {{ state.count }}", ctx)).toBe("Count: 5");
  });

  it("interpolates booleans and numbers; missing refs become empty string", () => {
    const ctx = makeCtx({ flag: true }, {});
    expect(resolveTemplateString("{{data.flag}}/{{data.nope}}", ctx)).toBe("true/");
  });

  it("renders objects/arrays as empty string — never JSON, never code", () => {
    const ctx = makeCtx({ obj: { a: 1 }, arr: [1, 2] });
    expect(resolveTemplateString("{{data.obj}}{{data.arr}}", ctx)).toBe("");
  });

  it("leaves expression-like tokens verbatim (no eval — GR-01)", () => {
    const ctx = makeCtx({}, { count: 5 });
    const out = resolveTemplateString("{{state.count + 1}}", ctx);
    expect(out).toBe("{{state.count + 1}}");
  });

  it("prototype-pollution refs resolve to empty string (D-12 guard inherited)", () => {
    const ctx = makeCtx({}, {});
    expect(resolveTemplateString("{{state.__proto__.polluted}}", ctx)).toBe("");
    expect(resolveTemplateString("{{data.constructor.name}}", ctx)).toBe("");
  });

  it("unknown root buckets resolve to empty string", () => {
    const ctx = makeCtx({ x: 1 }, {});
    expect(resolveTemplateString("{{window.location}}", ctx)).toBe("");
  });

  it("is bounded — tokens beyond the substitution cap pass through verbatim", () => {
    const ctx = makeCtx({ v: "x" });
    const template = Array.from({ length: 40 }, () => "{{data.v}}").join(",");
    const out = resolveTemplateString(template, ctx);
    // First 32 substituted, remaining 8 left verbatim
    expect(out.match(/x/g)?.length).toBe(32);
    expect(out).toContain("{{data.v}}");
  });

  it("returns plain strings untouched (fast path)", () => {
    const ctx = makeCtx();
    expect(resolveTemplateString("no tokens here", ctx)).toBe("no tokens here");
  });
});

describe("999.8b — text node mustache interpolation (render integration)", () => {
  it("resolves declared-state refs inside text content", () => {
    const spec: SpecRoot = {
      v: 1,
      state: [{ name: "count", type: "number", initial: 7 }],
      root: { type: "text", content: "You have {{state.count}} items" },
    } as SpecRoot;
    const html = renderSpec(spec);
    expect(html).toContain("You have 7 items");
    expect(html).not.toContain("{{");
  });

  it("resolves data refs inside text content within a list itemTemplate", () => {
    const spec = {
      v: 1,
      data: { emails: [{ id: "a", from: "alice@example.com" }] },
      root: {
        type: "list",
        dataRef: "data.emails",
        itemKey: "id",
        itemTemplate: { type: "text", content: "From: {{data.item.from}}" },
      },
    } as unknown as SpecRoot;
    const html = renderToStaticMarkup(
      <SpecRenderer
        spec={spec}
        registry={COMPONENT_REGISTRY}
        data={{ emails: [{ id: "a", from: "alice@example.com" }] }}
      />,
    );
    expect(html).toContain("From: alice@example.com");
  });

  it("does NOT interpolate non-text nodes (badge label keeps tokens verbatim)", () => {
    const html = renderSpec({
      v: 1,
      root: { type: "badge", label: "{{state.count}}" },
    } as SpecRoot);
    expect(html).toContain("{{state.count}}");
  });

  it("missing refs render as empty string without a fallback", () => {
    const html = renderSpec({
      v: 1,
      root: { type: "text", content: "Value: {{data.missing.path}}" },
    } as SpecRoot);
    expect(html).not.toContain(FALLBACK_MARKER);
    expect(html).toContain("Value: ");
    expect(html).not.toContain("{{");
  });
});
