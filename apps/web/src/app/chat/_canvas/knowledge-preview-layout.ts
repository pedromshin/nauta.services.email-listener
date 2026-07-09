/**
 * knowledge-preview-layout.ts — pure, framework-free hop-distance / cap-trim /
 * two-ring-ellipse layout math for the `knowledge-preview` canvas node
 * (PREV-01, 41-UI-SPEC.md §2/§3).
 *
 * Deliberately hand-rolled and small — NOT the dagre graph-layout library
 * (already an app dependency for `/knowledge`'s own `layoutGraph`, but
 * that's a hierarchical top-to-bottom tree layout designed for a large,
 * pannable graph) and NOT a second React Flow instance (the confirmed,
 * rejected hazard — 41-CONTEXT.md). This module imports neither.
 *
 * `computeHopDistances` mirrors `packages/api-client/src/router/knowledge/
 * expand.ts`'s `walkKnowledgeGraph` traversal exactly: every edge is treated
 * as UNDIRECTED for BFS purposes (`for (const candidate of [shaped.source,
 * shaped.target])`).
 *
 * All 5 exported members are pure and deterministic — no `Math.random`, no
 * `Date.now()`, never mutate their inputs, always return new values.
 */

// ---------------------------------------------------------------------------
// Minimal local interfaces — NOT imported from packages/api-client, so this
// module stays decoupled and DB-free-testable. Real `GraphNode`/`GraphEdge`
// values are structurally assignable to these without adaptation.
// ---------------------------------------------------------------------------

export interface PreviewGraphNode {
  readonly id: string;
}

export interface PreviewGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

// ---------------------------------------------------------------------------
// MAX_PREVIEW_NODES — 41-UI-SPEC.md §3's locked cap
// ---------------------------------------------------------------------------

export const MAX_PREVIEW_NODES = 25;

// ---------------------------------------------------------------------------
// computeHopDistances — undirected BFS from focusId
// ---------------------------------------------------------------------------

/**
 * computeHopDistances — plain BFS over `edges`, treating every edge as
 * UNDIRECTED (mirrors `walkKnowledgeGraph`'s own traversal). Seeded with
 * `focusId -> 0`. No artificial depth limit — the caller already bounds the
 * edge set to <=2 hops via the server's own `expandNode` response. A node
 * with no path to `focusId` is simply absent from the returned map (never
 * `Infinity`). Returns a NEW `Map`; never mutates `edges`.
 */
export function computeHopDistances(
  focusId: string,
  edges: ReadonlyArray<PreviewGraphEdge>,
): ReadonlyMap<string, number> {
  const distances = new Map<string, number>([[focusId, 0]]);
  let frontier = new Set<string>([focusId]);

  while (frontier.size > 0) {
    const nextFrontier = new Set<string>();

    for (const currentId of frontier) {
      for (const edge of edges) {
        if (edge.source !== currentId && edge.target !== currentId) continue;

        const neighbour = edge.source === currentId ? edge.target : edge.source;
        if (!distances.has(neighbour)) {
          distances.set(neighbour, (distances.get(currentId) ?? 0) + 1);
          nextFrontier.add(neighbour);
        }
      }
    }

    frontier = nextFrontier;
  }

  return distances;
}

// ---------------------------------------------------------------------------
// trimPreviewGraph — cap-trim to MAX_PREVIEW_NODES per 41-UI-SPEC.md §3
// ---------------------------------------------------------------------------

export interface TrimPreviewGraphResult<
  TNode extends PreviewGraphNode,
  TEdge extends PreviewGraphEdge,
> {
  readonly nodes: ReadonlyArray<TNode>;
  readonly edges: ReadonlyArray<TEdge>;
  readonly oneHopIds: readonly string[];
  readonly twoHopIds: readonly string[];
  readonly overflowCount: number;
}

/**
 * trimPreviewGraph — implements 41-UI-SPEC.md §3's exact trim priority:
 *   1. Focus node — always kept.
 *   2. 1-hop neighbours — kept in full up to the remaining budget (cap - 1).
 *      If 1-hop alone exceeds that budget, trim 1-hop itself to the first N
 *      (stable order) and keep ZERO 2-hop nodes.
 *   3. 2-hop neighbours — fill whatever budget remains after all 1-hop nodes
 *      are kept, stable order.
 *   4. Any edge whose endpoint fell outside the kept node set is dropped.
 *
 * `overflowCount = Math.max(0, nodes.length - cap)`, computed from the
 * ORIGINAL input length (41-UI-SPEC.md §3's exact formula). Never mutates
 * `nodes`/`edges`.
 */
export function trimPreviewGraph<
  TNode extends PreviewGraphNode,
  TEdge extends PreviewGraphEdge,
