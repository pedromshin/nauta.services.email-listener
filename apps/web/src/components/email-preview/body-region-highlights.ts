/**
 * body-region-highlights.ts — text-anchored highlighting for email-BODY
 * regions (the correct replacement for the old polygon overlay path).
 *
 * WHY: body-sourced region components carry polygons normalized to the
 * SOURCE document frame ([0..1] of whatever the extractor rendered). The
 * email body in the app is REFLOWED HTML — its line boxes share no geometry
 * with that frame, so scaling those polygons onto the prose container
 * produced meaningless dashed boxes garbling the text (the mobile
 * "PEDREDRO," bug). Geometry is unrecoverable here; the text itself is not.
 *
 * HOW: given the rendered body container and the body-sourced components
 * (attachmentId === null, contentText non-empty), find each component's
 * `contentText` in the container's rendered text — whitespace-normalized,
 * spanning text nodes via TreeWalker — and paint the matched DOM Ranges
 * through the CSS Custom Highlight API (`CSS.highlights`), styled by the
 * `::highlight(email-body-region)` rule in globals.css (a soft amber
 * suggested-wash: machine-inferred, unconfirmed — law 1's earned colour).
 *
 * Guarantees:
 *   - A region whose text cannot be found is SILENTLY SKIPPED — we never
 *     draw a wrong box.
 *   - Feature-detected: no `CSS.highlights` / `Highlight` (jsdom, old
 *     browsers) → clean no-op.
 *   - Multiple mounted bodies (the inbox renders desktop + mobile trees
 *     simultaneously) share ONE registry entry: each caller contributes its
 *     ranges under a private key and the entry is rebuilt from the union,
 *     so a second mount never clobbers the first.
 */

/** The minimal slice of an emails.detail component row the matcher needs. */
export interface BodyRegionTextSource {
  readonly contentText: string | null;
}

/** The registry name the `::highlight(...)` rule in globals.css styles. */
export const EMAIL_BODY_REGION_HIGHLIGHT = "email-body-region";

/** Collapse all whitespace runs to single spaces and trim. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

interface CharSource {
  readonly node: Text;
  readonly offset: number;
}

interface NormalizedIndex {
  /** The container's text with whitespace runs collapsed to single spaces. */
  readonly text: string;
  /** For each character of `text`, the source text node + offset. */
  readonly map: ReadonlyArray<CharSource>;
}

const isWhitespace = (ch: string): boolean => /\s/.test(ch);

/**
 * Build the whitespace-normalized text of `container` plus a per-character
 * map back to (text node, offset), so a match index range converts to a DOM
 * Range even when the match spans element boundaries.
 */
function buildNormalizedIndex(container: Element): NormalizedIndex {
  const doc = container.ownerDocument;
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  let text = "";
  const map: CharSource[] = [];
  let started = false;
  let pendingSpace: CharSource | null = null;

  for (
    let node = walker.nextNode();
    node !== null;
    node = walker.nextNode()
  ) {
    const textNode = node as Text;
    const data = textNode.data;
    for (let i = 0; i < data.length; i++) {
      const ch = data.charAt(i);
      if (isWhitespace(ch)) {
        // Collapse the run; remember where it began (leading runs dropped).
        if (started && pendingSpace === null) {
          pendingSpace = { node: textNode, offset: i };
        }
      } else {
        if (pendingSpace !== null) {
          text += " ";
          map.push(pendingSpace);
          pendingSpace = null;
        }
        text += ch;
        map.push({ node: textNode, offset: i });
        started = true;
      }
    }
  }

  return { text, map };
}

/**
 * Find each region's `contentText` in the container's rendered text
 * (whitespace-normalized; matches may span text nodes) and return one DOM
 * Range per FOUND region — first occurrence, in region order. Regions with
 * empty/absent text or no match are silently skipped (never a wrong box).
 *
 * Pure DOM in, Ranges out — unit-testable in jsdom without CSS.highlights.
 */
export function findBodyRegionRanges(
  container: Element,
  regions: ReadonlyArray<BodyRegionTextSource>,
): Range[] {
  const needles = regions
    .map((r) => (r.contentText === null ? "" : normalizeWhitespace(r.contentText)))
    .filter((needle) => needle.length > 0);
  if (needles.length === 0) return [];

  const { text, map } = buildNormalizedIndex(container);
  if (text.length === 0) return [];

  const doc = container.ownerDocument;
  const ranges: Range[] = [];

  for (const needle of needles) {
    const start = text.indexOf(needle);
    if (start === -1) continue;
    const startChar = map[start];
    const endChar = map[start + needle.length - 1];
    if (startChar === undefined || endChar === undefined) continue;
    const range = doc.createRange();
    range.setStart(startChar.node, startChar.offset);
    range.setEnd(endChar.node, endChar.offset + 1);
    ranges.push(range);
  }

  return ranges;
}

// ---------------------------------------------------------------------------
// CSS Custom Highlight API plumbing (feature-detected; shared registry entry)
// ---------------------------------------------------------------------------

interface HighlightRegistryLike {
  set(name: string, highlight: unknown): unknown;
  delete(name: string): boolean;
}

type HighlightConstructorLike = new (...ranges: Range[]) => unknown;

function getHighlightSupport(): {
  registry: HighlightRegistryLike;
  Highlight: HighlightConstructorLike;
} | null {
  if (typeof CSS === "undefined") return null;
  const registry = (CSS as unknown as { highlights?: HighlightRegistryLike })
    .highlights;
  if (registry === undefined || registry === null) return null;
  const ctor = (globalThis as { Highlight?: HighlightConstructorLike })
    .Highlight;
  if (typeof ctor !== "function") return null;
  return { registry, Highlight: ctor };
}

/** Live contributions to the shared registry entry, keyed per caller. */
const contributions = new Map<symbol, ReadonlyArray<Range>>();

function syncRegistry(
  registry: HighlightRegistryLike,
  Highlight: HighlightConstructorLike,
): void {
  const all: Range[] = [];
  for (const ranges of contributions.values()) all.push(...ranges);
  if (all.length === 0) {
    registry.delete(EMAIL_BODY_REGION_HIGHLIGHT);
  } else {
    registry.set(EMAIL_BODY_REGION_HIGHLIGHT, new Highlight(...all));
  }
}

const noopCleanup = (): void => undefined;

/**
 * Paint text-anchored highlights for `regions` over `container`. Returns a
 * cleanup that withdraws this caller's contribution (call it on unmount or
 * before re-applying). No CSS Custom Highlight support → clean no-op.
 */
export function applyBodyRegionHighlights(
  container: Element,
  regions: ReadonlyArray<BodyRegionTextSource>,
): () => void {
  const support = getHighlightSupport();
  if (support === null) return noopCleanup;

  const key = Symbol("email-body-region-highlights");
  contributions.set(key, findBodyRegionRanges(container, regions));
  syncRegistry(support.registry, support.Highlight);

  return () => {
    contributions.delete(key);
    syncRegistry(support.registry, support.Highlight);
  };
}
