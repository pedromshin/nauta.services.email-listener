"use client";

/**
 * treemap.tsx — the shared, reusable `Treemap` primitive: a WizTree-style
 * rectangular landscape that REPLACES the circle-pack view everywhere it was
 * used (the emails "Landscape" tab, the canvas "Mailbox / Drive landscape"
 * node, the /files drive view).
 *
 * WHAT IT OWNS
 *   - squarified tiling (via `layoutTreemap`, layout-only d3-hierarchy math):
 *     the box is fully tiled, every node is a labelable rectangle sized by weight
 *   - LABELS on every tile that has room — the whole point: a mailbox reads as
 *     named senders/threads/messages, not anonymous bubbles
 *   - click-to-drill: clicking a container re-tiles it to fill the box (the
 *     WizTree double-click-to-zoom idiom); a leaf click fires `onLeafActivate`
 *   - the SAME zoom/breadcrumb/back/reset chrome, keyboard contract and
 *     touch gestures as the circle-pack it replaces — it reuses that primitive's
 *     pure state machine (`circle-pack-zoom.ts`) and gesture predicates verbatim
 *   - a hover card (default: name + value; overridable via `renderHoverCard`)
 *
 * DESIGN LAW (theme-aware, D-58-01)
 *   Chrome is monochrome (law 1): tiles are INK washes and hairline rules, never
 *   a hue — a leaf's `tint` (recency/unread) maps to an ink-alpha ramp, so the
 *   landscape heatmap stays chrome. WizTree earns its rainbow from file TYPE; we
 *   earn legibility from LABELS + tiling and keep the ink palette. Every value
 *   resolves through a `var(--token)` so both themes are honoured.
 */

import * as React from "react";
import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import { ChevronRight, CornerLeftUp, House } from "lucide-react";

import { cn } from "@polytoken/ui";

import {
  layoutTreemap,
  type PackedRect,
  type TreeNode,
} from "./treemap-layout";
import {
  ancestorsOf,
  CIRCLE_PACK_ROOT_ID,
  circlePackNavReducer,
  initialCirclePackNavState,
  type CirclePackNavState,
} from "../circle-pack/circle-pack-zoom";
import {
  isDoubleTap,
  isPinchOut,
  touchSpan,
  type TapRecord,
} from "../circle-pack/circle-pack-gestures";

export type { PackedRect, TreeNode } from "./treemap-layout";

/** Args handed to the leaf render-prop for one leaf tile. */
export interface TreemapLeafRenderArgs<TLeaf> {
  readonly rect: PackedRect<TLeaf>;
  readonly focused: boolean;
  readonly hovered: boolean;
  /** Tile size in pixels — use it to decide what fits. */
  readonly width: number;
  readonly height: number;
}

export interface TreemapProps<TLeaf = unknown> {
  readonly data: TreeNode<TLeaf>;
  readonly width: number;
  readonly height: number;
  readonly paddingInner?: number;
  readonly paddingOuter?: number;
  readonly headerHeight?: number;
  /** Custom content for a LEAF tile, replacing the default name/value label. */
  readonly renderLeaf?: (args: TreemapLeafRenderArgs<TLeaf>) => React.ReactNode;
  /** Secondary muted line under a leaf's name (e.g. "12 messages", "3.4 MB"). */
  readonly formatValue?: (rect: PackedRect<TLeaf>) => string;
  /**
   * Render every tile's NAME as evidence — `font-serif` + `data-evidence` (the
   * pair, design law 2) — because it is the user's OWN material (a mail subject,
   * a sender). The emails / mailbox surfaces set this; /files leaves it off (a
   * file name is a sans chrome LABEL there, D-66-06). The muted value line stays
   * sans chrome either way.
   */
  readonly evidenceLabels?: boolean;
  /** Overrides the default hover card (name + value). */
  readonly renderHoverCard?: (rect: PackedRect<TLeaf>) => React.ReactNode;
  /** Fired when a LEAF tile is clicked or activated with Enter. */
  readonly onLeafActivate?: (rect: PackedRect<TLeaf>) => void;
  /** Accessible name for the whole view. */
  readonly ariaLabel?: string;
  readonly className?: string;
}

