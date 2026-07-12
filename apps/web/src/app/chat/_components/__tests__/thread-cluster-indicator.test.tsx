/**
 * thread-cluster-indicator.test.tsx — ThreadClusterIndicator (CLUS-02 linked
 * thread + CLUS-06 cluster context, 54-UI-SPEC.md Component 3): conditional
 * mount (threadId null/pending -> renders nothing), trigger aria-label +
 * truncated subject, popover "Linked thread"/"Cluster context" sections,
 * both `clusterContextCopy` variants, and the "Open thread →" link's href.
 *
 * `~/trpc/react`'s `api.chat.getConversationThreadId`/`api.chat.clusterSummary`/
 * `api.emails.threadCard` are mocked as plain `vi.fn()`s (mirrors
 * email-thread-node.test.tsx's `queryResult` convention). `PopoverContent`
 * renders through a Radix Portal appended to `document.body` (mirrors
 * add-email-thread-popover.test.tsx) — every post-open assertion queries
 * `document.body`.
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface ThreadIdQueryResult {
  readonly data: { readonly threadId: string | null } | undefined;
}

interface ThreadCardQueryResult {
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
}

interface ClusterSummaryQueryResult {
  readonly data:
    | {
        readonly hasThread: boolean;
        readonly siblingChatCount: number;
        readonly capturedSourceCount: number;
      }
    | undefined;
}

let threadIdResult: ThreadIdQueryResult = { data: undefined };
let threadCardResult: ThreadCardQueryResult = { data: undefined };
let clusterSummaryResult: ClusterSummaryQueryResult = { data: undefined };

const getConversationThreadIdMock = vi.fn((..._args: unknown[]) => threadIdResult);
const threadCardMock = vi.fn((..._args: unknown[]) => threadCardResult);
const clusterSummaryMock = vi.fn((..._args: unknown[]) => clusterSummaryResult);

vi.mock("~/trpc/react", () => ({
  api: {
    chat: {
      getConversationThreadId: {
        useQuery: (...args: unknown[]) => getConversationThreadIdMock(...args),
      },
      clusterSummary: {
        useQuery: (...args: unknown[]) => clusterSummaryMock(...args),
      },
    },
    emails: {
      threadCard: {
        useQuery: (...args: unknown[]) => threadCardMock(...args),
      },
    },
  },
}));

import { ThreadClusterIndicator, clusterContextCopy } from "../thread-cluster-indicator";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CONVERSATION_ID = "11111111-1111-1111-1111-111111111111";
const THREAD_ID = "22222222-2222-2222-2222-222222222222";
const LATEST_MESSAGE_ID = "33333333-3333-3333-3333-333333333333";

let containers: HTMLDivElement[] = [];
let roots: Root[] = [];

async function mount(element: React.ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(element);
  });
  return container;
}

function getTrigger(container: HTMLDivElement): HTMLButtonElement | null {
  return container.querySelector("button");
}

async function openPopover(container: HTMLDivElement): Promise<void> {
  const trigger = getTrigger(container);
  expect(trigger).not.toBeNull();
  await act(async () => {
    trigger!.click();
  });
}

beforeEach(() => {
  threadIdResult = { data: undefined };
  threadCardResult = { data: undefined };
  clusterSummaryResult = { data: undefined };
  getConversationThreadIdMock.mockClear();
  threadCardMock.mockClear();
  clusterSummaryMock.mockClear();
});

afterEach(async () => {
  for (const root of roots) {
    await act(async () => {
      root.unmount();
    });
  }
  for (const c of containers) c.remove();
  containers = [];
  roots = [];
  document.body
    .querySelectorAll("[data-radix-popper-content-wrapper]")
    .forEach((n) => n.remove());
});

describe("clusterContextCopy", () => {
  it("has-context variant substitutes real counts with the literal '(s)' suffix", () => {
    expect(clusterContextCopy(2, 3)).toBe(
      "This chat can see context from 2 other chat(s) and 3 captured source(s) on this thread.",
    );
  });

  it("none variant when both counts are zero", () => {
    expect(clusterContextCopy(0, 0)).toBe(
      "No other chats or sources on this thread yet.",
    );
  });

  it("has-context variant fires when only one count is nonzero", () => {
    expect(clusterContextCopy(1, 0)).toContain("1 other chat(s)");
    expect(clusterContextCopy(0, 1)).toContain("1 captured source(s)");
  });
});

describe("ThreadClusterIndicator", () => {
  it("renders nothing when threadId is null", async () => {
    threadIdResult = { data: { threadId: null } };
    const container = await mount(
      <ThreadClusterIndicator conversationId={CONVERSATION_ID} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing while the threadId query is still pending (data undefined)", async () => {
    threadIdResult = { data: undefined };
    const container = await mount(
      <ThreadClusterIndicator conversationId={CONVERSATION_ID} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the trigger with aria-label 'Linked thread: {subject}' when threadId is set", async () => {
    threadIdResult = { data: { threadId: THREAD_ID } };
    threadCardResult = {
      data: {
        threadId: THREAD_ID,
        subject: "Q3 renewal",
        participantsSummary: "Alice",
        latestSnippet: "snippet",
        latestMessageId: LATEST_MESSAGE_ID,
        messageCount: 3,
      },
    };
    clusterSummaryResult = {
      data: { hasThread: true, siblingChatCount: 2, capturedSourceCount: 1 },
    };
    const container = await mount(
      <ThreadClusterIndicator conversationId={CONVERSATION_ID} />,
    );

    const trigger = container.querySelector(
      'button[aria-label="Linked thread: Q3 renewal"]',
    );
    expect(trigger).not.toBeNull();
  });

  it("the popover has 'Linked thread' + 'Cluster context' sections, and the 'Open thread →' link points at hrefFor('email', latestMessageId)", async () => {
    threadIdResult = { data: { threadId: THREAD_ID } };
    threadCardResult = {
      data: {
        threadId: THREAD_ID,
        subject: "Q3 renewal",
        participantsSummary: "Alice",
        latestSnippet: "snippet",
        latestMessageId: LATEST_MESSAGE_ID,
        messageCount: 3,
      },
    };
    clusterSummaryResult = {
      data: { hasThread: true, siblingChatCount: 2, capturedSourceCount: 1 },
    };
    const container = await mount(
      <ThreadClusterIndicator conversationId={CONVERSATION_ID} />,
    );
    await openPopover(container);

    expect(document.body.textContent).toContain("Linked thread");
    expect(document.body.textContent).toContain("Cluster context");
    expect(document.body.textContent).toContain(
      "This chat can see context from 2 other chat(s) and 1 captured source(s) on this thread.",
    );

    const openThreadLink = Array.from(document.body.querySelectorAll("a")).find(
      (a) => a.textContent?.includes("Open thread"),
    );
    expect(openThreadLink).not.toBeUndefined();
    expect(openThreadLink?.getAttribute("href")).toBe(`/emails/${LATEST_MESSAGE_ID}`);
  });

  it("the none-context variant renders when clusterSummary has zero counts", async () => {
    threadIdResult = { data: { threadId: THREAD_ID } };
    threadCardResult = {
      data: {
        threadId: THREAD_ID,
        subject: "Q3 renewal",
        participantsSummary: "Alice",
        latestSnippet: "snippet",
        latestMessageId: LATEST_MESSAGE_ID,
        messageCount: 1,
      },
    };
    clusterSummaryResult = {
      data: { hasThread: true, siblingChatCount: 0, capturedSourceCount: 0 },
    };
    const container = await mount(
      <ThreadClusterIndicator conversationId={CONVERSATION_ID} />,
    );
    await openPopover(container);

    expect(document.body.textContent).toContain(
      "No other chats or sources on this thread yet.",
    );
  });

  it("falls back to 'Untitled thread' while the threadCard query is still pending", async () => {
    threadIdResult = { data: { threadId: THREAD_ID } };
    threadCardResult = { data: undefined };
    clusterSummaryResult = { data: undefined };
    const container = await mount(
      <ThreadClusterIndicator conversationId={CONVERSATION_ID} />,
    );

    const trigger = container.querySelector(
      'button[aria-label="Linked thread: Untitled thread"]',
    );
    expect(trigger).not.toBeNull();
  });

  it("trigger uses focus-visible (not bare focus:) with ring-offset-1, per the phase's focus-visible mandate (54-UI-REVIEW.md fix #4)", async () => {
    threadIdResult = { data: { threadId: THREAD_ID } };
    threadCardResult = {
      data: {
        threadId: THREAD_ID,
        subject: "Q3 renewal",
        participantsSummary: "Alice",
        latestSnippet: "snippet",
        latestMessageId: LATEST_MESSAGE_ID,
        messageCount: 1,
      },
    };
    clusterSummaryResult = {
      data: { hasThread: true, siblingChatCount: 0, capturedSourceCount: 0 },
    };
    const container = await mount(
      <ThreadClusterIndicator conversationId={CONVERSATION_ID} />,
    );

    const trigger = getTrigger(container);
    expect(trigger?.className).toContain("focus-visible:ring-ring");
    expect(trigger?.className).toContain("focus-visible:ring-offset-1");
    expect(trigger?.className).not.toContain("focus:ring-ring");
  });

  it("'Open thread' link has focus-visible styling and guards the pending threadCardQuery.data case — mirrors EmailThreadNode's canOpenThread guard (54-UI-REVIEW.md fix #2)", async () => {
    threadIdResult = { data: { threadId: THREAD_ID } };
    threadCardResult = { data: undefined }; // threadCard still pending
    clusterSummaryResult = {
      data: { hasThread: true, siblingChatCount: 0, capturedSourceCount: 0 },
    };
    const container = await mount(
      <ThreadClusterIndicator conversationId={CONVERSATION_ID} />,
    );
    await openPopover(container);

    const openThreadLink = Array.from(document.body.querySelectorAll("a")).find(
      (a) => a.textContent?.includes("Open thread"),
    );
    expect(openThreadLink).not.toBeUndefined();
    expect(openThreadLink?.className).toContain("focus-visible:ring-ring");
    expect(openThreadLink?.className).toContain("focus-visible:ring-offset-1");
    expect(openThreadLink?.getAttribute("aria-disabled")).toBe("true");
    expect(openThreadLink?.className).toContain("pointer-events-none");
    expect(openThreadLink?.getAttribute("href")).toBe("#");
  });

  it("'Open thread' link drops the disabled guard once threadCardQuery.data settles", async () => {
    threadIdResult = { data: { threadId: THREAD_ID } };
    threadCardResult = {
      data: {
        threadId: THREAD_ID,
        subject: "Q3 renewal",
        participantsSummary: "Alice",
        latestSnippet: "snippet",
        latestMessageId: LATEST_MESSAGE_ID,
        messageCount: 1,
      },
    };
    clusterSummaryResult = {
      data: { hasThread: true, siblingChatCount: 0, capturedSourceCount: 0 },
    };
    const container = await mount(
      <ThreadClusterIndicator conversationId={CONVERSATION_ID} />,
    );
    await openPopover(container);

    const openThreadLink = Array.from(document.body.querySelectorAll("a")).find(
      (a) => a.textContent?.includes("Open thread"),
    );
    expect(openThreadLink?.getAttribute("aria-disabled")).toBe("false");
    expect(openThreadLink?.className).not.toContain("pointer-events-none");
    expect(openThreadLink?.getAttribute("href")).toBe(`/emails/${LATEST_MESSAGE_ID}`);
  });

  it("does not fetch threadCard/clusterSummary when threadId is null", async () => {
    threadIdResult = { data: { threadId: null } };
    await mount(<ThreadClusterIndicator conversationId={CONVERSATION_ID} />);

    const threadCardCall = threadCardMock.mock.calls[0]?.[1] as
      | { enabled?: boolean }
      | undefined;
    const clusterSummaryCall = clusterSummaryMock.mock.calls[0]?.[1] as
      | { enabled?: boolean }
      | undefined;
    expect(threadCardCall?.enabled).toBe(false);
    expect(clusterSummaryCall?.enabled).toBe(false);
  });
});
