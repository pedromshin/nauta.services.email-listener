/**
 * cluster-summary.test.ts — router-level tests for chat.clusterSummary
 * (CLUS-02/CLUS-06, Phase 54 Plan 06).
 *
 * Strategy mirrors thread-link.test.ts: `@polytoken/db/ownership` is mocked
 * at the module boundary (`assertConversationOwnership` +
 * `userOwnedImporterIds`), and a minimal thenable Drizzle-chain fake models
 * `db.execute()` (the `tableColumnExists` probe) and a QUEUE of `db.select()`
 * results consumed in call order — this resolver issues up to 4 selects in a
 * fixed sequence (threadId read -> sibling conversations -> captured-source
 * edges -> captured-source nodes), so a queue lets each test seed exactly
 * the rows each step should see without a real SQL join.
 *
 * Test plan:
 *   Test 1: a thread-linked conversation with siblings + captured sources
 *           returns { hasThread:true, siblingChatCount, capturedSourceCount }
 *           reflecting the real (deduped) counts.
 *   Test 2: an unlinked conversation (threadId null) returns NO_CLUSTER,
 *           with zero sibling/edge/node queries issued.
 *   Test 3: a non-owned conversationId throws NOT_FOUND — no further reads.
 *   Test 4 (feature-detect): the thread_id column absent returns NO_CLUSTER,
 *           never throws.
 *   Test 5: an owner-less caller (userOwnedImporterIds -> []) short-circuits
 *           capturedSourceCount to 0 without querying edges/nodes.
 *   Test 6: a live 42703 from the threadId SELECT itself degrades cleanly
 *           (defense-in-depth, mirrors thread-link.ts Test 6).
 *   Test 7: duplicate edges pointing the SAME node at two different cluster
 *           conversations count that node exactly once.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@polytoken/db/ownership", async () => {
  const actual = await vi.importActual<typeof import("@polytoken/db/ownership")>(
    "@polytoken/db/ownership",
  );
  return {
    ...actual,
    assertConversationOwnership: vi.fn(),
    userOwnedImporterIds: vi.fn(),
  };
});

import {
  assertConversationOwnership,
  userOwnedImporterIds,
  OwnershipError,
} from "@polytoken/db/ownership";

import { __resetColumnExistsCacheForTests } from "../../_column-detect";
import { appRouter } from "../../../root";

const USER_A = { id: "10000000-0000-0000-0000-00000000000a" };
const CONVERSATION_A = "20000000-0000-0000-0000-000000000c01";
const CONVERSATION_SIBLING = "20000000-0000-0000-0000-000000000c02";
const THREAD_A = "30000000-0000-0000-0000-000000000e01";
const IMPORTER_A = "40000000-0000-0000-0000-000000000a01";
const NODE_A = "50000000-0000-0000-0000-000000000n01";
const NODE_B = "50000000-0000-0000-0000-000000000n02";

type FakeRow = Record<string, unknown>;

function createFakeChain(rows: ReadonlyArray<FakeRow>) {
  const chain = {
    from() {
      return chain;
    },
    where() {
      return chain;
    },
    limit() {
      return chain;
    },
    then(
      onFulfilled: (rows: ReadonlyArray<FakeRow>) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

function createFakeErrorChain(error: unknown) {
  const chain = {
    from() {
      return chain;
    },
    where() {
      return chain;
    },
    limit() {
      return chain;
    },
    then(
      onFulfilled: (rows: ReadonlyArray<FakeRow>) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.reject(error).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

/**
 * A minimal thenable Drizzle-chain fake: `execute()` models the
 * `tableColumnExists` information_schema probe; `select()` pops the next
 * result set off a FIFO queue (one entry per expected select call, in the
 * exact order the resolver issues them). `selectErrorOnCall` lets one
 * specific call index reject instead of resolve (Test 6's live-42703 case).
 */
function createFakeDb(options: {
  readonly columnExists?: boolean;
  readonly selectQueue?: ReadonlyArray<ReadonlyArray<FakeRow>>;
  readonly selectErrorOnCall?: { readonly index: number; readonly error: unknown };
}) {
  const columnExists = options.columnExists ?? true;
  const queue = [...(options.selectQueue ?? [])];
  let selectCallCount = 0;

  return {
    execute() {
      const rows = columnExists ? [{ column_name: "thread_id" }] : [];
      return Promise.resolve(rows);
    },
    select() {
      const callIndex = selectCallCount;
      selectCallCount += 1;
      if (options.selectErrorOnCall && options.selectErrorOnCall.index === callIndex) {
        return createFakeErrorChain(options.selectErrorOnCall.error);
      }
      const rows = queue.shift() ?? [];
      return createFakeChain(rows);
    },
    __selectCallCount: () => selectCallCount,
  };
}

function makeCaller(
  user: { id: string } | null,
  db: ReturnType<typeof createFakeDb>,
) {
  return appRouter.createCaller({
    db: db as never,
    headers: new Headers(),
    user,
  });
}

