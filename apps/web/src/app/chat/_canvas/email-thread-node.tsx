"use client";

/**
 * email-thread-node.tsx — EmailThreadNode: the canvas's `email-thread`
 * custom React Flow node (CLUS-01, 54-UI-SPEC.md Component 1) — the 4th
 * node type alongside `ChatNode`/`GenuiPanelNode`/`KnowledgePreviewNode`.
 *
 * Fixed `h-[220px] w-[320px]` shell on the shared card recipe
 * (`canvasNodeShellClass`) — this node's content is bounded by construction
 * (server-truncated THREAD_SNIPPET_CHARS=240 summary), so a fixed shell never
 * needs to grow.
 *
 * Header (Mail icon + truncating headerLabel + remove button),
 * loading/error/empty/success body (identical branch order to
 * `KnowledgePreviewMiniGraph`'s established precedent: loading -> error ->
 * empty -> success), and a two-action footer ("Open thread" deep-link +
 * "Attach chat"). Data fetching lives HERE via `api.emails.threadCard` —
 * `node.data` carries only a `threadId` ref (.strict, node-data-schemas.ts),
 * never fetched content.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LAW 2 LIVES ON THIS CARD, and it is the deliberate opposite of
 * `chat-node.tsx`'s call. Read the two together — they are one decision.
 * ────────────────────────────────────────────────────────────────────────
 *
 * The test is "where did the words come from?", never "which element holds
 * them". This card holds BOTH kinds at once, one line apart:
 *
 *   subject      -> the mail's own words          -> SERIF + data-evidence
 *   snippet      -> the mail's own words          -> SERIF + data-evidence
 *   participants -> polytoken's summary OF the    -> sans
 *                   mail ("Rafael Lima, you ·
 *                   3 messages")
 *
 * A chat node's title fails the same test where these pass: a conversation
 * title is user-authored or polytoken-generated, so it is chrome and stays
 * sans. `font-serif` is applied to the SPANS, never to the header row — a
 * serif container would hand its font down to the sans caption beside it by
 * INHERITANCE, and no className-reading gate can see that (brand-guide §3;
 * this is also why `pmark`/`chip`, which imply `font-serif`, are not used
 * here). `font-serif` and `data-evidence` are a PAIR: neither ships alone,
 * and `canvas-node-law.test.tsx` asserts the implication both ways.
 *
 * 54-UI-SPEC.md Judgment Call #2 gave this header's icon the retired
 * node-type hue. That instruction is superseded by law 3 ("entity type is
 * shape, never hue") — and the hue was already dead on screen, since post-59
 * the whole retired family resolves to a grey. The icon is faded, like every
 * other kind's (the sketch's `.ch svg`); this card's kind is legible from its
 * left rule's weight instead.
 *
 * `headerLabel` resolution order (mirrors `resolveHeaderLabel`'s exact
 * 3-step precedent from knowledge-preview-node.tsx): explicit `data.label`
 * -> the fetched thread's own `subject` once the query settles -> the
 * fallback literal "Untitled thread" (`Threads.subject` is nullable, so this
 * branch is real/reachable, not defensive-only).
 *
 * Attach chat creates a NEW conversation (`chat.createConversation`, mirrors
 * the rail's "New chat" open UX) then links it to this thread
 * (`chat.attachConversationToThread`, 54-01) — two calls, not one, because
 * `attachConversationToThread` only links an EXISTING conversation id and
 * this action's key_link explicitly targets that procedure (54-04-PLAN.md).
 * On success it calls `onOpenConversation` (54-04 deviation, Rule 2 — see
 * SUMMARY: `CanvasPersistenceContext` gained this optional field, threaded
 * from `chat-canvas.tsx` up to `page.tsx`'s `setSelectedId`, so the app
 * actually switches to the new conversation — "the visible conversation
 * switch IS the confirmation," 54-UI-SPEC.md's Interactive-State Contract).
 * A degrade result (`{attached:false}`, e.g. migration 0036 unapplied) or a
 * thrown error both surface as the SAME `toast.error` + Retry action.
 *
 * Remove — mirrors `KnowledgePreviewNode`'s remove button byte-for-byte:
 * `useReactFlow().deleteElements` removes this node from React Flow's own
 * `nodes` array; it never touches the underlying thread/emails.
 */

