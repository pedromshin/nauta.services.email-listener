"use client";

import { Button } from "@polytoken/ui/button";

type ActiveDrawMode = "redraw" | "split" | "add";

interface DrawModeBarProps {
  mode: ActiveDrawMode;
  drawnCount: number;
  onCancel: () => void;
  onConfirmSplit?: () => void;
  onDrawAnother?: () => void;
}

const HEADINGS: Record<ActiveDrawMode, string> = {
  redraw: "Draw Mode: Redraw",
  split: "Draw Mode: Split",
  add: "Draw Mode: Add Region",
};

const INSTRUCTIONS: Record<ActiveDrawMode, string> = {
  redraw: "Draw a rectangle to replace the region.",
  split: "Draw rectangles to define sub-regions.",
  add: "Draw a rectangle to define a new region.",
};

/**
 * DrawModeBar — status banner shown while draw mode is active.
 *
 * Split mode additionally shows the drawn-rect count, a "Draw another"
 * affordance, and a confirm button enabled once two or more rects exist.
 */
export function DrawModeBar({
  mode,
  drawnCount,
  onCancel,
  onConfirmSplit,
  onDrawAnother,
}: DrawModeBarProps) {
  const countText =
    drawnCount === 1 ? "1 region drawn" : `${drawnCount} regions drawn`;

  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b px-4 py-2 bg-muted text-sm"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm font-semibold">{HEADINGS[mode]}</span>
      <span className="text-sm text-muted-foreground">
        {INSTRUCTIONS[mode]}
      </span>
      {mode === "split" && drawnCount >= 1 && (
        <>
          <span className="text-sm text-muted-foreground">{countText}</span>
          <Button
            variant="outline"
            size="sm"
            aria-label="Draw another region boundary"
            onClick={onDrawAnother}
          >
            Draw another
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={drawnCount < 2}
            onClick={onConfirmSplit}
          >
            Confirm split ({drawnCount})
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        aria-label="Cancel current draw operation"
        aria-keyshortcuts="Escape"
        onClick={onCancel}
      >
        Cancel Draw (Esc)
      </Button>
    </div>
  );
}
