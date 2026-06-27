/**
 * generate.test.ts — vitest unit tests for the genui.generate tRPC procedure.
 *
 * Security contract (GEN-03 / D-08 / T-13-18 / T-13-19):
 *   - A valid spec from FastAPI is re-validated with SpecRootSchema.safeParse and returned.
 *   - A spec with an unregistered node type is rejected; SAFE_FALLBACK_SPEC is returned instead.
 *   - A spec with a non-relative navigate action is rejected; SAFE_FALLBACK_SPEC is returned.
 *   - A non-2xx FastAPI response returns SAFE_FALLBACK_SPEC with a friendly message (no leaked detail).
 *   - Raw invalid spec is NEVER returned to the caller.
 *
 * Contract tests (CR-01 / CR-02):
 *   - Request body must include raw_content, registry_version, and importer_id fields (CR-01).
 *   - FastAPI response is the ApiResponse envelope { success, data: { spec } }; the real spec
 *     is extracted from body.data.spec — NOT body.spec (CR-02).
 *
 * Test strategy: stub globalThis.fetch, set env vars per-test, call via appRouter caller.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAFE_FALLBACK_SPEC } from "@nauta/genui/schema";
import { REGISTRY_VERSION } from "@nauta/genui/registry";
import { appRouter } from "../../../root";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock Response with arbitrary JSON body and status. */
function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Create a tRPC caller with a stub ctx that has no real db connection. */
function makeCaller() {
  return appRouter.createCaller({ db: {} as never, headers: new Headers() });
}

/** A minimal schema-valid SpecRoot (alert node — always registered). */
const VALID_SPEC = {
  v: 1,
  root: { type: "alert", title: "Hello World" },
};

/**
 * CR-02 contract: FastAPI returns ApiResponse envelope.
 * The procedure must read body.data.spec, NOT body.spec.
 */
const VALID_ENVELOPE_RESPONSE = {
  success: true,
  data: { spec: VALID_SPEC },
  error: null,
};

/**
 * Legacy flat shape (stale) — should now return SAFE_FALLBACK because
 * the envelope parser looks for body.data.spec and finds nothing at that path.
 */
const STALE_FLAT_RESPONSE = {
  spec: VALID_SPEC,
  outcome: "ok",
  registryVersion: { catalogId: "nauta-v1", version: "0.1.0" },
};

/** A spec payload with an unregistered node type (SAFE-02) — wrapped in real envelope. */
const UNREGISTERED_TYPE_ENVELOPE = {
  success: true,
  data: {
    spec: {
      v: 1,
      root: { type: "unregistered-widget", label: "Danger" },
    },
  },
  error: null,
};

/** A spec payload with a non-relative navigate action (SAFE-04) — wrapped in real envelope. */
const NON_RELATIVE_NAVIGATE_ENVELOPE = {
  success: true,
  data: {
    spec: {
      v: 1,
      root: {
        type: "button",
        label: "Click me",
        "aria-label": "Click me",
        onClick: { type: "navigate", href: "https://evil.com/phish" },
      },
    },
  },
  error: null,
};

// ---------------------------------------------------------------------------
// Test env constants
// ---------------------------------------------------------------------------

const URL = "http://listener.test";
const API_KEY = "test-api-key-123";

// ---------------------------------------------------------------------------
// Contract tests: CR-01 (request body fields) + CR-02 (envelope parsing)
// ---------------------------------------------------------------------------

