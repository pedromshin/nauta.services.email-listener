"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";

import { cn } from "@nauta/ui";
import { Button } from "@nauta/ui/button";
import { Collapsible, CollapsibleContent } from "@nauta/ui/collapsible";
import { ScrollArea } from "@nauta/ui/scroll-area";
import { Skeleton } from "@nauta/ui/skeleton";

import { api } from "~/trpc/react";

import { ConversationRow } from "./conversation-row";

const COLLAPSE_STORAGE_KEY = "chat:rail:collapsed";

interface ConversationRailProps {
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly collapsed: boolean;
  readonly onCollapsedChange: (collapsed: boolean) => void;
  readonly onNewChat: () => void;
  readonly creatingConversation: boolean;
  readonly onRequestRename: (id: string) => void;
  readonly onRequestDelete: (id: string) => void;
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
 * from @nauta/ui/collapsible (Radix Collapsible) rather than a second
 * app-shell-style sidebar provider — reusing that provider would collide
 * with the app shell's shared `sidebar:state` cookie. Collapse state persists
 * to `localStorage["chat:rail:collapsed"]`, independent of that cookie; the
 * boolean itself is controlled by the parent (/chat/page.tsx) so a top-bar
 * toggle can reach it even while the rail is visually 0px wide.
 */
export function ConversationRail({
  selectedId,
  onSelect,
  collapsed,
  onCollapsedChange,
  onNewChat,
  creatingConversation,
  onRequestRename,
  onRequestDelete,
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

  const { data: conversations, isLoading } =
    api.chat.listConversations.useQuery({});

  return (
    <Collapsible
      open={!collapsed}
      onOpenChange={(open) => onCollapsedChange(!open)}
    >
      <div
        className={cn(
          "h-full shrink-0 overflow-hidden border-r border-border/50 bg-background/70 backdrop-blur-md",
          "motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-in-out",
          collapsed ? "w-0" : "w-[280px]",
        )}
      >
        <CollapsibleContent forceMount className="h-full w-[280px]">
          <div className="flex h-full w-[280px] flex-col">
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
                      onSelect={onSelect}
                      onRequestRename={onRequestRename}
                      onRequestDelete={onRequestDelete}
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
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
