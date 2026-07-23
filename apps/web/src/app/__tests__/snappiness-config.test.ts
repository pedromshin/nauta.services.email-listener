/**
 * snappiness-config.test.ts — committed regression gates for the
 * config-level snappiness levers (plan §3 + §4), in the same grep-idiom this
 * suite already uses for design law (palette-ban.test.ts).
 *
 * §3 — tRPC transport: BOTH clients (the app-wide one and the temporary
 * vault seam) must use `httpBatchStreamLink`, never the head-of-line-blocking
 * `httpBatchLink`. The two clients are contractually transport-identical
 * (vault-api.tsx header), so a drift on either side is a silent regression.
 *
 * §4 — Next router cache: `experimental.staleTimes.dynamic` must stay in
 * agreement with the tRPC layer's `staleTime: 30 * 1000`
 * (src/trpc/query-client.ts) — two caches disagreeing on freshness produces
 * refetch storms on back/forward navigation.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** apps/web — the workspace root these gates read from. */
const WEB_ROOT = path.resolve(__dirname, "..", "..", "..");

function read(relative: string): string {
  return readFileSync(path.join(WEB_ROOT, relative), "utf8");
}

describe("tRPC transport (snappiness plan §3)", () => {
  const CLIENT_FILES = [
    "src/trpc/react.tsx",
    "src/app/files/_lib/vault-api.tsx",
  ] as const;

  for (const file of CLIENT_FILES) {
    it(`${file} uses httpBatchStreamLink, never the blocking httpBatchLink`, () => {
      const source = read(file);
      expect(source).toContain("httpBatchStreamLink(");
      // Word-boundary check: `httpBatchLink(` must be gone (the *StreamLink*
      // name contains "BatchLink" as a substring only with the Stream prefix,
      // so match the exact non-stream call).
      expect(source).not.toMatch(/(?<!Stream)httpBatchLink\s*\(/);
      // The transformer must survive the swap — SuperJSON is what carries
      // Dates across the wire intact.
      expect(source).toContain("transformer: SuperJSON");
    });
  }
});

describe("Next router cache staleTimes (snappiness plan §4)", () => {
  it("next.config.mjs sets experimental.staleTimes.dynamic to 30s (agreeing with query-client's staleTime)", () => {
    const config = read("next.config.mjs");
    expect(config).toMatch(/staleTimes:\s*\{/);
    expect(config).toMatch(/dynamic:\s*30\b/);
    expect(config).toMatch(/static:\s*180\b/);

    const queryClient = read("src/trpc/query-client.ts");
    // The tRPC-layer freshness window the router cache is paired with.
    expect(queryClient).toMatch(/staleTime:\s*30 \* 1000/);
  });
});
