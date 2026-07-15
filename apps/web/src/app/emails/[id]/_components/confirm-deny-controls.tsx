"use client";

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
  /** Undo an auto-detected deny (restores the rejected candidate). */
  readonly onRestore?: (componentId: string) => void;
}

/**
 * ConfirmDenyControls — the inline floating ✓/✗ for candidate FIELD boxes
 * (D-16/D-17/D-18, 09-UI-SPEC §Inline ✓/✗ Controls).
 *
 * Positioned `absolute -top-3 right-0 z-30`. ✓ confirms (flywheel). ✗ denies:
 * auto-detected → deny + `toast.info("Field value cleared.", { Undo, 3000ms })`
 * (box leaves view); user-drawn → deny (keeps box, clears value). The exact undo
 * toast copy + 3000ms duration come from the Copywriting Contract.
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
  onRestore,
}: ConfirmDenyControlsProps) {
  function handleDeny(): void {
    onDeny(componentId);
    if (isAutoDetected) {
      toast.info("Field value cleared.", {
        action: {
          label: "Undo",
          onClick: () => onRestore?.(componentId),
        },
        duration: 3000,
      });
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