describe("genui.generate — contract: request body fields (CR-01)", () => {
  beforeEach(() => {
    process.env.EMAIL_LISTENER_URL = URL;
    process.env.EMAIL_LISTENER_API_KEY = API_KEY;
  });

  afterEach(() => {
    delete process.env.EMAIL_LISTENER_URL;
    delete process.env.EMAIL_LISTENER_API_KEY;
    vi.restoreAllMocks();
  });

  it("Contract-01: request body includes intent, raw_content, registry_version, importer_id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(VALID_ENVELOPE_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const caller = makeCaller();
    await caller.genui.generate({ intent: "Show me a summary" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(calledInit.body as string) as Record<string, unknown>;

    // CR-01: all required FastAPI fields must be present
    expect(sentBody).toHaveProperty("intent", "Show me a summary");
    expect(sentBody).toHaveProperty("raw_content");   // optional, default ""
    expect(sentBody).toHaveProperty("registry_version", REGISTRY_VERSION.version);
    expect(sentBody).toHaveProperty("importer_id");   // null when omitted
  });

  it("Contract-01b: raw_content defaults to empty string when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(VALID_ENVELOPE_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const caller = makeCaller();
    await caller.genui.generate({ intent: "Intent only" });

    const [, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(calledInit.body as string) as Record<string, unknown>;

    expect(sentBody["raw_content"]).toBe("");
  });
});

describe("genui.generate — contract: envelope parsing (CR-02)", () => {
  beforeEach(() => {
    process.env.EMAIL_LISTENER_URL = URL;
    process.env.EMAIL_LISTENER_API_KEY = API_KEY;
  });

  afterEach(() => {
    delete process.env.EMAIL_LISTENER_URL;
    delete process.env.EMAIL_LISTENER_API_KEY;
    vi.restoreAllMocks();
  });

  it("Contract-02: real ApiResponse envelope { success, data: { spec } } → returns real spec, NOT SAFE_FALLBACK", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(VALID_ENVELOPE_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const caller = makeCaller();
    const result = await caller.genui.generate({ intent: "Show summary" });

    // The real spec must be returned — not SAFE_FALLBACK_SPEC
    expect(result.outcome).toBe("ok");
    expect(result.spec).toEqual(VALID_SPEC);
    expect(result.spec).not.toEqual(SAFE_FALLBACK_SPEC);
  });

  it("Contract-02b: stale flat response { spec } (without data wrapper) → SAFE_FALLBACK (missing envelope)", async () => {
    // If FastAPI ever returns the old flat shape, the procedure should fall back safely
    // rather than silently using an invalid spec path.
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(STALE_FLAT_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const caller = makeCaller();
    const result = await caller.genui.generate({ intent: "Show summary" });

    expect(result.outcome).toBe("fallback");
    expect(result.spec).toEqual(SAFE_FALLBACK_SPEC);
  });
});

// ---------------------------------------------------------------------------
// Valid spec from FastAPI
// ---------------------------------------------------------------------------

describe("genui.generate — valid spec from FastAPI", () => {
  beforeEach(() => {
    process.env.EMAIL_LISTENER_URL = URL;
    process.env.EMAIL_LISTENER_API_KEY = API_KEY;
  });

  afterEach(() => {
    delete process.env.EMAIL_LISTENER_URL;
    delete process.env.EMAIL_LISTENER_API_KEY;
    vi.restoreAllMocks();
  });

  it("Test 1: returns validated spec + outcome 'ok' when FastAPI returns a valid spec in real envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(VALID_ENVELOPE_RESPONSE),
    );
    vi.stubGlobal("fetch", fetchMock);

    const caller = makeCaller();
    const result = await caller.genui.generate({
      intent: "Show me a summary of emails",
    });

    expect(result.outcome).toBe("ok");
    expect(result.spec).toEqual(VALID_SPEC);
    // Must not be the SAFE_FALLBACK_SPEC
    expect(result.spec).not.toEqual(SAFE_FALLBACK_SPEC);
  });

  it("Test 1b: issues POST to /v1/genui/generate with X-API-Key header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(VALID_ENVELOPE_RESPONSE),
    );
    vi.stubGlobal("fetch", fetchMock);

    const caller = makeCaller();
    await caller.genui.generate({ intent: "Show emails" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(calledUrl).toBe(`${URL}/v1/genui/generate`);
    expect(calledInit.method).toBe("POST");
    expect(
      (calledInit.headers as Record<string, string>)["X-API-Key"],
    ).toBe(API_KEY);
    expect(
      (calledInit.headers as Record<string, string>)["Content-Type"],
    ).toBe("application/json");
  });
});

// ---------------------------------------------------------------------------
// Web-boundary safeParse rejection (SAFE-02/03/04 / D-08)
// ---------------------------------------------------------------------------

