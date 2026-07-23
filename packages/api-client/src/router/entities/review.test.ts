/**
 * review.test.ts — unit tests for entities.reviewQueue (EN-02).
 *
 * Part A (DB-free pure helpers + schema):
 *   Test 1:  reviewQueueInputSchema defaults (limit 25, offset 0).
 *   Test 2:  reviewQueueInputSchema bounds (limit 1..50, offset >= 0).
 *   Test 3:  groupReviewPairs groups multiple link rows into one pair.
 *   Test 4:  groupReviewPairs dedupes symmetric A->B / B->A rows into ONE
 *            queue entry, surfacing the direction of the strongest row.
 *   Test 5:  filter discipline (defense-in-depth, D-20/RES-1): dismissed
 *            rows, inactive entities on either side, and self-pairs never
 *            surface.
 *   Test 6:  shared evidence — case-insensitive alias overlap + matching
 *            identifier keys.
 *   Test 7:  sorted by maxSimilarity desc, deterministic tiebreak.
 *   Test 8:  input rows are never mutated.
 *
 * Part B (router wiring, mocked ownership — mirrors
 * entities-user-scoping.test.ts):
 *   Test 9:  reviewQueue rejects a sessionless call with UNAUTHORIZED.
 *   Test 10: owner-less caller gets an empty queue and NO query is issued.
 *   Test 11: scope derives from ctx.user.id via userOwnedImporterIds.
 *   Test 12: rows are grouped/paged and counts decorated from the db result.
 *
 * Part C (write-path reuse):
 *   Test 13: the entities router exposes NO new write procedure from
 *            review.ts — accept/reject go through the EXISTING
 *            confirmMerge/rejectMerge procedures (mutations.ts), the same
 *            endpoints the detail page uses.
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

import { userOwnedImporterIds } from "@polytoken/db/ownership";

import { appRouter } from "../../root";
import {
  computeSharedEvidence,
  groupReviewPairs,
  reviewQueueInputSchema,
  type ReviewPairRawRow,
} from "./review";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = { id: "10000000-0000-0000-0000-00000000000a" };
const IMPORTER_A = "30000000-0000-0000-0000-000000000a01";
const SUBJECT_ID = "60000000-0000-0000-0000-000000000e01";
const CANDIDATE_ID = "60000000-0000-0000-0000-000000000e02";
const OTHER_ID = "60000000-0000-0000-0000-000000000e03";

function rawRow(overrides: Partial<ReviewPairRawRow> = {}): ReviewPairRawRow {
  return {
    subjectId: SUBJECT_ID,
    subjectDisplayName: "Acme Corp",
    subjectEntityTypeId: "70000000-0000-0000-0000-000000000001",
    subjectEntityTypeLabel: "Shipper",
    subjectAliases: ["ACME Corporation"],
    subjectIdentifiers: { email: "ops@acme.com" },
    subjectIsActive: true,
    candidateId: CANDIDATE_ID,
    candidateDisplayName: "ACME Corporation",
    candidateEntityTypeId: "70000000-0000-0000-0000-000000000001",
    candidateEntityTypeLabel: "Shipper",
    candidateAliases: [],
    candidateIdentifiers: { email: "OPS@acme.com" },
    candidateIsActive: true,
    similarityScore: 0.91,
    matchType: "semantic",
    wasDismissed: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.mocked(userOwnedImporterIds).mockReset();
});

// ---------------------------------------------------------------------------
// Part A — schema + pure helpers
// ---------------------------------------------------------------------------

describe("reviewQueueInputSchema", () => {
  it("Test 1: defaults limit=25 offset=0", () => {
    const parsed = reviewQueueInputSchema.parse({});
    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(0);
  });

  it("Test 2: bounds — limit 1..50, offset >= 0", () => {
    expect(() => reviewQueueInputSchema.parse({ limit: 0 })).toThrow();
    expect(() => reviewQueueInputSchema.parse({ limit: 51 })).toThrow();
    expect(reviewQueueInputSchema.parse({ limit: 50 }).limit).toBe(50);
    expect(() => reviewQueueInputSchema.parse({ offset: -1 })).toThrow();
  });
});

describe("groupReviewPairs", () => {
  it("Test 3: groups multiple link rows into one pair with aggregated matchTypes / maxSimilarity / linkCount", () => {
    const pairs = groupReviewPairs([
      rawRow({ similarityScore: 0.7, matchType: "semantic" }),
      rawRow({ similarityScore: 0.91, matchType: "alias" }),
      rawRow({ similarityScore: null, matchType: null }),
    ]);

    expect(pairs).toHaveLength(1);
    const pair = pairs[0]!;
    expect(pair.subject.id).toBe(SUBJECT_ID);
    expect(pair.candidate.id).toBe(CANDIDATE_ID);
    expect(pair.linkCount).toBe(3);
    expect(pair.maxSimilarity).toBe(0.91);
    expect([...pair.matchTypes].sort()).toEqual(["alias", "semantic"]);
  });

  it("Test 4: symmetric A->B and B->A rows collapse into ONE entry, direction from the strongest row", () => {
    const forward = rawRow({ similarityScore: 0.6 });
    const reversed = rawRow({
      subjectId: CANDIDATE_ID,
      subjectDisplayName: "ACME Corporation",
      candidateId: SUBJECT_ID,
      candidateDisplayName: "Acme Corp",
      similarityScore: 0.95,
    });

    const pairs = groupReviewPairs([forward, reversed]);
    expect(pairs).toHaveLength(1);
    // The reversed row is stronger — it defines the surfaced direction.
    expect(pairs[0]!.subject.id).toBe(CANDIDATE_ID);
    expect(pairs[0]!.candidate.id).toBe(SUBJECT_ID);
    expect(pairs[0]!.linkCount).toBe(2);
  });

  it("Test 5: dismissed rows, inactive entities (either side), and self-pairs never surface (D-20 defense-in-depth)", () => {
    expect(groupReviewPairs([rawRow({ wasDismissed: true })])).toHaveLength(0);
    expect(
      groupReviewPairs([rawRow({ candidateIsActive: false })]),
    ).toHaveLength(0);
    expect(groupReviewPairs([rawRow({ subjectIsActive: false })])).toHaveLength(
      0,
    );
    expect(
      groupReviewPairs([rawRow({ candidateId: SUBJECT_ID })]),
    ).toHaveLength(0);
  });

  it("Test 6: shared evidence — case-insensitive alias overlap and matching identifier keys", () => {
    const pairs = groupReviewPairs([rawRow()]);
    const pair = pairs[0]!;
    // subject alias "ACME Corporation" == candidate displayName (case-insensitive)
    expect(pair.sharedAliases).toContain("ACME Corporation");
    // identifiers email matches case-insensitively
    expect(pair.sharedIdentifierKeys).toEqual(["email"]);
  });

  it("Test 6b: computeSharedEvidence returns empty arrays when nothing overlaps", () => {
    const evidence = computeSharedEvidence(
      { displayName: "Alpha", aliases: [], identifiers: { email: "a@x.com" } },
      { displayName: "Beta", aliases: [], identifiers: { email: "b@y.com" } },
    );
    expect(evidence.sharedAliases).toEqual([]);
    expect(evidence.sharedIdentifierKeys).toEqual([]);
  });

  it("Test 7: sorted by maxSimilarity desc with deterministic tiebreak", () => {
    const low = rawRow({ similarityScore: 0.4 });
    const high = rawRow({
      candidateId: OTHER_ID,
      candidateDisplayName: "Acme Inc",
      similarityScore: 0.99,
    });
    const pairs = groupReviewPairs([low, high]);
    expect(pairs[0]!.candidate.id).toBe(OTHER_ID);
    expect(pairs[1]!.candidate.id).toBe(CANDIDATE_ID);
  });

  it("Test 8: never mutates the input rows", () => {
    const rows = [rawRow(), rawRow({ similarityScore: 0.2 })];
    const snapshot = JSON.stringify(rows);
    groupReviewPairs(rows);
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Part B — router wiring (mocked ownership; fake Drizzle chain)
// ---------------------------------------------------------------------------

type FakeRow = Record<string, unknown>;

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

describe("entities.reviewQueue — wiring (TENA-03)", () => {
  it("Test 9: rejects a sessionless call with UNAUTHORIZED", async () => {
    const caller = makeCaller(null);
    await expect(caller.entities.reviewQueue({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("Test 10: owner-less caller gets an empty queue and no query is issued", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([]);
    const selectCalls = { count: 0 };
    const caller = makeCaller(USER_A, [rawRow() as unknown as FakeRow], selectCalls);

    const result = await caller.entities.reviewQueue({});
    expect(result.items).toEqual([]);
    expect(result.totalPending).toBe(0);
    expect(result.hasMore).toBe(false);
    expect(selectCalls.count).toBe(0);
  });

  it("Test 11: derives the importer scope from ctx.user.id via userOwnedImporterIds", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_A]);
    const caller = makeCaller(USER_A, []);

    await caller.entities.reviewQueue({});
    expect(userOwnedImporterIds).toHaveBeenCalledWith(
      expect.anything(),
      USER_A.id,
    );
  });

  it("Test 12: groups rows into pairs and pages them (limit+offset over grouped pairs)", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_A]);
    // Two raw rows -> ONE grouped pair. The fake chain serves the same rows
    // to the follow-up counts query; its shape lacks entityInstanceId, so
    // counts fall back to 0 (the mapper skips unusable rows by design).
    const caller = makeCaller(USER_A, [
      rawRow({ similarityScore: 0.5 }) as unknown as FakeRow,
      rawRow({ similarityScore: 0.9 }) as unknown as FakeRow,
    ]);

    const result = await caller.entities.reviewQueue({ limit: 10, offset: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.totalPending).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextOffset).toBe(1);
    expect(result.items[0]).toMatchObject({
      subject: { id: SUBJECT_ID, occurrenceCount: 0 },
      candidate: { id: CANDIDATE_ID, occurrenceCount: 0 },
      maxSimilarity: 0.9,
      linkCount: 2,
    });
  });

  it("Test 12b: offset past the grouped set yields an empty page with hasMore=false", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_A]);
    const caller = makeCaller(USER_A, [rawRow() as unknown as FakeRow]);

    const result = await caller.entities.reviewQueue({ limit: 10, offset: 5 });
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.totalPending).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Part C — write-path reuse (no parallel writes)
// ---------------------------------------------------------------------------

describe("entities review — write-path reuse", () => {
  it("Test 13: review.ts adds ONLY reviewQueue; accept/reject reuse the existing confirmMerge/rejectMerge procedures", async () => {
    const procedures = appRouter._def.procedures as Record<string, unknown>;
    const entityProcedureNames = Object.keys(procedures).filter((k) =>
      k.startsWith("entities."),
    );

    // The queue's write paths are the pre-existing curation procedures…
    expect(entityProcedureNames).toContain("entities.confirmMerge");
    expect(entityProcedureNames).toContain("entities.rejectMerge");
    // …and review.ts introduces exactly one new procedure: the queue query.
    expect(entityProcedureNames).toContain("entities.reviewQueue");
    const reviewAdded = entityProcedureNames.filter(
      (k) =>
        ![
          "entities.list",
          "entities.byId",
          "entities.confirmMerge",
          "entities.rejectMerge",
          "entities.unmerge",
        ].includes(k),
    );
    expect(reviewAdded).toEqual(["entities.reviewQueue"]);
  });
});
