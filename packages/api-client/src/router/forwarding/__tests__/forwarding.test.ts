/**
 * forwarding.test.ts — unit tests for the forwarding router (THRD-04, Plan 45-06).
 *
 * Strategy: a minimal fake Drizzle handle models get-or-create over a
 * single-row-per-user table (same thenable-chain idiom as
 * packages/db/src/ownership.test.ts and emails-user-scoping.test.ts). The
 * fake `insert()` chain echoes back the row it was given via `values()` —
 * exactly what a real `.returning()` does — so the router's OWN generated
 * token is what round-trips through the assertions, never a value hardcoded
 * in the test.
 *
 * Test plan:
 *   Test 1: first call (no existing row) creates + returns u-<token>@<domain>,
 *           and the insert's userId came from ctx.user, not any input.
 *   Test 2: second call (existing row) returns the IDENTICAL token — idempotent.
 *   Test 3: an insert-conflict race (onConflictDoNothing skips the insert)
 *           re-selects and returns the winning row's token.
 *   Test 4: session is required — a null ctx.user rejects with UNAUTHORIZED
 *           before any db call.
 *   Test 5: missing FORWARDING_EMAIL_DOMAIN fails fast with a clear error.
 *   Test 6: generateForwardingToken produces a >=128-bit, base64url token.
 *   Test 7: buildForwardingAddress composes the exact `u-{token}@{domain}` contract.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appRouter } from "../../../root";
import {
  buildForwardingAddress,
  generateForwardingToken,
} from "../index";

const USER_A = { id: "10000000-0000-0000-0000-00000000000a" };
const DOMAIN = "magnitudetech.com.br";

type FakeRow = { readonly token: string };

/**
 * A minimal thenable Drizzle-chain fake covering exactly the subset the
 * forwarding router calls: select().from().where().limit() and
 * insert().values().onConflictDoNothing().returning().
 *
 * `insertConflict: true` simulates a concurrent winner: the insert's
 * `.returning()` resolves to `[]` (as a real onConflictDoNothing skip would),
 * forcing the router down its re-select path.
 */
function createFakeDb(options: {
  readonly existingRow?: FakeRow;
  readonly insertConflict?: boolean;
  readonly rereadRow?: FakeRow;
}) {
  let selectCallCount = 0;
  const selectWhereArgs: unknown[] = [];
  let insertedValues: { userId: string; token: string } | undefined;

  const db = {
    select() {
      const chain = {
        from() {
          return chain;
        },
        where(cond: unknown) {
          selectWhereArgs.push(cond);
          return chain;
        },
        limit() {
          return chain;
        },
        then(
          onFulfilled: (rows: ReadonlyArray<FakeRow>) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          selectCallCount += 1;
          const rows =
            selectCallCount === 1
              ? options.existingRow
                ? [options.existingRow]
                : []
              : options.rereadRow
                ? [options.rereadRow]
                : [];
          return Promise.resolve(rows).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
    insert() {
      const chain = {
        values(v: { userId: string; token: string }) {
          insertedValues = v;
          return chain;
        },
        onConflictDoNothing() {
          return chain;
        },
        returning() {
          return chain;
        },
        then(
          onFulfilled: (rows: ReadonlyArray<FakeRow>) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          const rows = options.insertConflict
            ? []
            : insertedValues
              ? [{ token: insertedValues.token }]
              : [];
          return Promise.resolve(rows).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
  };

  return {
    db,
    selectCallCount: () => selectCallCount,
    getInsertedValues: () => insertedValues,
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

describe("forwardingRouter.getOrCreateMyAddress", () => {
  beforeEach(() => {
    process.env["FORWARDING_EMAIL_DOMAIN"] = DOMAIN;
  });

  afterEach(() => {
    delete process.env["FORWARDING_EMAIL_DOMAIN"];
  });

  it("Test 1: first call creates + returns u-<token>@<domain>, userId from ctx", async () => {
    const fake = createFakeDb({});
    const caller = makeCaller(USER_A, fake.db);

    const result = await caller.forwarding.getOrCreateMyAddress();

    expect(result.address).toMatch(
      new RegExp(`^u-[A-Za-z0-9_-]+@${DOMAIN.replace(/\./g, "\\.")}$`),
    );
    expect(result.address).toBe(`u-${result.token}@${DOMAIN}`);
    // The token persisted came from ctx.user.id — never a client-supplied
    // field (there is no input schema on this procedure at all).
    expect(fake.getInsertedValues()?.userId).toBe(USER_A.id);
    expect(fake.getInsertedValues()?.token).toBe(result.token);
  });

  it("Test 2: second call (existing row) returns the identical token — idempotent", async () => {
    const fake = createFakeDb({ existingRow: { token: "existing-token-value" } });
    const caller = makeCaller(USER_A, fake.db);

    const result = await caller.forwarding.getOrCreateMyAddress();

    expect(result.token).toBe("existing-token-value");
    expect(result.address).toBe(`u-existing-token-value@${DOMAIN}`);
    // No insert should have been necessary — the row already existed.
    expect(fake.getInsertedValues()).toBeUndefined();
  });

  it("Test 3: concurrent insert conflict re-selects the winning row (idempotent under a race)", async () => {
    const fake = createFakeDb({
      insertConflict: true,
      rereadRow: { token: "winner-token" },
    });
    const caller = makeCaller(USER_A, fake.db);

    const result = await caller.forwarding.getOrCreateMyAddress();

    expect(result.token).toBe("winner-token");
    expect(result.address).toBe(`u-winner-token@${DOMAIN}`);
    expect(fake.selectCallCount()).toBe(2);
  });

  it("Test 4: rejects a sessionless call with UNAUTHORIZED", async () => {
    const fake = createFakeDb({});
    const caller = makeCaller(null, fake.db);

    await expect(caller.forwarding.getOrCreateMyAddress()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    // Never touches the db when there's no session.
    expect(fake.selectCallCount()).toBe(0);
  });

  it("Test 5: missing FORWARDING_EMAIL_DOMAIN fails fast, not a blank address", async () => {
    delete process.env["FORWARDING_EMAIL_DOMAIN"];
    const fake = createFakeDb({});
    const caller = makeCaller(USER_A, fake.db);

    await expect(caller.forwarding.getOrCreateMyAddress()).rejects.toThrow(
      /FORWARDING_EMAIL_DOMAIN/,
    );
  });
});

describe("generateForwardingToken", () => {
  it("Test 6: produces a >=128-bit-entropy, base64url-safe token", () => {
    const token = generateForwardingToken();
    // base64url alphabet only — safe to embed directly in an email local-part.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    // base64url packs 6 bits/char; >=22 chars clears the 128-bit floor.
    expect(token.length).toBeGreaterThanOrEqual(22);

    const other = generateForwardingToken();
    expect(other).not.toBe(token);
  });
});

describe("buildForwardingAddress", () => {
  it("Test 7: composes the exact u-{token}@{domain} seam contract", () => {
    expect(buildForwardingAddress("abc123", "example.com")).toBe(
      "u-abc123@example.com",
    );
  });
});
