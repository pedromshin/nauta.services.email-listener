"use client";

import { Button } from "@nauta/ui/button";

interface ActiveParentBannerProps {
  /** The active entity's display label. */
  readonly label: string;
  /** Clear the active parent (Esc also clears, via use-canvas-state). */
  readonly onClear: () => void;
}

/**
 * ActiveParentBanner — the D-10 active-parent status banner.
 *
 * Violet-tinted (active-parent is entity-scoped: role-color entity = violet),
 * `role="status" aria-live="polite"`. Copy is the exact Copywriting Contract
 * string: "Active entity: {label} — next drawn boxes become fields". Rendered
 * only when an entity is armed (the consumer guards on activeParentId).
 */
export function ActiveParentBanner({ label, onClear }: ActiveParentBannerProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b px-4 py-2 bg-violet-50 dark:bg-violet-950/20 text-sm"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm">
        <span className="font-semibold">Active entity: {label}</span>
        {" — next drawn boxes become fields"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto"
        aria-label="Clear active entity"
        aria-keyshortcuts="Escape"
        onClick={onClear}
      >
        Clear
      </Button>
    </div>
  );
}
