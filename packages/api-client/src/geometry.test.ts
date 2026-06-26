import { describe, expect, it } from "vitest";

import {
  clientXYToNormalized,
  normalizedRectToPolygon,
  polygonToRect,
} from "./geometry";

/**
 * Helper: round a rect's fields to avoid IEEE 754 floating-point noise
 * (e.g. 0.6 - 0.2 === 0.39999999999999997 in JS).
 */
function roundRect(
  r: { left: number; top: number; width: number; height: number },
  decimals = 10,
): { left: number; top: number; width: number; height: number } {
  const f = 10 ** decimals;
  return {
    left: Math.round(r.left * f) / f,
    top: Math.round(r.top * f) / f,
    width: Math.round(r.width * f) / f,
    height: Math.round(r.height * f) / f,
  };
}

describe("polygonToRect", () => {
  it("maps axis-aligned rectangle polygon to correct rect", () => {
    const polygon = [
      [0.1, 0.2],
      [0.5, 0.2],
      [0.5, 0.6],
      [0.1, 0.6],
    ] as const satisfies ReadonlyArray<readonly [number, number]>;

    expect(roundRect(polygonToRect(polygon))).toEqual({
      left: 0.1,
      top: 0.2,
      width: 0.4,
      height: 0.4,
    });
  });

  it("maps full-page polygon [[0,0],[1,0],[1,1],[0,1]] to full rect", () => {
    const polygon = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ] as const satisfies ReadonlyArray<readonly [number, number]>;

    expect(polygonToRect(polygon)).toEqual({
      left: 0,
      top: 0,
      width: 1,
      height: 1,
    });
  });

  it("handles skewed (non-axis-aligned) polygon via min/max bounding box", () => {
    // Diamond shape: top(0.5,0), right(1,0.5), bottom(0.5,1), left(0,0.5)
    const polygon = [
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ] as const satisfies ReadonlyArray<readonly [number, number]>;

    expect(polygonToRect(polygon)).toEqual({
      left: 0,
      top: 0,
      width: 1,
      height: 1,
    });
  });

  it("handles single-point degenerate polygon (width:0, height:0, no NaN, no throw)", () => {
    const polygon = [
      [0.3, 0.7],
    ] as const satisfies ReadonlyArray<readonly [number, number]>;

    const result = polygonToRect(polygon);

    expect(result).toEqual({ left: 0.3, top: 0.7, width: 0, height: 0 });
    expect(Number.isNaN(result.width)).toBe(false);
    expect(Number.isNaN(result.height)).toBe(false);
  });

  it("returns a new immutable object each call (does not mutate input)", () => {
    const polygon = [
      [0.1, 0.2],
      [0.5, 0.2],
      [0.5, 0.6],
      [0.1, 0.6],
    ] as const satisfies ReadonlyArray<readonly [number, number]>;

    const result1 = polygonToRect(polygon);
    const result2 = polygonToRect(polygon);

    // Different object references
    expect(result1).not.toBe(result2);

    // Input array is unmodified
    expect(polygon[0]).toEqual([0.1, 0.2]);
    expect(polygon[1]).toEqual([0.5, 0.2]);
  });

  it("returns zero-size rect for empty polygon (no Infinity, no throw) [CR-02]", () => {
    const result = polygonToRect([]);
    expect(result).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(Number.isFinite(result.left)).toBe(true);
    expect(Number.isFinite(result.top)).toBe(true);
    expect(Number.isFinite(result.width)).toBe(true);
    expect(Number.isFinite(result.height)).toBe(true);
  });

  it("clamps out-of-range coordinates to [0, 1] (WR-05)", () => {
    // Polygon with coordinates slightly outside [0,1] due to pipeline rounding
    const polygon = [
      [-0.05, -0.1],
      [1.05, -0.1],
      [1.05, 1.1],
      [-0.05, 1.1],
    ] as const satisfies ReadonlyArray<readonly [number, number]>;

    const result = polygonToRect(polygon);
    expect(result.left).toBeGreaterThanOrEqual(0);
    expect(result.top).toBeGreaterThanOrEqual(0);
    expect(result.left + result.width).toBeLessThanOrEqual(1);
    expect(result.top + result.height).toBeLessThanOrEqual(1);
    // Should map to full page
    expect(result).toEqual({ left: 0, top: 0, width: 1, height: 1 });
  });

  it("clamps a degenerate negative-coordinate polygon to a zero-size rect at origin [WR-05]", () => {
    const polygon = [
      [-0.5, -0.5],
    ] as const satisfies ReadonlyArray<readonly [number, number]>;

    const result = polygonToRect(polygon);
    expect(result).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});

describe("clientXYToNormalized", () => {
  it("returns [0.5, 0.5] for pointer at center of bounds", () => {
    const bounds = { left: 100, top: 200, width: 400, height: 300 } as DOMRect;
    const [x, y] = clientXYToNormalized(300, 350, bounds);
    expect(x).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0.5);
  });

  it("clamps pointer below origin to [0, 0]", () => {
    const bounds = { left: 100, top: 200, width: 400, height: 300 } as DOMRect;
    const [x, y] = clientXYToNormalized(0, 0, bounds);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it("clamps pointer beyond bounds to [1, 1]", () => {
    const bounds = { left: 0, top: 0, width: 100, height: 100 } as DOMRect;
    const [x, y] = clientXYToNormalized(999, 999, bounds);
    expect(x).toBe(1);
    expect(y).toBe(1);
  });

  it("returns a new readonly tuple each call (immutable — r1 !== r2)", () => {
    const bounds = { left: 0, top: 0, width: 100, height: 100 } as DOMRect;
    const r1 = clientXYToNormalized(50, 50, bounds);
    const r2 = clientXYToNormalized(50, 50, bounds);
    expect(r1).not.toBe(r2);
  });
});

describe("normalizedRectToPolygon", () => {
  it("produces a 4-corner polygon from two normalized points", () => {
    const poly = normalizedRectToPolygon(0.1, 0.2, 0.5, 0.6);
    expect(poly).toHaveLength(4);
    expect(poly[0]).toEqual([0.1, 0.2]);
    expect(poly[1]).toEqual([0.5, 0.2]);
    expect(poly[2]).toEqual([0.5, 0.6]);
    expect(poly[3]).toEqual([0.1, 0.6]);
  });

  it("handles reversed drag direction (x1 < x0 or y1 < y0) — normalizes to top-left first", () => {
    const poly = normalizedRectToPolygon(0.5, 0.6, 0.1, 0.2);
    expect(poly[0]).toEqual([0.1, 0.2]);
    expect(poly[2]).toEqual([0.5, 0.6]);
  });
});
