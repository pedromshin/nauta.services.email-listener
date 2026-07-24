/**
 * treemap-layout.ts — the pure d3-hierarchy layout math behind the shared
 * `Treemap` primitive (the WizTree-style rectangular landscape that REPLACES the
 * circle-pack view).
 *
 * WHY A TREEMAP, NOT PACKED CIRCLES: packed circles waste the box (a circle
 * fills ~78% of its square), never tile, and — the real complaint — leave no
 * room for a LABEL, so a mailbox reads as anonymous grey bubbles. A squarified
 * treemap tiles the whole rectangle, every node gets a labelable rectangle, and
 * size-by-weight is read at a glance. This is the WizTree idiom.
 *
 * This module is LAYOUT ONLY: it turns a containment hierarchy into positioned
 * rectangles (`x0,y0,x1,y1` per node) via `d3.treemap()` (squarified tiling) and
 * returns a flat, plain array. It renders nothing and imports no React — the DOM
 * rendering lives in `treemap.tsx`, so the math stays unit-testable in jsdom
 * (which does no layout).
 *
 * It reuses the SAME input contract as the circle-pack primitive (`CircleDatum`,
 * re-exported here as `TreeNode`) so every existing hierarchy builder
 * (emails.circlePackLandscape, buildDriveHierarchy, …) feeds the treemap
 * unchanged, and it assigns each node the SAME stable, path-derived id (`0`,
 * `0/2`, `0/2/1`, …) as `packCircles`, so the shared zoom state machine
 * (`circle-pack-zoom.ts`) drives the treemap verbatim.
 */

import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import type { HierarchyNode, HierarchyRectangularNode } from "d3-hierarchy";

import type { CircleDatum } from "../circle-pack/circle-pack-layout";

/** The treemap consumes the exact input contract as the circle-pack. */
export type TreeNode<TLeaf = unknown> = CircleDatum<TLeaf>;

/** One positioned rectangle in the tiled layout — a plain, serializable record. */
export interface PackedRect<TLeaf = unknown> {
  /** Stable path id (`0` = root, `0/1` = second child of root, …). */
  readonly id: string;
  readonly datum: TreeNode<TLeaf>;
  /** Left / top / right / bottom in pixels, within the [width × height] box. */
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** Depth RELATIVE to the focused root (0 = the focus itself). */
  readonly depth: number;
  readonly parentId: string | null;
  readonly isLeaf: boolean;
  /** Summed leaf value (own `value` for a leaf). */
  readonly value: number;
  readonly childIds: readonly string[];
}

/**
 * A flat, id-keyed index over the WHOLE hierarchy (independent of which node is
 * focused). The reducer's read model (`{parentOf, childrenOf, isLeaf, ids}` — a
 * superset of `CircleNavIndex`) plus the datum/value lookups the renderer needs
 * to lay out and label a focused subtree.
 */
export interface TreemapIndex<TLeaf = unknown> {
  readonly parentOf: ReadonlyMap<string, string | null>;
  readonly childrenOf: ReadonlyMap<string, readonly string[]>;
  readonly isLeaf: ReadonlyMap<string, boolean>;
  readonly ids: ReadonlySet<string>;
  readonly datumOf: ReadonlyMap<string, TreeNode<TLeaf>>;
  readonly valueOf: ReadonlyMap<string, number>;
}

export interface TreemapOptions {
  readonly width: number;
  readonly height: number;
  /** Gap between sibling tiles. Default 1. */
  readonly paddingInner?: number;
  /** Gap between a container and its children on all sides. Default 2. */
  readonly paddingOuter?: number;
  /** Header band reserved at the top of every CONTAINER for its label. Default 16. */
  readonly paddingTop?: number;
}

/** Build the sorted d3 hierarchy once — sum leaves, order siblings largest-first
 * (the conventional treemap ordering) so ids and tiling are deterministic. */
