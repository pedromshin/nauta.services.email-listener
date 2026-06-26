"use client";

/**
 * graph-nodes.tsx — six custom React Flow node components for the knowledge graph.
 *
 * Node types (UI-SPEC Node Visual Language):
 *   entity_type        160×48  bg-primary/10 border-primary/40   Shapes icon
 *   entity_type_field  128×32  bg-muted/60 border-border/60      Hash icon
 *   entity_instance    160×44  bg-violet-500/10 border-violet-500/40  Box icon
 *   email_component    128×36  bg-amber-500/10 border-amber-500/40   Layers icon
 *   email              144×40  bg-slate-100/60 border-slate-400/40   Mail icon
 *   knowledge_node     160×48  bg-primary/15 border-primary/60 + glow  Share2 icon
 *
 * All nodes: rounded-lg border shadow-sm cursor-pointer
 * Selected: ring-2 ring-primary ring-offset-1
 * Hover: shadow-md transition-shadow duration-150
 *
 * Typography: text-sm font-semibold or text-xs ONLY — never font-medium (UI-SPEC Note #5)
 */

import { Box, Hash, Layers, Mail, Shapes, Share2 } from "lucide-react";
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Shared base classes
// ---------------------------------------------------------------------------

const BASE =
  "rounded-lg border shadow-sm cursor-pointer select-none transition-shadow duration-150 hover:shadow-md flex items-center gap-2 px-3";

const SELECTED_RING = "ring-2 ring-primary ring-offset-1";

function nodeClasses(color: string, selected: boolean): string {
  return `${BASE} ${color}${selected ? ` ${SELECTED_RING}` : ""}`;
}

// ---------------------------------------------------------------------------
// entity_type — 160×48, teal bg-primary/10
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
      className={nodeClasses("bg-primary/10 border-primary/40", selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Entity Type: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Shapes className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="truncate text-sm font-semibold text-foreground">
        {data.label}
      </span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// entity_type_field — 128×32, muted slate
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
      className={nodeClasses("bg-muted/60 border-border/60", selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Field: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Hash className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate text-xs text-foreground">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// entity_instance — 160×44, violet
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
      className={nodeClasses("bg-violet-500/10 border-violet-500/40", selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Instance: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Box className="size-4 shrink-0 text-violet-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {data.label}
        </div>
        {data.entityTypeName != null && (
          <div className="truncate text-xs text-muted-foreground">
            {data.entityTypeName}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// email_component — 128×36, amber
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
      className={nodeClasses("bg-amber-500/10 border-amber-500/40", selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Component: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Layers className="size-3 shrink-0 text-amber-500" aria-hidden />
      <span className="truncate text-xs text-foreground">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// email — 144×40, slate
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
      className={nodeClasses(
        "bg-slate-100/60 border-slate-400/40 dark:bg-slate-800/40 dark:border-slate-600/40",
        selected,
      )}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Email: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Mail className="size-4 shrink-0 text-slate-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{truncated}</div>
        {data.senderDomain != null && (
          <div className="truncate text-xs text-muted-foreground">
            {data.senderDomain}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// knowledge_node — 160×48, teal with glow
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
    data.confidence != null
      ? `${Math.round(data.confidence * 100)}%`
      : null;

  return (
    <div
      style={{ width: 160, height: 48 }}
      className={`${nodeClasses("bg-primary/15 border-primary/60", selected)} shadow-[0_0_8px_hsl(164_39%_22%/0.25)]`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Knowledge Rule: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Share2 className="size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-primary">
          {data.label}
        </div>
        {confLabel != null && (
          <div className="truncate text-xs text-muted-foreground">
            {confLabel}
          </div>
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
