"use client";

/**
 * email-thread-node.tsx — EmailThreadNode: the canvas's `email-thread`
 * custom React Flow node (CLUS-01, 54-UI-SPEC.md Component 1) — the 4th
 * node type alongside `ChatNode`/`GenuiPanelNode`/`KnowledgePreviewNode`.
 *
 * Fixed `h-[220px] w-[320px]` shell, byte-identical recipe to
 * `KnowledgePreviewNode`'s outer shell (the closest node-type analog) — this
 * node's content is bounded by construction (server-truncated
 * THREAD_SNIPPET_CHARS=240 summary), so a fixed shell never needs to grow.
 *
 * Header (Mail icon `text-graph-email` — NOT `text-primary`, 54-UI-SPEC.md
 * Judgment Call #2 — + truncating headerLabel + remove button),
 * loading/error/empty/success body (identical branch order to
 * `KnowledgePreviewMiniGraph`'s established precedent: loading -> error ->
 * empty -> success), and a two-action footer ("Open thread" deep-link +
 * "Attach chat"). Data fetching lives HERE via `api.emails.threadCard` —
 * `node.data` carries only a `threadId` ref (.strict, node-data-schemas.ts),
 * never fetched content.
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
import { EmptyState } from "~/components/empty-state";
import { hrefFor } from "~/components/provenance-link";

import { useCanvasPersistenceContext } from "./panel-overlay-context";
import type { EmailThreadNodeData } from "./node-data-schemas";

export type EmailThreadNodeType = Node<EmailThreadNodeData, "email-thread">;

const SELECTED_RING = "ring-2 ring-primary ring-offset-1";

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
      className={`flex h-[220px] w-[320px] flex-col overflow-hidden rounded-lg border border-border/60 bg-background transition-shadow duration-150 animate-in fade-in-0 zoom-in-95 [animation-duration:250ms] motion-reduce:animate-none ${selected ? `${SELECTED_RING} shadow-elevation-2` : "shadow-elevation-1"}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-drag-handle flex h-9 shrink-0 cursor-grab items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 active:cursor-grabbing">
        <span className="flex min-w-0 items-center gap-2">
          <Mail className="size-3 shrink-0 text-graph-email" aria-hidden />
          <span className="truncate text-xs font-normal text-muted-foreground">
            {headerLabel}
          </span>
        </span>
        <button
          type="button"
          aria-label="Remove thread"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 pointer-coarse:touch-target"
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
          <EmptyState
            icon={AlertCircle}
            tone="destructive"
            layout="centered"
            size="compact"
            heading="Couldn't load this thread."
            body="Try again, or open it from your inbox."
            action={{ label: "Retry", onClick: () => void query.refetch() }}
          />
        ) : query.data === null ? (
          <EmptyState
            icon={Mail}
            tone="muted"
            layout="centered"
            size="compact"
            heading="This thread is unavailable."
            body="It may have been removed or is no longer accessible."
          />
        ) : query.data ? (
          <>
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <Users className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{query.data.participantsSummary}</span>
            </div>
            <p className="mt-1 line-clamp-4 text-xs font-normal text-foreground">
              {query.data.latestSnippet}
            </p>
          </>
        ) : null}
      </div>
      <div className="flex h-9 shrink-0 items-center justify-between gap-1 border-t border-border/60 px-2">
        <Link
          href={query.data ? hrefFor("email", query.data.latestMessageId) : "#"}
          aria-disabled={!canOpenThread}
          onClick={(event) => {
            if (!canOpenThread) event.preventDefault();
          }}
          className={`flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 pointer-coarse:h-11 ${canOpenThread ? "" : "pointer-events-none opacity-50"}`}
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