function makeRoot<TLeaf>(datum: TreeNode<TLeaf>): HierarchyNode<TreeNode<TLeaf>> {
  return hierarchy<TreeNode<TLeaf>>(
    datum,
    (d) => d.children as TreeNode<TLeaf>[] | undefined,
  )
    .sum((d) => Math.max(0, d.value ?? 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

/**
 * indexTree — walk the whole hierarchy (no tiling) assigning stable path ids and
 * recording parent/child/leaf/datum/value for every node. Cheap: one traversal,
 * no layout. The child ordering is the SAME largest-first order the layout uses,
 * so a node's path id is consistent between this index and any focused layout.
 */
export function indexTree<TLeaf = unknown>(rootDatum: TreeNode<TLeaf>): TreemapIndex<TLeaf> {
  const root = makeRoot<TLeaf>(rootDatum);
  const parentOf = new Map<string, string | null>();
  const childrenOf = new Map<string, readonly string[]>();
  const isLeaf = new Map<string, boolean>();
  const ids = new Set<string>();
  const datumOf = new Map<string, TreeNode<TLeaf>>();
  const valueOf = new Map<string, number>();

  const walk = (node: HierarchyNode<TreeNode<TLeaf>>, id: string, parentId: string | null): void => {
    const kids = node.children ?? [];
    parentOf.set(id, parentId);
    childrenOf.set(id, kids.map((_, i) => `${id}/${i}`));
    isLeaf.set(id, kids.length === 0);
    ids.add(id);
    datumOf.set(id, node.data);
    valueOf.set(id, node.value ?? 0);
    kids.forEach((child, i) => walk(child, `${id}/${i}`, id));
  };
  walk(root, "0", null);
  return { parentOf, childrenOf, isLeaf, ids, datumOf, valueOf };
}

/**
 * layoutTreemap — tile the FOCUSED subtree to fill the whole box.
 *
 * The focused node (root by default) is squarified into `[width × height]`; its
 * descendants tile inside it, each container reserving a `paddingTop` header
 * band for its own label. Emitted rects carry GLOBAL path ids (prefixed with the
 * focus id) so the zoom machine, breadcrumb and click handlers key on the same
 * ids `indexTree` produced — drilling never renumbers a node.
 *
 * Pure: same (rootDatum, focusId, opts) ⇒ same output, no DOM, no side effects.
 */
export function layoutTreemap<TLeaf = unknown>(
  rootDatum: TreeNode<TLeaf>,
  focusId: string,
  { width, height, paddingInner = 1, paddingOuter = 2, paddingTop = 16 }: TreemapOptions,
): { readonly rects: PackedRect<TLeaf>[]; readonly index: TreemapIndex<TLeaf> } {
  const index = indexTree<TLeaf>(rootDatum);
  const focusDatum = index.datumOf.get(focusId) ?? rootDatum;
  const anchorId = index.ids.has(focusId) ? focusId : "0";

  const local = treemap<TreeNode<TLeaf>>()
    .tile(treemapSquarify)
    .size([Math.max(1, width), Math.max(1, height)])
    .paddingInner(paddingInner)
    .paddingOuter(paddingOuter)
    // paddingTop only bites on nodes that HAVE children (leaves have nothing to
    // pad), so a constant value reserves a header band on every container.
    .paddingTop(paddingTop)
    .round(true)(makeRoot<TLeaf>(focusDatum));

  // local path ("0", "0/2", …) → global path (anchorId, anchorId + "/2", …).
  const toGlobal = (localId: string): string =>
    localId === "0" ? anchorId : `${anchorId}${localId.slice(1)}`;

  const rects: PackedRect<TLeaf>[] = [];
  const walk = (node: HierarchyRectangularNode<TreeNode<TLeaf>>, localId: string): void => {
    const kids = node.children ?? [];
    const id = toGlobal(localId);
    rects.push({
      id,
      datum: node.data,
      x0: node.x0,
      y0: node.y0,
      x1: node.x1,
      y1: node.y1,
      depth: node.depth,
      // The focus root reports its TRUE parent (from the full index) so the
      // breadcrumb / zoom-out can step above it; descendants report the local one.
      parentId: localId === "0" ? (index.parentOf.get(anchorId) ?? null) : toGlobal(localId.slice(0, localId.lastIndexOf("/"))),
      isLeaf: kids.length === 0,
      value: node.value ?? 0,
      childIds: kids.map((_, i) => toGlobal(`${localId}/${i}`)),
    });
    kids.forEach((child, i) => walk(child, `${localId}/${i}`));
  };
  walk(local, "0");
  return { rects, index };
}
