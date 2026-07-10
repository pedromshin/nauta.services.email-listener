/**
 * theme/__tests__/contrast.ts — pure WCAG-AA contrast ratio helper (D-48).
 *
 * Parses an "H S% L%" HSL channel-triplet string (the pack token format —
 * see theme/tokens.ts / theme/packs.ts), converts HSL -> sRGB -> relative
 * luminance per the WCAG 2.x formula, and computes the contrast ratio
 * between two colors: (Llighter + 0.05) / (Ldarker + 0.05).
 *
 * Pure, dependency-free, colocated with the tests that consume it — this is
 * NOT a runtime module (theme/ consumers never import it), only a test
 * helper for packs.test.ts's computational WCAG-AA contrast gate.
 */

type HslComponents = {
  readonly h: number;
  readonly s: number;
  readonly l: number;
};

const HSL_TRIPLET_PATTERN =
  /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/;

/** Parses an "H S% L%" triplet string into normalized {h, s, l} (s/l in [0,1]). */
function parseHslTriplet(value: string): HslComponents {
  const match = HSL_TRIPLET_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Not a valid HSL channel-triplet: "${value}"`);
  }
  const [, h, s, l] = match;
  return { h: Number(h), s: Number(s) / 100, l: Number(l) / 100 };
}

/** Converts normalized HSL -> sRGB channels in the 0-255 range. */
function hslToRgb255({
  h,
  s,
  l,
}: HslComponents): readonly [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hp >= 0 && hp < 1) {
    [rp, gp, bp] = [c, x, 0];
  } else if (hp < 2) {
    [rp, gp, bp] = [x, c, 0];
  } else if (hp < 3) {
    [rp, gp, bp] = [0, c, x];
  } else if (hp < 4) {
    [rp, gp, bp] = [0, x, c];
  } else if (hp < 5) {
    [rp, gp, bp] = [x, 0, c];
  } else {
    [rp, gp, bp] = [c, 0, x];
  }

  return [(rp + m) * 255, (gp + m) * 255, (bp + m) * 255];
}

/** WCAG relative luminance of a single 0-255 sRGB channel. */
function channelLuminance(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0-1) of an "H S% L%" HSL channel-triplet string. */
export function relativeLuminance(hslTriplet: string): number {
  const [r, g, b] = hslToRgb255(parseHslTriplet(hslTriplet));
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/**
 * WCAG contrast ratio between two "H S% L%" HSL channel-triplet strings.
 * Order-independent — always returns (lighter + 0.05) / (darker + 0.05).
 */
export function contrastRatio(a: string, b: string): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}