>(
  focusId: string,
  nodes: ReadonlyArray<TNode>,
  edges: ReadonlyArray<TEdge>,
  cap: number = MAX_PREVIEW_NODES,
): TrimPreviewGraphResult<TNode, TEdge> {
  const distances = computeHopDistances(focusId, edges);

  const focusNodes: TNode[] = [];
  const oneHopNodes: TNode[] = [];
  const twoHopNodes: TNode[] = [];

  for (const node of nodes) {
    const distance = distances.get(node.id);
    if (node.id === focusId) {
      focusNodes.push(node);
    } else if (distance === 1) {
      oneHopNodes.push(node);
    } else if (distance === 2) {
      twoHopNodes.push(node);
    }
  }

  const remainingBudget = Math.max(0, cap - focusNodes.length);
  const keptOneHopNodes = oneHopNodes.slice(0, remainingBudget);
  const oneHopBudgetExceeded = oneHopNodes.length > remainingBudget;
  const twoHopBudgetRemaining = oneHopBudgetExceeded
    ? 0
    : Math.max(0, remainingBudget - keptOneHopNodes.length);
  const keptTwoHopNodes = oneHopBudgetExceeded
    ? []
    : twoHopNodes.slice(0, twoHopBudgetRemaining);

  const keptNodes: TNode[] = [...focusNodes, ...keptOneHopNodes, ...keptTwoHopNodes];
  const keptIds = new Set(keptNodes.map((n) => n.id));

  const keptEdges = edges.filter(
    (edge) => keptIds.has(edge.source) && keptIds.has(edge.target),
  );

  const overflowCount = Math.max(0, nodes.length - cap);

  return {
    nodes: keptNodes,
    edges: keptEdges,
    oneHopIds: keptOneHopNodes.map((n) => n.id),
    twoHopIds: keptTwoHopNodes.map((n) => n.id),
    overflowCount,
  };
}

// ---------------------------------------------------------------------------
// orderTwoHopByParent — sorts twoHopIds by their connecting 1-hop parent's
// index within oneHopIds (a proxy for the parent's ring-1 angle)
// ---------------------------------------------------------------------------

/**
 * orderTwoHopByParent — for each id in `twoHopIds`, finds ANY edge connecting
 * it to an id present in `oneHopIds` (checks both `source`/`target`,
 * undirected) and resolves that oneHop id's index within `oneHopIds` as its
 * "parent rank". Returns a NEW array, sorted ascending by parent rank, STABLE
 * (equal/unresolvable ranks preserve original `twoHopIds` relative order); a
 * `twoHop` id with no resolvable parent edge sorts to the end. Never mutates
 * `twoHopIds`, never throws.
 */
export function orderTwoHopByParent(
  oneHopIds: readonly string[],
  twoHopIds: readonly string[],
  edges: ReadonlyArray<PreviewGraphEdge>,
): readonly string[] {
  const oneHopRank = new Map<string, number>(
    oneHopIds.map((id, index) => [id, index]),
  );

  const rankFor = (twoHopId: string): number => {
    for (const edge of edges) {
      if (edge.source === twoHopId && oneHopRank.has(edge.target)) {
        return oneHopRank.get(edge.target)!;
      }
      if (edge.target === twoHopId && oneHopRank.has(edge.source)) {
        return oneHopRank.get(edge.source)!;
      }
    }
    return Number.POSITIVE_INFINITY;
  };

  return twoHopIds
    .map((id, originalIndex) => ({ id, rank: rankFor(id), originalIndex }))
    .sort((a, b) => a.rank - b.rank || a.originalIndex - b.originalIndex)
    .map((entry) => entry.id);
}

// ---------------------------------------------------------------------------
// layoutPreview — two-ring ellipse layout, 41-UI-SPEC.md §2
// ---------------------------------------------------------------------------

export interface PreviewBox {
  readonly width: number;
  readonly height: number;
}

const DEFAULT_PREVIEW_BOX: PreviewBox = { width: 280, height: 140 };
const RING_ONE_RADIUS_FACTOR = 0.38;
const RING_TWO_RADIUS_FACTOR = 0.62;

function layoutRing(
  ids: readonly string[],
  centerX: number,
  centerY: number,
  box: PreviewBox,
  radiusFactor: number,
): Record<string, { readonly x: number; readonly y: number }> {
  const positions: Record<string, { readonly x: number; readonly y: number }> = {};

  ids.forEach((id, index) => {
    const angle = (index / ids.length) * 2 * Math.PI - Math.PI / 2;
    positions[id] = {
      x: centerX + radiusFactor * box.width * Math.cos(angle),
      y: centerY + radiusFactor * box.height * Math.sin(angle),
    };
  });

  return positions;
}

/**
 * layoutPreview — computes deterministic `{x, y}` positions for the focus
 * node (box center) plus every id in `oneHop` (ring 1, rx=0.38*width,
 * ry=0.38*height) and `twoHop` (ring 2, rx=0.62*width, ry=0.62*height), each
 * ring evenly spaced by angle starting at 12 o'clock, in the exact order
 * given. The CALLER is responsible for having already passed a
 * parent-ordered `twoHop` array via `orderTwoHopByParent` — this function
 * itself just spaces whatever order it's given, evenly, by index. No
 * collision detection, no iterative relaxation. Pure — no `Math.random`, no
 * `Date.now()`.
 */
export function layoutPreview(
  focusId: string,
  oneHop: readonly string[],
  twoHop: readonly string[],
  box: PreviewBox = DEFAULT_PREVIEW_BOX,
): Record<string, { readonly x: number; readonly y: number }> {
  const centerX = box.width / 2;
  const centerY = box.height / 2;

  return {
    [focusId]: { x: centerX, y: centerY },
    ...layoutRing(oneHop, centerX, centerY, box, RING_ONE_RADIUS_FACTOR),
    ...layoutRing(twoHop, centerX, centerY, box, RING_TWO_RADIUS_FACTOR),
  };
}
