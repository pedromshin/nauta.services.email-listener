"use client";

/**
 * chat-canvas-island.tsx — thin "use client" wrapper holding the
 * `dynamic(ssr: false)` call for the /chat canvas's React Flow surface.
 *
 * Next.js 15 enforces that `ssr: false` is not allowed inside Server
 * Components; this mirrors /knowledge's knowledge-graph-island.tsx exactly.
 * ChatCanvas is NEVER server-rendered.
 */

import dynamic from "next/dynamic";

import type { ChatHistoryRow, ConversationController } from "../_hooks/use-conversation-controller";
import { CanvasSkeleton } from "./canvas-skeleton";

const ChatCanvasDynamic = dynamic(
  () => import("./chat-canvas").then((mod) => ({ default: mod.ChatCanvas })),
  {
    ssr: false,
    loading: () => <CanvasSkeleton />,
  },
);

export interface ChatCanvasIslandProps {
  readonly conversationId: string;
  readonly controller: ConversationController;
  readonly historyRows: readonly ChatHistoryRow[];
}

export function ChatCanvasIsland({
  conversationId,
  controller,
  historyRows,
}: ChatCanvasIslandProps): React.ReactElement {
  return (
    <ChatCanvasDynamic
      conversationId={conversationId}
      controller={controller}
      historyRows={historyRows}
    />
  );
}
