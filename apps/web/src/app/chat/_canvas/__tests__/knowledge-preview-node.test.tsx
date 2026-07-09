/**
 * knowledge-preview-node.test.tsx — KnowledgePreviewNode (PREV-01,
 * 41-UI-SPEC.md section 1/3): `resolveHeaderLabel`/`resolveFooterCopy`'s
 * pure resolution logic, loading-flag threading into
 * `KnowledgePreviewMiniGraph`, remove-button wiring via
 * `useReactFlow().deleteElements`, and `node-types.ts`'s 3rd registry entry.
 *
 * Mounts the REAL component — mirrors this repo's createRoot-in-jsdom + `act`
 * convention (knowledge-preview-mini-graph.test.tsx, provenance-link.test.tsx).
 * `~/trpc/react`'s `api.knowledge.expandNode.useQuery` is mocked as a plain
 * `vi.fn()` (mirrors `use-canvas-persistence-edges-stable.test.tsx`'s
 * `api.chat.getCanvasLayout.useQuery` mock convention — simpler than
 * `use-data-bindings.test.tsx`'s `useQueries` proxy, since this is a single
 * `.useQuery` call). `@xyflow/react`'s `useReactFlow` is mocked via a
 * PARTIAL factory (`vi.importActual` spread, override only `useReactFlow`)
 * so `Handle`/`Position`/every other real export stays intact.
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface FakeExpandNodeResult {
  readonly data:
    | { readonly nodes: ReadonlyArray<{ readonly id: string; readonly label: string }>; readonly edges: readonly unknown[] }
    | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
}

let queryResult: FakeExpandNodeResult = {
  data: undefined,
  isPending: true,
  isError: false,
  refetch: vi.fn(),
};

const useQueryMock = vi.fn(() => queryResult);

vi.mock("~/trpc/react", () => ({
  api: {
    knowledge: {
      expandNode: {
        useQuery: (...args: unknown[]) => useQueryMock(...args),
      },
    },
  },
}));

const mockDeleteElements = vi.fn();

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
  return {
    ...actual,
    useReactFlow: () => ({ deleteElements: mockDeleteElements }),
  };
});

import {
  KnowledgePreviewNode,
  resolveFooterCopy,
  resolveHeaderLabel,
  type KnowledgePreviewNodeType,
} from "../knowledge-preview-node";
import { nodeTypes, resolveNodeComponent } from "../node-types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FOCUS_ID = "00000000-0000-0000-0000-000000000001";

function makeNodeProps(
  overrides: Partial<NodeProps<KnowledgePreviewNodeType>> = {},
): NodeProps<KnowledgePreviewNodeType> {
  return {
    id: "knowledge-preview:1",
    data: { focusNodeId: FOCUS_ID },
    type: "knowledge-preview",
    dragging: false,
    zIndex: 0,
    selectable: true,
    deletable: true,
    selected: false,
    draggable: true,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    ...overrides,
  } as NodeProps<KnowledgePreviewNodeType>;
}

let containers: HTMLDivElement[] = [];

async function mount(element: React.ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return container;
}

beforeEach(() => {
  queryResult = { data: undefined, isPending: true, isError: false, refetch: vi.fn() };
  useQueryMock.mockClear();
  mockDeleteElements.mockClear();
});

afterEach(() => {
  for (const c of containers) {
    document.body.removeChild(c);
  }
  containers = [];
});

describe("resolveHeaderLabel", () => {
  // Test 1
  it("explicit customLabel always wins, regardless of other args", () => {
    expect(resolveHeaderLabel("Custom", undefined, "f")).toBe("Custom");
    expect(
      resolveHeaderLabel("Custom", [{ id: "f", label: "Acme Corp" }], "f"),
    ).toBe("Custom");
  });

  // Test 2
  it("resolves the focus node's own title once data has settled", () => {
    expect(
      resolveHeaderLabel(undefined, [{ id: "f", label: "Acme Corp" }], "f"),
    ).toBe("Acme Corp");
  });

  // Test 3
  it("falls back to 'Knowledge preview' while loading with no data yet", () => {
    expect(resolveHeaderLabel(undefined, undefined, "f")).toBe("Knowledge preview");
  });

  // Test 4
  it("falls back to 'Knowledge preview' when settled but focus not found (defensive)", () => {
    expect(resolveHeaderLabel(undefined, [], "f")).toBe("Knowledge preview");
  });
});

describe("resolveFooterCopy", () => {
  // Test 5
  it("returns the no-overflow / overflow copy exactly", () => {
    expect(resolveFooterCopy(0)).toBe("Open in Knowledge →");
    expect(resolveFooterCopy(3)).toBe("+3 more — Open in Knowledge →");
  });
});

describe("KnowledgePreviewNode", () => {
  // Test 6
  it("loading: renders fallback header text and threads isLoading down to the mini-graph", async () => {
    queryResult = {
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    };
    const container = await mount(
      <ReactFlowProvider>
        <KnowledgePreviewNode {...makeNodeProps()} />
      </ReactFlowProvider>,
    );

    expect(container.textContent).toContain("Knowledge preview");
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  // Test 7
  it("remove wiring: clicking the remove button calls deleteElements once with this node's own id", async () => {
    const container = await mount(
      <ReactFlowProvider>
        <KnowledgePreviewNode {...makeNodeProps({ id: "knowledge-preview:remove-me" })} />
      </ReactFlowProvider>,
    );

    const removeButton = container.querySelector(
      'button[aria-label="Remove knowledge preview"]',
    );
    expect(removeButton).not.toBeNull();

    await act(async () => {
      (removeButton as HTMLButtonElement).click();
    });

    expect(mockDeleteElements).toHaveBeenCalledTimes(1);
    expect(mockDeleteElements).toHaveBeenCalledWith({
      nodes: [{ id: "knowledge-preview:remove-me" }],
    });
  });

  // Test 8
  it("node-types.ts wiring: nodeTypes['knowledge-preview'] resolves to KnowledgePreviewNode", () => {
    expect(nodeTypes["knowledge-preview"]).toBe(KnowledgePreviewNode);
    expect(resolveNodeComponent("knowledge-preview")).toBe(KnowledgePreviewNode);
  });
});
