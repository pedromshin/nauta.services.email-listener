/**
 * entity-types-write.test.ts — vitest coverage for the Phase 9 (09-04)
 * entity-type write mutations (D-26):
 *   create, update, createField, updateField, deleteField, reorderFields
 *
 * Same fetch-mock + env-stub strategy as mutations.test.ts. Verifies correct
 * URL/method/header/snake_cased body, the field_type Zod allowlist (T-09-32),
 * uuid validation (T-09-31), and the env guard (T-09-30).
 *
 * Since Phase 44 (44-06, TENA-03) every write is protectedProcedure and
 * ownership-gated: `@polytoken/db/ownership` is mocked at the module
 * boundary (defaulting to "resolves"), the caller carries a valid session
 * user, and the fake ctx.db serves the gate's importer-load queries with an
 * OWNED, NON-NULL importer id so the pre-existing proxy-behavior tests pass
 * through the gate. The tenancy gates themselves are covered by the
 * "tenancy gates (44-06)" describe block below:
 *   - sessionless call -> UNAUTHORIZED
 *   - create -> FORBIDDEN always (FastAPI's endpoint only creates
 *     system-default NULL-importer types; system defaults are seed-only)
 *   - write on a NULL-importer (system default) type/field -> FORBIDDEN
 *   - write on another user's importer -> NOT_FOUND, fetch never reached
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@polytoken/db/ownership", async () => {
  const actual = await vi.importActual<typeof import("@polytoken/db/ownership")>(
    "@polytoken/db/ownership",
  );
  return {
    ...actual,
    assertImporterOwnership: vi.fn(),
    userOwnedImporterIds: vi.fn(),
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

const TEST_USER = { id: "10000000-0000-0000-0000-00000000000a" };
const IMPORTER_A = "30000000-0000-0000-0000-000000000a01";
const IMPORTER_B = "30000000-0000-0000-0000-000000000b02";
const ENTITY_TYPE_ID = "00000000-0000-0000-0000-0000000000e1";
const FIELD_ID = "00000000-0000-0000-0000-0000000000f2";

type FakeRow = Record<string, unknown>;

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/**
 * Minimal thenable chain standing in for the ownership gate's importer-load
 * query (same idiom as emails-user-scoping.test.ts). Resolves the seeded
 * rows regardless of arguments.
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
    orderBy() {
      return chain;
    },
    limit() {
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

/**
 * Default seeded gate row: serves BOTH assertEntityTypeWritable (reads
 * `importerId`) and assertFieldWritable (reads `typeImporterId`) with an
 * owned, non-NULL importer.
 */
const OWNED_GATE_ROW: FakeRow = {
  importerId: IMPORTER_A,
  typeImporterId: IMPORTER_A,
};

function makeCaller(
  user: { id: string } | null = TEST_USER,
  rows: ReadonlyArray<FakeRow> = [OWNED_GATE_ROW],
) {
  const db = {
    select() {
      return createFakeChain(rows);
    },
  };
  return appRouter.createCaller({
    db: db as never,
    headers: new Headers(),
    user,
  });
}

const URL = "http://listener.test";
const API_KEY = "test-api-key";

function headerOf(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string>)[name];
}

