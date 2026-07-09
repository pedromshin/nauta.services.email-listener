"use client";

/**
 * graph-toolbar.tsx — h-11 top-of-page toolbar for the /knowledge graph surface.
 *
 * UI-SPEC Toolbar:
 *   Left:  page title "Knowledge" text-sm font-semibold
 *   Right: zoom-to-fit (Maximize2, aria-label "Zoom to fit"),
 *          layout-toggle (disabled — dagre only, aria-label "Toggle layout"),
 *          node count text-xs text-muted-foreground
 *
 * Presentational: state + handlers injected via props from knowledge-graph.tsx.
 * No font-medium (500) — UI-SPEC Note #5. Only font-normal / font-semibold.
 */

import { Maximize2 } from "lucide-react";

import { Button } from "@polytoken/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GraphToolbarProps {
  readonly total: number;
  readonly onFitView: () => void;
  /** GRAPH-03 — the tier-filter control, inserted between the title and the right-aligned action group. */
  readonly children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphToolbar({
  total,
  onFitView,
  children,
}: GraphToolbarProps): React.ReactElement {
  return (
    <div
      className="flex h-11 shrink-0 items-center justify-between border-b border-border/50 bg-background/70 px-4 backdrop-blur-md"
    >
      {/* Left: page title */}
      <span className="text-sm font-semibold">Knowledge</span>

      {/* Middle: tier-filter control (GRAPH-03) — NOT inside FilterRail */}
      {children}

      {/* Right: toolbar actions */}
      <div className="flex items-center gap-1">
        {/* Zoom-to-fit */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Zoom to fit"
          onClick={onFitView}
        >
          <Maximize2 className="size-4" aria-hidden />
        </Button>

        {/* Layout toggle — disabled: dagre is the only layout */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Toggle layout"
          aria-pressed={true}
          disabled
        >
          {/* No icon specified in UI-SPEC for layout toggle; using a placeholder */}
          <span className="size-4 flex items-center justify-center text-xs" aria-hidden>⊞</span>
        </Button>

        {/* Node count */}
        <span className="px-2 text-xs text-muted-foreground">
          {total} nodes
        </span>
      </div>
    </div>
  );
}