import * as React from "react";
import { memo, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { AlertCircle, Loader2, Mail, MessageSquarePlus, Users, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@polytoken/ui/button";
import { Skeleton } from "@polytoken/ui/skeleton";

import { api } from "~/trpc/react";
import { hrefFor } from "~/components/provenance-link";

import { canvasNodeShellClass } from "./canvas-node-shell-class";
import { CANVAS_NODE_KIND_GEOMETRY } from "./canvas-vocabulary";
import { useCanvasPersistenceContext } from "./panel-overlay-context";
import type { EmailThreadNodeData } from "./node-data-schemas";

export type EmailThreadNodeType = Node<EmailThreadNodeData, "email-thread">;

const ATTACH_ERROR_COPY = "Couldn't attach a chat to this thread — try again.";

/**
 * resolveHeaderLabel — the exact 3-step resolution order (54-UI-SPEC.md
 * Component 1): explicit `customLabel` always wins -> the fetched thread's
 * own `subject` once the query has settled with a non-empty value -> the
 * fallback literal "Untitled thread". A falsy `fetchedSubject` (undefined —
 * still loading/errored/not found — or null — settled with no subject) both
 * fall to the same fallback, mirroring `resolveHeaderLabel`'s
 * knowledge-preview-node.tsx precedent of falling back while unsettled.
 */
export function resolveHeaderLabel(
  customLabel: string | undefined,
  fetchedSubject: string | null | undefined,
): string {
  if (customLabel !== undefined) return customLabel;
  if (fetchedSubject) return fetchedSubject;
  return "Untitled thread";
}

export const EmailThreadNode = memo(function EmailThreadNode({
  id,
  data,
  selected,
}: NodeProps<EmailThreadNodeType>) {
  const { deleteElements } = useReactFlow();
  const { onOpenConversation } = useCanvasPersistenceContext();
  const [isAttaching, setIsAttaching] = useState(false);

  const query = api.emails.threadCard.useQuery({ threadId: data.threadId });
  const createConversation = api.chat.createConversation.useMutation();
  const attachConversationToThread = api.chat.attachConversationToThread.useMutation();

  const headerLabel = resolveHeaderLabel(data.label, query.data?.subject);
  const canOpenThread = query.data !== undefined && query.data !== null;

  async function handleAttachChat(): Promise<void> {
    setIsAttaching(true);
    try {
      const created = await createConversation.mutateAsync({});
      const result = await attachConversationToThread.mutateAsync({
        conversationId: created.id,
        threadId: data.threadId,
      });
      if (!result.attached) {
        toast.error(ATTACH_ERROR_COPY, {
          action: { label: "Retry", onClick: () => void handleAttachChat() },
        });
        return;
      }
      onOpenConversation?.(created.id);
    } catch {
      toast.error(ATTACH_ERROR_COPY, {
        action: { label: "Retry", onClick: () => void handleAttachChat() },
      });
    } finally {
      setIsAttaching(false);
    }
  }

  return (
    <div
      className={`h-[220px] w-[320px] animate-in fade-in-0 zoom-in-95 [animation-duration:250ms] motion-reduce:animate-none ${canvasNodeShellClass(CANVAS_NODE_KIND_GEOMETRY["email-thread"], selected === true)}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-drag-handle flex h-9 shrink-0 cursor-grab items-center justify-between gap-2 border-b border-hair px-3 active:cursor-grabbing">
        <span className="flex min-w-0 items-center gap-2">
          <Mail className="size-3 shrink-0 text-faded" aria-hidden />
          {/* The sketch's `.ct2` — SERIF, because a thread subject is the
              mail's own words. Marked on the SPAN, never the row: see the
              file header. */}
          <span
            className="truncate font-serif text-xs font-semibold text-ink"
            data-evidence
          >
            {headerLabel}
          </span>
        </span>
        {/* The sketch's `.xbtn` — INK, not madder. Removing this card from the
            board is not irreversible (T-61-19): the thread, its emails and any
            attached conversation all survive; only the placement drops, and it
            re-adds from the same popover. Madder is reserved for actions that
            genuinely cannot be undone (law 1: "never errors, never warnings" —
            and never a merely-undoable action). */}
        <button
          type="button"
          aria-label="Remove thread"
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-pencil transition-colors hover:bg-ink-08 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 pointer-coarse:touch-target"
          onClick={(event) => {
            event.stopPropagation();
            void deleteElements({ nodes: [{ id }] });
          }}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="relative flex flex-1 flex-col gap-1 px-3 py-2">
        {query.isPending ? (
          <div role="status" aria-label="Loading thread" className="flex flex-col gap-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : query.isError ? (
          // Compact, card-embedded error presentation (54-UI-REVIEW.md fix
          // #1/#3) — deliberately NOT the shared `EmptyState` primitive:
          // `EmptyState`'s "compact" recipe (icon + text-base heading +
          // text-sm body + mt-6 default-variant Button, ~160px tall) needs
          // more height than this node's fixed shell provides (148px gross
          // body budget). This inline icon + one-line message + quiet Retry
          // stays inside the ~90px it actually needs.
          //
          // THE ICON IS INK, and this was a live law-1 violation until 61-06:
          // it tinted itself with the irreversible colour. A thread that failed
          // to load is a STATE, not an irreversible action, and §3 is explicit
          // that "an error is ink on a rule" — madder is never an error. This
          // is the same defect 60-06 found in `pdf-preview-pane`'s "Preview
          // failed" badge, and the same call 61-05 made on the save-status
          // indicator: ink, because a failure is not bookkeeping either, so it
          // does not drop to the pencil that "Saved" wears.
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-1 text-center">
            <AlertCircle className="size-5 shrink-0 text-ink" aria-hidden />
            <p className="text-xs text-faded">
              Couldn&apos;t load this thread. Try again, or open it from your inbox.
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="rounded-sm px-1.5 py-0.5 text-xs text-faded transition-colors hover:bg-ink-08 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              Retry
            </button>
          </div>
        ) : query.data === null ? (
          // Same compact recipe, no action (54-UI-REVIEW.md fix #1) — see
          // the error branch's comment above for why this isn't `EmptyState`.
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-1 text-center">
            <Mail className="size-5 shrink-0 text-faded" aria-hidden />
            <p className="text-xs text-faded">
              This thread is unavailable. It may have been removed or is no longer accessible.
            </p>
          </div>
        ) : query.data ? (
          <>
            {/* The sketch's `.parts` — SANS. "Rafael Lima, you · 3 messages" is
                polytoken's summary OF the mail, not a line the mail contains. */}
            <div className="flex min-w-0 items-center gap-2 text-2xs text-faded">
              <Users className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{query.data.participantsSummary}</span>
            </div>
            {/* The sketch's `.csnip` — SERIF, the thread's own sentence. */}
            <p
              className="mt-1 line-clamp-4 font-serif text-xs leading-relaxed text-ink"
              data-evidence
            >
              {query.data.latestSnippet}
            </p>
          </>
        ) : null}
      </div>
      {/* The sketch's `.cf` — a --hair rule, never a --rule. */}
      <div className="flex h-9 shrink-0 items-center justify-between gap-1 border-t border-hair px-2">
        <Link
          href={query.data ? hrefFor("email", query.data.latestMessageId) : "#"}
          aria-disabled={!canOpenThread}
          onClick={(event) => {
            if (!canOpenThread) event.preventDefault();
          }}
          className={`flex h-7 shrink-0 items-center gap-1 rounded-sm px-2 text-xs text-faded transition-colors hover:bg-ink-05 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 pointer-coarse:h-11 ${canOpenThread ? "" : "pointer-events-none opacity-50"}`}
        >
          Open thread →
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 pointer-coarse:h-11"
          disabled={isAttaching}
          onClick={() => void handleAttachChat()}
        >
          {isAttaching ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <MessageSquarePlus className="size-3.5" aria-hidden />
          )}
          Attach chat
        </Button>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
