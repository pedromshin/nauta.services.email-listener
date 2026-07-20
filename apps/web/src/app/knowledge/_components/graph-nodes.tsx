"use client";

/**
 * graph-nodes.tsx — the six custom React Flow node shells for the knowledge graph.
 *
 * ── PHASE 62 REDESIGN (SURF-03, D-58-01) ──
 * Rebuilt on Phase 61's canvas card language, not re-tokened. The old shells
 * keyed each node TYPE to a hue (the retired `graph-*` family + `primary`
 * washes, plus a shadow "glow" on knowledge nodes) — role encoded as colour,
 * which law 3 forbids, and elevation carried by shadow, which the identity's
 * "flat surfaces, hairline rules, zero shadow anywhere" forbids.
 *
 * Now every node is the sketch's flat `.card`: a single `--bright` sheet a step
 * above the board, a `--rule` hairline, `--r-card` radius, ZERO shadow. Type is
 * carried by STRUCTURE — a left-rule whose weight states how much of the user's
 * own material the node holds — and by an ink GLYPH, never a hue (law 3). This
 * mirrors `canvas-vocabulary.ts`'s `CANVAS_NODE_KIND_GEOMETRY` axis exactly;
 * the knowledge surface owns its own kinds so the map is local, but the rule is
 * the shared one. Selection is an ink OUTLINE (law 1: selected states carry no
 * hue), offset so the board's grid shows through the gap — never a ring (its
 * offset paints a white halo in dark, D-61-03-F). Hover is a rule change, never
 * a lift.
 *
 * Colour is spent nowhere on these shells: the one place tier lives on this
 * surface is the EDGES and the legend, where it is earned.
 *
 * Typography: text-sm font-semibold or text-xs ONLY — never font-medium.
 */

import { Box, Hash, Layers, Mail, Shapes, Share2 } from "lucide-react";
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";

// ---------------------------------------------------------------------------
// The flat card, and the structural axis that differentiates kinds.
//
// LEFT-RULE WEIGHT = how much of the user's OWN material this node carries —
// the same axis canvas-vocabulary.ts names for the chat canvas:
//   entity_type (4)       the schema anchor — the thing the whole graph is about
//   entity_instance (2)   a real extracted entity — the user's own material
//   email (2)             mail the user received — real evidence, in full
//   entity_type_field (1) a facet of the schema — structure, no material of its own
//   email_component (1)   a region inside an email — a fragment
//   knowledge_node (2+dbl) a rule polytoken bound FROM the material — a synthesis,
//                          set apart by the DOUBLE rule (a bound artifact), never a hue
// ---------------------------------------------------------------------------

const CARD_BASE =
  "flex items-center gap-2 overflow-hidden rounded-card border border-rule bg-bright px-3 cursor-pointer select-none transition-colors hover:border-rule-hi";

/** Selection is an ink outline, offset so the grid shows through (law 1). */
const SELECTED = "outline-2 outline-offset-2 outline-ink";

function shellClass(kindGeometry: string, selected: boolean): string {
  return selected
    ? `${CARD_BASE} ${kindGeometry} ${SELECTED}`
    : `${CARD_BASE} ${kindGeometry}`;
}

// ---------------------------------------------------------------------------
// entity_type — 160×48, the schema anchor (heaviest rule)
// ---------------------------------------------------------------------------

export type EntityTypeNodeData = { readonly label: string } & Record<
  string,
  unknown
>;
export type EntityTypeNodeType = Node<EntityTypeNodeData, "entity_type">;

