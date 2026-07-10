/**
 * cross-tenant.test.ts — dedicated adversarial case for GET
 * /api/attachments/[id] (Phase 44 Plan 08, TENA-03 acceptance gate).
 *
 * route.test.ts (Plan 07) already covers the full 401/404/200/400/500 matrix
 * for this route in isolation. This file isolates the SINGLE cross-tenant
 * scenario the 44-08 acceptance gate requires as an explicit, named case:
 * user B requesting user A's attachment id must get 404 (fail-closed, no
 * existence oracle); user A requesting their OWN attachment must get 200
 * (the positive control proving the route isn't blanket-denying).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@polytoken/db/client", () => ({
  db: { select: vi.fn() },
}));

vi.mock("@polytoken/db/ownership", async () => {
  const actual = await vi.importActual<typeof import("@polytoken/db/ownership")>(
    "@polytoken/db/ownership",
  );
  return {
    ...actual,
    assertImporterOwnership: vi.fn(),
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient as createServiceRoleClient } from "@supabase/supabase-js";

import { db } from "@polytoken/db/client";
import { assertImporterOwnership, OwnershipError } from "@polytoken/db/ownership";

import { createClient as createSupabaseServerClient } from "~/lib/supabase/server";

import { GET } from "../[id]/route";

const ATTACHMENT_A_ID = "10000000-0000-0000-0000-00000000000a";
const IMPORTER_A = "20000000-0000-0000-0000-00000000000a";
const USER_A = { id: "30000000-0000-0000-0000-00000000000a" };
const USER_B = { id: "30000000-0000-0000-0000-00000000000b" };
const STORAGE_KEY = "importers/a/attachment.pdf";

function makeRequest(id: string = ATTACHMENT_A_ID): {
  params: Promise<{ id: string }>;
} {
  return { params: Promise.resolve({ id }) };
}

function mockDbSelect(rows: ReadonlyArray<Record<string, unknown>>) {
  const chain = {
    from() {
      return chain;
    },
    where() {
      return chain;
    },
    limit() {
      return Promise.resolve(rows);
    },
  };
  vi.mocked(db.select).mockReturnValue(chain as never);
}

function mockSession(user: { id: string } | null) {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as never);
}

function mockStorageSignedUrl(result: { data?: { signedUrl: string }; error?: unknown }) {
  vi.mocked(createServiceRoleClient).mockReturnValue({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn().mockResolvedValue(result),
      }),
    },
  } as never);
}

describe("GET /api/attachments/[id] — cross-tenant adversarial case (TENA-03)", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "http://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.mocked(assertImporterOwnership).mockReset();
    vi.restoreAllMocks();
  });

  it("user B requesting user A's attachment -> 404 (fail-closed, no existence oracle)", async () => {
    mockSession(USER_B);
    mockDbSelect([{ storageKey: STORAGE_KEY, importerId: IMPORTER_A }]);
    vi.mocked(assertImporterOwnership).mockRejectedValueOnce(
      new OwnershipError("importer", IMPORTER_A),
    );

    const res = await GET({} as never, makeRequest(ATTACHMENT_A_ID));

    expect(res.status).toBe(404);
    expect(assertImporterOwnership).toHaveBeenCalledWith(db, IMPORTER_A, USER_B.id);
  });

  it("user A requesting their OWN attachment -> 200 + signed url (positive control)", async () => {
    mockSession(USER_A);
    mockDbSelect([{ storageKey: STORAGE_KEY, importerId: IMPORTER_A }]);
    vi.mocked(assertImporterOwnership).mockResolvedValueOnce(undefined);
    mockStorageSignedUrl({ data: { signedUrl: "https://signed.example/owner" } });

    const res = await GET({} as never, makeRequest(ATTACHMENT_A_ID));
    const body = (await res.json()) as { url: string };

    expect(res.status).toBe(200);
    expect(body).toEqual({ url: "https://signed.example/owner" });
    expect(assertImporterOwnership).toHaveBeenCalledWith(db, IMPORTER_A, USER_A.id);
  });
});
