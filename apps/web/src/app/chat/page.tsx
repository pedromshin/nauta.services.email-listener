"use client";

import { useCallback, useRef, useState } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";

import { Button } from "@nauta/ui/button";

import { api } from "~/trpc/react";

import { ChatHomeEmptyState } from "./_components/chat-home-empty-state";
import { Composer } from "./_components/composer";
import { ConversationRail } from "./_components/conversation-rail";
import { CostMeter } from "./_components/cost-meter";
import {
  GeneratingIndicator,
  MessageList,
  type MessageListItem,
} from "./_components/message-list";
import type { TurnStatus } from "./_components/message-turn";
import { ModelPicker } from "./_components/model-picker";
import {
  useChatStream,
  type MessagePart,
  type StreamState,
  type StreamTerminalState,
} from "./_hooks/use-chat-stream";
import {
  useWebllmEngine,
  type UseWebllmEngineResult,
} from "./_hooks/use-webllm-engine";

const STREAMING_TURN_ID = "__streaming-turn__";
const OPTIMISTIC_USER_TURN_ID = "__optimistic-user-turn__";

// ---------------------------------------------------------------------------
// Turn grouping — chat.getHistory returns EVERY sibling version row (D-16),
// not just the active one, so the regenerate SiblingNav has something to
// navigate. groupTurnsFromHistory folds those rows into one MessageListItem
// per logical turn (user row + the currently-selected assistant sibling).
// ---------------------------------------------------------------------------

interface ChatHistoryRow {
  readonly id: string;
  readonly role: string;
  readonly parts: unknown;
  readonly status: string;
  readonly turnIndex: number;
  readonly siblingGroupId: string | null;
  readonly version: number;
  readonly isActive: boolean;
}

/** Stable key for a turn's regenerate/sibling group — falls back to the row's
 * own id for the (never-actually-null per 22-06, but typed nullable) case. */
function siblingGroupKeyFor(row: ChatHistoryRow): string {
  return row.siblingGroupId ?? row.id;
}

/**
 * Folds raw chat.getHistory rows (ALL sibling versions) into render-ready
 * turns: one user MessageListItem plus one assistant MessageListItem per
 * turnIndex, the assistant item carrying the full siblings[] list (D-16) so
 * SiblingNav can navigate locally. `siblingOverrides` holds the user's local
 * (non-persisted) choice of which sibling to display; `regeneratingActiveId`
 * hides the stale cached row for a turn whose regenerate is in flight — the
 * live streaming pseudo-turn represents it instead (avoids a duplicate).
 */
function groupTurnsFromHistory(
  rows: readonly ChatHistoryRow[],
  siblingOverrides: Readonly<Record<string, string>>,
  regeneratingActiveId: string | null,
): MessageListItem[] {
  const turnIndices = Array.from(new Set(rows.map((row) => row.turnIndex))).sort(
    (a, b) => a - b,
  );
  const items: MessageListItem[] = [];

  for (const turnIndex of turnIndices) {
    const rowsForTurn = rows.filter((row) => row.turnIndex === turnIndex);

    const userRow = rowsForTurn.find((row) => row.role === "user");
    if (userRow) {
      items.push({
        id: userRow.id,
        role: "user",
        parts: (userRow.parts as MessagePart[] | null) ?? [],
      });
    }

    const assistantRows = rowsForTurn
      .filter((row) => row.role === "assistant")
      .sort((a, b) => a.version - b.version);
    if (assistantRows.length === 0) continue;

    const activeRow =
      assistantRows.find((row) => row.isActive) ??
      assistantRows[assistantRows.length - 1]!;

    if (activeRow.id === regeneratingActiveId) {
      // Stale — a regenerate for this turn is streaming right now; the live
      // pseudo-turn (appended after history) stands in for it instead.
      continue;
    }

    const groupKey = siblingGroupKeyFor(activeRow);
    const overrideId = siblingOverrides[groupKey];
    const selectedRow =
      assistantRows.find((row) => row.id === overrideId) ?? activeRow;
    const siblingIds = assistantRows.map((row) => row.id);

    items.push({
      id: selectedRow.id,
      role: "assistant",
      parts: (selectedRow.parts as MessagePart[] | null) ?? [],
      status: selectedRow.status as TurnStatus,
      siblings: siblingIds.length > 1 ? siblingIds : undefined,
      activeSiblingIndex: siblingIds.indexOf(selectedRow.id),
      regenerateTargetId: activeRow.id,
    });
  }

  return items;
}

