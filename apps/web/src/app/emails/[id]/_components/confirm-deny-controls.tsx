"use client";

// Explicit React namespace import — vitest's esbuild transform defaults to the
// classic JSX runtime and needs `React` in scope when a test mounts this
// component directly (same convention as region-overlay-box.tsx; needed by
// deny-toast-honesty.test.tsx — UI-1).
import * as React from "react";
import { toast } from "sonner";

interface ConfirmDenyControlsProps {
  /** The candidate FIELD component id. */
  readonly componentId: string;
  /**
   * Origin (D-18): auto-detected boxes get a soft-reject + Undo toast (the box
   * leaves view); user-drawn boxes keep their geometry, only the value clears.
   * Drives ONLY the client-side undo-toast affordance — the server is the
   * authority for the actual soft-reject vs clear-value outcome.
   */
  readonly isAutoDetected: boolean;
  /** Confirm the candidate (promote → confirmed, D-17 flywheel). */
  readonly onConfirm: (componentId: string) => void;
  /** Deny the candidate (origin-aware on the server, D-18). */
  readonly onDeny: (componentId: string) => void;
}

/**
 * ConfirmDenyControls — the inline floating ✓/✗ for candidate FIELD boxes
 * (D-16/D-17/D-18, 09-UI-SPEC §Inline ✓/✗ Controls).
 *
 * Positioned `absolute -top-3 right-0 z-30`. ✓ confirms (flywheel). ✗ denies:
 * auto-detected → deny + an honest `toast.info` that the field was removed (box
 * leaves view); user-drawn → deny (keeps box, clears value).
 *
 * UI-1: this toast used to offer an "Undo" action. It was a lie — no server
 * un-reject endpoint exists, so the action only patched the query cache to
 * "candidate" and immediately invalidated; the refetch returned "rejected" and
 * the box vanished again. Worse, deny atomically appends the polygon to the
 * parent's denied_field_polygons memo (D-19), so a later Autofill never
 * re-proposes it — the "undo" had a permanent side effect. An honest "Field
 * removed" with no action beats a fake undo that silently loses a correct read.
 *
 * LAW 1 DISPOSITION OF THE TWO HUES HERE (60-05-PLAN.md §D):
 *   ✓ CONFIRM wears the confirmed token (verdigris). It states a TIER — this
 *     value is now confirmed — which is precisely the hue tier has earned.
 *   ✗ DENY KEEPS madder, and this is correct, not an oversight. Law 1 reserves
 *     madder for controls that perform an IRREVERSIBLE action, and deny is one:
 *     it soft-rejects the region or clears the extracted value on the server.
 *     Blanket-removing `destructive` here would break law 1 from the other
 *     side — leaving the one genuinely destructive control on this surface
 *     indistinguishable from the benign one sitting 4px to its left.
 */
export function ConfirmDenyControls({
  componentId,
  isAutoDetected,
  onConfirm,
  onDeny,
}: ConfirmDenyControlsProps) {
  function handleDeny(): void {
    onDeny(componentId);
    if (isAutoDetected) {
      // UI-1: no Undo action — there is no server restore path, and deny has a
      // durable side effect (the D-19 memo). State the outcome honestly.
      toast.info("Field removed.", { duration: 3000 });
    }
  }

  return (
    <div
      className="absolute -top-3 right-0 flex gap-1 z-30 pointer-events-auto"
      role="group"
      aria-label="Confirm or deny field value"
    >
      <button
        type="button"
        aria-label="Confirm field value"
        className="h-5 w-5 rounded-full bg-conf hover:bg-conf/90 active:bg-conf/80 text-on-fill flex items-center justify-center text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        onClick={(e) => {
          e.stopPropagation();
          onConfirm(componentId);
        }}
      >
        ✓
      </button>
      <button
        type="button"
        aria-label="Deny field value"
        className="h-5 w-5 rounded-full bg-destructive hover:bg-destructive/90 active:bg-destructive/80 text-destructive-foreground flex items-center justify-center text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        onClick={(e) => {
          e.stopPropagation();
          handleDeny();
        }}
      >
        ✗
      </button>
    </div>
  );
}
