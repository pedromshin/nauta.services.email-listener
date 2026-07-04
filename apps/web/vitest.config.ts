import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's `"~/*": ["./src/*"]` path alias — without this,
// vitest/vite (which does not read tsconfig `paths` on its own) cannot
// resolve any module under test that imports "~/..." (e.g. "~/trpc/react"),
// failing with "Failed to resolve import" even though `tsc`/`next build`
// both resolve it fine via tsconfig.
export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
