import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve @nauta/genui/schema sub-path directly to the schema module.
      // Intentionally uses the schema-only sub-path (pure Zod, no JSX)
      // so that api-client (a server-side-only package with no JSX support)
      // does not inadvertently pull in React/JSX components from the
      // renderer or catalog sub-modules.
      "@nauta/genui/schema": path.resolve(
        __dirname,
        "../genui/src/schema/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      SKIP_ENV_VALIDATION: "true",
    },
  },
});
