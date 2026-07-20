"use client";

/**
 * document-node.tsx — DocumentNode: the canvas's `document` custom React Flow
 * node (Phase 70 — DOCS-02) — the 5th node type alongside
 * ChatNode/GenuiPanelNode/KnowledgePreviewNode/EmailThreadNode.
 *
 * A STUB in the sense the plan asks for: it makes a stored document placeable on
 * the canvas as a first-class node, anchored on a `documentId` ref. It mirrors
 * `EmailThreadNode`'s shape exactly — fixed shell on the shared card recipe,
 * data fetching HERE (`api.documents.byId`, gated through ownership.ts) with
 * node.data carrying ONLY the ref (never the fetched content), a
 * loading/error/unavailable/success body in that branch order, and a one-action
 * footer ("Open document" deep-link into /documents/[id]).
 *
 * LAW 2 on this card: the document TITLE is the user's own material (their
 * synthesised report), so it is SERIF + data-evidence — marked on the SPAN,
 * never the header row, exactly as EmailThreadNode marks a thread subject (a
 * serif container would hand the font down to the sans caption by INHERITANCE,
 * which no className-reading gate can see). The generated-date caption is
 * polytoken's summary chrome, so it stays SANS.
 *
 * Kind geometry: `CANVAS_NODE_KIND_GEOMETRY["document"]` — a DOUBLE left rule at
 * evidence weight (2), the shape that says "a bound artifact, a synthesis" (law
 * 3: kind is shape, never hue). Remove mirrors the sibling nodes byte-for-byte:
 * `deleteElements` drops only the placement; the underlying document survives.
 */

import * as React from "react";
import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { AlertCircle, FileText, X } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@polytoken/ui/skeleton";

import { api } from "~/trpc/react";

import { canvasNodeShellClass } from "./canvas-node-shell-class";
import { CANVAS_NODE_KIND_GEOMETRY } from "./canvas-vocabulary";
import type { DocumentNodeData } from "./node-data-schemas";

export type DocumentNodeType = Node<DocumentNodeData, "document">;

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : dateFmt.format(d);
}

/**
 * resolveHeaderLabel — mirrors EmailThreadNode's 3-step order: explicit
 * `customLabel` always wins -> the fetched document's own `title` once the
 * query settles -> the fallback literal "Untitled document".
 */
export function resolveHeaderLabel(
  customLabel: string | undefined,
  fetchedTitle: string | null | undefined,
): string {
  if (customLabel !== undefined) return customLabel;
  if (fetchedTitle) return fetchedTitle;
  return "Untitled document";
}

export const DocumentNode = memo(function DocumentNode({
  id,
  data,
  selected,
}: NodeProps<DocumentNodeType>) {
  const { deleteElements } = useReactFlow();
  const query = api.documents.byId.useQuery({ id: data.documentId });

  const headerLabel = resolveHeaderLabel(data.label, query.data?.title);
  const canOpen = query.data !== undefined && query.data !== null;

  return (
    <div
      className={`h-[140px] w-[300px] animate-in fade-in-0 zoom-in-95 [animation-duration:250ms] motion-reduce:animate-none ${canvasNodeShellClass(CANVAS_NODE_KIND_GEOMETRY.document, selected === true)}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-drag-handle flex h-9 shrink-0 cursor-grab items-center justify-between gap-2 border-b border-hair px-3 active:cursor-grabbing">
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="size-3 shrink-0 text-faded" aria-hidden />
          {/* The document's own title — SERIF, marked on the SPAN (see header). */}
          <span
            className="truncate font-serif text-xs font-semibold text-ink"
            data-evidence
          >
            {headerLabel}
          </span>
        </span>
        <button
          type="button"
          aria-label="Remove document"
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-pencil transition-colors hover:bg-ink-08 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 pointer-coarse:touch-target"
          onClick={(event) => {
            event.stopPropagation();
            void deleteElements({ nodes: [{ id }] });
          }}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="relative flex flex-1 flex-col gap-1 px-3 py-2">
        {query.isPending ? (
          <div
            role="status"
            aria-label="Loading document"
            className="flex flex-col gap-2"
          >
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : query.isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-1 text-center">
            <AlertCircle className="size-5 shrink-0 text-ink" aria-hidden />
            <p className="text-xs text-faded">
              Couldn&apos;t load this document. Try again, or open it from your
              documents.
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="rounded-sm px-1.5 py-0.5 text-xs text-faded transition-colors hover:bg-ink-08 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              Retry
            </button>
          </div>
        ) : query.data === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-1 text-center">
            <FileText className="size-5 shrink-0 text-faded" aria-hidden />
            <p className="text-xs text-faded">
              This document is unavailable. It may have been removed or is no
              longer accessible.
            </p>
          </div>
        ) : query.data ? (
          <div className="flex min-w-0 flex-col gap-1 text-2xs text-faded">
            <span>
              Generated{" "}
              <span className="tabular">{formatDate(query.data.createdAt)}</span>
            </span>
            {query.data.sourceLedgerId ? (
              <span>From a research run</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex h-9 shrink-0 items-center justify-end gap-1 border-t border-hair px-2">
        <Link
          href={canOpen ? `/documents/${data.documentId}` : "#"}
          aria-disabled={!canOpen}
          onClick={(event) => {
            if (!canOpen) event.preventDefault();
          }}
          className={`flex h-7 shrink-0 items-center gap-1 rounded-sm px-2 text-xs text-faded transition-colors hover:bg-ink-05 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 pointer-coarse:h-11 ${canOpen ? "" : "pointer-events-none opacity-50"}`}
        >
          Open document →
        </Link>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