describe("genui.generate — web-boundary safeParse rejection (SAFE-02/03/04 / D-08)", () => {
  beforeEach(() => {
    process.env.EMAIL_LISTENER_URL = URL;
    process.env.EMAIL_LISTENER_API_KEY = API_KEY;
  });

  afterEach(() => {
    delete process.env.EMAIL_LISTENER_URL;
    delete process.env.EMAIL_LISTENER_API_KEY;
    vi.restoreAllMocks();
  });

  it("Test 2: unregistered node type → SAFE_FALLBACK_SPEC returned, raw invalid spec NOT returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse(UNREGISTERED_TYPE_ENVELOPE)),
    );

    const caller = makeCaller();
    const result = await caller.genui.generate({ intent: "Show widgets" });

    expect(result.outcome).toBe("fallback");
    expect(result.spec).toEqual(SAFE_FALLBACK_SPEC);
    // Critically: the raw malformed spec must NOT be in the result
    expect(JSON.stringify(result)).not.toContain("unregistered-widget");
  });

  it("Test 3: non-relative navigate action (https://evil.com) → SAFE_FALLBACK_SPEC, raw spec NOT returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse(NON_RELATIVE_NAVIGATE_ENVELOPE)),
    );

    const caller = makeCaller();
    const result = await caller.genui.generate({ intent: "Show button" });

    expect(result.outcome).toBe("fallback");
    expect(result.spec).toEqual(SAFE_FALLBACK_SPEC);
    // The malicious href must not appear in the result
    expect(JSON.stringify(result)).not.toContain("evil.com");
  });

  it("Test 3b: javascript: navigate action → SAFE_FALLBACK_SPEC", async () => {
    const jsEnvelope = {
      success: true,
      data: {
        spec: {
          v: 1,
          root: {
            type: "button",
            label: "XSS",
            "aria-label": "XSS button",
            onClick: { type: "navigate", href: "javascript:alert(1)" },
          },
        },
      },
      error: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse(jsEnvelope)),
    );

    const caller = makeCaller();
    const result = await caller.genui.generate({ intent: "Test" });

    expect(result.outcome).toBe("fallback");
    expect(result.spec).toEqual(SAFE_FALLBACK_SPEC);
    expect(JSON.stringify(result)).not.toContain("javascript:");
  });
});

// ---------------------------------------------------------------------------
// FastAPI transport error (T-13-19)
// ---------------------------------------------------------------------------

describe("genui.generate — FastAPI transport error (T-13-19)", () => {
  beforeEach(() => {
    process.env.EMAIL_LISTENER_URL = URL;
    process.env.EMAIL_LISTENER_API_KEY = API_KEY;
  });

  afterEach(() => {
    delete process.env.EMAIL_LISTENER_URL;
    delete process.env.EMAIL_LISTENER_API_KEY;
    vi.restoreAllMocks();
  });

  it("Test 4: non-2xx FastAPI response → fallback outcome, friendly message, no leaked detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({ detail: "Internal Bedrock error: secret-key=xyz" }, 500),
      ),
    );

    const caller = makeCaller();
    const result = await caller.genui.generate({ intent: "Trigger error" });

    expect(result.outcome).toBe("fallback");
    expect(result.spec).toEqual(SAFE_FALLBACK_SPEC);
    // The raw error detail must NOT be leaked to the caller (T-13-19)
    expect(JSON.stringify(result)).not.toContain("secret-key=xyz");
    expect(JSON.stringify(result)).not.toContain("Internal Bedrock error");
  });
});

// ---------------------------------------------------------------------------
// Env guard
// ---------------------------------------------------------------------------

describe("genui.generate — env guard", () => {
  it("Test 5: throws when EMAIL_LISTENER_URL is missing", async () => {
    delete process.env.EMAIL_LISTENER_URL;
    delete process.env.EMAIL_LISTENER_API_KEY;

    const caller = makeCaller();
    await expect(
      caller.genui.generate({ intent: "test" }),
    ).rejects.toThrow();
  });
});
