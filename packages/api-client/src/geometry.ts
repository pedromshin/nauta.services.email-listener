/**
 * Geometry utilities for the PDF overlay layer.
 *
 * All functions are pure (no side effects, immutable inputs/outputs).
 */

/** Clamps a value to [lo, hi]. */
const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/**
 * Converts a normalized 4-corner polygon (0–1 coordinates, top-left origin)
 * to a CSS-position-fraction rect `{ left, top, width, height }`.
 *
 * The polygon need not be axis-aligned — the function collapses any convex or
 * concave polygon to its min/max bounding box.
 *
 * Special cases:
 * - Empty polygon: returns `{ left: 0, top: 0, width: 0, height: 0 }` — never
 *   produces Infinity or NaN (CR-02).
 * - Single-point degenerate polygon: returns `{ ..., width: 0, height: 0 }`.
 * - Coordinates outside [0, 1] are clamped before bounding-box computation so
 *   that rounding errors from the Python pipeline cannot produce offscreen
 *   overlay boxes (WR-05).
 * - Never throws, never returns NaN.
 *
 * @param polygon  Array of `[x, y]` tuples, each nominally in the range [0, 1].
 * @returns A new, readonly rect object each call.
 */
export function polygonToRect(
  polygon: ReadonlyArray<readonly [number, number]>,
): { readonly left: number; readonly top: number; readonly width: number; readonly height: number } {
  // Guard: empty polygon would produce Infinity via Math.min/max spread (CR-02)
  if (polygon.length === 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  // Clamp individual coordinates to [0, 1] before bounding-box computation
  // so that pipeline rounding errors cannot push overlays offscreen (WR-05).
  const xs = polygon.map(([x]) => clamp(x, 0, 1));
  const ys = polygon.map(([, y]) => clamp(y, 0, 1));

  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);

  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Converts a pointer event's client coordinates to normalized [0, 1] coordinates
 * relative to the overlay div's bounding rect.
 *
 * Pure function — never mutates inputs; returns a new readonly tuple each call.
 *
 * @param clientX  Pointer `clientX` from a pointer event.
 * @param clientY  Pointer `clientY` from a pointer event.
 * @param overlayBounds  `DOMRect` obtained from `element.getBoundingClientRect()`.
 * @returns A new `readonly [x, y]` tuple clamped to [0, 1].
 */
export function clientXYToNormalized(
  clientX: number,
  clientY: number,
  overlayBounds: DOMRect,
): readonly [number, number] {
  const x = clamp((clientX - overlayBounds.left) / overlayBounds.width, 0, 1);
  const y = clamp((clientY - overlayBounds.top) / overlayBounds.height, 0, 1);
  return [x, y] as const;
}

/**
 * Converts top-left and bottom-right normalized coordinates (from a pointer drag)
 * to the 4-corner polygon format expected by the API — clockwise from top-left.
 *
 * Handles reversed drags (x1 < x0 or y1 < y0) by normalizing to left/top/right/bottom
 * via `Math.min` / `Math.max`.
 *
 * Pure function — never mutates inputs; returns a new readonly array each call.
 *
 * @param x0  Starting normalized x coordinate.
 * @param y0  Starting normalized y coordinate.
 * @param x1  Ending normalized x coordinate.
 * @param y1  Ending normalized y coordinate.
 * @returns A new `ReadonlyArray` of 4 `readonly [x, y]` corner tuples.
 */
export function normalizedRectToPolygon(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): ReadonlyArray<readonly [number, number]> {
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const right = Math.max(x0, x1);
  const bottom = Math.max(y0, y1);
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ] as const;
}
