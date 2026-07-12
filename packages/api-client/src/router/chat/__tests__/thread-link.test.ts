/**
 * thread-link.test.ts — router-level tests for chat.attachConversationToThread
 * + chat.getConversationThreadId (CLUS-02, Phase 54 Plan 01) and for
 * createConversation's new optional `threadId` input.
 *
 * Strategy: `@polytoken/db/ownership` is mocked at the module boundary (same
 * idiom as thread-grouping.test.ts / emails-user-scoping.test.ts) — its own
 * allow/deny-matrix correctness is exhaustively covered by
 * packages/db/src/ownership.test.ts. These tests prove the WIRING: ownership
 * is asserted BEFORE any write, the `_column-detect.ts` feature-detection
 * gate is honored, and an unapplied migration 0036 (or a live 42703 from the
 * write itself) degrades cleanly instead of throwing.
 *
 * A minimal fake Drizzle handle (same thenable-chain idiom as
 * forwarding.test.ts) models select/update/insert/execute. `__resetColumnExistsCacheForTests`
 * clears `_column-detect.ts`'s per-process cache between cases so "column
 * exists" and "column absent" scenarios never leak into each other.
 *
 * Test plan:
 *   Test 1: attachConversationToThread with a threadId + owned conversationId
 *           sets thread_id and returns { attached: true }.
 *   Test 2: a non-owned conversationId throws NOT_FOUND — thread_id never written.
 *   Test 3: createConversation persists an optional threadId when the column exists.
 *   Test 4: createConversation silently drops threadId when the column is absent
 *           (no error, no write of the missing column).
 *   Test 5: getConversationThreadId returns { threadId } for an owned conversation
 *           with a linked thread, and null when unset.
 *   Test 6 (graceful degradation): the underlying UPDATE raising a Postgres
 *           UndefinedColumn error (42703) is caught and returns a clean
 *           unavailable result instead of throwing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@polytoken/db/ownership", async () => {
  const actual = await vi.importActual<typeof import("@polytoken/db/ownership")>(
    "@polytoken/db/ownership",
  );
  return {
    ...actual,
    assertConversationOwnership: vi.fn(),
  };
});

import {
  assertConversationOwnership,
  OwnershipError,
} from "@polytoken/db/ownership";

import { __resetColumnExistsCacheForTests } from "../../_column-detect";
import { appRouter } from "../../../root";

const USER_A = { id: "10000000-0000-0000-0000-00000000000a" };
const CONVERSATION_A = "20000000-0000-0000-0000-000000000c01";
const THREAD_A = "30000000-0000-0000-0000-000000000e01";

type FakeRow = Record<string, unknown>;

/**
 * A minimal thenable Drizzle-chain fake covering exactly the subset the
 * chat router calls: select().from().where().limit(), update().set().where(),
 * insert().values().returning(), and execute() (the information_schema
 * probe `tableColumnExists` issues).
 *
 * - `columnExists: false` makes execute() resolve to an empty row list
 *   (simulates migration 0036 unapplied — the real "no such column" case).
 * - `updateRejectsWith` makes the update chain's terminal `.then()` reject
 *   with the given error (simulates a live 42703 from the write itself,
 *   independent of the detection probe).
 * - `selectRows` seeds what select().from().where().limit() resolves to.
 */
