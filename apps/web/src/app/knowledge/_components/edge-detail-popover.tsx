"use client";

/**
 * edge-detail-popover.tsx — minimal suggestion-edge detail surface + Promote
 * button (Phase-30 TIER-03 closure, 32-03).
 *
 * UI-SPEC LOCKED popover order: header "Suggested relationship" / "Relation"
 * value=relationType / "Tier" Badge / "Confidence" = Math.round(confidence*100)%
 * (omit row if confidence absent) / "Source" (omit row if provenanceSummary
 * unavailable — never "undefined" or a raw JSON blob) / Separator / "Promote to
 * confirmed" button (Check icon, Loader2 spin while pending, disabled while
 * pending). No success toast — the edge's own re-styling IS the confirmation.
 *
 * Scope discipline (hard ceiling): ONE popover, ONE button, error toast on 4xx —
 * no review queue, no bulk operations, no dismiss/deactivate action.
 *
 * SECURITY (T-11-05 discipline, mirrored from node-detail-pane.tsx): every
 * DB-origin string (relationType, provenanceSummary) renders as plain escaped
 * React text — no dangerouslySetInnerHTML anywhere in this file.
 *
 * No font-medium (500) — only font-normal (400) or font-semibold (600).
 */

import { Check, Loader2 } from "lucide-react";

import { Badge } from "@polytoken/ui/badge";
import { Button } from "@polytoken/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@polytoken/ui/popover";
import { Separator } from "@polytoken/ui/separator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PopoverEdge {
  readonly id: string;
  readonly relationType: string;
  readonly tier: "INFERRED" | "AMBIGUOUS";
  readonly confidence?: number;
  readonly provenanceSummary?: string;
}

export interface AnchorPoint {
  readonly x: number;
  readonly y: number;
}

interface EdgeDetailPopoverProps {
  readonly edge: PopoverEdge | null;
  readonly anchorPosition: AnchorPoint | null;
  readonly pending: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPromote: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

/** Reuses the tier's own edge-treatment recipe: INFERRED neutral muted, AMBIGUOUS
 * the same at reduced opacity — consistent with the edge's own faint styling. */
function TierBadge({ tier }: { readonly tier: "INFERRED" | "AMBIGUOUS" }): React.ReactElement {
  return (
    <Badge
      variant="secondary"
      className={
        tier === "AMBIGUOUS"
          ? "bg-muted text-muted-foreground border-border opacity-60"
          : "bg-muted text-muted-foreground border-border"
      }
    >
      {tier}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EdgeDetailPopover({
  edge,
  anchorPosition,
  pending,
  onOpenChange,
  onPromote,
}: EdgeDetailPopoverProps): React.ReactElement {
  return (
    <Popover open={edge !== null} onOpenChange={onOpenChange}>
      {/* Anchored at the click coordinates — a 0-size fixed point, not a
       * visible trigger element (this affordance opens via edge click, not a
       * button). */}
      <PopoverAnchor asChild>
        <span
          className="pointer-events-none fixed size-0"
          style={{ left: anchorPosition?.x ?? 0, top: anchorPosition?.y ?? 0 }}
          aria-hidden
        />
      </PopoverAnchor>
      {edge !== null && (
        <PopoverContent align="center" className="space-y-3">
          <p className="text-sm font-semibold">Suggested relationship</p>

          <div className="space-y-2">
            <DetailRow label="Relation">{edge.relationType}</DetailRow>
            <DetailRow label="Tier">
              <TierBadge tier={edge.tier} />
            </DetailRow>
            {edge.confidence !== undefined && (
              <DetailRow label="Confidence">
                {Math.round(edge.confidence * 100)}%
              </DetailRow>
            )}
            {edge.provenanceSummary !== undefined && (
              <DetailRow label="Source">{edge.provenanceSummary}</DetailRow>
            )}
          </div>

          <Separator />

          <Button
            type="button"
            variant="default"
            className="w-full"
            disabled={pending}
            onClick={onPromote}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            Promote to confirmed
          </Button>
        </PopoverContent>
      )}
    </Popover>
  );
}
