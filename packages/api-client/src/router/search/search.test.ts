/**
 * search.test.ts — DB-free tests for the `search.omnibox` fan-out (AI-05).
 *
 * Strategy mirrors knowledge-user-scoping.test.ts: `@polytoken/db/ownership`
 * is mocked at the module boundary (its allow/deny correctness is covered by
 * packages/db/src/ownership.test.ts); the fake ctx.db is QUEUE-based. The
 * queue order is deterministic because each arm's builder chain is
 * constructed synchronously in declaration order before any await settles:
 * entity (select #1) → email (select #2) → conversation (select #3);
 * the knowledge arm consumes ctx.db.execute (its own queue); the file arm
 * consumes the injected fake VaultAdapter.
 *
 * Test plan:
 *   1. sessionless call → UNAUTHORIZED.
 *   2. query shorter than 2 chars → zod rejection (BAD_REQUEST).
 *   3. owner-less caller: importer-anchored arms issue ZERO queries, but the
 *      user-scoped arms (conversations, files) still run.
 *   4. fan-out shape + merge order: every arm contributes; results are
 *      typed { kind, id, title, subtitle?, href } in OMNIBOX_KIND_ORDER.
 *   5. scoping wiring: scope derives from ctx.user.id; the knowledge RPC
 *      runs once per owned importer; the file arm lists ctx.user.id's root.
 *   6. per-arm degradation: one arm throwing yields an empty group, not a
 *      dead omnibox.
 *   7. mergeOmniboxResults — pure ordering contract.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@polytoken/db/ownership", async () => {
  const actual = await vi.importActual<typeof import("@polytoken/db/ownership")>(
    "@polytoken/db/ownership",
  );
  return {
    ...actual,
    userOwnedImporterIds: vi.fn(),
  };
});

import { userOwnedImporterIds } from "@polytoken/db/ownership";

import type { VaultAdapter } from "../files/storage-adapter";
import {
  createSearchRouter,
  mergeOmniboxResults,
  OMNIBOX_KIND_ORDER,
  omniboxSearchInputSchema,
  type OmniboxResult,
} from "./index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = { id: "10000000-0000-0000-0000-00000000000a" };
const IMPORTER_A = "30000000-0000-0000-0000-000000000a01";
const IMPORTER_B = "30000000-0000-0000-0000-000000000a02";

const ENTITY_ID = "40000000-0000-0000-0000-000000000001";
const EMAIL_ID = "50000000-0000-0000-0000-000000000001";
const CONVERSATION_ID = "60000000-0000-0000-0000-000000000001";
const KNOWLEDGE_ID = "80000000-0000-0000-0000-000000000001";

type FakeRow = Record<string, unknown>;

/** A thenable drizzle-ish chain resolving (or rejecting) with seeded rows. */
function createFakeChain(rows: ReadonlyArray<FakeRow> | Error) {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then(
      onFulfilled: (value: ReadonlyArray<FakeRow>) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return rows instanceof Error
        ? Promise.reject(rows).then(onFulfilled, onRejected)
        : Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

function createFakeVaultAdapter(
  entries: ReadonlyArray<{ name: string; isFolder: boolean; kind: string }>,
) {
  const listFolder = vi.fn().mockResolvedValue({
    entries: entries.map((entry) => ({
      name: entry.name,
      kind: entry.kind,
      isFolder: entry.isFolder,
      size: entry.isFolder ? null : 1,
      updatedAt: null,
      contentType: null,
    })),
    nextCursor: null,
  });
  const adapter: VaultAdapter = {
    listFolder,
    signedDownloadUrl: vi.fn(),
    signedUploadUrl: vi.fn(),
    createFolder: vi.fn(),
    removeEntry: vi.fn(),
  } as unknown as VaultAdapter;
  return { adapter, listFolder };
}

/**
 * makeCaller — queue-based fake db (select + execute have SEPARATE queues)
 * plus an injected fake vault adapter.
 */
function makeCaller(opts: {
  user: { id: string } | null;
  selectQueue?: ReadonlyArray<ReadonlyArray<FakeRow> | Error>;
  executeQueue?: ReadonlyArray<ReadonlyArray<FakeRow> | Error>;
  vaultEntries?: ReadonlyArray<{ name: string; isFolder: boolean; kind: string }>;
}) {
  const selectQueue = [...(opts.selectQueue ?? [])];
  const executeQueue = [...(opts.executeQueue ?? [])];
  const selectCalls = { count: 0 };
  const executeCalls = { count: 0 };

  const db = {
    select() {
      selectCalls.count += 1;
      return createFakeChain(selectQueue.shift() ?? []);
    },
    execute() {
      executeCalls.count += 1;
      const next = executeQueue.shift() ?? [];
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    },
  };

  const { adapter, listFolder } = createFakeVaultAdapter(
    opts.vaultEntries ?? [],
  );

  const router = createSearchRouter({ vaultAdapter: adapter });
  const caller = router.createCaller({
    db: db as never,
    headers: new Headers(),
    user: opts.user,
  });

  return { caller, selectCalls, executeCalls, listFolder };
}

afterEach(() => {
  vi.mocked(userOwnedImporterIds).mockReset();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Session + input validation
// ---------------------------------------------------------------------------

describe("search.omnibox — session + input validation", () => {
  it("Test 1: rejects a sessionless call with UNAUTHORIZED", async () => {
    const { caller } = makeCaller({ user: null });
    await expect(caller.omnibox({ query: "acme" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("Test 2: rejects a sub-2-char query at the zod boundary", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValue([IMPORTER_A]);
    const { caller, selectCalls } = makeCaller({ user: USER_A });
    await expect(caller.omnibox({ query: "a" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(selectCalls.count).toBe(0);

    // Schema contract directly (exported for DB-free testing).
    expect(omniboxSearchInputSchema.safeParse({ query: "a" }).success).toBe(
      false,
    );
    expect(
      omniboxSearchInputSchema.safeParse({ query: "ok" }).success,
    ).toBe(true);
    expect(
      omniboxSearchInputSchema.safeParse({ query: "ok", limitPerKind: 50 })
        .success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Owner-less scoping split (TENA-03)
// ---------------------------------------------------------------------------

describe("search.omnibox — owner-less caller (TENA-03)", () => {
  it("Test 3: importer-anchored arms issue ZERO queries; user-scoped arms still run", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([]);
    const { caller, selectCalls, executeCalls, listFolder } = makeCaller({
      user: USER_A,
      // Seed a "leaked" row: if any importer-anchored arm queried anyway,
      // this would surface as an entity result.
      selectQueue: [
        [{ id: CONVERSATION_ID, title: "Acme planning" }],
      ],
      vaultEntries: [{ name: "acme-quote.pdf", isFolder: false, kind: "text" }],
    });

    const { results } = await caller.omnibox({ query: "acme" });

    // Exactly ONE select ran (conversations); zero knowledge RPCs.
    expect(selectCalls.count).toBe(1);
    expect(executeCalls.count).toBe(0);
    // File arm is structurally user-scoped and still ran.
    expect(listFolder).toHaveBeenCalledWith(USER_A.id, [], 0);

    expect(results.map((r) => r.kind)).toEqual(["conversation", "file"]);
  });
});

// ---------------------------------------------------------------------------
// Fan-out shape + merge order
// ---------------------------------------------------------------------------

describe("search.omnibox — fan-out shape + arm-priority merge", () => {
  it("Test 4: every arm contributes typed results, merged in OMNIBOX_KIND_ORDER", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_A]);
    const { caller } = makeCaller({
      user: USER_A,
      // Declaration order: entity, email, conversation.
      selectQueue: [
        [
          {
            id: ENTITY_ID,
            displayName: "Acme GmbH",
            entityTypeLabel: "Supplier",
          },
        ],
        [
          {
            id: EMAIL_ID,
            subject: "Acme invoice",
            senderName: "Jane at Acme",
            senderAddress: "jane@acme.com",
          },
        ],
        [{ id: CONVERSATION_ID, title: "Acme planning" }],
      ],
      executeQueue: [
        [
          {
            id: KNOWLEDGE_ID,
            title: "Acme payment terms",
            content: "Net 30",
            scope: "sender",
            scope_ref_id: null,
            tier: "EXTRACTED",
            confidence: 0.9,
            sim: 0.7,
          },
        ],
      ],
      vaultEntries: [
        { name: "acme-quote.pdf", isFolder: false, kind: "text" },
        // Folders are never file results.
        { name: "acme-folder", isFolder: true, kind: "folder" },
        // Non-matching names are filtered out.
        { name: "other.txt", isFolder: false, kind: "text" },
      ],
    });

    const { results } = await caller.omnibox({ query: "acme" });

    expect(results).toEqual([
      {
        kind: "entity",
        id: ENTITY_ID,
        title: "Acme GmbH",
        subtitle: "Supplier",
        href: `/entities/${ENTITY_ID}`,
      },
      {
        kind: "email",
        id: EMAIL_ID,
        title: "Acme invoice",
        subtitle: "Jane at Acme",
        href: `/emails/${EMAIL_ID}`,
      },
      {
        kind: "conversation",
        id: CONVERSATION_ID,
        title: "Acme planning",
        href: `/chat?c=${CONVERSATION_ID}`,
      },
      {
        kind: "knowledge",
        id: KNOWLEDGE_ID,
        title: "Acme payment terms",
        subtitle: "EXTRACTED",
        href: `/knowledge?node=${KNOWLEDGE_ID}`,
      },
      {
        kind: "file",
        id: "acme-quote.pdf",
        title: "acme-quote.pdf",
        subtitle: "text",
        href: "/files",
      },
    ]);
  });

  it("Test 5: scope derives from ctx.user.id; knowledge RPC runs once per owned importer", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([
      IMPORTER_A,
      IMPORTER_B,
    ]);
    const { caller, executeCalls, listFolder } = makeCaller({
      user: USER_A,
      executeQueue: [[], []],
    });

    await caller.omnibox({ query: "acme" });

    expect(userOwnedImporterIds).toHaveBeenCalledWith(
      expect.anything(),
      USER_A.id,
    );
    // One trgm RPC per owned importer (the KG-8 per-importer seam).
    expect(executeCalls.count).toBe(2);
    // The file arm lists the CALLER's root — never a client-named prefix.
    expect(listFolder).toHaveBeenCalledTimes(1);
    expect(listFolder).toHaveBeenCalledWith(USER_A.id, [], 0);
  });
});

// ---------------------------------------------------------------------------
// Per-arm degradation
// ---------------------------------------------------------------------------

describe("search.omnibox — per-arm degradation", () => {
  it("Test 6: one arm failing yields an empty group, not a dead omnibox", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_A]);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { caller } = makeCaller({
      user: USER_A,
      selectQueue: [
        [{ id: ENTITY_ID, displayName: "Acme GmbH", entityTypeLabel: null }],
        new Error("emails table is on fire"),
        [{ id: CONVERSATION_ID, title: "Acme planning" }],
      ],
      executeQueue: [[]],
    });

    const { results } = await caller.omnibox({ query: "acme" });

    expect(results.map((r) => r.kind)).toEqual(["entity", "conversation"]);
    // The failure was loud server-side, naming the arm.
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("email arm failed"),
      expect.any(Error),
    );
  });
});

// ---------------------------------------------------------------------------
// Pure merge contract
// ---------------------------------------------------------------------------

describe("mergeOmniboxResults — ordering contract", () => {
  it("Test 7: flattens in OMNIBOX_KIND_ORDER, preserving per-arm order", () => {
    const make = (
      kind: OmniboxResult["kind"],
      id: string,
    ): OmniboxResult => ({ kind, id, title: id, href: `/x/${id}` });

    const merged = mergeOmniboxResults({
      file: [make("file", "f1"), make("file", "f2")],
      entity: [make("entity", "e1")],
      knowledge: [make("knowledge", "k1")],
    });

    expect(merged.map((r) => `${r.kind}:${r.id}`)).toEqual([
      "entity:e1",
      "knowledge:k1",
      "file:f1",
      "file:f2",
    ]);
    // Sanity: the exported order is the documented one.
    expect(OMNIBOX_KIND_ORDER).toEqual([
      "entity",
      "email",
      "conversation",
      "knowledge",
      "file",
    ]);
  });
});
