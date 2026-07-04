"use client";

/**
 * chat-canvas.tsx — ChatCanvas: the /chat canvas's React Flow surface
 * (CANVAS-01, CANVAS-02, D-02/D-03/D-05).
 *
 * Builds ONE `chat` node (centered at 0,0) + one `genui-panel` node per
 * active `genui_spec` message part in `historyRows` — each node.data carries
 * ONLY its provenance ref (D-05, never the spec content itself), auto-placed
 * via `layoutCanvasNodes`'s dagre LR port. Renders inside `CanvasSpecProvider`
 * (23-02, history-derived specsByProvenance) and `ChatControllerProvider`
 * (Task 2's D-02 seam) so `GenuiPanelNode`/`ChatNode` read volatile/streaming
 * state without ever touching the `nodes` array's `data` field (D-07).
 *
 * Persistence/restore is NOT wired here (plan 23-04's seam) — this renders
 * fresh from history + a fresh dagre layout on every mount, an explicit
 * plan-sanctioned interim behavior.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type ReactFlowInstance,
  type ReactFlowProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Workaround: moduleResolution:bundler + `export { default as ReactFlow }` causes TS
// to see the named export as the module namespace rather than the component value.
// Casting via the known props interface restores the JSX call signature (mirrors
// /knowledge's knowledge-graph.tsx).
const ReactFlowJSX = ReactFlow as React.ComponentType<ReactFlowProps<FlowNode, FlowEdge>>;

import { Button } from "@nauta/ui/button";

import type { MessagePart } from "../_hooks/use-chat-stream";
import type {
  ChatHistoryRow,
  ConversationController,
} from "../_hooks/use-conversation-controller";
import { CanvasEmptyState } from "./canvas-empty-state";
import {
  CanvasKeyboardHint,
  KEYBOARD_HINT_DISMISSED_KEY,
} from "./canvas-keyboard-hint";
import { layoutCanvasNodes } from "./canvas-layout";
import { CanvasSpecProvider } from "./canvas-spec-context";
import { ChatControllerProvider } from "./chat-node";
import { nodeTypes } from "./node-types";

const DRAG_HANDLE_SELECTOR = ".node-drag-handle";
// New-panel materialization fade (23-UI-SPEC.md Interaction Contracts) —
// `motion-safe:` gates it out entirely under prefers-reduced-motion. React
// Flow only (re)mounts a node's DOM element when its `id` first enters the
// array, so this plays exactly once per genui-panel node — the initial
// history-derived batch fades in together on mount; a LATER live-materialized
// panel (plan 23-04) gets its own fresh mount and fade, never replaying on
// already-mounted siblings.
const GENUI_PANEL_CLASS_NAME = "motion-safe:animate-in fade-in duration-200";

function chatNodeId(conversationId: string): string {
  return `chat:${conversationId}`;
}

function genuiPanelNodeId(messageId: string, partIndex: number): string {
  return `genui-panel:${messageId}:${partIndex}`;
}

/** `messageId:partIndex` — mirrors canvas-spec-context.tsx's own provenance
 * lookup key convention exactly. */
function provenanceKey(messageId: string, partIndex: number): string {
  return `${messageId}:${partIndex}`;
}

/**
 * buildBaseNodes — the chat node + one genui-panel node per ACTIVE turn's
 * genui_spec part (D-05: node.data is the provenance ref ONLY — never spec
 * content). Positions are all `{0,0}` placeholders; `layoutCanvasNodes`
 * assigns the real dagre-computed positions next. Pure — never mutates
 * `historyRows`.
 */
function buildBaseNodes(
  conversationId: string,
  historyRows: readonly ChatHistoryRow[],
): FlowNode[] {
  const chatNode: FlowNode = {
    id: chatNodeId(conversationId),
    type: "chat",
    position: { x: 0, y: 0 },
    dragHandle: DRAG_HANDLE_SELECTOR,
    data: { conversationId },
  };

  const genuiNodes: FlowNode[] = [];
  for (const row of historyRows) {
    if (!row.isActive) continue; // D-16: only the currently-displayed sibling materializes a panel
    const parts = (row.parts as MessagePart[] | null) ?? [];
    parts.forEach((part, partIndex) => {
      if (part.type !== "genui_spec") return;
      genuiNodes.push({
        id: genuiPanelNodeId(row.id, partIndex),
        type: "genui-panel",
        position: { x: 0, y: 0 },
        dragHandle: DRAG_HANDLE_SELECTOR,
        className: GENUI_PANEL_CLASS_NAME,
        data: {
          provenance: { messageId: row.id, partIndex, runId: null },
          turnIndex: row.turnIndex,
        },
      });
    });
  }

  return [chatNode, ...genuiNodes];
}

