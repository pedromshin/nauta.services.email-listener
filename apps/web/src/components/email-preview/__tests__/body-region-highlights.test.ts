/**
 * body-region-highlights.test.ts — the pure matcher half of the body-region
 * highlighter (jsdom supports Range + TreeWalker; CSS.highlights is absent, so
 * the registry plumbing is feature-detected to a no-op and asserted as such).
 *
 * These cover the guarantees the visible bug fix depends on: text-anchored
 * matching that spans element boundaries, whitespace normalization, and the
 * "never draw a wrong box" skip.
 */

import { describe, expect, it } from "vitest";

import {
  applyBodyRegionHighlights,
  findBodyRegionRanges,
  normalizeWhitespace,
} from "../body-region-highlights";

function container(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe("normalizeWhitespace", () => {
  it("collapses runs and trims", () => {
    expect(normalizeWhitespace("  Olá   PEDRO,\n\t bordo ")).toBe(
      "Olá PEDRO, bordo",
    );
  });
});

describe("findBodyRegionRanges", () => {
  it("returns one range per found region, matching text across element boundaries", () => {
    const el = container(
      "<p>Olá <strong>PEDRO</strong>, você está quase a bordo.</p>",
    );
    const ranges = findBodyRegionRanges(el, [
      { contentText: "PEDRO, você está" },
    ]);
    expect(ranges).toHaveLength(1);
    // The matched text (whitespace-normalized) is contiguous in reading order
    // even though it spans <strong> and the following text node.
    expect(normalizeWhitespace(ranges[0]!.toString())).toBe("PEDRO, você está");
  });

  it("silently skips a region whose text is not present (never a wrong box)", () => {
    const el = container("<p>Olá PEDRO, você está quase a bordo.</p>");
    const ranges = findBodyRegionRanges(el, [
      { contentText: "this text is nowhere in the body" },
      { contentText: "quase a bordo" },
    ]);
    expect(ranges).toHaveLength(1);
    expect(normalizeWhitespace(ranges[0]!.toString())).toBe("quase a bordo");
  });

  it("skips empty / null region text", () => {
    const el = container("<p>Anything at all</p>");
    expect(findBodyRegionRanges(el, [{ contentText: null }])).toHaveLength(0);
    expect(findBodyRegionRanges(el, [{ contentText: "   " }])).toHaveLength(0);
  });

  it("matches whitespace-normalized needles against reflowed HTML whitespace", () => {
    // Rendered HTML often carries newlines/indentation between inline tags; the
    // matcher normalizes both sides so a clean needle still anchors.
    const el = container(
      "<p>Você\n   está    quase</p>",
    );
    const ranges = findBodyRegionRanges(el, [{ contentText: "Você está quase" }]);
    expect(ranges).toHaveLength(1);
  });
});

describe("applyBodyRegionHighlights (feature-detected)", () => {
  it("is a clean no-op with a working cleanup where CSS.highlights is absent (jsdom)", () => {
    const el = container("<p>Olá PEDRO</p>");
    const cleanup = applyBodyRegionHighlights(el, [{ contentText: "PEDRO" }]);
    expect(typeof cleanup).toBe("function");
    // Must not throw on cleanup.
    expect(() => cleanup()).not.toThrow();
  });
});
