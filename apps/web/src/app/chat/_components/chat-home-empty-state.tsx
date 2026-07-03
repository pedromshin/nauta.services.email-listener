"use client";

import { MessageSquarePlus, Plus } from "lucide-react";

import { Button } from "@nauta/ui/button";

interface ChatHomeEmptyStateProps {
  readonly onNewChat: () => void;
  readonly creating?: boolean;
}

/**
 * ChatHomeEmptyState (D-13) — the /chat landing surface shown in the main
 * column when no conversation is selected. Mirrors entities-gallery.tsx's
 * EmptyState shape (icon + heading + body) but larger — this is a primary
 * landing surface, not a sparse-list state — per 22-UI-SPEC.md Layout §1 +
 * Copywriting Contract. The button here is the same "New chat" CTA as the
 * rail's, surfaced larger for the case the rail is collapsed.
 */
export function ChatHomeEmptyState({
  onNewChat,
  creating = false,
}: ChatHomeEmptyStateProps): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-24 text-center">
      <MessageSquarePlus
        className="mb-4 h-10 w-10 text-muted-foreground/40"
        aria-hidden
      />
      <h1 className="text-2xl font-semibold text-foreground">
        Start a new conversation
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Ask the agent anything — responses stream in and can include
        interactive widgets.
      </p>
      <Button
        type="button"
        variant="default"
        className="mt-6 gap-2"
        onClick={onNewChat}
        disabled={creating}
      >
        <Plus className="size-4" aria-hidden />
        New chat
      </Button>
    </div>
  );
}
