---
phase: 43-auth-google-oauth-sessions-supabase-auth
verified: 2026-07-10T00:52:15Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live Google OAuth round-trip: visit /chat signed-out, sign in with Google, verify return to /chat with an authenticated session"
    expected: "Redirect to /login?redirectTo=%2Fchat; clicking 'Continue with Google' completes the Google consent screen and lands back on /chat authenticated"
    why_human: "No real Google OAuth client/credentials exist in this environment (SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID is not set in .env.local) — Google Cloud Console client creation is an explicit user action per 43-CONTEXT.md; the code path is unit/typecheck-verified but the live provider round-trip cannot be automated here"
  - test: "Session persists across browser refresh after Google sign-in"
    expected: "Refreshing the browser after a successful sign-in keeps the user authenticated (AUTH-01)"
    why_human: "Requires a live browser session with a real Supabase session cookie set by a completed OAuth round-trip"
  - test: "Sign-out in the sidebar lands on /login and revisiting /chat redirects back to /login"
    expected: "Clicking 'Sign out' clears the session and subsequent protected-route visits redirect to /login (AUTH-02)"
    why_human: "Requires a live authenticated browser session to exercise the full sign-in -> sign-out loop end to end"
  - test: "apps/web/e2e/auth-redirect.spec.ts execution"
    expected: "Playwright spec passes against a running dev server"
    why_human: "Playwright is not installed in this run (the phase's one-new-dependency budget was spent on @supabase/ssr, a locked decision) — spec is authored per 43-05 for future enablement; the automatable equivalent (resolveAuthRedirect unit test) is already verified green"
---

# Phase 43: Auth — Google OAuth + Sessions (Supabase Auth) Verification Report

