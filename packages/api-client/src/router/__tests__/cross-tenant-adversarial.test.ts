/**
 * cross-tenant-adversarial.test.ts — the Phase 44 ACCEPTANCE GATE (44-08,
 * TENA-03) for every tRPC procedure + the apps/web attachments route.
 *
 * This is NOT a re-derivation of the per-router scoping suites (44-05/06/07)
 * — those already exhaustively prove each router's own allow/deny wiring.
 * This suite proves the SAME thing from the ADVERSARY's point of view: given
 * two real users (A, B) and rows A owns, does ANY procedure in `appRouter`
 * let user B read or write A's data? Every router in `root.ts` (emails,
 * entities, entityTypes, knowledge, genui, chat) is exercised with at least
 * one cross-tenant READ attempt and one cross-tenant WRITE attempt (where a
 * write procedure exists — see the knowledge section below for the one
 * documented exception), plus a positive control proving user B can still
 * reach user B's OWN data (so the suite proves scoping, not blanket denial).
 *
 * Strategy (same idiom as emails/entities/knowledge/chat-user-scoping.test.ts,
 * Plans 05-07): `@polytoken/db/ownership` is mocked at the module boundary —
 * its own allow/deny-matrix correctness is exhaustively covered by
 * packages/db/src/ownership.test.ts (44-02). This suite drives the REAL
 * `appRouter` (createCallerFactory-style, via `appRouter.createCaller`) with
 * two distinct `ctx.user` ids over a seeded fake Drizzle chain — the same
 * fixture idiom as every 44-05/06/07 router suite, extended here to walk
 * every router in one adversarial pass.
 *
 * Coverage note — knowledge router has NO tRPC write mutation: the only
 * WRITE surface for knowledge_node_edges is the FastAPI promote endpoint
 * (`POST /v1/knowledge/edges/{id}/promote`), which is NOT proxied through
 * `packages/api-client` at all. That surface is covered by the FastAPI
 * adversarial suite (`apps/email-listener/tests/adversarial/
 * test_cross_tenant.py`, Task 2 of this plan) instead — see the
 * "knowledgeRouter" section below for the explicit cross-reference.
 *
 * Coverage note — genui.generate/codeIslandGenerate: the generation CACHE is
 * DELIBERATELY cross-tenant (Plan 01, SC5) — exact-match cache hits across
 * users are the intended behavior, not a tenancy gap. These two procedures
 * are asserted as auth-gated ONLY (UNAUTHORIZED without a session) and
 * explicitly NOT ownership-denied even when passed another user's
 * importerId — see the "genui — generation cache stays cross-tenant" block.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";

vi.mock("@polytoken/db/ownership", async () => {
  const actual = await vi.importActual<typeof import("@polytoken/db/ownership")>(
    "@polytoken/db/ownership",
  );
  return {
    ...actual,
    userOwnedImporterIds: vi.fn(),
    assertEmailOwnership: vi.fn(),
    assertComponentOwnership: vi.fn(),
    assertImporterOwnership: vi.fn(),
    assertConversationOwnership: vi.fn(),
  };
});

import {
  assertComponentOwnership,
  assertConversationOwnership,
  assertEmailOwnership,
  assertImporterOwnership,
  OwnershipError,
  userOwnedImporterIds,
} from "@polytoken/db/ownership";
import { ChatConversations } from "@polytoken/db/schema";

import { appRouter } from "../../root";

// ---------------------------------------------------------------------------
// Fixtures — two real users, each owning one importer + its rows.
// ---------------------------------------------------------------------------

const USER_A = { id: "a1000000-0000-0000-0000-00000000000a" };
const USER_B = { id: "b2000000-0000-0000-0000-00000000000b" };

const IMPORTER_A = "1a000000-0000-0000-0000-00000000001a";
const IMPORTER_B = "1b000000-0000-0000-0000-00000000001b";

const EMAIL_A_ID = "2a000000-0000-0000-0000-00000000002a";
const COMPONENT_A_ID = "3a000000-0000-0000-0000-00000000003a";
const ENTITY_A_ID = "4a000000-0000-0000-0000-00000000004a";
const ENTITY_A_TARGET_ID = "4a000000-0000-0000-0000-00000000004b";
const ENTITY_TYPE_A_ID = "5a000000-0000-0000-0000-00000000005a";
const NODE_A_ID = "6a000000-0000-0000-0000-00000000006a";
const NODE_B_ID = "6b000000-0000-0000-0000-00000000006b";
const CONVERSATION_A_ID = "7a000000-0000-0000-0000-00000000007a";
const TEMPLATE_A_ID = "8a000000-0000-0000-0000-00000000008a";
const TEMPLATE_B_ID = "8b000000-0000-0000-0000-00000000008b";

type FakeRow = Record<string, unknown>;

const URL = "http://listener.test";
const API_KEY = "test-api-key";

/**
 * Minimal thenable chain mimicking the subset of Drizzle's query-builder
 * surface the routers call (select/from/join/where/groupBy/orderBy/limit/
 * offset). Every chain method returns the same object; the terminal
 * `.then()` resolves the seeded `rows` array regardless of the arguments
 * passed to it — same idiom as every 44-05/06/07 *-user-scoping.test.ts.
 */
