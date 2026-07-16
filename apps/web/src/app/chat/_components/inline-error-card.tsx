"use client";

// Explicit React import — Next.js's SWC automatic JSX runtime tolerates its
// absence, but vitest's classic-runtime esbuild JSX transform needs `React`
// in scope for any suite that mounts this file directly (documented gotcha —
// see message-list.tsx / genui-panel-node.tsx / 53-03 / 53-04's identical
// fix). message-stream-law.test.tsx (61-04) mounts MessageTurn across every
// part type and status, which reaches this file for the first time.
import * as React from "react";

import { AlertTriangle } from "lucide-react";

import { Button } from "@polytoken/ui/button";

export interface InlineErrorCardProps {
  /** Re-runs the failed turn (regenerate under the hood, CHAT-04/CHAT-05).
   * The composer draft is NEVER touched by this handler — draft and turn
   * state are fully decoupled (D-19, T-22-36). */
  readonly onRetry: () => void;
}

/**
 * InlineErrorCard (CHAT-05, D-19) — renders in place of a failed assistant
 * turn's content, as a self-contained bordered card per 22-UI-SPEC.md.
 *
 * LAW 1 (61-08, D-58-01): AN ERROR IS INK ON A RULE. This card used to wear the
 * irreversible colour on its frame, its icon and its heading — inherited from
 * generation-state-chrome.tsx's fallback banner, and written long before the
 * identity existed. 58-IDENTITY is explicit that the irreversible colour is for
 * "destructive buttons only. Never errors, never warnings." A failed turn is a
 * STATE, and it is not even a permanent one: the Retry button below is right
 * there, so the one thing this card must not say is "this cannot be undone".
 *
 * What carries it instead, none of it colour: `role="alert"`, the warning
 * glyph (shape survives greyscale — law 3), the semibold heading, and a real
 * rule around it. The named density step is `p-panel` — brand-guide §3 lists
 * "framed error/empty states" against it by name.
 *
 * `CostCapBlockedCard` is its sibling and was swept identically; the two are
 * meant to read as one family.
 */
export function InlineErrorCard({
  onRetry,
}: InlineErrorCardProps): React.ReactElement {
  return (
    <div
      role="alert"
      className="my-2 flex flex-col gap-2 rounded-card border border-rule p-panel"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-ink" aria-hidden />
        <span className="text-sm font-semibold text-ink">
          Something went wrong generating this response.
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  );
}
