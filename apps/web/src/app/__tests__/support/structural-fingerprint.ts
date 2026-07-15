/**
 * structural-fingerprint.ts — a colour-blind DOM fingerprint (60-01-PLAN.md
 * Task 1). Freezes what the inbox looks like STRUCTURALLY so a later plan can
 * be provably shown to have changed it — or, when it hasn't, so a pure
 * re-token can be caught masquerading as a redesign.
 *
 * THE CENTRAL DESIGN CONSTRAINT: `fingerprintTree` reads NO className, NO
 * style, and NO `data-*` attribute. Criterion 1 (ROADMAP) says the inbox must
 * differ "not just in color". If this fingerprint could see colour, a
 * className/token swap would move it and the gate built on top of it (Plan
 * 02's `inbox-structure.test.tsx`) would be theatre. Excluding `data-*`
 * closes the companion loophole: a later plan cannot "pass" by sprinkling
 * marker attributes instead of genuinely restructuring the tree. What
 * remains is pure DOM topology — tag names, structural roles, presence-only
 * interaction-state markers, and where text lives — which only real
 * restructuring can move.
 *
 * Free of vitest imports so it is consumable from any apps/web test tree, per
 * the plan's own instruction.
 */

/**
 * Presence-only ARIA markers. Values are deliberately never read: they flip
 * with component state (e.g. `aria-expanded` toggles when a thread opens),
 * and a fingerprint keyed on transient state would be unstable across
 * otherwise-identical renders. Presence of the attribute, not its value, is
 * the structural fact worth recording.
 */
const ARIA_PRESENCE_ALLOWLIST = [
  "aria-expanded",
  "aria-pressed",
  "aria-selected",
  "aria-hidden",
] as const;

export interface StructuralFingerprint {
  /**
   * A deterministic serialization of the subtree's topology: per element,
   * lowercased tagName, then `[role=VALUE]` when a role attribute exists,
   * then a presence-only marker for each ARIA_PRESENCE_ALLOWLIST attribute
   * found, then `#t` when the element has a direct non-empty text child,
   * then its children recursively in document order, parenthesized.
   * Deliberately absent: className, style, data-*, id, href, ARIA values.
   */
  readonly shape: string;
  /** Total elements in the subtree (root inclusive). */
  readonly elementCount: number;
  /** Deepest nesting level reached (root = depth 0). */
  readonly maxDepth: number;
  /**
   * Count of elements carrying a direct non-empty text child — the
   * information-density proxy. This counts distinct rendered facts, not
   * pixels: jsdom does not evaluate Tailwind CSS, so an honest px-density
   * metric is not available here (that is the screenshot harness's job).
   */
  readonly leafTextCount: number;
  /** tagName -> occurrence count, sorted by key for a stable diff. */
  readonly tagCounts: Readonly<Record<string, number>>;
  /** role value -> occurrence count, sorted by key for a stable diff. */
  readonly roleCounts: Readonly<Record<string, number>>;
}

/** True when `el` has at least one direct child TEXT_NODE with non-blank content. */
function hasDirectNonEmptyText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 /* Node.TEXT_NODE */) {
      const text = node.textContent ?? "";
      if (text.trim().length > 0) return true;
    }
  }
  return false;
}

/** Sorted-key copy of a tally map, for a diff-stable, deterministic artifact. */
function sortedCounts(counts: Record<string, number>): Record<string, number> {
  const sorted: Record<string, number> = {};
  for (const key of Object.keys(counts).sort()) {
    sorted[key] = counts[key]!;
  }
  return sorted;
}

/**
 * fingerprintTree — walk `root` and every descendant element, producing a
 * colour-blind structural fingerprint. See `StructuralFingerprint` for field
 * semantics and the module doc comment for why colour/data-* are excluded.
 */
export function fingerprintTree(root: Element): StructuralFingerprint {
  let elementCount = 0;
  let maxDepth = 0;
  let leafTextCount = 0;
  const tagCounts: Record<string, number> = {};
  const roleCounts: Record<string, number> = {};

  function walk(el: Element, depth: number): string {
    elementCount += 1;
    if (depth > maxDepth) maxDepth = depth;

    const tag = el.tagName.toLowerCase();
    tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;

    let marker = tag;

    const role = el.getAttribute("role");
    if (role !== null) {
      marker += `[role=${role}]`;
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }

    for (const attr of ARIA_PRESENCE_ALLOWLIST) {
      if (el.hasAttribute(attr)) {
        marker += `[${attr}]`;
      }
    }

    if (hasDirectNonEmptyText(el)) {
      leafTextCount += 1;
      marker += "#t";
    }

    const childMarkers: string[] = [];
    for (const child of Array.from(el.children)) {
      childMarkers.push(walk(child, depth + 1));
    }

    return childMarkers.length > 0 ? `${marker}(${childMarkers.join("")})` : marker;
  }

  const shape = walk(root, 0);

  return {
    shape,
    elementCount,
    maxDepth,
    leafTextCount,
    tagCounts: sortedCounts(tagCounts),
    roleCounts: sortedCounts(roleCounts),
  };
}
