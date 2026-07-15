"use client";

// Explicit React import — Next.js's SWC automatic JSX runtime tolerates its
// absence, but vitest's classic-runtime esbuild JSX transform needs `React`
// in scope for any suite that mounts this file directly (documented gotcha,
// see genui-panel-node.tsx / 53-03 / 53-04's identical fix).
import * as React from "react";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { cn } from "@polytoken/ui";
import { Button } from "@polytoken/ui/button";
import { Collapsible, CollapsibleContent } from "@polytoken/ui/collapsible";
import { ScrollArea } from "@polytoken/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@polytoken/ui/sheet";
import { Skeleton } from "@polytoken/ui/skeleton";

import { api } from "~/trpc/react";

import { ConversationRow, type ConversationSummary } from "./conversation-row";
import { DeleteConversationDialog } from "./delete-conversation-dialog";

const COLLAPSE_STORAGE_KEY = "chat:rail:collapsed";

interface ConversationRailProps {
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onDeleted: (deletedId: string) => void;
  readonly collapsed: boolean;
  readonly onCollapsedChange: (collapsed: boolean) => void;
  /** MOBL-01 (53-UI-SPEC.md Judgment Call #3) — below `md` the rail renders
   * inside a left overlay `Sheet` instead of the desktop inline `Collapsible`.
   * A SEPARATE boolean from `collapsed` (which defaults to rail-VISIBLE) —
   * this one defaults CLOSED, lifted to `page.tsx`'s `ChatPage` so the
   * existing top-bar rail-toggle button can drive it. */
  readonly mobileOpen: boolean;
  readonly onMobileOpenChange: (open: boolean) => void;
  readonly onNewChat: () => void;
  readonly creatingConversation: boolean;
}

function RailSkeleton(): React.ReactElement {
  return (
    <div
      aria-busy="true"
      aria-label="Loading conversations…"
      className="space-y-2 p-2"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

/**
 * ConversationRail (D-11) — own collapsible rail nested inside /chat, built
 * from @polytoken/ui/collapsible (Radix Collapsible) rather than a second
 * app-shell-style sidebar provider — reusing that provider would collide
 * with the app shell's shared `sidebar:state` cookie. Collapse state persists
 * to `localStorage["chat:rail:collapsed"]`, independent of that cookie; the
 * boolean itself is controlled by the parent (/chat/page.tsx) so a top-bar
 * toggle can reach it even while the rail is visually 0px wide.
 *
 * Owns the inline-rename (D-12) and hard-delete-confirm (D-14) interaction
 * state for its rows: which row is currently renaming, and which
 * conversation the single `DeleteConversationDialog` instance targets.
 */
export function ConversationRail({
  selectedId,
  onSelect,
  onDeleted,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
  onNewChat,
  creatingConversation,
}: ConversationRailProps): React.ReactElement {
  // Hydrate the persisted collapse preference once on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === "true") {
      onCollapsedChange(true);
    }
    // Intentionally run once on mount only — hydration read, not a sync loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist every change back to the same key.
  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const utils = api.useUtils();
  const { data: conversations, isLoading } =
    api.chat.listConversations.useQuery({});

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingConversation, setDeletingConversation] =
    useState<ConversationSummary | null>(null);

  const renameConversation = api.chat.renameConversation.useMutation({
    onSuccess: async () => {
      await utils.chat.listConversations.invalidate();
      setRenamingId(null);
    },
  });

  const deleteConversation = api.chat.deleteConversation.useMutation({
    onSuccess: async (_result, variables) => {
      await utils.chat.listConversations.invalidate();
      onDeleted(variables.id);
      setDeletingConversation(null);
    },
  });

  // Shared rail body (New-chat button + conversation list) — reused by BOTH
  // the desktop inline Collapsible and the mobile overlay Sheet below `md`
  // (MOBL-01, 53-UI-SPEC.md Judgment Call #3). `handleSelect` differs per
  // caller: the mobile Sheet's row-select ALSO closes the Sheet (a
  // full-overlay Sheet left open would hide the very conversation the user
  // just chose), the desktop tree just calls `onSelect` directly.
  function renderRailBody(
    handleSelect: (id: string) => void,
    wrapperClassName: string,
  ): React.ReactElement {
    return (
      <div className={wrapperClassName}>
        <div className="shrink-0 p-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="w-full gap-2"
            onClick={onNewChat}
            disabled={creatingConversation}
          >
            <Plus className="size-4" aria-hidden />
            New chat
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2 pt-0">
            {isLoading ? (
              <RailSkeleton />
            ) : conversations && conversations.length > 0 ? (
              conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === selectedId}
                  isRenaming={renamingId === conversation.id}
                  onSelect={handleSelect}
                  onRequestRename={setRenamingId}
                  onRequestDelete={setDeletingConversation}
                  onRenameCommit={(id, title) =>
                    renameConversation.mutate({ id, title })
                  }
                  onRenameCancel={() => setRenamingId(null)}
                />
              ))
            ) : (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No conversations yet.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  const handleMobileSelect = (id: string): void => {
    onSelect(id);
    onMobileOpenChange(false);
  };

  return (
    <>
      {/* Desktop (>=md) — byte-identical inline Collapsible, unchanged. */}
      <div className="hidden md:block h-full">
        {/* `h-full` is load-bearing: Radix renders this root as a bare <div> with no
         * class of its own, so without it the height chain breaks here — the div grows
         * to fit every conversation, CollapsibleContent's `h-full` resolves against
         * *that* instead of the 856px wrapper, and the page scrolls to ~11,000px
         * instead of the rail scrolling inside itself. */}
        <Collapsible
          className="h-full"
          open={!collapsed}
          onOpenChange={(open) => onCollapsedChange(!open)}
        >
          <div
            className={cn(
              "h-full shrink-0 overflow-hidden border-r border-border/50 bg-background/95",
              "t-panel-reveal",
              collapsed ? "w-0" : "w-[280px]",
            )}
          >
            <CollapsibleContent forceMount className="h-full w-[280px]">
              {renderRailBody(onSelect, "flex h-full w-[280px] flex-col")}
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>

      {/* Mobile (<md) — left overlay Sheet (MOBL-01, Judgment Call #3),
       * closed by default; opened by page.tsx's lifted `mobileOpen` state via
       * the existing top-bar rail-toggle button. `md:hidden` on SheetContent
       * itself is belt-and-suspenders (a Sheet left open across a resize past
       * `md` still collapses). */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="md:hidden p-0">
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          {renderRailBody(handleMobileSelect, "flex h-full w-full flex-col")}
        </SheetContent>
      </Sheet>

      <DeleteConversationDialog
        conversationTitle={deletingConversation?.title ?? null}
        open={deletingConversation !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingConversation(null);
        }}
        onConfirm={() => {
          if (deletingConversation) {
            deleteConversation.mutate({ id: deletingConversation.id });
          }
        }}
        isDeleting={deleteConversation.isPending}
      />
    </>
  );
}