function bodyOf(init: RequestInit): Record<string, unknown> {
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("entity-types write mutations (09-04)", () => {
  beforeEach(() => {
    process.env.EMAIL_LISTENER_URL = URL;
    process.env.EMAIL_LISTENER_API_KEY = API_KEY;
    vi.mocked(assertImporterOwnership).mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.EMAIL_LISTENER_URL;
    delete process.env.EMAIL_LISTENER_API_KEY;
    vi.mocked(assertImporterOwnership).mockReset();
    vi.restoreAllMocks();
  });

  it("update: PATCH /v1/entity-types/{id} with snake_cased {is_active}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await makeCaller().entityTypes.update({
      entityTypeId: ENTITY_TYPE_ID,
      label: "Renamed",
      isActive: false,
    });

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${URL}/v1/entity-types/${ENTITY_TYPE_ID}`);
    expect(init.method).toBe("PATCH");
    expect(bodyOf(init)).toEqual({ label: "Renamed", is_active: false });
  });

  it("createField: POST /{id}/fields with snake_cased field_type body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await makeCaller().entityTypes.createField({
      entityTypeId: ENTITY_TYPE_ID,
      slug: "order_date",
      label: "Order Date",
      fieldType: "date",
      isRequired: true,
      isIdentifier: false,
    });

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${URL}/v1/entity-types/${ENTITY_TYPE_ID}/fields`);
    expect(init.method).toBe("POST");
    expect(headerOf(init, "X-API-Key")).toBe(API_KEY);
    expect(bodyOf(init)).toEqual({
      slug: "order_date",
      label: "Order Date",
      field_type: "date",
      is_required: true,
      is_identifier: false,
    });
  });

  it("updateField: PATCH /fields/{id} with only provided keys snake_cased", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await makeCaller().entityTypes.updateField({
      fieldId: FIELD_ID,
      fieldType: "number",
    });

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${URL}/v1/entity-types/fields/${FIELD_ID}`);
    expect(init.method).toBe("PATCH");
    expect(bodyOf(init)).toEqual({ field_type: "number" });
  });

  it("deleteField: DELETE /fields/{id} with X-API-Key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ data: { field_id: FIELD_ID, hard_deleted: true } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await makeCaller().entityTypes.deleteField({ fieldId: FIELD_ID });

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${URL}/v1/entity-types/fields/${FIELD_ID}`);
    expect(init.method).toBe("DELETE");
    expect(headerOf(init, "X-API-Key")).toBe(API_KEY);
  });

  it("reorderFields: POST /{id}/fields/reorder with {ordered_field_ids}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    const ids = [FIELD_ID, "00000000-0000-0000-0000-0000000000f3"];
    await makeCaller().entityTypes.reorderFields({
      entityTypeId: ENTITY_TYPE_ID,
      orderedFieldIds: ids,
    });

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(
      `${URL}/v1/entity-types/${ENTITY_TYPE_ID}/fields/reorder`,
    );
    expect(bodyOf(init)).toEqual({ ordered_field_ids: ids });
  });

  it("createField rejects an out-of-allowlist fieldType at the Zod boundary (T-09-32)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      makeCaller().entityTypes.createField({
        entityTypeId: ENTITY_TYPE_ID,
        slug: "weird",
        label: "Weird",
        // @ts-expect-error — intentionally invalid to assert the schema rejects it
        fieldType: "boolean",
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("update rejects a non-uuid entityTypeId before fetch (T-09-31)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      makeCaller().entityTypes.update({
        entityTypeId: "not-a-uuid",
        label: "x",
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("error path: non-2xx surfaces the FastAPI {detail}", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ detail: "Slug already exists" }, 409));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      makeCaller().entityTypes.update({
        entityTypeId: ENTITY_TYPE_ID,
        label: "Dup",
      }),
    ).rejects.toThrow("Slug already exists");
  });

  it("env guard (T-09-30): missing API key throws before any fetch", async () => {
    process.env.EMAIL_LISTENER_URL = URL;
    delete process.env.EMAIL_LISTENER_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      makeCaller().entityTypes.deleteField({ fieldId: FIELD_ID }),
    ).rejects.toThrow("is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tenancy gates (Phase 44 Plan 06, TENA-03)
// ---------------------------------------------------------------------------

describe("entity-types tenancy gates (44-06)", () => {
  beforeEach(() => {
    process.env.EMAIL_LISTENER_URL = URL;
    process.env.EMAIL_LISTENER_API_KEY = API_KEY;
  });

  afterEach(() => {
    delete process.env.EMAIL_LISTENER_URL;
    delete process.env.EMAIL_LISTENER_API_KEY;
    vi.mocked(assertImporterOwnership).mockReset();
    vi.mocked(userOwnedImporterIds).mockReset();
    vi.unstubAllGlobals();
  });

  it("a sessionless write rejects with UNAUTHORIZED", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.entityTypes.update({ entityTypeId: ENTITY_TYPE_ID, label: "x" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("a sessionless list rejects with UNAUTHORIZED", async () => {
    const caller = makeCaller(null);
    await expect(caller.entityTypes.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("list derives its scope from ctx.user.id via userOwnedImporterIds", async () => {
    vi.mocked(userOwnedImporterIds).mockResolvedValueOnce([IMPORTER_A]);
    const caller = makeCaller(TEST_USER, []);

    await expect(caller.entityTypes.list()).resolves.toEqual([]);
    expect(userOwnedImporterIds).toHaveBeenCalledWith(
      expect.anything(),
      TEST_USER.id,
    );
  });

  it("create is FORBIDDEN from a user session (system defaults are seed-only, T-44-06-04)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      makeCaller().entityTypes.create({ slug: "rogue", label: "Rogue" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a write on a system-default (NULL importer) type is FORBIDDEN, never reaching fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(TEST_USER, [
      { importerId: null, typeImporterId: null },
    ]);

    await expect(
      caller.entityTypes.update({ entityTypeId: ENTITY_TYPE_ID, label: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assertImporterOwnership).not.toHaveBeenCalled();
  });

  it("a field write on a system-default type is FORBIDDEN, never reaching fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(TEST_USER, [
      { importerId: null, typeImporterId: null },
    ]);

    await expect(
      caller.entityTypes.deleteField({ fieldId: FIELD_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a write against another user's importer is NOT_FOUND, never reaching fetch (cross-tenant)", async () => {
    vi.mocked(assertImporterOwnership).mockRejectedValueOnce(
      new OwnershipError("importer", IMPORTER_B),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(TEST_USER, [
      { importerId: IMPORTER_B, typeImporterId: IMPORTER_B },
    ]);

    await expect(
      caller.entityTypes.update({ entityTypeId: ENTITY_TYPE_ID, label: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assertImporterOwnership).toHaveBeenCalledWith(
      expect.anything(),
      IMPORTER_B,
      TEST_USER.id,
    );
  });

  it("a write on a MISSING type is NOT_FOUND (fail-closed, same surface as foreign)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = makeCaller(TEST_USER, []);

    await expect(
      caller.entityTypes.reorderFields({
        entityTypeId: ENTITY_TYPE_ID,
        orderedFieldIds: [FIELD_ID],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