/** Clamp a tint into [0,1]; absent ⇒ a mid wash so a tile is always visible. */
function clampTint(tint: number | undefined): number {
  if (tint === undefined || Number.isNaN(tint)) return 0.5;
  return Math.min(1, Math.max(0, tint));
}

const DEFAULT_HEADER = 16;

/**
 * Treemap — the primitive. Generic over the opaque leaf payload `TLeaf`.
 */
export function Treemap<TLeaf = unknown>({
  data,
  width,
  height,
  paddingInner = 1,
  paddingOuter = 2,
  headerHeight = DEFAULT_HEADER,
  renderLeaf,
  formatValue,
  evidenceLabels = false,
  renderHoverCard,
  onLeafActivate,
  ariaLabel = "Treemap view",
  className,
}: TreemapProps<TLeaf>): React.ReactElement {
  // Index the WHOLE tree once (focus-independent) for the reducer's read model.
  const index = useMemo(
    () => layoutTreemap<TLeaf>(data, CIRCLE_PACK_ROOT_ID, { width, height, paddingInner, paddingOuter, paddingTop: headerHeight }).index,
    [data, width, height, paddingInner, paddingOuter, headerHeight],
  );

  const [nav, dispatch] = useReducer(
    (state: CirclePackNavState, action: Parameters<typeof circlePackNavReducer>[1]) =>
      circlePackNavReducer(state, action, index),
    undefined,
    initialCirclePackNavState,
  );

  // Tile the FOCUSED subtree to fill the box. Re-tiling on drill keeps labels
  // crisp at every level (no viewBox scaling / blur).
  const rects = useMemo(
    () => layoutTreemap<TLeaf>(data, nav.focusId, { width, height, paddingInner, paddingOuter, paddingTop: headerHeight }).rects,
    [data, nav.focusId, width, height, paddingInner, paddingOuter, headerHeight],
  );
  const byId = useMemo(() => {
    const m = new Map<string, PackedRect<TLeaf>>();
    for (const r of rects) m.set(r.id, r);
    return m;
  }, [rects]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ── touch zoom-OUT gestures (touch has no Esc key), reused verbatim ────────
  const lastTapRef = useRef<TapRecord | null>(null);
  const pinchStartRef = useRef<number | null>(null);
  const pinchFiredRef = useRef(false);
  const multiTouchRef = useRef(false);
  const suppressClickRef = useRef(false);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2) {
      multiTouchRef.current = true;
      pinchFiredRef.current = false;
      pinchStartRef.current = touchSpan(event.touches[0]!, event.touches[1]!);
    }
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (
      event.touches.length >= 2 &&
      pinchStartRef.current !== null &&
      !pinchFiredRef.current &&
      isPinchOut(pinchStartRef.current, touchSpan(event.touches[0]!, event.touches[1]!))
    ) {
      pinchFiredRef.current = true;
      suppressClickRef.current = true;
      dispatch({ type: "zoomOut" });
    }
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length > 0) return;
    const wasMultiTouch = multiTouchRef.current;
    multiTouchRef.current = false;
    pinchStartRef.current = null;
    pinchFiredRef.current = false;
    if (wasMultiTouch) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const rec: TapRecord = { time: Date.now(), x: touch.clientX, y: touch.clientY };
    if (isDoubleTap(lastTapRef.current, rec)) {
      lastTapRef.current = null;
      suppressClickRef.current = true;
      dispatch({ type: "zoomOut" });
    } else {
      lastTapRef.current = rec;
    }
  }, []);

  const handleTileClick = useCallback(
    (rect: PackedRect<TLeaf>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      // Clicking the container you are already drilled to steps OUT to its parent.
      if (!rect.isLeaf && rect.id === nav.focusId) {
        dispatch({ type: "zoomOut" });
        return;
      }
      dispatch({ type: "focus", id: rect.id });
      if (rect.isLeaf) onLeafActivate?.(rect);
    },
    [onLeafActivate, nav.focusId],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          dispatch({ type: "sibling", dir: "next" });
          break;
        case "ArrowLeft":
          event.preventDefault();
          dispatch({ type: "sibling", dir: "prev" });
          break;
        case "ArrowDown":
          event.preventDefault();
          dispatch({ type: "child" });
          break;
        case "ArrowUp":
          event.preventDefault();
          dispatch({ type: "parent" });
          break;
        case "Enter": {
          event.preventDefault();
          const cursor = byId.get(nav.cursorId);
          if (cursor?.isLeaf) onLeafActivate?.(cursor);
          dispatch({ type: "zoomIn" });
          break;
        }
        case "Escape":
          event.preventDefault();
          dispatch({ type: "zoomOut" });
          break;
        default:
          break;
      }
    },
    [byId, nav.cursorId, onLeafActivate],
  );

  const hovered = hoveredId ? byId.get(hoveredId) : undefined;

  // The drill path root → … → focus, as clickable crumbs (reuses the pure
  // ancestor walk). Empty at the root, so the nav bar hides at full zoom-out.
  const trail = useMemo(
    () =>
      ancestorsOf(index, nav.focusId)
        .map((id) => ({ id, name: index.datumOf.get(id)?.name ?? "" })),
    [index, nav.focusId],
  );
  const zoomedIn = nav.focusId !== CIRCLE_PACK_ROOT_ID;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-testid="treemap"
      className={cn(
        "relative select-none overflow-hidden rounded-card bg-bright outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
      style={{ width, height }}
    >
      {/* Tiles layer. Rects come in DFS order (parent before child), so a
          container paints BEHIND its children — nesting reads correctly. */}
      <div className="absolute inset-0">
        {rects.map((rect) => {
          const w = rect.x1 - rect.x0;
          const h = rect.y1 - rect.y0;
          if (w <= 0 || h <= 0) return null;

          const isCursor = rect.id === nav.cursorId;
          const isHovered = rect.id === hoveredId;
          const isFocusRoot = rect.id === nav.focusId;
          const highlight = isCursor || isHovered;
          const style: React.CSSProperties = { left: rect.x0, top: rect.y0, width: w, height: h };

          if (rect.isLeaf) {
            const tint = clampTint(rect.datum.tint);
            const showLabel = w >= 30 && h >= 16;
            const showValue = Boolean(formatValue) && w >= 44 && h >= 30;
            return (
              <div
                key={rect.id}
                data-tile-id={rect.id}
                data-leaf="true"
                className="absolute cursor-pointer"
                style={style}
                onClick={(event) => {
                  event.stopPropagation();
                  handleTileClick(rect);
                }}
                onMouseEnter={() => setHoveredId(rect.id)}
                onMouseLeave={() => setHoveredId((prev) => (prev === rect.id ? null : prev))}
              >
                {/* ink wash whose alpha encodes tint (recency / unread) */}
                <div
                  className="absolute inset-0 rounded-[2px]"
                  style={{ backgroundColor: "var(--ink)", opacity: 0.1 + tint * 0.45 }}
                />
                <div
                  className={cn(
                    "absolute inset-0 rounded-[2px] border",
                    highlight ? "border-ink" : "border-hair",
                  )}
                />
                {renderLeaf ? (
                  <div className="pointer-events-none absolute inset-0">
                    {renderLeaf({ rect, focused: isFocusRoot, hovered: isHovered, width: w, height: h })}
                  </div>
                ) : showLabel ? (
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-start gap-0 overflow-hidden p-1 leading-tight">
                    <span
                      className={cn(
                        "truncate text-[10px] text-ink",
                        evidenceLabels ? "font-serif" : "font-medium",
                      )}
                      data-evidence={evidenceLabels ? true : undefined}
                    >
                      {rect.datum.name}
                    </span>
                    {showValue ? (
                      <span className="tabular truncate text-[9px] text-faded">
                        {formatValue?.(rect)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          }

          // Container: transparent body (children read through), hairline border,
          // and a header band carrying its label. Clicking the header drills in
          // (or, on the focus root, steps out).
          const showHeader = w >= 36 && h >= headerHeight;
          return (
            <div
              key={rect.id}
              data-tile-id={rect.id}
              data-leaf="false"
              className="absolute"
              style={style}
              onMouseEnter={() => setHoveredId(rect.id)}
              onMouseLeave={() => setHoveredId((prev) => (prev === rect.id ? null : prev))}
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-[2px] border",
                  highlight || isFocusRoot ? "border-ink" : "border-rule",
                )}
                style={{ backgroundColor: "var(--ink)", opacity: 0.02 }}
              />
              {showHeader ? (
                <button
                  type="button"
                  data-tile-header={rect.id}
                  aria-label={isFocusRoot ? `Back out of ${rect.datum.name}` : `Open ${rect.datum.name}`}
                  className="absolute inset-x-0 top-0 flex cursor-pointer items-center gap-1 overflow-hidden px-1 text-left"
                  style={{ height: headerHeight }}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleTileClick(rect);
                  }}
                >
                  <span
                    className={cn(
                      "truncate text-[10px] text-ink",
                      evidenceLabels ? "font-serif" : "font-semibold",
                    )}
                    data-evidence={evidenceLabels ? true : undefined}
                  >
                    {rect.datum.name}
                  </span>
                  <span className="tabular shrink-0 text-[9px] text-faded">
                    {formatValue ? formatValue(rect) : rect.value.toLocaleString()}
                  </span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Zoom-OUT chrome — only while drilled in, identical to the circle-pack. */}
      {zoomedIn ? (
        <div
          data-testid="treemap-nav"
          className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-center gap-1.5"
        >
          <button
            type="button"
            data-testid="treemap-zoom-out"
            aria-label="Zoom out"
            title="Back (up one level)"
            onClick={() => dispatch({ type: "zoomOut" })}
            className="pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-full border border-rule bg-bright text-ink transition-colors hover:bg-ink-08 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 pointer-coarse:touch-target"
          >
            <CornerLeftUp className="size-4" aria-hidden />
          </button>

          <nav
            aria-label="Breadcrumb"
            data-testid="treemap-breadcrumb"
            className="pointer-events-auto flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden rounded-full border border-rule bg-bright px-2 py-1"
          >
            {trail.map((crumb, i) => {
              const isLast = i === trail.length - 1;
              const isRoot = crumb.id === CIRCLE_PACK_ROOT_ID;
              return (
                <React.Fragment key={crumb.id}>
                  {i > 0 ? (
                    <ChevronRight className="size-3 shrink-0 text-faded" aria-hidden />
                  ) : null}
                  <button
                    type="button"
                    data-testid="treemap-crumb"
                    data-crumb-id={crumb.id}
                    aria-current={isLast ? "location" : undefined}
                    disabled={isLast}
                    onClick={() =>
                      dispatch(isRoot ? { type: "reset" } : { type: "focus", id: crumb.id })
                    }
                    className={cn(
                      "max-w-[9rem] shrink-0 truncate rounded-sm px-1 text-xs transition-colors",
                      isLast ? "font-medium text-ink" : "text-faded hover:text-ink hover:underline",
                    )}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          <button
            type="button"
            data-testid="treemap-reset"
            aria-label="Reset to root"
            title="Reset to root"
            onClick={() => dispatch({ type: "reset" })}
            className="pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-full border border-rule bg-bright text-ink transition-colors hover:bg-ink-08 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 pointer-coarse:touch-target"
          >
            <House className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {hovered ? (
        <div
          data-testid="treemap-hover-card"
          role="tooltip"
          className="pointer-events-none absolute z-10 max-w-[220px] -translate-x-1/2 -translate-y-full rounded-md border border-rule bg-bright px-chip-x py-chip-y text-xs text-ink shadow-none"
          style={{
            left: Math.min(width - 8, Math.max(8, (hovered.x0 + hovered.x1) / 2)),
            top: Math.max(8, hovered.y0),
          }}
        >
          {renderHoverCard ? (
            renderHoverCard(hovered)
          ) : (
            <span className="flex flex-col gap-0.5">
              <span className="truncate font-medium text-ink">{hovered.datum.name}</span>
              <span className="tabular text-faded">
                {formatValue ? formatValue(hovered) : hovered.value.toLocaleString()}
                {hovered.isLeaf || formatValue ? "" : " total"}
              </span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