beforeEach(() => {
  __resetColumnExistsCacheForTests();
  vi.mocked(assertConversationOwnership).mockReset();
  vi.mocked(userOwnedImporterIds).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("chat.clusterSummary", () => {
  it("Test 1: thread-linked with siblings + captured sources returns real counts", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    vi.mocked(userOwnedImporterIds).mockResolvedValue([IMPORTER_A]);

    const db = createFakeDb({
      columnExists: true,
      selectQueue: [
        [{ threadId: THREAD_A }], // 1. this conversation's threadId
        [{ id: CONVERSATION_SIBLING }], // 2. sibling conversations
        [{ sourceNodeId: NODE_A }, { sourceNodeId: NODE_B }], // 3. edges
        [{ id: NODE_A }, { id: NODE_B }], // 4. nodes
      ],
    });
    const caller = makeCaller(USER_A, db);

    const result = await caller.chat.clusterSummary({
      conversationId: CONVERSATION_A,
    });

    expect(result).toEqual({
      hasThread: true,
      siblingChatCount: 1,
      capturedSourceCount: 2,
    });
  });

  it("Test 2: an unlinked conversation returns NO_CLUSTER with no sibling/edge/node reads", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    vi.mocked(userOwnedImporterIds).mockResolvedValue([IMPORTER_A]);

    const db = createFakeDb({
      columnExists: true,
      selectQueue: [[{ threadId: null }]],
    });
    const caller = makeCaller(USER_A, db);

    const result = await caller.chat.clusterSummary({
      conversationId: CONVERSATION_A,
    });

    expect(result).toEqual({
      hasThread: false,
      siblingChatCount: 0,
      capturedSourceCount: 0,
    });
    expect(db.__selectCallCount()).toBe(1);
  });

  it("Test 3: a non-owned conversationId throws NOT_FOUND — no further reads", async () => {
    vi.mocked(assertConversationOwnership).mockRejectedValue(
      new OwnershipError("conversation", CONVERSATION_A),
    );
    const db = createFakeDb({ columnExists: true, selectQueue: [] });
    const caller = makeCaller(USER_A, db);

    await expect(
      caller.chat.clusterSummary({ conversationId: CONVERSATION_A }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.__selectCallCount()).toBe(0);
  });

  it("Test 4 (feature-detect): the thread_id column absent returns NO_CLUSTER, never throws", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    const db = createFakeDb({ columnExists: false, selectQueue: [] });
    const caller = makeCaller(USER_A, db);

    const result = await caller.chat.clusterSummary({
      conversationId: CONVERSATION_A,
    });

    expect(result).toEqual({
      hasThread: false,
      siblingChatCount: 0,
      capturedSourceCount: 0,
    });
    expect(db.__selectCallCount()).toBe(0);
  });

  it("Test 5: an owner-less caller short-circuits capturedSourceCount to 0, no edge/node reads", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    vi.mocked(userOwnedImporterIds).mockResolvedValue([]);

    const db = createFakeDb({
      columnExists: true,
      selectQueue: [
        [{ threadId: THREAD_A }],
        [], // no siblings
      ],
    });
    const caller = makeCaller(USER_A, db);

    const result = await caller.chat.clusterSummary({
      conversationId: CONVERSATION_A,
    });

    expect(result).toEqual({
      hasThread: true,
      siblingChatCount: 0,
      capturedSourceCount: 0,
    });
    // Only the threadId + sibling reads happen — no edge/node queries.
    expect(db.__selectCallCount()).toBe(2);
  });

  it("Test 6 (graceful degradation): a live 42703 from the threadId SELECT is caught, not thrown", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    const db = createFakeDb({
      columnExists: true,
      selectErrorOnCall: {
        index: 0,
        error: Object.assign(new Error('column "thread_id" does not exist'), {
          code: "42703",
        }),
      },
    });
    const caller = makeCaller(USER_A, db);

    const result = await caller.chat.clusterSummary({
      conversationId: CONVERSATION_A,
    });

    expect(result).toEqual({
      hasThread: false,
      siblingChatCount: 0,
      capturedSourceCount: 0,
    });
  });

  it("Test 7: the SAME node attached to two cluster conversations counts once", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    vi.mocked(userOwnedImporterIds).mockResolvedValue([IMPORTER_A]);

    const db = createFakeDb({
      columnExists: true,
      selectQueue: [
        [{ threadId: THREAD_A }],
        [{ id: CONVERSATION_SIBLING }],
        // Two edges, same sourceNodeId — one per cluster conversation.
        [{ sourceNodeId: NODE_A }, { sourceNodeId: NODE_A }],
        [{ id: NODE_A }],
      ],
    });
    const caller = makeCaller(USER_A, db);

    const result = await caller.chat.clusterSummary({
      conversationId: CONVERSATION_A,
    });

    expect(result.capturedSourceCount).toBe(1);
  });
});
