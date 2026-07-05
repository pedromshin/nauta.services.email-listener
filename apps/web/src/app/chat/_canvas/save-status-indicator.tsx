"use client";

/**
 * save-status-indicator.tsx — SaveStatusIndicator: ambient, toolbar-adjacent
 * feedback for the debounced canvas-layout save (D-06, 23-UI-SPEC.md
 * Copywriting Contract). Same subtle visual register as `CostMeter`
 * (`text-xs text-muted-foreground`) — never a toast, never a modal, never
 * blocking.
 *
 * "Saved" appears for ~2s after a successful save (motion-safe fade-in on
 * appearance; disappearance is a plain unmount in both motion modes — see
 * the module doc in use-canvas-persistence.ts for why an animated exit was
 * out of proportion for this ambient label). "Not saved — retrying…" stays
 * visible for the whole error window: the debounce timer auto-retries on the
 * NEXT change, so there is deliberately no retry button (local/sandbox
 * single-user data, matches REQUIREMENTS' "no CRDT/multiplayer" posture).
 * Renders nothing while idle/saving — no chrome for the common in-flight
 * case.
 */

import { useEffect, useState } from "react";

import type { SaveStatus } from "./use-canvas-persistence";

const SAVED_VISIBLE_MS = 2000;

export interface SaveStatusIndicatorProps {
  readonly status: SaveStatus;
}

export function SaveStatusIndicator({
  status,
}: SaveStatusIndicatorProps): React.ReactElement | null {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (status !== "saved") {
      setShowSaved(false);
      return;
    }
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), SAVED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (status === "error") {
    return (
      <span role="status" className="text-xs text-muted-foreground">
        Not saved — retrying…
      </span>
    );
  }

  if (status === "saved" && showSaved) {
    return (
      <span
        role="status"
        className="text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        Saved
      </span>
    );
  }

  return null;
}