/**
 * toWebllmMessages — active-sibling chat.getHistory rows -> the plain
 * text-only {role, content} shape useWebllmEngine.generateStream() expects.
 * D-08: a browser-locus model never sees genui_spec parts (no tool was ever
 * offered to it), so a prior assistant turn's non-text parts are simply
 * skipped rather than replayed — this mirrors run_chat_turn.py's own
 * _provider_content_blocks stand-in posture for parts a given transport
 * can't represent, just applied to the OUTGOING side instead.
 */
function toWebllmMessages(
  rows: readonly ChatHistoryRow[],
): ReadonlyArray<{ readonly role: "user" | "assistant"; readonly content: string }> {
  return rows
    .filter((row) => row.isActive && (row.role === "user" || row.role === "assistant"))
    .slice()
    .sort((a, b) => a.turnIndex - b.turnIndex)
    .map((row) => {
      const parts = (row.parts as MessagePart[] | null) ?? [];
      const content = parts
        .filter((part): part is Extract<MessagePart, { type: "text" }> => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      return { role: row.role as "user" | "assistant", content };
    });
}

// Visually-hidden aria-live announcer copy (22-UI-SPEC.md Accessibility) —
// announces STATE TRANSITIONS only, never the growing delta text itself
// (that would spam screen readers on every streamed token).
function liveAnnouncementFor(state: StreamState): string {
  switch (state) {
    case "streaming":
      return "Generating response";
    case "completed":
      return "Response complete";
    case "stopped":
      return "Response stopped by user";
    case "failed":
      return "Response failed";
    case "cost_capped":
      return "Cost limit reached";
    default:
      return "";
  }
}

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
  const utils = api.useUtils();
  const { data: historyRows } = api.chat.getHistory.useQuery({
    conversationId,
  });
  const { data: modelsData } = api.chat.models.useQuery();
  const recordBrowserTurn = api.chat.recordBrowserTurn.useMutation();
  // Data-driven locus branch (D-09) — looked up from the registry, never a
  // hardcoded model-id comparison in the renderer/send-path.
  const isBrowserLocus =
    (modelsData?.models ?? []).find((model) => model.id === modelId)
      ?.executionLocus === "browser";
  const [webllmParts, setWebllmParts] = useState<readonly MessagePart[]>([]);
  const [webllmStreamState, setWebllmStreamState] = useState<StreamState>("idle");
  const webllmStopRequestedRef = useRef(false);
  const [optimisticUserText, setOptimisticUserText] = useState<string | null>(
    null,
  );
  // D-16: the user's LOCAL choice of which sibling version to display per
  // regenerate group (groupKey -> selected message id) — purely visual, never
  // re-fetches and never affects the server's active-context sibling.
  const [siblingOverrides, setSiblingOverrides] = useState<
    Record<string, string>
  >({});
  // The active-sibling message id currently being regenerated, if any — used
  // to hide the stale cached row while the live pseudo-turn streams its
  // replacement (avoids a duplicate render of the same logical turn).
  const [regeneratingActiveId, setRegeneratingActiveId] = useState<
    string | null
  >(null);
  // Last text the user actually submitted via the composer — the fallback
  // retry path for a turn that fails before it has ever been persisted (so
  // there is no message id yet to regenerate against, CHAT-05).
  const lastSentTextRef = useRef<string>("");
  // chat.getHistory row count captured at the moment the CURRENT turn's
  // stream started — every terminal outcome except a pre-turn cost block
  // inserts at least one new row (D-15: even a failed/stopped turn persists
  // whatever partial streamed), so once the refetched count grows past this
  // snapshot the persisted row has landed and the transient live pseudo-turn
  // is dropped in favor of it (avoids rendering the same turn twice).
  const historyCountAtStreamStartRef = useRef<number>(0);

  const handleTerminal = useCallback(() => {
    // Every terminal branch persists whatever streamed so far (D-15) — the
    // persisted row is now authoritative, so replace the transient turns.
    void utils.chat.getHistory.invalidate({ conversationId });
    // A completed turn writes a new chat_cost_ledger row (22-06/22-07) — keep
    // the session cost meter live (D-23) without a manual refresh.
    void utils.chat.sessionCost.invalidate({ conversationId });
    setOptimisticUserText(null);
    setRegeneratingActiveId(null);
  }, [conversationId, utils]);

  const chatStream = useChatStream({ conversationId, onTerminal: handleTerminal });

  // Browser-locus send path (D-08/D-09) — the SIBLING of chatStream.send for
  // a WebLLM model: streams locally via useWebllmEngine.generateStream, then
  // persists the finished turn in the SAME canonical shape server turns use
  // via chat.recordBrowserTurn (T-22-39-style: no genui, text-only).
  const runWebllmTurn = useCallback(
    async (text: string) => {
      webllmStopRequestedRef.current = false;
      setWebllmParts([]);
      setWebllmStreamState("streaming");
      historyCountAtStreamStartRef.current = (historyRows ?? []).length;

      const requestMessages = [
        ...toWebllmMessages(historyRows ?? []),
        { role: "user" as const, content: text },
      ];

      let accumulatedText = "";
      let usage: { inputTokens: number; outputTokens: number } | undefined;
      let terminalState: StreamTerminalState = "completed";

      try {
        await webllm.ensureLoaded();
        for await (const chunk of webllm.generateStream(requestMessages)) {
          if (chunk.textDelta) {
            accumulatedText += chunk.textDelta;
            setWebllmParts([{ type: "text", text: accumulatedText }]);
          }
          if (chunk.usage) {
            usage = chunk.usage;
          }
        }
        terminalState = webllmStopRequestedRef.current ? "stopped" : "completed";
      } catch (error) {
        console.error("[ConversationView] WebLLM generation failed:", error);
        terminalState = webllmStopRequestedRef.current ? "stopped" : "failed";
      }

      setWebllmStreamState(terminalState);

      try {
        await recordBrowserTurn.mutateAsync({
          conversationId,
          modelId,
          userText: text,
          assistantText: accumulatedText,
          status: terminalState,
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
        });
      } catch (error) {
        console.error("[ConversationView] recordBrowserTurn failed:", error);
      }

      handleTerminal();
    },
    [webllm, historyRows, conversationId, modelId, recordBrowserTurn, handleTerminal],
  );

  const handleSubmit = useCallback(
    (text: string) => {
      lastSentTextRef.current = text;
      setOptimisticUserText(text);
      if (isBrowserLocus) {
        void runWebllmTurn(text);
        return;
      }
      historyCountAtStreamStartRef.current = (historyRows ?? []).length;
      chatStream.send(text, modelId);
    },
    [chatStream, modelId, historyRows, isBrowserLocus, runWebllmTurn],
  );

  const handleStop = useCallback(() => {
    if (isBrowserLocus) {
      webllmStopRequestedRef.current = true;
      webllm.interrupt();
      return;
    }
    chatStream.stop();
  }, [isBrowserLocus, webllm, chatStream]);

  const handleRegenerate = useCallback(
    (assistantMessageId: string) => {
      // A stale sibling override for this group would otherwise keep
      // pointing at a retired version once the new one lands.
      setSiblingOverrides({});
      setRegeneratingActiveId(assistantMessageId);
      historyCountAtStreamStartRef.current = (historyRows ?? []).length;
      chatStream.regenerate(assistantMessageId, modelId);
    },
    [chatStream, modelId, historyRows],
  );

  // CHAT-05: retry is the same operation as regenerate once a message id
  // exists; a turn that failed before ever being persisted (no id yet) falls
  // back to re-sending the same user text (via whichever locus is active).
  const handleLiveRetry = useCallback(() => {
    if (regeneratingActiveId) {
      handleRegenerate(regeneratingActiveId);
      return;
    }
    if (isBrowserLocus) {
      void runWebllmTurn(lastSentTextRef.current);
      return;
    }
    historyCountAtStreamStartRef.current = (historyRows ?? []).length;
    chatStream.send(lastSentTextRef.current, modelId);
  }, [
    regeneratingActiveId,
    handleRegenerate,
    chatStream,
    modelId,
    historyRows,
    isBrowserLocus,
    runWebllmTurn,
  ]);

  const handleNavigateSibling = useCallback(
    (siblingMessageId: string) => {
      const row = (historyRows ?? []).find((r) => r.id === siblingMessageId);
      if (!row) return;
      const groupKey = siblingGroupKeyFor(row);
      setSiblingOverrides((prev) => ({ ...prev, [groupKey]: siblingMessageId }));
    },
    [historyRows],
  );

  const historyTurns = groupTurnsFromHistory(
    historyRows ?? [],
    siblingOverrides,
    regeneratingActiveId,
  );

  // The currently-active locus's stream state/parts (D-09 — a data-driven
  // branch, never a hardcoded per-model special case). Exactly one of
  // {chatStream, runWebllmTurn} is ever active per ConversationView instance
  // (the composer disables while either streams), so this union is safe.
  const activeStreamState: StreamState = isBrowserLocus
    ? webllmStreamState
    : chatStream.state;
  const activeStreamParts: readonly MessagePart[] = isBrowserLocus
    ? webllmParts
    : chatStream.parts;

  // D-21: a pre-turn fail-closed block never streams any content at all —
  // zero parts distinguishes it from a mid-stream cost-cap (which always has
  // whatever partial content streamed before the breach, D-15). Browser-locus
  // turns never cost-cap (D-08 — always $0), so this is only ever true for
  // the server-locus path.
  const isPreTurnCostBlock =
    activeStreamState === "cost_capped" && activeStreamParts.length === 0;
  // A pre-turn block never inserts a chat_messages row at all, so history
  // can never "catch up" to it — it stays visible until the next action
  // replaces it. Every other terminal outcome DOES insert a row (D-15), so
  // once the refetched row count grows past the pre-stream snapshot, the
  // persisted turn has landed and this transient stand-in is redundant.
  const historyHasCaughtUp =
    (historyRows ?? []).length > historyCountAtStreamStartRef.current;
  const suppressLiveTurn =
    activeStreamState !== "idle" &&
    activeStreamState !== "streaming" &&
    !isPreTurnCostBlock &&
    historyHasCaughtUp;

  const turns: MessageListItem[] = [...historyTurns];
  if (optimisticUserText !== null && activeStreamState !== "idle") {
    turns.push({
      id: OPTIMISTIC_USER_TURN_ID,
      role: "user",
      parts: [{ type: "text", text: optimisticUserText }],
    });
  }
  if (activeStreamState !== "idle" && !suppressLiveTurn) {
    const liveStatus: TurnStatus =
      activeStreamState === "streaming"
        ? "streaming"
        : isPreTurnCostBlock
          ? "cost_capped_pre_turn"
          : (activeStreamState as TurnStatus);
    turns.push({
      id: STREAMING_TURN_ID,
      role: "assistant",
      parts: activeStreamParts,
      status: liveStatus,
      // A "completed" live turn's real message id isn't known client-side
      // until chat.getHistory catches up (server-generated UUID) — offering
      // regenerate here would resend the user's text instead of regenerating
      // the reply it actually produced (handleLiveRetry's no-id fallback).
      // failed/cost_capped/stopped need an IMMEDIATELY actionable retry
      // (CHAT-05), and "resend" is an acceptable, correct fallback for those
      // (nothing meaningful to regenerate yet either way) — only the
      // "completed" case is excluded to avoid that misfire.
      regenerateTargetId: liveStatus === "completed" ? undefined : STREAMING_TURN_ID,
    });
  }

  const regenerateDisabled = activeStreamState === "streaming";

  const handleSelectBrowserModel = useCallback(
    async (_modelId: string) => {
      await webllm.ensureLoaded();
    },
    [webllm],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <span className="sr-only" aria-live="polite">
        {liveAnnouncementFor(activeStreamState)}
      </span>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/70 px-4 backdrop-blur-md">
        <ModelPicker
          conversationId={conversationId}
          currentModelId={modelId}
          onSelectBrowserModel={handleSelectBrowserModel}
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
        turns={turns}
        streamingTurnId={STREAMING_TURN_ID}
        regenerateDisabled={regenerateDisabled}
        onNavigateSibling={handleNavigateSibling}
        onRegenerate={(assistantMessageId) =>
          assistantMessageId === STREAMING_TURN_ID
            ? handleLiveRetry()
            : handleRegenerate(assistantMessageId)
        }
      />
      <GeneratingIndicator state={activeStreamState} />
      <Composer
        isStreaming={activeStreamState === "streaming"}
        onSubmit={handleSubmit}
        onStop={handleStop}
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
