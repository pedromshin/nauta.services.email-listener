/**
 * brand-mark.tsx — the polytoken.ai brand mark (D-47-02, BRND-02).
 *
 * A rounded, organic node/brain hybrid: two interlocking soft-edged "lobe"
 * shapes (evoking a brain) plus one smaller circular "node" bridging them
 * (evoking a node cluster) — the two readings D-47-02 locked the mark
 * against ("both 'node cluster' and something organic"). Deliberately NOT
 * sharp graph lines or an infrastructure diagram, and NOT a hand-drawn
 * doodle (product-register-and-bans.md ban #11) — these are plain rounded
 * geometric primitives, not sketchy illustration.
 *
 * Token discipline (D-03/STYLE-03): every shape fills with `currentColor`
 * so the mark inherits whichever `text-*` color context it renders in
 * (sidebar/login both use `text-primary`, so the mark renders teal without
 * this file ever naming a color). The ONE softer secondary accent D-47-02
 * allows is expressed as a Tailwind `opacity-*` utility layered on top of
 * `currentColor` — never a second raw color value, never a new token.
 *
 * `variant="glyph"` is the square mark alone (the sidebar avatar slot and
 * login card header this plan wires, plus the geometry `app/icon.svg`'s
 * static favicon mirrors). `variant="lockup"` pairs the glyph with the
 * "Polytoken" wordmark, committed for future header use — not consumed by
 * this plan's call sites yet.
 */

import * as React from "react";

import { cn } from "@polytoken/ui";

export interface BrandMarkProps {
  /** "glyph": mark only (default). "lockup": mark + "Polytoken" wordmark. */
  readonly variant?: "glyph" | "lockup";
  /** "brand" (default): soft secondary-lobe accent. "mono": flat single tone for small sizes. */
  readonly tone?: "brand" | "mono";
  /** Tailwind sizing class applied to the glyph's <svg> (e.g. "size-6", "size-8"). Default "size-6". */
  readonly size?: string;
  /** Extra classes merged onto the glyph's <svg>. */
  readonly className?: string;
}

function Glyph({
  tone,
  size,
  className,
}: {
  readonly tone: "brand" | "mono";
  readonly size: string;
  readonly className: string | undefined;
}): React.ReactElement {
  // D-47-02: mono tone drops the secondary lobe's opacity split so the mark
  // reads as one flat solid shape at small sizes — a semi-transparent
  // overlap can turn muddy below ~16px (favicon/avatar scale).
  const secondaryLobeClassName = tone === "mono" ? undefined : "opacity-55";

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn(size, className)}
    >
      {/* Lobe 1 — upper-left, the larger organic "brain" half */}
      <rect
        x="4"
        y="3"
        width="18"
        height="15"
        rx="7.5"
        ry="7.5"
        transform="rotate(-12 13 10.5)"
        fill="currentColor"
      />
      {/* Lobe 2 — lower-right, the softer secondary half (the ONE accent D-47-02 allows) */}
      <rect
        x="12"
        y="12"
        width="17"
        height="14"
        rx="7"
        ry="7"
        transform="rotate(16 20.5 19)"
        fill="currentColor"
        className={secondaryLobeClassName}
      />
      {/* Node — small circle bridging the two lobes, the node-cluster half of the hybrid */}
      <circle cx="9.5" cy="22.5" r="4" fill="currentColor" />
    </svg>
  );
}

/**
 * BrandMark — the committed polytoken mark component. Replaces the "P"
 * letter-avatar placeholder in the sidebar brand slot and the login card
 * header (D-47-02, BRND-02).
 */
export function BrandMark({
  variant = "glyph",
  tone = "brand",
  size = "size-6",
  className,
}: BrandMarkProps): React.ReactElement {
  if (variant === "lockup") {
    return (
      <span className="inline-flex items-center gap-2">
        <Glyph tone={tone} size={size} className={className} />
        <span className="truncate text-sm font-semibold text-foreground">
          Polytoken
        </span>
      </span>
    );
  }

  return <Glyph tone={tone} size={size} className={className} />;
}
