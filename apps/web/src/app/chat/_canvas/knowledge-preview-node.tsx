"use client";

/**
 * knowledge-preview-node.tsx — KnowledgePreviewNode: the canvas's
 * `knowledge-preview` custom React Flow node (PREV-01, 41-UI-SPEC.md
 * sections 1/3) — the 3rd node type alongside `ChatNode`/`GenuiPanelNode`.
 *
 * Fixed `h-[240px] w-[320px]` shell, NOT `min-h`/`min-w` like GenuiPanelNode
 * uses — this node's content is bounded by construction (a capped mini-graph
 * that never overflows), so the layout math inside KnowledgePreviewMiniGraph
 * always has the exact space it was computed for.
 *
 * Header (Share2 icon + truncating headerLabel + remove button),
 * KnowledgePreviewMiniGraph body (data-fetching lives HERE via
 * `knowledge.expandNode` — that component is purely presentational/
 * prop-driven, never calls tRPC itself), and a footer deep-link that always
 * renders regardless of query state (41-UI-SPEC.md section 3).
 *
 * `headerLabel` resolution order (41-UI-SPEC.md section 1): explicit
 * `data.label` -> the resolved focus node's own title once `expandNode`
 * settles -> the fallback literal "Knowledge preview".
 *
 * Remove — the FIRST node-level remove affordance on this canvas. Uses
 * `useReactFlow().deleteElements` to remove this node from React Flow's own
 * `nodes` array; the actual debounced-save trigger on removal is wired in
 * `chat-canvas.tsx`'s `handleNodesChange` (Plan 41-02 Task 3), not here.
 */

import * as React from "react";
import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { Share2, X } from "lucide-react";
import Link from "next/link";

import { api } from "~/trpc/react";
import { hrefFor } from "~/components/provenance-link";

import { KnowledgePreviewMiniGraph } from "./knowledge-preview-mini-graph";
import { MAX_PREVIEW_NODES } from "./knowledge-preview-layout";
import type { KnowledgePreviewNodeData } from "./node-data-schemas";

export type KnowledgePreviewNodeType = Node<KnowledgePreviewNodeData, "knowledge-preview">;

const SELECTED_RING = "ring-2 ring-primary ring-offset-1";

/**
 * KNOWLEDGE_PREVIEW_STALE_TIME_MS — TanStack's own default staleTime is 0
 * (always-stale). A MODEST staleTime (41-CONTEXT.md) matches the freshness
 * tier `use-data-bindings.ts`'s `STALE_TIME_MS["knowledge.graph"]`/
 * `["knowledge.byId"]` already use for the same `knowledge.*` domain, kept
 * as an independent local constant since `expandNode` isn't one of that
 * module's 5 wired procedures.
 */
const KNOWLEDGE_PREVIEW_STALE_TIME_MS = 10_000;

interface ResolvableNode {
  readonly id: string;
  readonly label: string;
}

/**
 * resolveHeaderLabel — the exact 3-step resolution order (41-UI-SPEC.md
 * section 1): explicit `customLabel` always wins -> the resolved focus
 * node's own title once data has settled -> the fallback literal
 * "Knowledge preview". Defensive: `.find` returning `undefined` (still
 * loading, or a fail-closed empty response) never throws.
 */
export function resolveHeaderLabel(
  customLabel: string | undefined,
  nodes: ReadonlyArray<ResolvableNode> | undefined,
  focusNodeId: string,
): string {
  if (customLabel !== undefined) return customLabel;
  const resolved = nodes?.find((node) => node.id === focusNodeId);
  return resolved?.label ?? "Knowledge preview";
}

/**
 * resolveFooterCopy — 41-UI-SPEC.md section 3's exact footer copy table.
 */
export function resolveFooterCopy(overflowCount: number): string {
  if (overflowCount > 0) return `+${overflowCount} more — Open in Knowledge →`;
  return "Open in Knowledge →";
}

export const KnowledgePreviewNode = memo(function KnowledgePreviewNode({
  id,
  data,
  selected,
}: NodeProps<KnowledgePreviewNodeType>) {
  const { deleteElements } = useReactFlow();
  const query = api.knowledge.expandNode.useQuery(
    { nodeId: data.focusNodeId, depth: 2 },
    { staleTime: KNOWLEDGE_PREVIEW_STALE_TIME_MS },
  );

  const headerLabel = resolveHeaderLabel(data.label, query.data?.nodes, data.focusNodeId);
  const overflowCount = Math.max(0, (query.data?.nodes.length ?? 0) - MAX_PREVIEW_NODES);
  const footerCopy = resolveFooterCopy(overflowCount);

  return (
    <div
      className={`flex h-[240px] w-[320px] flex-col overflow-hidden rounded-lg border border-border/60 bg-background transition-shadow duration-150 animate-in fade-in-0 zoom-in-95 [animation-duration:250ms] motion-reduce:animate-none ${selected ? `${SELECTED_RING} shadow-elevation-2` : "shadow-elevation-1"}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-drag-handle flex h-9 shrink-0 cursor-grab items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 active:cursor-grabbing">
        <span className="flex min-w-0 items-center gap-2">
          <Share2 className="size-3 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-xs font-normal text-muted-foreground">
            {headerLabel}
          </span>
        </span>
        <button
          type="button"
          aria-label="Remove knowledge preview"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          onClick={(event) => {
            event.stopPropagation();
            void deleteElements({ nodes: [{ id }] });
          }}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <KnowledgePreviewMiniGraph
        focusNodeId={data.focusNodeId}
        nodes={query.data?.nodes ?? []}
        edges={query.data?.edges ?? []}
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      />
      <Link
        href={hrefFor("knowledge", data.focusNodeId)}
        className="flex h-7 w-full shrink-0 items-center justify-center gap-1 border-t border-border/60 px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        {footerCopy}
      </Link>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
