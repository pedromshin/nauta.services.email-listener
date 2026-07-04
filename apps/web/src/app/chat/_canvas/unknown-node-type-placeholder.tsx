"use client";

/**
 * unknown-node-type-placeholder.tsx — inert degrade-gracefully card for a
 * persisted node type this session's NODE_TYPE_REGISTRY doesn't recognize
 * (CANVAS-03, D-04, T-23-05).
 *
 * Position/size come from the persisted layout's Node object itself (React
 * Flow applies those independent of the custom node component) — this
 * component only fills its container, so the canvas's overall spatial
 * arrangement is undisturbed by a registry miss. No action button, no
 * interactive content: an unrecognized node type is TAMPERING-class
 * untrusted input and must never execute or render anything beyond this
 * static card (never a crash, never a blank canvas).
 *
 * Copy + colors verbatim from 23-UI-SPEC.md's Copywriting Contract / Color
 * table: `bg-muted/40 border-destructive/30`, `AlertTriangle` icon.
 */

import { AlertTriangle } from "lucide-react";
import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";

export type UnknownNodeTypeNodeData = { readonly nodeType: string } & Record<
  string,
  unknown
>;
export type UnknownNodeTypeNodeType = Node<
  UnknownNodeTypeNodeData,
  "unknown-node-type"
>;

export const UnknownNodeTypePlaceholder = memo(function UnknownNodeTypePlaceholder({
  data,
}: NodeProps<UnknownNodeTypeNodeType>) {
  return (
    <div className="flex h-full min-h-[240px] w-full min-w-[320px] flex-col gap-2 rounded-lg border border-destructive/30 bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
        <span className="text-sm font-normal text-foreground">
          This panel type isn&apos;t supported in this version.
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Type: {data.nodeType} · The canvas layout is unaffected — this panel is
        skipped safely.
      </p>
    </div>
  );
});
