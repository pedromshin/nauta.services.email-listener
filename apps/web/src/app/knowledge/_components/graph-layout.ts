/**
 * graph-layout.ts — dagre TB layout utility for the knowledge graph.
 *
 * Takes React Flow node + edge arrays and returns a new array of nodes with
 * { position: { x, y } } assigned by dagre (center-offset to React Flow top-left).
 * Pure function — never mutates input arrays or node objects.
 *
 * UI-SPEC Layout Algorithm:
 *   rankdir: "TB"   — top-to-bottom
 *   ranksep: 64     — 64px vertical gap between ranks
 *   nodesep: 32     — 32px horizontal gap between nodes
 *   edgesep: 16
 */

import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Fixed node dimensions per UI-SPEC Node Visual Language
// ---------------------------------------------------------------------------

const NODE_DIMENSIONS: Readonly<Record<string, { width: number; height: number }>> = {
  entity_type: { width: 160, height: 48 },
  entity_type_field: { width: 128, height: 32 },
  entity_instance: { width: 160, height: 44 },
  email_component: { width: 128, height: 36 },
  email: { width: 144, height: 40 },
  knowledge_node: { width: 160, height: 48 },
};

const DEFAULT_NODE_DIMENSIONS = { width: 160, height: 48 };

// ---------------------------------------------------------------------------
// Layout function
// ---------------------------------------------------------------------------

/**
 * Apply dagre TB layout to React Flow nodes/edges.
 * Returns a new array of nodes with computed `position` — inputs are not mutated.
 */
export function layoutGraph<NodeData extends Record<string, unknown>>(
  nodes: ReadonlyArray<Node<NodeData>>,
  edges: ReadonlyArray<Edge>,
): Array<Node<NodeData>> {
  const g = new dagre.graphlib.Graph();

  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    ranksep: 64,
    nodesep: 32,
    edgesep: 16,
  });

  // Add nodes with fixed dimensions per type
  for (const node of nodes) {
    const dims =
      NODE_DIMENSIONS[node.type ?? ""] ?? DEFAULT_NODE_DIMENSIONS;
    g.setNode(node.id, { width: dims.width, height: dims.height });
  }

  // Add edges
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // Map dagre center positions → React Flow top-left positions
  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const dims =
      NODE_DIMENSIONS[node.type ?? ""] ?? DEFAULT_NODE_DIMENSIONS;

    return {
      ...node,
      position: {
        x: dagreNode.x - dims.width / 2,
        y: dagreNode.y - dims.height / 2,
      },
    };
  });
}
