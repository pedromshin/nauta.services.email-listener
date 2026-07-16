/**
 * playwright.config.ts — cross-browser config for the e2e suite (D-47-04).
 *
 * Covers two specs: code-island-isolation.spec.ts (Phase 20 SPIKE — `page.setContent` only,
 * no dev server needed) and auth-redirect.spec.ts (Phase 43 — needs a real running dev server
 * + baseURL). Runs the sandbox-escape assertions in BOTH Chromium and Firefox: the inline
 * `<meta>` CSP is the sole enforcing layer (no `csp=` attribute is used), so exercising both
 * engines proves the opaque-origin + meta-CSP jail holds cross-browser (20-RESEARCH.md §5).
 *
 * webServer runs `npm run dev` with cwd = this config's directory (apps/web), so the dev
 * script's `dotenv -e ../../.env.local -- next dev` still resolves to the root .env.local.
 * reuseExistingServer: true so this works whether or not a dev server is already running on
 * port 3000 (local dev commonly leaves one up).
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  // Two specs own dedicated configs and must never ride along on `test:e2e` — testMatch above is
  // /.*\.spec\.ts/, so a new e2e spec rides along BY DEFAULT unless it is ignored here:
  //   - screenshot-review.spec.ts (D-47-05) — a capture harness, not an assertion spec
  //     (playwright.screenshot.config.ts).
  //   - surface-geometry.spec.ts (61-01) — the rendered-geometry gate
  //     (playwright.geometry.config.ts). Its whole safety property is that its own config
  //     declares NO webServer and therefore cannot spawn a second `next dev` over the live
  //     server's `.next` (T-61-03 / 999.22). Letting it run under THIS config — which does
  //     declare one — reintroduces exactly the hazard it exists to remove, so this ignore is
  //     load-bearing, not tidiness.
  testIgnore: /(screenshot-review|surface-geometry)\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
