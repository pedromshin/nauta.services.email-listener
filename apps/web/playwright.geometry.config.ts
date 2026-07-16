/**
 * playwright.geometry.config.ts — dedicated config for the rendered-geometry gate
 * (e2e/surface-geometry.spec.ts, 61-01 Task 1).
 *
 * WHY A THIRD CONFIG, AND WHY IT SPAWNS NO DEV SERVER (T-61-03 / backlog 999.22):
 *
 * Both existing configs declare a web-server block (`playwright.config.ts` and
 * `playwright.screenshot.config.ts` — each runs `npm run dev` with `reuseExistingServer: true`).
 * `next dev` and `next build` SHARE `apps/web/.next`, so a second compiler booted against a
 * directory a live dev server already owns corrupts it silently — no error, no build failure,
 * just a dev server serving broken chunks. That is 999.22, and it cost 60-07 an entire
 * verification leg.
 *
 * `reuseExistingServer: true` is a MITIGATION, not a guarantee: it is a port probe, and a probe
 * that misfires (a slow server, a health check that 500s, a port bound by something else) spawns
 * the second compiler anyway. This config removes the failure mode by CONSTRUCTION rather than
 * by discipline: a config that declares no server-spawning block cannot spawn a compiler even if
 * every probe in Playwright misbehaves at once.
 *
 * DO NOT ADD A SERVER-SPAWNING BLOCK TO THIS FILE. This is the mitigation itself, not a
 * convenience. The invariant is machine-checked by 61-01's verification, which asserts this file
 * contains ZERO occurrences of the Playwright option's name — that check is deliberately total,
 * which is why this comment spells the option out in prose instead of naming it literally: the
 * file stays greppably, unambiguously free of it, in code AND in comments.
 *
 * This spec asserts against whatever is already serving port 3000. If nothing is, it fails fast
 * with a connection error — that is the honest outcome, and the correct fix is to start the dev
 * server (`npm run web:dev` from the repo root), never to teach this config to start one.
 *
 * Equally: never run a bare `npx playwright test` — that resolves the DEFAULT config, which does
 * spawn a server. Run this gate via `npm run test:geometry` only.
 *
 * workers: 1 / fullyParallel: false — every test in the spec seeds a GoTrue session for the SAME
 * local seed user, and minting a magic link for one email invalidates any prior unconsumed token
 * for it (see seed-session.ts's MAX_MINT_ATTEMPTS doc comment). Serial execution avoids that
 * race rather than retrying through it.
 *
 * chromium only — this gate measures layout, not engine-specific behavior. The cross-browser
 * matrix in playwright.config.ts exists for the code-island CSP jail, which has a real
 * per-engine claim to prove; a broken height chain is broken in every engine.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /surface-geometry\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