function createFakeDb(options: {
  readonly columnExists?: boolean;
  readonly updateRejectsWith?: unknown;
  readonly selectRows?: ReadonlyArray<FakeRow>;
}) {
  const columnExists = options.columnExists ?? true;
  let updateCallCount = 0;
  let updateSetValue: Record<string, unknown> | undefined;
  let insertedValues: Record<string, unknown> | undefined;
  let executeCallCount = 0;

  const db = {
    execute() {
      executeCallCount += 1;
      const rows = columnExists ? [{ column_name: "thread_id" }] : [];
      return Promise.resolve(rows);
    },
    select() {
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
          return Promise.resolve(options.selectRows ?? []).then(
            onFulfilled,
            onRejected,
          );
        },
      };
      return chain;
    },
    update() {
      const chain = {
        set(v: Record<string, unknown>) {
          updateSetValue = v;
          return chain;
        },
        where() {
          return chain;
        },
        then(
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          updateCallCount += 1;
          if (options.updateRejectsWith !== undefined) {
            return Promise.reject(options.updateRejectsWith).then(
              onFulfilled,
              onRejected,
            );
          }
          return Promise.resolve(undefined).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
    insert() {
      const chain = {
        values(v: Record<string, unknown>) {
          insertedValues = v;
          return chain;
        },
        returning() {
          return chain;
        },
        then(
          onFulfilled: (rows: ReadonlyArray<FakeRow>) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve([{ id: "40000000-0000-0000-0000-000000000new" }]).then(
            onFulfilled,
            onRejected,
          );
        },
      };
      return chain;
    },
  };

  return {
    db,
    updateCallCount: () => updateCallCount,
    getUpdateSetValue: () => updateSetValue,
    getInsertedValues: () => insertedValues,
    executeCallCount: () => executeCallCount,
  };
}

function makeCaller(
  user: { id: string } | null,
  db: ReturnType<typeof createFakeDb>["db"],
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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("chat.attachConversationToThread", () => {
  it("Test 1: sets thread_id and returns { attached: true } for an owned conversation", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    const fake = createFakeDb({ columnExists: true });
    const caller = makeCaller(USER_A, fake.db);

    const result = await caller.chat.attachConversationToThread({
      conversationId: CONVERSATION_A,
      threadId: THREAD_A,
    });

    expect(result).toEqual({ attached: true });
    expect(fake.updateCallCount()).toBe(1);
    expect(fake.getUpdateSetValue()?.["threadId"]).toBe(THREAD_A);
    expect(fake.getUpdateSetValue()?.["updatedAt"]).toBeInstanceOf(Date);
  });

  it("Test 2: a non-owned conversationId throws NOT_FOUND — thread_id never written", async () => {
    vi.mocked(assertConversationOwnership).mockRejectedValue(
      new OwnershipError("conversation", CONVERSATION_A),
    );
    const fake = createFakeDb({ columnExists: true });
    const caller = makeCaller(USER_A, fake.db);

    await expect(
      caller.chat.attachConversationToThread({
        conversationId: CONVERSATION_A,
        threadId: THREAD_A,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(fake.updateCallCount()).toBe(0);
  });

  it("Test 6 (graceful degradation): a live 42703 from the UPDATE is caught, not thrown", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    const fake = createFakeDb({
      columnExists: true,
      updateRejectsWith: Object.assign(new Error('column "thread_id" does not exist'), {
        code: "42703",
      }),
    });
    const caller = makeCaller(USER_A, fake.db);

    const result = await caller.chat.attachConversationToThread({
      conversationId: CONVERSATION_A,
      threadId: THREAD_A,
    });

    expect(result).toEqual({ attached: false, reason: "linkage_unavailable" });
  });

  it("returns a clean unavailable result (no throw) when the column doesn't exist yet", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    const fake = createFakeDb({ columnExists: false });
    const caller = makeCaller(USER_A, fake.db);

    const result = await caller.chat.attachConversationToThread({
      conversationId: CONVERSATION_A,
      threadId: THREAD_A,
    });

    expect(result).toEqual({ attached: false, reason: "linkage_unavailable" });
    expect(fake.updateCallCount()).toBe(0);
  });
});

describe("chat.getConversationThreadId", () => {
  it("Test 5a: returns { threadId } for an owned conversation with a linked thread", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    const fake = createFakeDb({
      columnExists: true,
      selectRows: [{ threadId: THREAD_A }],
    });
    const caller = makeCaller(USER_A, fake.db);

    const result = await caller.chat.getConversationThreadId({
      conversationId: CONVERSATION_A,
    });

    expect(result).toEqual({ threadId: THREAD_A });
  });

  it("Test 5b: returns { threadId: null } when unset", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    const fake = createFakeDb({
      columnExists: true,
      selectRows: [{ threadId: null }],
    });
    const caller = makeCaller(USER_A, fake.db);

    const result = await caller.chat.getConversationThreadId({
      conversationId: CONVERSATION_A,
    });

    expect(result).toEqual({ threadId: null });
  });

  it("returns { threadId: null } when the column doesn't exist yet (no throw)", async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue(undefined);
    const fake = createFakeDb({ columnExists: false });
    const caller = makeCaller(USER_A, fake.db);

    const result = await caller.chat.getConversationThreadId({
      conversationId: CONVERSATION_A,
    });

    expect(result).toEqual({ threadId: null });
  });
});

describe("chat.createConversation — optional threadId (CLUS-02)", () => {
  it("Test 3: persists threadId when the column exists", async () => {
    const fake = createFakeDb({ columnExists: true });
    const caller = makeCaller(USER_A, fake.db);

    await caller.chat.createConversation({
      modelId: "some-model",
      threadId: THREAD_A,
    });

    expect(fake.getInsertedValues()?.["threadId"]).toBe(THREAD_A);
  });

  it("Test 4: silently drops threadId when the column is absent (no throw)", async () => {
    const fake = createFakeDb({ columnExists: false });
    const caller = makeCaller(USER_A, fake.db);

    const result = await caller.chat.createConversation({
      modelId: "some-model",
      threadId: THREAD_A,
    });

    expect(result.id).toBeDefined();
    expect(fake.getInsertedValues()?.["threadId"]).toBeUndefined();
  });
});