function createFakeChain(rows: ReadonlyArray<FakeRow>) {
  const chain = {
    from() {
      return chain;
    },
    innerJoin() {
      return chain;
    },
    leftJoin() {
      return chain;
    },
    where() {
      return chain;
    },
    groupBy() {
      return chain;
    },
    orderBy() {
      return chain;
    },
    limit() {
      return chain;
    },
    offset() {
      return chain;
    },
    then(
      onFulfilled: (value: ReadonlyArray<FakeRow>) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

/** A `ctx.db` stub whose every `select()` call resolves the SAME seeded rows. */
function selectDb(rows: ReadonlyArray<FakeRow> = []): { select: () => unknown } {
  return { select: () => createFakeChain(rows) };
}

/**
 * A `ctx.db` stub whose `select()` calls consume a QUEUE of seeded result
 * sets in order (for procedures that issue >1 sequential SELECT, e.g.
 * knowledge.byId's node-then-edges pair).
 */
function queueSelectDb(
  resultQueue: ReadonlyArray<ReadonlyArray<FakeRow>>,
): { select: () => unknown } {
  const queue = [...resultQueue];
  return { select: () => createFakeChain(queue.shift() ?? []) };
}

function makeCaller(user: { id: string } | null, db: unknown = {}) {
  return appRouter.createCaller({
    db: db as never,
    headers: new Headers(),
    user,
  });
}

beforeEach(() => {
  process.env.EMAIL_LISTENER_URL = URL;
  process.env.EMAIL_LISTENER_API_KEY = API_KEY;
});

afterEach(() => {
  delete process.env.EMAIL_LISTENER_URL;
  delete process.env.EMAIL_LISTENER_API_KEY;
  vi.mocked(userOwnedImporterIds).mockReset();
  vi.mocked(assertEmailOwnership).mockReset();
  vi.mocked(assertComponentOwnership).mockReset();
  vi.mocked(assertImporterOwnership).mockReset();
  vi.mocked(assertConversationOwnership).mockReset();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Sessionless calls — UNAUTHORIZED across every router (representative proc)
// ---------------------------------------------------------------------------

describe("adversarial gate — sessionless calls are rejected on every router", () => {
  it("emails.list", async () => {
    await expect(makeCaller(null).emails.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("entities.list", async () => {
    await expect(makeCaller(null).entities.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("entityTypes.list", async () => {
    await expect(makeCaller(null).entityTypes.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("knowledge.list", async () => {
    await expect(makeCaller(null).knowledge.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("chat.listConversations", async () => {
    await expect(
      makeCaller(null).chat.listConversations({}),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("genui.historyList", async () => {
    await expect(makeCaller(null).genui.historyList({})).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });

  it("genui.generate", async () => {
    await expect(
      makeCaller(null).genui.generate({ intent: "probe" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---------------------------------------------------------------------------
// emailsRouter — user B against user A's email/component
// ---------------------------------------------------------------------------

describe("adversarial gate — emailsRouter", () => {
  it("READ: emails.byId(A's email) as user B -> NOT_FOUND", async () => {
    vi.mocked(assertEmailOwnership).mockRejectedValueOnce(
      new OwnershipError("email", EMAIL_A_ID),
    );
    const caller = makeCaller(USER_B);

    await expect(
      caller.emails.byId({ id: EMAIL_A_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(assertEmailOwnership).toHaveBeenCalledWith(
      expect.anything(),
      EMAIL_A_ID,
      USER_B.id,
    );
  });

  it("WRITE: emails.accept(A's component) as user B -> NOT_FOUND, fetch never reached", async () => {
    vi.mocked(assertComponentOwnership).mockRejectedValueOnce(
      new OwnershipError("component", COMPONENT_A_ID),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(USER_B);

    await expect(
      caller.emails.accept({ componentId: COMPONENT_A_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSITIVE CONTROL: emails.list as user B returns user B's OWN row", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_B]);
    const caller = makeCaller(
      USER_B,
      selectDb([
        {
          id: "email-b-1",
          subject: "B's own email",
          senderName: null,
          senderAddress: "sender@example.com",
          toAddresses: [],
          receivedAt: new Date(),
          importerId: IMPORTER_B,
          bodyText: null,
        },
      ]),
    );

    const result = await caller.emails.list({});
    expect(result.items).toEqual([
      expect.objectContaining({ id: "email-b-1", importerId: IMPORTER_B }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// entitiesRouter — user B against user A's entity
// ---------------------------------------------------------------------------

describe("adversarial gate — entitiesRouter", () => {
  it("READ: entities.byId(A's entity) as user B -> NOT_FOUND", async () => {
    vi.mocked(assertImporterOwnership).mockRejectedValueOnce(
      new OwnershipError("importer", IMPORTER_A),
    );
    const caller = makeCaller(
      USER_B,
      selectDb([
        {
          id: ENTITY_A_ID,
          displayName: "A's Acme Corp",
          entityTypeId: "70000000-0000-0000-0000-000000000001",
          entityTypeLabel: "Shipper",
          identifiers: {},
          aliases: [],
          isActive: true,
          nautaId: null,
          createdAt: new Date(),
          importerId: IMPORTER_A,
        },
      ]),
    );

    await expect(
      caller.entities.byId({ id: ENTITY_A_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("WRITE: entities.confirmMerge(A's entity) as user B -> NOT_FOUND, fetch never reached", async () => {
    vi.mocked(assertImporterOwnership).mockRejectedValueOnce(
      new OwnershipError("importer", IMPORTER_A),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(USER_B, selectDb([{ importerId: IMPORTER_A }]));

    await expect(
      caller.entities.confirmMerge({
        entityInstanceId: ENTITY_A_ID,
        targetId: ENTITY_A_TARGET_ID,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSITIVE CONTROL: entities.list as user B returns user B's OWN row", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_B]);
    const caller = makeCaller(
      USER_B,
      selectDb([
        {
          id: "entity-b-1",
          displayName: "B's Own Corp",
          entityTypeId: "70000000-0000-0000-0000-000000000001",
          entityTypeLabel: "Shipper",
          identifiers: {},
          lastSeen: null,
          isActive: true,
          nautaId: null,
          occurrenceCount: 1,
          pendingDuplicatesCount: 0,
        },
      ]),
    );

    const result = await caller.entities.list({});
    expect(result.items).toEqual([
      expect.objectContaining({ id: "entity-b-1" }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// entityTypesRouter — user B against user A's importer-owned override
// ---------------------------------------------------------------------------

describe("adversarial gate — entityTypesRouter", () => {
  it("READ: entityTypes.list as user B derives scope from ctx.user.id (never a client-supplied field)", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_B]);
    const caller = makeCaller(USER_B, selectDb([]));

    await caller.entityTypes.list();
    expect(userOwnedImporterIds).toHaveBeenCalledWith(
      expect.anything(),
      USER_B.id,
    );
  });

  it("WRITE: entityTypes.update(A's owned type) as user B -> NOT_FOUND, fetch never reached", async () => {
    vi.mocked(assertImporterOwnership).mockRejectedValueOnce(
      new OwnershipError("importer", IMPORTER_A),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(
      USER_B,
      selectDb([{ importerId: IMPORTER_A, typeImporterId: IMPORTER_A }]),
    );

    await expect(
      caller.entityTypes.update({
        entityTypeId: ENTITY_TYPE_A_ID,
        label: "pwned",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSITIVE CONTROL: entityTypes.update(B's OWN type) as user B succeeds", async () => {
    vi.mocked(assertImporterOwnership).mockResolvedValueOnce(undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: {} }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(
      USER_B,
      selectDb([{ importerId: IMPORTER_B, typeImporterId: IMPORTER_B }]),
    );

    await expect(
      caller.entityTypes.update({
        entityTypeId: "b0000000-0000-0000-0000-00000000000b",
        label: "B's own label",
      }),
    ).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// knowledgeRouter — user B against user A's knowledge node
//
// No tRPC write mutation exists on this router (the only WRITE surface,
// POST /v1/knowledge/edges/{id}/promote, is a direct FastAPI endpoint never
// proxied through packages/api-client) — see
// apps/email-listener/tests/adversarial/test_cross_tenant.py for that
// surface's adversarial coverage.
// ---------------------------------------------------------------------------

describe("adversarial gate — knowledgeRouter (read-only tRPC surface)", () => {
  it("READ: knowledge.byId(A's node) as user B -> NOT_FOUND", async () => {
    vi.mocked(assertImporterOwnership).mockRejectedValueOnce(
      new OwnershipError("importer", IMPORTER_A),
    );
    const caller = makeCaller(
      USER_B,
      queueSelectDb([
        [
          {
            id: NODE_A_ID,
            title: "A's rule",
            content: null,
            scope: "email",
            scopeRefId: null,
            scopeRefType: null,
            source: "synthesis",
            confidence: 1,
            importerId: IMPORTER_A,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ]),
    );

    await expect(
      caller.knowledge.byId({ id: NODE_A_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("READ (2nd surface): knowledge.expandNode(A's node as seed) as user B -> NOT_FOUND (T-44-06-03)", async () => {
    vi.mocked(assertImporterOwnership).mockRejectedValueOnce(
      new OwnershipError("importer", IMPORTER_A),
    );
    const caller = makeCaller(
      USER_B,
      queueSelectDb([[{ id: NODE_A_ID, importerId: IMPORTER_A, isActive: true }]]),
    );

    await expect(
      caller.knowledge.expandNode({ nodeId: NODE_A_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("POSITIVE CONTROL: knowledge.byId(B's OWN node) as user B resolves", async () => {
    vi.mocked(assertImporterOwnership).mockResolvedValueOnce(undefined);
    const caller = makeCaller(
      USER_B,
      queueSelectDb([
        [
          {
            id: NODE_B_ID,
            title: "B's own rule",
            content: null,
            scope: "email",
            scopeRefId: null,
            scopeRefType: null,
            source: "synthesis",
            confidence: 1,
            importerId: IMPORTER_B,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        [], // edges
      ]),
    );

    const result = await caller.knowledge.byId({ id: NODE_B_ID });
    expect(result?.node).toMatchObject({ id: NODE_B_ID });
  });
});

// ---------------------------------------------------------------------------
// chatRouter — user B against user A's conversation
// ---------------------------------------------------------------------------

describe("adversarial gate — chatRouter", () => {
  it("READ: chat.getHistory(A's conversation) as user B -> NOT_FOUND", async () => {
    vi.mocked(assertConversationOwnership).mockRejectedValueOnce(
      new OwnershipError("conversation", CONVERSATION_A_ID),
    );
    const caller = makeCaller(USER_B);

    await expect(
      caller.chat.getHistory({ conversationId: CONVERSATION_A_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("WRITE: chat.renameConversation(A's conversation) as user B -> NOT_FOUND, no write issued", async () => {
    vi.mocked(assertConversationOwnership).mockRejectedValueOnce(
      new OwnershipError("conversation", CONVERSATION_A_ID),
    );
    const caller = makeCaller(USER_B);

    await expect(
      caller.chat.renameConversation({ id: CONVERSATION_A_ID, title: "pwned" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("POSITIVE CONTROL: chat.listConversations as user B is structurally scoped to B's OWN user_id (never A's)", async () => {
    const captured: { where?: unknown } = {};
    const chain = {
      from() {
        return chain;
      },
      where(cond: unknown) {
        captured.where = cond;
        return chain;
      },
      orderBy() {
        return chain;
      },
      limit() {
        return Promise.resolve([]);
      },
    };
    const caller = makeCaller(USER_B, { select: () => chain });

    await caller.chat.listConversations({});

    expect(captured.where).toEqual(
      and(eq(ChatConversations.userId, USER_B.id), undefined),
    );
    // Never structurally equal to a filter scoped to user A.
    expect(captured.where).not.toEqual(
      and(eq(ChatConversations.userId, USER_A.id), undefined),
    );
  });
});

// ---------------------------------------------------------------------------
// genuiRouter — historyList/historyById must not leak user A's history;
// generate/codeIslandGenerate stay auth-gated ONLY (deliberately cross-tenant
// generation cache, Plan 01 SC5) — never ownership-denied.
// ---------------------------------------------------------------------------

describe("adversarial gate — genuiRouter", () => {
  it("READ: genui.historyById(A's template) as user B -> NOT_FOUND", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_B]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: TEMPLATE_A_ID,
              intent_text: "A's intent",
              created_at: "2026-06-01T12:00:00+00:00",
              registry_version: "abc123",
              use_count: 1,
              validation_status: "validated",
              spec_json: { v: 1, root: { type: "alert", title: "x" } },
            },
            error: null,
          }),
      } as Response),
    );
    const caller = makeCaller(USER_B, selectDb([{ importerId: IMPORTER_A }]));

    await expect(
      caller.genui.historyById({ id: TEMPLATE_A_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("READ (2nd surface): genui.historyList({importerId: A's importer}) as user B -> empty, zero fetch calls", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_B]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(USER_B);

    const result = await caller.genui.historyList({ importerId: IMPORTER_A });
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSITIVE CONTROL: genui.historyById(B's OWN template) as user B resolves", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValue([IMPORTER_B]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: TEMPLATE_B_ID,
              intent_text: "B's own intent",
              created_at: "2026-06-01T12:00:00+00:00",
              registry_version: "abc123",
              use_count: 1,
              validation_status: "validated",
              spec_json: { v: 1, root: { type: "alert", title: "x" } },
            },
            error: null,
          }),
      } as Response),
    );
    const caller = makeCaller(USER_B, selectDb([{ importerId: IMPORTER_B }]));

    const result = await caller.genui.historyById({ id: TEMPLATE_B_ID });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ id: TEMPLATE_B_ID });
  });

  it("genui.generate — generation cache stays cross-tenant: passing A's importerId is auth-gated ONLY, never ownership-denied (SC5)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { spec: { v: 1, root: { type: "alert", title: "shared cache hit" } } },
            error: null,
          }),
      } as Response),
    );
    const caller = makeCaller(USER_B);

    const result = await caller.genui.generate({
      intent: "probe with another user's importer",
      importerId: IMPORTER_A,
    });

    // Never denied for cross-tenant importerId — auth (session) is the only gate.
    expect(result.outcome).toBe("ok");
  });
});