export const EntityTypeNode = memo(function EntityTypeNode({
  data,
  selected,
}: NodeProps<EntityTypeNodeType>) {
  return (
    <div
      style={{ width: 160, height: 48 }}
      className={shellClass("border-l-4 border-l-ink", selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Entity Type: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Shapes className="size-4 shrink-0 text-faded" strokeWidth={1.75} aria-hidden />
      <span className="truncate text-sm font-semibold text-foreground">
        {data.label}
      </span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// entity_type_field — 128×32, a facet of the schema (light rule)
// ---------------------------------------------------------------------------

export type EntityTypeFieldNodeData = { readonly label: string } & Record<
  string,
  unknown
>;
export type EntityTypeFieldNodeType = Node<
  EntityTypeFieldNodeData,
  "entity_type_field"
>;

export const EntityTypeFieldNode = memo(function EntityTypeFieldNode({
  data,
  selected,
}: NodeProps<EntityTypeFieldNodeType>) {
  return (
    <div
      style={{ width: 128, height: 32 }}
      className={shellClass("border-l border-l-ink", selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Field: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Hash className="size-3 shrink-0 text-faded" strokeWidth={1.75} aria-hidden />
      <span className="truncate text-xs text-foreground">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// entity_instance — 160×44, a real extracted entity (evidence rule)
// ---------------------------------------------------------------------------

export type EntityInstanceNodeData = {
  readonly label: string;
  readonly entityTypeName?: string | null;
} & Record<string, unknown>;
export type EntityInstanceNodeType = Node<
  EntityInstanceNodeData,
  "entity_instance"
>;

export const EntityInstanceNode = memo(function EntityInstanceNode({
  data,
  selected,
}: NodeProps<EntityInstanceNodeType>) {
  return (
    <div
      style={{ width: 160, height: 44 }}
      className={shellClass("border-l-2 border-l-ink", selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Instance: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Box className="size-4 shrink-0 text-faded" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {data.label}
        </div>
        {data.entityTypeName != null && (
          <div className="truncate text-xs text-pencil">
            {data.entityTypeName}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// email_component — 128×36, a region inside an email (light rule)
// ---------------------------------------------------------------------------

export type EmailComponentNodeData = { readonly label: string } & Record<
  string,
  unknown
>;
export type EmailComponentNodeType = Node<
  EmailComponentNodeData,
  "email_component"
>;

export const EmailComponentNode = memo(function EmailComponentNode({
  data,
  selected,
}: NodeProps<EmailComponentNodeType>) {
  return (
    <div
      style={{ width: 128, height: 36 }}
      className={shellClass("border-l border-l-ink", selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Component: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Layers className="size-3 shrink-0 text-faded" strokeWidth={1.75} aria-hidden />
      <span className="truncate text-xs text-foreground">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// email — 144×40, mail the user received (evidence rule)
// ---------------------------------------------------------------------------

export type EmailNodeData = {
  readonly label: string;
  readonly senderDomain?: string | null;
} & Record<string, unknown>;
export type EmailNodeType = Node<EmailNodeData, "email">;

export const EmailNode = memo(function EmailNode({
  data,
  selected,
}: NodeProps<EmailNodeType>) {
  const truncated =
    data.label.length > 20 ? `${data.label.slice(0, 20)}…` : data.label;

  return (
    <div
      style={{ width: 144, height: 40 }}
      className={shellClass("border-l-2 border-l-ink", selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Email: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Mail className="size-4 shrink-0 text-faded" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{truncated}</div>
        {data.senderDomain != null && (
          <div className="truncate text-xs text-pencil">{data.senderDomain}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// knowledge_node — 160×48, a rule bound from the material (DOUBLE rule)
// ---------------------------------------------------------------------------

export type KnowledgeNodeNodeData = {
  readonly label: string;
  readonly confidence?: number | null;
} & Record<string, unknown>;
export type KnowledgeNodeNodeType = Node<
  KnowledgeNodeNodeData,
  "knowledge_node"
>;

export const KnowledgeNodeNode = memo(function KnowledgeNodeNode({
  data,
  selected,
}: NodeProps<KnowledgeNodeNodeType>) {
  const confLabel =
    data.confidence != null ? `${Math.round(data.confidence * 100)}%` : null;

  return (
    <div
      style={{ width: 160, height: 48 }}
      className={shellClass("border-l-2 border-l-ink border-double", selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Knowledge Rule: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Share2 className="size-4 shrink-0 text-faded" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {data.label}
        </div>
        {confLabel != null && (
          <div className="tabular truncate text-xs text-pencil">{confLabel}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// nodeTypes map — passed to ReactFlow's nodeTypes prop
// ---------------------------------------------------------------------------

export const nodeTypes = {
  entity_type: EntityTypeNode,
  entity_type_field: EntityTypeFieldNode,
  entity_instance: EntityInstanceNode,
  email_component: EmailComponentNode,
  email: EmailNode,
  knowledge_node: KnowledgeNodeNode,
} as const;
