"use client";

import { useRef } from "react";

import {
  clientXYToNormalized,
  normalizedRectToPolygon,
} from "@nauta/api-client/geometry";

/** Minimum draw size in normalized units (1% of the page in each dimension). */
const MIN_DRAW_SIZE = 0.01;

interface PageSize {
  width: number;
  height: number;
}

interface LiveRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

interface DrawOverlayProps {
  pageSize: PageSize;
  liveRect: LiveRect | null;
  setLiveRect: (rect: LiveRect | null) => void;
  onRectDrawn: (polygon: ReadonlyArray<readonly [number, number]>) => void;
  onTooSmall: () => void;
}

/**
 * DrawOverlay — pointer-driven rectangle draw surface mounted over the PDF page.
 *
 * Captures pointer events (the root div is interactive — it must NOT swallow
 * events the way the read-only overlay layer does). On pointer-up the drawn
 * rect is normalized to a 4-corner polygon via normalizedRectToPolygon; draws
 * smaller than MIN_DRAW_SIZE in either dimension fire onTooSmall instead.
 */
export function DrawOverlay({
  pageSize,
  liveRect,
  setLiveRect,
  onRectDrawn,
  onTooSmall,
}: DrawOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<readonly [number, number] | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.setPointerCapture(e.pointerId);
    const bounds = overlay.getBoundingClientRect();
    const [x, y] = clientXYToNormalized(e.clientX, e.clientY, bounds);
    startRef.current = [x, y] as const;
    setLiveRect({ x0: x, y0: y, x1: x, y1: y });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const overlay = overlayRef.current;
    const start = startRef.current;
    if (!overlay || !start) return;
    const bounds = overlay.getBoundingClientRect();
    const [x, y] = clientXYToNormalized(e.clientX, e.clientY, bounds);
    setLiveRect({ x0: start[0], y0: start[1], x1: x, y1: y });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    const overlay = overlayRef.current;
    const start = startRef.current;
    if (!overlay || !start) return;
    if (overlay.hasPointerCapture(e.pointerId)) {
      overlay.releasePointerCapture(e.pointerId);
    }
    const bounds = overlay.getBoundingClientRect();
    const [x, y] = clientXYToNormalized(e.clientX, e.clientY, bounds);
    startRef.current = null;
    setLiveRect(null);

    const width = Math.abs(x - start[0]);
    const height = Math.abs(y - start[1]);
    if (width < MIN_DRAW_SIZE || height < MIN_DRAW_SIZE) {
      onTooSmall();
      return;
    }
    onRectDrawn(normalizedRectToPolygon(start[0], start[1], x, y));
  }

  return (
    <div
      ref={overlayRef}
      // z-20 lifts the draw surface above react-pdf's .textLayer (z-index: 2) and
      // the region overlay (z-10); without it the text layer swallows the
      // pointerdown/move and click-drag drawing never starts.
      className="absolute inset-0 z-20 cursor-crosshair touch-none"
      style={{ width: pageSize.width, height: pageSize.height }}
      role="application"
      aria-label="Drawing canvas"
      aria-description="Draw a rectangle. Press Escape to cancel."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Live preview rect — purely visual while dragging */}
      {liveRect && (
        <div
          aria-hidden="true"
          className="absolute border-2 border-primary border-dashed bg-primary/15"
          style={{
            left: Math.min(liveRect.x0, liveRect.x1) * pageSize.width,
            top: Math.min(liveRect.y0, liveRect.y1) * pageSize.height,
            width: Math.abs(liveRect.x1 - liveRect.x0) * pageSize.width,
            height: Math.abs(liveRect.y1 - liveRect.y0) * pageSize.height,
          }}
        />
      )}
    </div>
  );
}
