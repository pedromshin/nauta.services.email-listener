"use client";

/**
 * regenerate-control.tsx — RegenerateControl: the toolbar's `RotateCw`
 * icon-button entry point for PANL-03's one-click regenerate action
 * (52-UI-SPEC.md Component 3, 52-04-PLAN.md Task 1).
 *
 * Replaces Plan 52-02's inert interface-first skeleton. One-click, no
 * popover, no confirmation (52-CONTEXT.md/52-UI-SPEC.md): clicking
 * immediately re-generates the panel's current variant via the SAME
 * `genui.generate` transport `generation-sandbox-island.tsx` uses
 * (`useQuery(..., { enabled: false })` + manual `refetch()`), then appends
 * the result as a new `regenerate` version through `appendVersion` —
 * supersede-never-mutate, nothing is ever deleted or rewritten in place.
 *
 * Intent sourcing (documented judgment call, 52-04-PLAN.md Task 1
 * <behavior> — the panel spec does not persist its own original intent):
 * `deriveIntent` finds the assistant row matching this panel's
 * `provenance.messageId` in `chat.getHistory` (ordered turnIndex ASC,
 * version ASC per history.ts) and walks backward for the nearest preceding
 * user row's text. A message that no longer exists, or has no preceding
 * user text, falls back to a constant directive so a regenerate can never
 * silently no-op.
 */

import * as React from "react";
import { useMemo, useState } from "react";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Tooltip, TooltipContent, TooltipTrigger } from "@polytoken/ui/tooltip";

import { api } from "~/trpc/react";

import type { MessagePart } from "../../_hooks/use-chat-stream";
import type { ChatHistoryRow } from "../../_hooks/use-conversation-controller";
import { appendVersion } from "../panel-overlay";
import {
  useCanvasPersistenceContext,
  usePanelOverlay,
  type PanelActionControlProps,
} from "../panel-overlay-context";
import { PANEL_ACTION_ICON_BUTTON_CLASS } from "./panel-action-button-class";

const FALLBACK_INTENT =
  "Produce a fresh visual variant of this view, preserving its information and purpose.";

const REGENERATE_ERROR_COPY = "Couldn't regenerate this panel — try again.";

/**
 * deriveIntent(rows, messageId) — pure: finds the row matching `messageId`
 * in `chat.getHistory` rows (turnIndex ASC, version ASC) and walks backward
 * for the nearest preceding user row's concatenated text parts. Falls back
 * to `FALLBACK_INTENT` when the message is missing, or no preceding user
 * text is found — never throws, never returns an empty string.
 */
export function deriveIntent(rows: readonly ChatHistoryRow[], messageId: string): string {
  const index = rows.findIndex((row) => row.id === messageId);
  if (index === -1) return FALLBACK_INTENT;

  for (let i = index - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row === undefined || row.role !== "user") continue;
    const parts = (row.parts as MessagePart[] | null) ?? [];
    const text = parts
      .filter((part): part is Extract<MessagePart, { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (text.length > 0) return text;
  }

  return FALLBACK_INTENT;
}

export function RegenerateControl({
  panelId,
  provenance,
  resolvedPackId,
  isLocked,
  onBusyChange,
  onGeneratingChange,
}: PanelActionControlProps): React.ReactElement {
  const { overlay, writeOverlay } = usePanelOverlay(panelId);
  const { conversationId } = useCanvasPersistenceContext();
  const { data: historyRows } = api.chat.getHistory.useQuery({ conversationId });
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Derived fresh on every render from the ALREADY-available historyRows —
  // never a stale closure, unlike a value that would need a setState commit
  // before the query hook below could see it (see generation-sandbox-island.tsx's
  // queryPackId note for the pattern this deliberately avoids).
  const intent = useMemo(
    () => deriveIntent(historyRows ?? [], provenance.messageId),
    [historyRows, provenance.messageId],
  );

  // D-06-style manual trigger (mirrors generation-sandbox-island.tsx):
  // enabled:false, `refetch()` on click only.
  const q = api.genui.generate.useQuery(
    { intent, stylePackId: resolvedPackId },
    { enabled: false },
  );

  async function handleRegenerate(): Promise<void> {
    setIsRegenerating(true);
    onBusyChange(true);
    onGeneratingChange(true);

    const result = await q.refetch();

    if (result.data !== undefined && result.data.outcome !== "fallback") {
      writeOverlay(
        appendVersion(overlay, {
          generatedBy: "regenerate",
          specJson: JSON.stringify(result.data.spec),
          // Rule 1 fix (52-04-SUMMARY.md): resolveActivePanel reads a STORED
          // version's OWN stylePackId (never the spec's embedded
          // style_pack_id) once that version is active — omitting this would
          // silently drop the panel back to DEFAULT_PACK_ID on every
          // regenerate, undoing any prior pack choice.
          stylePackId: resolvedPackId,
        }),
      );
    } else {
      toast.error(REGENERATE_ERROR_COPY, {
        action: { label: "Retry", onClick: () => { void handleRegenerate(); } },
      });
    }

    setIsRegenerating(false);
    onBusyChange(false);
    onGeneratingChange(false);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={isRegenerating ? "Regenerating panel" : "Regenerate"}
          disabled={isLocked || isRegenerating}
          onClick={() => { void handleRegenerate(); }}
          className={PANEL_ACTION_ICON_BUTTON_CLASS}
        >
          <RotateCw
            className={isRegenerating ? "size-3.5 motion-safe:animate-spin" : "size-3.5"}
            aria-hidden
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>Regenerate</TooltipContent>
    </Tooltip>
  );
}
