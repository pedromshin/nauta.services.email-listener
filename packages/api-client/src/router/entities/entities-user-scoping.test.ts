/**
 * entities-user-scoping.test.ts — cross-tenant regression tests for the
 * entities tRPC router (Phase 44 Plan 06, TENA-03).
 *
 * Strategy (mirrors emails/__tests__/emails-user-scoping.test.ts, 44-05):
 * `@polytoken/db/ownership` is mocked at the module boundary — its own
 * allow/deny-matrix correctness is exhaustively covered by
 * packages/db/src/ownership.test.ts (44-02). These tests prove the WIRING:
 * every entities-router procedure (a) requires a session
 * (protectedProcedure -> UNAUTHORIZED for a sessionless call), (b) derives
 * its scope/ownership check from ctx.user.id — never a client-supplied
 * field, and (c) maps a rejected ownership check to TRPCError NOT_FOUND
 * BEFORE any write proxies to FastAPI.
 *
 * Test plan:
 *   Test 1-3:  list / byId / confirmMerge reject a sessionless call with
 *              UNAUTHORIZED.
 *   Test 4:    list — an owner-less caller gets an empty page (no query).
 *   Test 5:    list — a non-owned importerId filter is rejected (empty page)
 *              even though the fake db is seeded with a "leaked" row.
 *   Test 6:    list — an owned importerId filter is honored.
 *   Test 7:    byId — NOT_FOUND when the entity's importer belongs to
 *              another user.
 *   Test 8:    byId — null for a missing entity (pre-existing contract).
 *   Test 9:    confirmMerge — NOT_FOUND when the merge TARGET belongs to
 *              another user (every referenced id asserted), fetch never
 *              reached.
 *   Test 10:   unmerge — NOT_FOUND for a foreign entity, fetch never reached.
 *   Test 11:   unmerge — NOT_FOUND for a MISSING entity (fail-closed, same
 *              surface as foreign), fetch never reached.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@polytoken/db/ownership", async () => {
  const actual = await vi.importActual<typeof import("@polytoken/db/ownership")>(
    "@polytoken/db/ownership",
  );
  return {
    ...actual,
    userOwnedImporterIds: vi.fn(),
    assertImporterOwnership: vi.fn(),
  };
});

import {
  assertImporterOwnership,
  OwnershipError,
  userOwnedImporterIds,
} from "@polytoken/db/ownership";

import { appRouter } from "../../root";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = { id: "10000000-0000-0000-0000-00000000000a" };
const IMPORTER_A = "30000000-0000-0000-0000-000000000a01";
const IMPORTER_B = "30000000-0000-0000-0000-000000000b02";
const ENTITY_ID = "60000000-0000-0000-0000-000000000e01";
const TARGET_ID = "60000000-0000-0000-0000-000000000e02";

type FakeRow = Record<string, unknown>;

/**
 * Minimal thenable chain mimicking the subset of Drizzle's query-builder the
 * entities router calls. Every chain method returns the same object; the
 * terminal `.then()` resolves the seeded rows regardless of arguments — a
 * fixture for testing the ROUTER's interpretation of a query result (same
 * idiom as emails-user-scoping.test.ts / packages/db/src/ownership.test.ts).
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

function makeCaller(
  user: { id: string } | null,
  rows: ReadonlyArray<FakeRow> = [],
  selectCalls: { count: number } = { count: 0 },
) {
  const db = {
    select() {
      selectCalls.count += 1;
      return createFakeChain(rows);
    },
  };
  return appRouter.createCaller({
    db: db as never,
    headers: new Headers(),
    user,
  });
}

/** A full raw gallery row so shapeGalleryItem has everything it needs. */
function galleryRow(importerId: string): FakeRow {
  return {
    id: ENTITY_ID,
    displayName: "Acme Corp",
    entityTypeId: "70000000-0000-0000-0000-000000000001",
    entityTypeLabel: "Shipper",
    identifiers: {},
    lastSeen: null,
    isActive: true,
    nautaId: null,
    occurrenceCount: 1,
    pendingDuplicatesCount: 0,
    importerId,
  };
}

