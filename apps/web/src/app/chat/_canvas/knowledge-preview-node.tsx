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
 *
 * CHROME (61-06): the shared card recipe (`canvasNodeShellClass`) plus
 * `CANVAS_NODE_KIND_GEOMETRY["knowledge-preview"]` — a left rule AND a dotted
 * frame, because this card is a bounded, non-interactive GLANCE at another
 * surface rather than an artifact in its own right (61-02's kind axis; law 3:
 * shape, never hue).
 *
 * LAW 2 — the header label stays SANS, and the reasoning is the same test
 * `email-thread-node.tsx` applies to reach the opposite answer. A knowledge
 * node's label is polytoken's own canonical name for a resolved entity — its
 * index term, deduped and normalized across every mail it ever appeared in —
 * not a sentence the mail contains. The `?? "Knowledge preview"` fallback is
 * polytoken's word outright. Serif is a claim that has to be earned; this
 * label does not earn it.
 */

import * as React from "react";
import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { Share2, X } from "lucide-react";
import Link from "next/link";

import { api } from "~/trpc/react";
import { hrefFor } from "~/components/provenance-link";

import { canvasNodeShellClass } from "./canvas-node-shell-class";
import { CANVAS_NODE_KIND_GEOMETRY } from "./canvas-vocabulary";
import { KnowledgePreviewMiniGraph } from "./knowledge-preview-mini-graph";
import { MAX_PREVIEW_NODES } from "./knowledge-preview-layout";
import type { KnowledgePreviewNodeData } from "./node-data-schemas";

export type KnowledgePreviewNodeType = Node<KnowledgePreviewNodeData, "knowledge-preview">;

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
      className={`h-[240px] w-[320px] animate-in fade-in-0 zoom-in-95 [animation-duration:250ms] motion-reduce:animate-none ${canvasNodeShellClass(CANVAS_NODE_KIND_GEOMETRY["knowledge-preview"], selected === true)}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-drag-handle flex h-9 shrink-0 cursor-grab items-center justify-between gap-2 border-b border-hair px-3 active:cursor-grabbing">
        <span className="flex min-w-0 items-center gap-2">
          <Share2 className="size-3 shrink-0 text-faded" aria-hidden />
          {/* SANS — polytoken's canonical name for an entity, not the mail's
              own words. See the file header's law-2 note. */}
          <span className="truncate text-xs font-semibold text-ink">
            {headerLabel}
          </span>
        </span>
        {/* The sketch's `.xbtn` — INK. Removing this card from the board is not
            irreversible (T-61-19): the knowledge node itself survives untouched
            and the card re-adds from the same popover. */}
        <button
          type="button"
          aria-label="Remove knowledge preview"
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-pencil transition-colors hover:bg-ink-08 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 pointer-coarse:touch-target"
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
      {/* The sketch's `.cf` rule + `.tbtn.quiet` register. This footer IS
          interactive (unlike 61-04's tool row), so a hover is honest — it goes
          on the sketch's own hover step (--ink-05) instead of the shadcn accent
          well, and keeps its coarse-pointer touch-target floor. */}
      <Link
        href={hrefFor("knowledge", data.focusNodeId)}
        className="flex h-7 w-full shrink-0 items-center justify-center gap-1 border-t border-hair px-3 text-xs text-faded transition-colors hover:bg-ink-05 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 pointer-coarse:h-11"
      >
        {footerCopy}
      </Link>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