/** History-derived specsByProvenance map — feeds CanvasSpecProvider (23-02
 * seam); keys mirror canvas-spec-context.tsx's own provenanceKey exactly. */
function buildSpecsByProvenance(
  historyRows: readonly ChatHistoryRow[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of historyRows) {
    if (!row.isActive) continue;
    const parts = (row.parts as MessagePart[] | null) ?? [];
    parts.forEach((part, partIndex) => {
      if (part.type !== "genui_spec") return;
      map.set(provenanceKey(row.id, partIndex), JSON.stringify(part.spec));
    });
  }
  return map;
}

export interface ChatCanvasProps {
  readonly conversationId: string;
  readonly controller: ConversationController;
  readonly historyRows: readonly ChatHistoryRow[];
}

export function ChatCanvas({
  conversationId,
  controller,
  historyRows,
}: ChatCanvasProps): React.ReactElement {
  const baseNodes = useMemo(
    () => buildBaseNodes(conversationId, historyRows),
    [conversationId, historyRows],
  );
  const laidOutNodes = useMemo(() => layoutCanvasNodes(baseNodes, []), [baseNodes]);
  const specsByProvenance = useMemo(
    () => buildSpecsByProvenance(historyRows),
    [historyRows],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(laidOutNodes);
  const [edges, , onEdgesChange] = useEdgesState<FlowEdge>([]);
  // Session-only (23-UI-SPEC.md Layout & Structure "Minimap decision") —
  // deliberately NOT persisted, resets to off on reload.
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [hintDismissed, setHintDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEYBOARD_HINT_DISMISSED_KEY) === "true";
  });

  const rfInstanceRef = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const handleInit = useCallback((instance: ReactFlowInstance<FlowNode, FlowEdge>) => {
    rfInstanceRef.current = instance;
  }, []);

  const handlePaneClick = useCallback(() => {
    setNodes((prev) =>
      prev.map((node) => (node.selected ? { ...node, selected: false } : node)),
    );
  }, [setNodes]);

  const PAN_STEP_PX = 50;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Only handle these keys when the CONTAINER itself has focus — never
      // when focus is inside a node's composer/form controls (typing "+" or
      // arrow keys into a message must never hijack pan/zoom). 23-UI-SPEC.md
      // Accessibility: "When canvas has focus (not inside a specific node)".
      if (event.target !== event.currentTarget) return;
      const instance = rfInstanceRef.current;
      if (!instance) return;

      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        const viewport = instance.getViewport();
        const delta =
          event.key === "ArrowUp"
            ? { x: 0, y: PAN_STEP_PX }
            : event.key === "ArrowDown"
              ? { x: 0, y: -PAN_STEP_PX }
              : event.key === "ArrowLeft"
                ? { x: PAN_STEP_PX, y: 0 }
                : { x: -PAN_STEP_PX, y: 0 };
        instance.setViewport({
          x: viewport.x + delta.x,
          y: viewport.y + delta.y,
          zoom: viewport.zoom,
        });
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        instance.zoomIn();
        return;
      }
      if (event.key === "-") {
        event.preventDefault();
        instance.zoomOut();
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        void instance.fitView({ padding: 0.2, duration: 200 });
        return;
      }
      if (event.key === "Escape") {
        handlePaneClick();
      }
    },
    [handlePaneClick],
  );

  const handleDismissHint = useCallback(() => {
    setHintDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEYBOARD_HINT_DISMISSED_KEY, "true");
    }
  }, []);

  const handleToggleMiniMap = useCallback(() => {
    setShowMiniMap((prev) => !prev);
  }, []);

  const isEmpty = nodes.length === 0;

  return (
    <CanvasSpecProvider specsByProvenance={specsByProvenance}>
      <ChatControllerProvider controller={controller}>
        <div
          role="application"
          aria-label="Conversation canvas"
          aria-roledescription="node-based diagram"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="relative h-full w-full"
        >
          {isEmpty ? (
            <CanvasEmptyState />
          ) : (
            <ReactFlowJSX
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onPaneClick={handlePaneClick}
              onInit={handleInit}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={2}
              proOptions={{ hideAttribution: false }}
              aria-label="Conversation canvas"
            >
              <Background gap={16} size={1} />
              <Controls showZoom showFitView showInteractive />
              {showMiniMap && <MiniMap pannable zoomable />}
              <Panel position="top-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-pressed={showMiniMap}
                  aria-label="Toggle minimap"
                  className="size-11 bg-background/70 backdrop-blur-md"
                  onClick={handleToggleMiniMap}
                >
                  <MapIcon className="size-4" aria-hidden />
                </Button>
              </Panel>
            </ReactFlowJSX>
          )}
          {!hintDismissed && <CanvasKeyboardHint onDismiss={handleDismissHint} />}
        </div>
      </ChatControllerProvider>
    </CanvasSpecProvider>
  );
}
