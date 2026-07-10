/**
 * auth-redirect.spec.ts — browser-level proof that a signed-out visitor hitting a
 * protected surface is bounced to `/login` with a `redirectTo` return-to param
 * (Phase 43 Plan 02, AUTH-02 — the route-guard middleware built on top of the pure
 * `resolveAuthRedirect`/`safeNextPath` pair in `src/lib/auth/redirect.ts`).
 *
 * STATUS: authored, not yet executed — Playwright is not installed in this autonomous
 * run (the phase's single new-dep budget was spent on `@supabase/ssr`, per
 * `43-CONTEXT.md`). This mirrors the existing authored-but-unrun precedent at
 * `apps/web/e2e/code-island-isolation.spec.ts`. To run:
 *   npm i -D @playwright/test && npx playwright install chromium
 *   (start `npm run dev` in apps/web, signed out, no Supabase session cookie)
 *   npx playwright test apps/web/e2e/auth-redirect.spec.ts
 *
 * The automatable, deterministic version of this gate already ships as the 8 unit
 * tests in `src/lib/auth/redirect.test.ts` (43-02) — those exercise the pure decision
 * function directly. This spec is the browser-level UAT counterpart for future
 * enablement: it proves the middleware is actually wired into a real running app,
 * which the unit tests (by design) do not touch.
 */

import { expect, test } from "@playwright/test";

test.describe("signed-out route protection", () => {
  test("visiting a protected surface redirects to /login with a redirectTo param", async ({
    page,
  }) => {
    // No sign-in performed — this browser context has no Supabase session cookie,
    // so the route-guard middleware (apps/web/src/middleware.ts) must redirect.
    await page.goto("/chat");

    await expect(page).toHaveURL(/\/login(\?|$)/);

    const url = new URL(page.url());
    const redirectTo = url.searchParams.get("redirectTo");
    expect(redirectTo).toBe("/chat");
  });
});