**Phase Goal:** The app has real user identity — Google sign-in via Supabase Auth (`@supabase/ssr`, the milestone's ONE new npm dependency), persistent sessions, session-derived identity in every server context.
**Verified:** 2026-07-10T00:52:15Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User signs in with Google and returns authenticated; session persists across refresh; sign-out works | ✓ VERIFIED (code) / ? HUMAN (live round-trip) | `google-signin-button.tsx` calls `signInWithOAuth({provider:"google"})`; `auth/callback/route.ts` calls `exchangeCodeForSession`; `auth/signout/route.ts` calls `signOut()` server-side. All code paths typecheck clean and unit-tested at the pure-logic layer, but no live Google OAuth client is configured in this environment (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` absent from `.env.local`) — the actual browser round-trip is human UAT per Plan 02's own `<human-check>` block |
| 2 | Signed-out visitors to app surfaces are redirected to sign-in | ✓ VERIFIED | `apps/web/src/middleware.ts` calls `updateSession` + `resolveAuthRedirect`; `apps/web/src/lib/auth/redirect.ts` unit tests (8/8 passing, re-run independently) cover redirect-to-login, pass-through for `/login`/`/auth/*`, and authenticated pass-through; `config.matcher` excludes only `_next`, `api`, favicon, static assets |
| 3 | tRPC context resolves the session user server-side; a test proves identity cannot be supplied from client input | ✓ VERIFIED | `packages/api-client/src/trpc.ts` — `ctx.user` sourced from `createTRPCContext({user})`; `protectedProcedure` throws `UNAUTHORIZED` when `ctx.user` is null; `trpc.test.ts`'s `whoAmIWithInput` test proves the resolver returns `ctx.user.id` ("u1") not `input.userId` ("attacker-u2") — re-run independently, 5/5 passing. Route handler (`api/trpc/[trpc]/route.ts`) resolves via `getUser()`, never `getSession()` |
| 4 | Server-side FastAPI proxy routes forward the user's identity; X-API-Key boundary unchanged (existing service tests green) | ✓ VERIFIED | All 4 routes (`chat/stream`, `chat/regenerate`, `chat/widget/submit`, `knowledge/edges/[edgeId]/promote`) resolve `getUser()` and add `"X-User-Id": user.id` alongside the unchanged `"X-API-Key"`; null-user returns 401 (no anonymous forward). `apps/email-listener/app/presentation/middleware/auth.py` has zero diff (`git diff` empty, no phase-43 commit touches it). `user_context.py`'s `extract_user_id` is additive/non-enforcing. Re-ran `uv run pytest tests/presentation/test_user_context.py -x --no-cov` — 4/4 passing |
| 5 | Missing auth env vars fail startup with a clear message; Google Cloud OAuth client runbook exists | ✓ VERIFIED | `apps/web/src/lib/env.ts`'s `parseEnv` throws `"Missing/invalid auth environment variables: <fields>"`; re-ran `env.test.ts` — 3/3 passing, including the public/secret-separation assertion. `GOOGLE-OAUTH-RUNBOOK.md` (197 lines) contains all 6 required sections, both live Supabase project refs, the callback URI, and the secret var name (grep gates re-verified) |

**Score:** 5/5 truths code-verified; truth 1's live-provider round-trip is `human_needed` (expected — no Google OAuth client exists in this environment by design; autonomous execution never creates external OAuth clients per 43-CONTEXT.md)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/package.json` + `package-lock.json` | `@supabase/ssr` as the sole new dep | ✓ VERIFIED | `@supabase/ssr: ^0.12.0` in package.json; lockfile regenerated; `@supabase/supabase-js` (pre-existing) unaffected |
| `apps/web/src/lib/env.ts` | Zod env schema + fail-fast `parseEnv` + typed `env` | ✓ VERIFIED | 57 lines; disjoint public/server schema; module-level fail-fast with `SKIP_ENV_VALIDATION` test escape hatch |
| `apps/web/src/lib/env.test.ts` | Fail-fast + secret-separation proof | ✓ VERIFIED, WIRED | 3 tests, re-run green |
| `apps/web/src/lib/supabase/client.ts` | Browser client via `createBrowserClient` | ✓ VERIFIED, WIRED | Used by `google-signin-button.tsx` |
| `apps/web/src/lib/supabase/server.ts` | Server client, cookie-bound, `getUser()` contract documented | ✓ VERIFIED, WIRED | Used by callback, signout, all 4 BFF proxy routes, tRPC route handler |
| `apps/web/src/lib/supabase/middleware.ts` | `updateSession(request)` refresh helper, no redirect logic | ✓ VERIFIED, WIRED | Used by `src/middleware.ts`; contains zero redirect branching as designed |
| `apps/web/src/middleware.ts` (plan said `apps/web/middleware.ts`) | Session refresh + route guard | ✓ VERIFIED, WIRED | Confirmed at `src/middleware.ts` — Next.js 15 resolves middleware relative to the app-dir parent (`src/`), documented deviation is correct and load-bearing; file exists, imports `updateSession` + `resolveAuthRedirect`, matcher excludes `_next`/`api`/static |
| `apps/web/src/lib/auth/redirect.ts` | Pure `safeNextPath` + `resolveAuthRedirect` | ✓ VERIFIED, WIRED | Consumed by `middleware.ts`, `google-signin-button.tsx`, `auth/callback/route.ts` |
| `apps/web/src/app/login/page.tsx` + `_components/google-signin-button.tsx` | Google-only login card | ✓ VERIFIED, WIRED | Single primary action, `<Suspense>` boundary present, no password/email inputs |
| `apps/web/src/app/auth/callback/route.ts` | `exchangeCodeForSession` + safe redirect | ✓ VERIFIED, WIRED | Uses `safeNextPath`; failure path redirects to `/login?error=auth` without leaking upstream error |
| `apps/web/src/app/auth/signout/route.ts` + `sign-out-button.tsx` + `app-sidebar.tsx` | Server-side sign-out wired into sidebar | ✓ VERIFIED, WIRED | `<SignOutButton />` rendered inside `<SidebarFooter>` beneath `<ThemeToggle />` (grep-confirmed) |
| `packages/api-client/src/trpc.ts` | `ctx.user` + `protectedProcedure` | ✓ VERIFIED, WIRED | Framework-agnostic (no `next/headers`/`@supabase/ssr` import, grep-confirmed) |
| `packages/api-client/src/trpc.test.ts` | Identity-injection acceptance test | ✓ VERIFIED | 5/5 tests, re-run green |
| `apps/web/src/app/api/trpc/[trpc]/route.ts` | `getUser()` resolution -> `createTRPCContext` | ✓ VERIFIED, WIRED | Async `createContext`, `getUser()` present, no `getSession(` |
| 4 BFF proxy routes (`chat/stream`, `chat/regenerate`, `chat/widget/submit`, `knowledge/edges/[edgeId]/promote`) | `X-User-Id` forwarding | ✓ VERIFIED, WIRED | All 4 confirmed: `getUser()` -> `X-User-Id` header, alongside unchanged `X-API-Key`, 401 on null user |
| `apps/email-listener/app/presentation/middleware/user_context.py` | Non-enforcing `extract_user_id` | ✓ VERIFIED, WIRED | `USER_ID_HEADER`, never raises; `auth.py` git diff empty |
| `apps/email-listener/tests/presentation/test_user_context.py` | Extraction + `require_api_key` regression proof | ✓ VERIFIED | 4/4 tests, re-run green |
| `GOOGLE-OAUTH-RUNBOOK.md` | 6-section Google Cloud + Supabase runbook | ✓ VERIFIED | 197 lines; grep gates for callback URI, staging ref, secret var name all pass |
| `supabase/config.toml` `[auth.external.google]` | Provider block reading `env(...)` only | ✓ VERIFIED | `client_id`/`secret` both `env(...)` refs, no literal secret; diff shows only the intended 2 edits |
| `.env.example` | Documented placeholders for 4 new vars | ✓ VERIFIED | All 4 vars present as commented placeholders, no real values |
| `apps/web/e2e/auth-redirect.spec.ts` | Authored-not-run Playwright smoke spec | ✓ VERIFIED (authored) / ? HUMAN (execution) | Exists, matches `*.spec.ts`, asserts `/login` redirect + `redirectTo=/chat`; Playwright itself is intentionally not installed this phase |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `supabase/server.ts` | `next/headers cookies()` | cookie adapter | WIRED | `getAll`/`setAll` implemented, `setAll` try/catch for Server Component case |
| `supabase/*.ts` | `lib/env.ts` | validated `NEXT_PUBLIC_SUPABASE_*` | WIRED | All 3 helpers import `env`, never raw `process.env` |
| `middleware.ts` | `supabase/middleware.ts` | `updateSession(request)` | WIRED | Confirmed at `src/middleware.ts` |
| `google-signin-button.tsx` | `supabase.auth.signInWithOAuth` | provider google, redirectTo `/auth/callback` | WIRED | Confirmed |
| `app-sidebar.tsx` | `auth/signout/route.ts` | form POST `/auth/signout` | WIRED | Confirmed |
| `api/trpc/[trpc]/route.ts` | `supabase/server.ts` | `getUser()` | WIRED | Confirmed, no `getSession(` |
| `api/trpc/[trpc]/route.ts` | `createTRPCContext` | resolved user injected | WIRED | Confirmed |
| `trpc.ts` protectedProcedure consumers | UNAUTHORIZED middleware | throws when `ctx.user` null | WIRED | Confirmed via test |
| `apps/web/src/app/api/chat/*` + `knowledge/edges/*/promote` | `supabase/server.ts` | `getUser()` -> `X-User-Id` | WIRED | All 4 routes confirmed |
| BFF proxy -> FastAPI | `extract_user_id` | `X-User-Id` header read into request context | WIRED (non-enforcing by design) | Confirmed, Phase-44 scope for enforcement |
| `supabase/config.toml [auth.external.google]` | `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)` | `env()` reference | WIRED | Confirmed, no literal secret |
| `GOOGLE-OAUTH-RUNBOOK.md` | `auth/callback/route.ts` | documents callback URIs | WIRED | Confirmed |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| env fail-fast + redirect pure-logic tests | `npx vitest run src/lib/env.test.ts src/lib/auth/redirect.test.ts` (apps/web) | 2 files, 11 tests passed | ✓ PASS |
| tRPC identity-injection + UNAUTHORIZED gate | `npx vitest run src/trpc.test.ts` (packages/api-client) | 1 file, 5 tests passed | ✓ PASS |
| FastAPI non-enforcing extractor + require_api_key regression | `uv run pytest tests/presentation/test_user_context.py -x --no-cov` (apps/email-listener) | 4 passed | ✓ PASS |
| apps/web typecheck (excluding known baseline) | `npx tsc --noEmit \| grep -v "src/app/dev/design"` | empty output (zero new errors); full unfiltered run confirmed baseline errors still confined to `src/app/dev/design/previews-vendored.tsx` | ✓ PASS |
| `auth.py` untouched | `git diff HEAD apps/email-listener/app/presentation/middleware/auth.py` | empty diff | ✓ PASS |
| `config.toml` diff scoped | `git show 63d7b54 -- supabase/config.toml` | only the 2 intended edits (redirect URL + google block) | ✓ PASS |
| `packages/api-client/dist` not committed | `git ls-files packages/api-client/dist` | empty (gitignored) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| AUTH-01 | 43-01, 43-02 | Google sign-in + persistent session | ✓ SATISFIED (code) / ? NEEDS HUMAN (live round-trip) | Sign-in button, callback exchange, session cookies all implemented and typecheck-clean; live Google provider not configured in this env |
| AUTH-02 | 43-02 | Sign-out + route protection | ✓ SATISFIED | Middleware guard unit-tested (8/8); sign-out route + sidebar button wired |
| AUTH-03 | 43-03 | tRPC session-derived identity, no client-input override | ✓ SATISFIED | `protectedProcedure` + identity-injection test (5/5) |
| AUTH-04 | 43-04 | FastAPI identity forwarding via BFF, X-API-Key unchanged | ✓ SATISFIED | 4 routes forward `X-User-Id`; `auth.py` diff empty; 4/4 Python tests pass |
| AUTH-05 | 43-01, 43-05 | Env fail-fast + Google OAuth runbook | ✓ SATISFIED | `parseEnv` fail-fast (3/3 tests); runbook (197 lines, all grep gates pass) |

No orphaned requirements — all 5 REQUIREMENTS.md entries (AUTH-01 through AUTH-05) are claimed by a plan's `requirements` frontmatter and independently verified above.

### Anti-Patterns Found

None. Scanned all 25 files created/modified across the 5 plans for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented"/"coming soon" — zero matches. No stub returns (`return null`/`return {}`/empty handlers) found in any auth-critical path; all handlers perform real Supabase/tRPC/fetch calls.

### Human Verification Required

1. **Live Google OAuth round-trip**
   **Test:** With `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`/`_SECRET` configured per `GOOGLE-OAUTH-RUNBOOK.md`, visit `/chat` while signed out, click "Continue with Google", complete the Google consent screen.
   **Expected:** Redirect to `/login?redirectTo=%2Fchat`; after Google consent, land back on `/chat` authenticated.
   **Why human:** No real Google OAuth client exists in this environment (`.env.local` has no `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`) — Google Cloud Console client creation is an explicit, out-of-autonomous-scope user action per `43-CONTEXT.md`.

2. **Session persistence across refresh**
   **Test:** After a successful sign-in, refresh the browser.
   **Expected:** Session persists (AUTH-01).
   **Why human:** Requires a live authenticated browser session from a completed OAuth round-trip.

3. **Sign-out loop**
   **Test:** Click "Sign out" in the sidebar; revisit `/chat`.
   **Expected:** Lands on `/login`; revisiting `/chat` redirects back to `/login` (AUTH-02).
   **Why human:** Requires a live authenticated session to exercise end-to-end.

4. **Playwright e2e execution**
   **Test:** Run `apps/web/e2e/auth-redirect.spec.ts` after installing Playwright.
   **Expected:** Signed-out visit to `/chat` lands on `/login` with `redirectTo=/chat`.
   **Why human:** Playwright is intentionally not installed this phase (one-new-dependency budget spent on `@supabase/ssr`, a locked decision); the equivalent automatable check (`resolveAuthRedirect` unit test) is already verified green above.

### Gaps Summary

No code-level gaps found. All 5 ROADMAP success criteria and all 5 requirement IDs (AUTH-01 through AUTH-05) are backed by real, substantive, wired implementations — independently re-run (not merely trusted from SUMMARY.md): 11 apps/web vitest assertions, 5 packages/api-client vitest assertions, 4 FastAPI pytest assertions, and a clean `tsc --noEmit` outside the pre-existing `src/app/dev/design` baseline. The one deviation from plan (middleware.ts at `src/middleware.ts` instead of the plan-literal `apps/web/middleware.ts`) was verified correct — Next.js 15 resolves middleware relative to the app-directory parent, and a root-level file would have been silently inert.

The phase's status is `human_needed` rather than `passed` solely because the live Google OAuth round-trip requires a real Google Cloud OAuth client that autonomous execution is explicitly barred from creating (per `43-CONTEXT.md`) — this is an expected, planned handoff (Plan 02's own `<human-check>` block and Plan 05's runbook exist specifically to enable it), not an implementation gap.

---

*Verified: 2026-07-10T00:52:15Z*
*Verifier: Claude (gsd-verifier)*
