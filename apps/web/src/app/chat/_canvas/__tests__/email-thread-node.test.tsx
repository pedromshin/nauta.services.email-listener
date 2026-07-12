/**
 * email-thread-node.test.tsx — EmailThreadNode (CLUS-01, 54-UI-SPEC.md
 * Component 1): the versioned-registry `email-thread` node type
 * (node.data schema/registry/dimensions — Task 1) plus the component's
 * loading/error/empty/success branches, Attach-chat mutation flow, and
 * remove wiring (Task 2, TDD RED->GREEN).
 *
 * "registry" describe block mirrors node-type-registry.test.ts's own
 * hash-flip/schema-strict conventions — kept here (rather than that file)
 * per 54-04-PLAN.md Task 1's own verify command
 * (`npx vitest run .../email-thread-node.test.tsx -t "registry"`).
 *
 * Component tests mount the REAL component (createRoot-in-jsdom + `act`,
 * mirrors knowledge-preview-node.test.tsx). `~/trpc/react`'s
 * `api.emails.threadCard.useQuery` / `api.chat.createConversation.useMutation`
 * / `api.chat.attachConversationToThread.useMutation` are mocked as plain
 * `vi.fn()`s; `@xyflow/react`'s `useReactFlow` is mocked via a PARTIAL
 * factory (mirrors knowledge-preview-node.test.tsx); `sonner`'s `toast` is
 * mocked (mirrors regenerate-control.test.tsx). EmailThreadNode reads
 * `onOpenConversation` from `CanvasPersistenceProvider` (54-04 deviation,
 * Rule 2 — see SUMMARY), so every component-mounting test wraps in the REAL
 * provider with an injectable value.
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

import {
  computeNodeRegistryHash,
  NODE_REGISTRY_VERSION,
} from "../node-registry-version";
import { EmailThreadNodeDataSchema } from "../node-data-schemas";
import { NODE_TYPE_REGISTRY } from "../node-type-registry";
import type { NodeTypeRegistryEntry } from "../node-type-registry";
import { CANVAS_NODE_DIMENSIONS } from "../canvas-layout";

const VALID_THREAD_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("registry", () => {
  describe("EmailThreadNodeDataSchema", () => {
    it("accepts a valid threadId with no label", () => {
      expect(
        EmailThreadNodeDataSchema.safeParse({ threadId: VALID_THREAD_ID }).success,
      ).toBe(true);
    });

    it("accepts a valid threadId with a label", () => {
      expect(
        EmailThreadNodeDataSchema.safeParse({
          threadId: VALID_THREAD_ID,
          label: "Q3 renewal thread",
        }).success,
      ).toBe(true);
    });

    it("rejects a non-uuid threadId", () => {
      expect(
        EmailThreadNodeDataSchema.safeParse({ threadId: "not-a-uuid" }).success,
      ).toBe(false);
    });

    it("rejects a label longer than 120 characters", () => {
      expect(
        EmailThreadNodeDataSchema.safeParse({
          threadId: VALID_THREAD_ID,
          label: "a".repeat(121),
        }).success,
      ).toBe(false);
    });

    it("rejects an unrecognized extra top-level key (.strict())", () => {
      expect(
        EmailThreadNodeDataSchema.safeParse({
          threadId: VALID_THREAD_ID,
          extra: true,
        }).success,
      ).toBe(false);
    });
  });

  describe("NODE_TYPE_REGISTRY['email-thread']", () => {
    it("exists with dataSchema === EmailThreadNodeDataSchema", () => {
      expect(NODE_TYPE_REGISTRY["email-thread"]).toBeDefined();
      expect(NODE_TYPE_REGISTRY["email-thread"]?.dataSchema).toBe(
        EmailThreadNodeDataSchema,
      );
      expect(NODE_TYPE_REGISTRY["email-thread"]?.id).toBe("email-thread");
    });
  });

  describe("computeNodeRegistryHash", () => {
    it("flips when the email-thread entry is added vs a registry without it", () => {
      const withoutEmailThread: Record<string, NodeTypeRegistryEntry> = {
        ...NODE_TYPE_REGISTRY,
      };
      delete withoutEmailThread["email-thread"];

      expect(computeNodeRegistryHash(withoutEmailThread)).not.toBe(
        computeNodeRegistryHash(NODE_TYPE_REGISTRY),
      );
    });

    it("NODE_REGISTRY_VERSION reflects the CURRENT registry (incl. email-thread)", () => {
      expect(NODE_REGISTRY_VERSION).toBe(computeNodeRegistryHash(NODE_TYPE_REGISTRY));
    });
  });

  describe("CANVAS_NODE_DIMENSIONS['email-thread']", () => {
    it("is fixed 320x220", () => {
      expect(CANVAS_NODE_DIMENSIONS["email-thread"]).toEqual({
        width: 320,
        height: 220,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Component tests (Task 2)
// ---------------------------------------------------------------------------

interface FakeThreadCardResult {
  readonly data:
    | {
        readonly threadId: string;
        readonly subject: string | null;
        readonly participantsSummary: string;
        readonly latestSnippet: string | null;
        readonly latestMessageId: string;
        readonly messageCount: number;
      }
    | null
    | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
}

let queryResult: FakeThreadCardResult = {
  data: undefined,
  isPending: true,
  isError: false,
  refetch: vi.fn(),
};

const useThreadCardQueryMock = vi.fn((..._args: unknown[]) => queryResult);

const createConversationMutateAsync = vi.fn();
const attachConversationToThreadMutateAsync = vi.fn();

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

vi.mock("~/trpc/react", () => ({
  api: {
    emails: {
      threadCard: {
        useQuery: (...args: unknown[]) => useThreadCardQueryMock(...args),
      },
    },
    chat: {
      createConversation: {
        useMutation: () => ({ mutateAsync: createConversationMutateAsync }),
      },
      attachConversationToThread: {
        useMutation: () => ({ mutateAsync: attachConversationToThreadMutateAsync }),
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

import { EmailThreadNode, resolveHeaderLabel, type EmailThreadNodeType } from "../email-thread-node";
import { nodeTypes, resolveNodeComponent } from "../node-types";
import {
  CanvasPersistenceProvider,
  type CanvasPersistenceContextValue,
} from "../panel-overlay-context";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const THREAD_ID = VALID_THREAD_ID;
const NEW_CONVERSATION_ID = "660e8400-e29b-41d4-a716-446655440111";

function makeNodeProps(
  overrides: Partial<NodeProps<EmailThreadNodeType>> = {},
): NodeProps<EmailThreadNodeType> {
  return {
    id: "email-thread:1",
    data: { threadId: THREAD_ID },
    type: "email-thread",
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
  } as NodeProps<EmailThreadNodeType>;
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

function renderNode(
  overrides: Partial<NodeProps<EmailThreadNodeType>> = {},
  persistenceOverrides: Partial<CanvasPersistenceContextValue> = {},
): Promise<HTMLDivElement> {
  const value: CanvasPersistenceContextValue = {
    scheduleSave: vi.fn(),
    conversationId: "11111111-1111-1111-1111-111111111111",
    onOpenConversation: vi.fn(),
    ...persistenceOverrides,
  };
  return mount(
    <ReactFlowProvider>
      <CanvasPersistenceProvider value={value}>
        <EmailThreadNode {...makeNodeProps(overrides)} />
      </CanvasPersistenceProvider>
    </ReactFlowProvider>,
  );
}

beforeEach(() => {
  queryResult = { data: undefined, isPending: true, isError: false, refetch: vi.fn() };
  useThreadCardQueryMock.mockClear();
  mockDeleteElements.mockClear();
  createConversationMutateAsync.mockReset();
  attachConversationToThreadMutateAsync.mockReset();
  toastError.mockClear();
});

afterEach(() => {
  for (const c of containers) {
    document.body.removeChild(c);
  }
  containers = [];
});

describe("resolveHeaderLabel", () => {
  it("explicit customLabel always wins", () => {
    expect(resolveHeaderLabel("Custom", "Real subject")).toBe("Custom");
    expect(resolveHeaderLabel("Custom", undefined)).toBe("Custom");
  });

  it("resolves the fetched thread's own subject once settled", () => {
    expect(resolveHeaderLabel(undefined, "Q3 renewal")).toBe("Q3 renewal");
  });

  it("falls back to 'Untitled thread' while loading (no data yet)", () => {
    expect(resolveHeaderLabel(undefined, undefined)).toBe("Untitled thread");
  });

  it("falls back to 'Untitled thread' when settled with a null subject", () => {
    expect(resolveHeaderLabel(undefined, null)).toBe("Untitled thread");
  });
});

describe("EmailThreadNode", () => {
  // Test: loading
  it("loading: renders role=status aria-label='Loading thread' skeletons", async () => {
    queryResult = { data: undefined, isPending: true, isError: false, refetch: vi.fn() };
    const container = await renderNode();

    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-label")).toBe("Loading thread");
    expect(container.textContent).toContain("Untitled thread");
  });

  // Test: error
  it("error: destructive EmptyState with the exact heading and a Retry action calling refetch", async () => {
    const refetch = vi.fn();
    queryResult = { data: undefined, isPending: false, isError: true, refetch };
    const container = await renderNode();

    expect(container.textContent).toContain("Couldn't load this thread.");
    expect(container.textContent).toContain("Try again, or open it from your inbox.");

    const retryButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Retry",
    );
    expect(retryButton).not.toBeUndefined();

    await act(async () => {
      retryButton!.click();
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // Test: empty
  it("empty (query.data === null): 'This thread is unavailable.' with the Mail icon", async () => {
    queryResult = { data: null, isPending: false, isError: false, refetch: vi.fn() };
    const container = await renderNode();

    expect(container.textContent).toContain("This thread is unavailable.");
    expect(container.textContent).toContain(
      "It may have been removed or is no longer accessible.",
    );
  });

  // Test: success
  it("success: participants row + line-clamp-4 summary; headerLabel resolves data.label -> subject -> fallback", async () => {
    queryResult = {
      data: {
        threadId: THREAD_ID,
        subject: "Q3 renewal",
        participantsSummary: "Alice, Bob +2 more",
        latestSnippet: "Let's finalize the terms by Friday.",
        latestMessageId: "770e8400-e29b-41d4-a716-446655440222",
        messageCount: 5,
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
    const container = await renderNode();

    expect(container.textContent).toContain("Q3 renewal");
    expect(container.textContent).toContain("Alice, Bob +2 more");
    expect(container.textContent).toContain("Let's finalize the terms by Friday.");

    // data.label wins over the fetched subject when both are present
    const withLabel = await renderNode({ data: { threadId: THREAD_ID, label: "My label" } });
    expect(withLabel.textContent).toContain("My label");
    expect(withLabel.textContent).not.toContain("Q3 renewal");
  });

  // Test: Attach chat — success path
  it("Attach chat: creates + attaches a conversation, then calls onOpenConversation with the new id", async () => {
    queryResult = {
      data: {
        threadId: THREAD_ID,
        subject: "Q3 renewal",
        participantsSummary: "Alice",
        latestSnippet: "snippet",
        latestMessageId: "770e8400-e29b-41d4-a716-446655440222",
        messageCount: 1,
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
    createConversationMutateAsync.mockResolvedValue({ id: NEW_CONVERSATION_ID });
    attachConversationToThreadMutateAsync.mockResolvedValue({ attached: true });

    const onOpenConversation = vi.fn();
    const container = await renderNode({}, { onOpenConversation });

    const attachButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Attach chat"),
    ) as HTMLButtonElement;
    expect(attachButton).not.toBeUndefined();

    await act(async () => {
      attachButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createConversationMutateAsync).toHaveBeenCalledWith({});
    expect(attachConversationToThreadMutateAsync).toHaveBeenCalledWith({
      conversationId: NEW_CONVERSATION_ID,
      threadId: THREAD_ID,
    });
    expect(onOpenConversation).toHaveBeenCalledWith(NEW_CONVERSATION_ID);
    expect(toastError).not.toHaveBeenCalled();
  });

  // Test: Attach chat — in-flight state
  it("Attach chat: shows Loader2 + disabled while in flight", async () => {
    queryResult = { data: null, isPending: false, isError: false, refetch: vi.fn() };
    let resolveCreate: (value: { id: string }) => void = () => undefined;
    createConversationMutateAsync.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; }),
    );
    attachConversationToThreadMutateAsync.mockResolvedValue({ attached: true });

    const container = await renderNode();
    const attachButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Attach chat"),
    ) as HTMLButtonElement;

    await act(async () => {
      attachButton.click();
    });

    expect(attachButton.disabled).toBe(true);
    expect(container.querySelector(".animate-spin")).not.toBeNull();

    await act(async () => {
      resolveCreate({ id: NEW_CONVERSATION_ID });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  // Test: Attach chat — error path
  it("Attach chat: attach failure shows toast.error with a Retry action", async () => {
    queryResult = { data: null, isPending: false, isError: false, refetch: vi.fn() };
    createConversationMutateAsync.mockResolvedValue({ id: NEW_CONVERSATION_ID });
    attachConversationToThreadMutateAsync.mockResolvedValue({
      attached: false,
      reason: "linkage_unavailable",
    });

    const onOpenConversation = vi.fn();
    const container = await renderNode({}, { onOpenConversation });
    const attachButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Attach chat"),
    ) as HTMLButtonElement;

    await act(async () => {
      attachButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onOpenConversation).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
    const [message, options] = toastError.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("Couldn't attach a chat to this thread — try again.");
    expect(options.action.label).toBe("Retry");
    expect(typeof options.action.onClick).toBe("function");
  });

  // Test: remove wiring
  it("remove wiring: clicking the remove button calls deleteElements once with this node's own id, nothing else", async () => {
    queryResult = { data: null, isPending: false, isError: false, refetch: vi.fn() };
    const container = await renderNode({ id: "email-thread:remove-me" });

    const removeButton = container.querySelector('button[aria-label="Remove thread"]');
    expect(removeButton).not.toBeNull();

    await act(async () => {
      (removeButton as HTMLButtonElement).click();
    });

    expect(mockDeleteElements).toHaveBeenCalledTimes(1);
    expect(mockDeleteElements).toHaveBeenCalledWith({
      nodes: [{ id: "email-thread:remove-me" }],
    });
    expect(createConversationMutateAsync).not.toHaveBeenCalled();
    expect(attachConversationToThreadMutateAsync).not.toHaveBeenCalled();
  });

  // Test: node-types.ts wiring
  it("node-types.ts wiring: nodeTypes['email-thread'] resolves to EmailThreadNode", () => {
    expect(nodeTypes["email-thread"]).toBe(EmailThreadNode);
    expect(resolveNodeComponent("email-thread")).toBe(EmailThreadNode);
  });
});
