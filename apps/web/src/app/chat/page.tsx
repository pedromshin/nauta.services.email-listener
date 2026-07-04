"use client";

import { useCallback, useState } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";

import { Button } from "@nauta/ui/button";

import { api } from "~/trpc/react";

import { ChatHomeEmptyState } from "./_components/chat-home-empty-state";
import { Composer } from "./_components/composer";
import { ConversationRail } from "./_components/conversation-rail";
import { CostMeter } from "./_components/cost-meter";
import { GeneratingIndicator, MessageList } from "./_components/message-list";
import { ModelPicker } from "./_components/model-picker";
import { useConversationController } from "./_hooks/use-conversation-controller";
import { useWebllmEngine, type UseWebllmEngineResult } from "./_hooks/use-webllm-engine";

interface ConversationViewProps {
  readonly conversationId: string;
  readonly modelId: string;
  /** Single top-level useWebllmEngine() instance (ChatPage) — threaded down
   * so switching conversations never re-instantiates or re-downloads the
   * WebLLM engine (D-08). */
  readonly webllm: UseWebllmEngineResult;
}

/**
 * ConversationView — the /chat main column once a conversation is selected
 * (CHAT-01/03/06/07, STREAM-01). Merges persisted history (chat.getHistory)
 * with the live streaming turn from EITHER useChatStream (server-locus, SSE)
 * or useWebllmEngine (browser-locus, local — D-08/D-09). The send handler
 * branches purely on the selected model's registry execution_locus — never a
 * hardcoded per-model special case — so both loci feed the SAME growing-parts
 * + state-machine shape into the SAME MessageList. The optimistic user
 * message renders immediately on submit — before either path starts — and
 * both transient turns are dropped once the turn settles and
 * chat.getHistory is invalidated (the persisted row takes over).
 */
function ConversationView({
  conversationId,
  modelId,
  webllm,
}: ConversationViewProps): React.ReactElement {
  const controller = useConversationController({ conversationId, modelId, webllm });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <span className="sr-only" aria-live="polite">
        {controller.liveAnnouncement}
      </span>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/70 px-4 backdrop-blur-md">
        <ModelPicker
          conversationId={conversationId}
          currentModelId={modelId}
          onSelectBrowserModel={controller.handleSelectBrowserModel}
          webllm={{
            supported: webllm.supported,
            status: webllm.status,
            progress: webllm.progress,
            progressText: webllm.progressText,
          }}
        />
        <CostMeter conversationId={conversationId} />
      </div>
      <MessageList
        turns={controller.turns}
        streamingTurnId={controller.streamingTurnId}
        regenerateDisabled={controller.regenerateDisabled}
        onNavigateSibling={controller.handleNavigateSibling}
        onRegenerate={controller.onRegenerateTurn}
      />
      <GeneratingIndicator state={controller.activeStreamState} />
      <Composer
        isStreaming={controller.activeStreamState === "streaming"}
        onSubmit={controller.handleSubmit}
        onStop={controller.handleStop}
      />
    </div>
  );
}

/**
 * /chat — client page rendering the two-state layout (D-13) inside the
 * existing root SidebarInset slot (apps/web/src/app/layout.tsx). The
 * conversation rail (D-11) is always mounted; the main column swaps between
 * the home empty-state and the streamed ConversationView (22-08 replaces
 * 22-05's placeholder).
 *
 * The rail-collapse toggle lives in this top bar — outside the rail's own
 * 0px-collapsed width — so it stays reachable even when the rail is fully
 * hidden (D-11/UI-SPEC: rail collapses to 0px, not an icon-rail).
 */
export default function ChatPage(): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  // ONE top-level engine instance (D-08) — never re-instantiated when the
  // selected conversation changes, so switching conversations never
  // re-downloads the (large, first-run-only) WebLLM model weights.
  const webllm = useWebllmEngine();

  const utils = api.useUtils();
  const { data: conversations } = api.chat.listConversations.useQuery({});
  const createConversation = api.chat.createConversation.useMutation({
    onSuccess: async (result) => {
      await utils.chat.listConversations.invalidate();
      setSelectedId(result.id);
    },
  });

  const handleNewChat = useCallback(() => {
    createConversation.mutate({});
  }, [createConversation]);

  // T-22-18-adjacent UX: de-select if the conversation currently open is the
  // one that just got hard-deleted (D-14), otherwise the main column would
  // keep pointing at a conversation id that no longer exists.
  const handleConversationDeleted = useCallback((deletedId: string) => {
    setSelectedId((current) => (current === deletedId ? null : current));
  }, []);

  const selectedConversation =
    conversations?.find((conversation) => conversation.id === selectedId) ??
    null;

  return (
    <div className="flex h-svh flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/50 px-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            railCollapsed ? "Expand conversation list" : "Collapse conversation list"
          }
          className="size-11"
          onClick={() => setRailCollapsed((prev) => !prev)}
        >
          {railCollapsed ? (
            <PanelLeft className="size-4" aria-hidden />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden />
          )}
        </Button>
        <span className="text-base font-semibold text-foreground">Chat</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <ConversationRail
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDeleted={handleConversationDeleted}
          collapsed={railCollapsed}
          onCollapsedChange={setRailCollapsed}
          onNewChat={handleNewChat}
          creatingConversation={createConversation.isPending}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selectedId && selectedConversation ? (
            <ConversationView
              key={selectedId}
              conversationId={selectedId}
              modelId={selectedConversation.modelId}
              webllm={webllm}
            />
          ) : selectedId ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading conversation…
            </div>
          ) : (
            <ChatHomeEmptyState
              onNewChat={handleNewChat}
              creating={createConversation.isPending}
            />
          )}
        </div>
      </div>
    </div>
  );
}