afterEach(() => {
  vi.mocked(userOwnedImporterIds).mockReset();
  vi.mocked(assertImporterOwnership).mockReset();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Session requirement
// ---------------------------------------------------------------------------

describe("entitiesRouter — session requirement (TENA-03)", () => {
  it("Test 1: entities.list rejects a sessionless call with UNAUTHORIZED", async () => {
    const caller = makeCaller(null);
    await expect(caller.entities.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("Test 2: entities.byId rejects a sessionless call with UNAUTHORIZED", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.entities.byId({ id: ENTITY_ID }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("Test 3: entities.confirmMerge rejects a sessionless call with UNAUTHORIZED", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.entities.confirmMerge({
        entityInstanceId: ENTITY_ID,
        targetId: TARGET_ID,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---------------------------------------------------------------------------
// list scoping (T-44-06-01)
// ---------------------------------------------------------------------------

describe("entitiesRouter — list scoping (T-44-06-01)", () => {
  it("Test 4: list returns an empty page (and issues no query) when the caller owns no importers", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([]);
    const selectCalls = { count: 0 };
    const caller = makeCaller(USER_A, [galleryRow(IMPORTER_B)], selectCalls);

    const result = await caller.entities.list({});
    expect(result.items).toEqual([]);
    expect(selectCalls.count).toBe(0);
  });

  it("Test 5: a non-owned importerId filter is rejected — user A cannot read via user B's importerId", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_A]);
    // Seeded with a row the fake db would happily return if the procedure
    // ever queried without the ownership-derived scope.
    const caller = makeCaller(USER_A, [galleryRow(IMPORTER_B)]);

    const result = await caller.entities.list({ importerId: IMPORTER_B });
    expect(result.items).toEqual([]);
  });

  it("Test 6: an owned importerId filter is honored", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_A]);
    const caller = makeCaller(USER_A, [galleryRow(IMPORTER_A)]);

    const result = await caller.entities.list({ importerId: IMPORTER_A });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: ENTITY_ID });
    expect(userOwnedImporterIds).toHaveBeenCalledWith(
      expect.anything(),
      USER_A.id,
    );
  });
});

// ---------------------------------------------------------------------------
// byId cross-tenant isolation (T-44-06-02)
// ---------------------------------------------------------------------------

describe("entitiesRouter — byId cross-tenant isolation (T-44-06-02)", () => {
  it("Test 7: byId throws NOT_FOUND when the entity's importer belongs to another user", async () => {
    vi.mocked(assertImporterOwnership).mockRejectedValueOnce(
      new OwnershipError("importer", IMPORTER_B),
    );
    const caller = makeCaller(USER_A, [
      { ...galleryRow(IMPORTER_B), aliases: [], createdAt: new Date() },
    ]);

    await expect(
      caller.entities.byId({ id: ENTITY_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(assertImporterOwnership).toHaveBeenCalledWith(
      expect.anything(),
      IMPORTER_B,
      USER_A.id,
    );
  });

  it("Test 8: byId returns null for a missing entity (pre-existing contract)", async () => {
    const caller = makeCaller(USER_A, []);
    await expect(caller.entities.byId({ id: ENTITY_ID })).resolves.toBeNull();
    expect(assertImporterOwnership).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// merge / unmerge cross-tenant write rejection (T-44-06-02)
// ---------------------------------------------------------------------------

describe("entitiesRouter — merge/unmerge cross-tenant write rejection (T-44-06-02)", () => {
  it("Test 9: confirmMerge rejects when the merge TARGET belongs to another user, never reaching fetch", async () => {
    vi.mocked(assertImporterOwnership)
      .mockResolvedValueOnce(undefined) // entityInstanceId's importer: owned
      .mockRejectedValueOnce(new OwnershipError("importer", IMPORTER_B)); // targetId's importer: foreign
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(USER_A, [{ importerId: IMPORTER_B }]);

    await expect(
      caller.entities.confirmMerge({
        entityInstanceId: ENTITY_ID,
        targetId: TARGET_ID,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
    // Every referenced id's importer was asserted with ctx.user.id.
    expect(assertImporterOwnership).toHaveBeenCalledTimes(2);
    expect(assertImporterOwnership).toHaveBeenCalledWith(
      expect.anything(),
      IMPORTER_B,
      USER_A.id,
    );
  });

  it("Test 10: unmerge rejects a foreign entity, never reaching fetch", async () => {
    vi.mocked(assertImporterOwnership).mockRejectedValueOnce(
      new OwnershipError("importer", IMPORTER_B),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(USER_A, [{ importerId: IMPORTER_B }]);

    await expect(
      caller.entities.unmerge({ entityInstanceId: ENTITY_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Test 11: unmerge rejects a MISSING entity with the same NOT_FOUND surface (fail-closed)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(USER_A, []); // entity load resolves no row

    await expect(
      caller.entities.unmerge({ entityInstanceId: ENTITY_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assertImporterOwnership).not.toHaveBeenCalled();
  });
});
