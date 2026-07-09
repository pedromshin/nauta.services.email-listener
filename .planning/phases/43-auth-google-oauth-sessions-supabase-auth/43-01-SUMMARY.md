---
phase: 43-auth-google-oauth-sessions-supabase-auth
plan: 01
subsystem: web-auth
tags: [supabase, auth, zod, env-validation, nextjs, ssr]

# Dependency graph
requires: []
provides:
  - "@supabase/ssr installed in @polytoken/web (single new milestone dep)"
  - "apps/web/src/lib/env.ts — Zod-validated env schema + parseEnv fail-fast + typed env export"
  - "apps/web/src/lib/supabase/{client,server,middleware}.ts — the three canonical @supabase/ssr client helpers"
affects: [43-02-sign-in-out-route-protection, 43-03-trpc-context-identity, 43-04-fastapi-identity-forwarding]

# Tech tracking
tech-stack:
  added: ["@supabase/ssr@^0.12.0"]
  patterns:
    - "Zod envSchema + parseEnv(source) fail-fast pattern (throws named-var Error) for all future env additions"
    - "SKIP_ENV_VALIDATION test-env convention (packages/api-client) now also applied in apps/web/vitest.config.ts"
    - "getUser() (server-verified), never getSession() alone, as the standing authorization rule for all future server/middleware Supabase code"

key-files:
  created:
    - apps/web/src/lib/env.ts
    - apps/web/src/lib/env.test.ts
    - apps/web/src/lib/supabase/client.ts
    - apps/web/src/lib/supabase/server.ts
    - apps/web/src/lib/supabase/middleware.ts
  modified:
    - apps/web/package.json
    - package-lock.json
    - apps/web/vitest.config.ts

key-decisions:
  - "@supabase/ssr pinned at ^0.12.0 per STACK.md (not the plan's stale '^0.5-^0.7' text) — verified 0.12.0 resolved, matches the researched pin exactly"
  - "apps/web/vitest.config.ts gained SKIP_ENV_VALIDATION: 'true' in test.env (deviation, not in plan's files_modified) — required so importing env.ts during any test run doesn't throw at module load before assertions even execute; mirrors the existing packages/api-client/vitest.config.ts convention the plan's own read_first pointed at"
  - "middleware.ts returns { response, user } and contains zero redirect logic by design — route-guard decisions are explicitly Plan 02's responsibility"

patterns-established:
  - "Fail-fast Zod env module with SKIP_ENV_VALIDATION test escape hatch — reusable for any future required env var in apps/web"

requirements-completed: [AUTH-01, AUTH-05]

# Metrics
duration: ~15min
completed: 2026-07-09
---

# Phase 43 Plan 01: Auth Foundation — @supabase/ssr + Env Validation + Client Helpers Summary

**Installed `@supabase/ssr` (the milestone's one new npm dependency), added a Zod-validated fail-fast env schema (AUTH-05), and created the three canonical browser/server/middleware `@supabase/ssr` client helpers that every downstream Phase 43 plan will import.**

## Performance

- **Duration:** ~15 min (continuation from a pre-approved Task 0 checkpoint)
- **Completed:** 2026-07-09T23:09:46Z
- **Tasks:** 2 completed (Task 0 checkpoint was approved by the user before this continuation run started)
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- Ran `npm install @supabase/ssr -w @polytoken/web` from repo root — resolved to `0.12.0`, exactly matching STACK.md's `^0.12.0` pin. Package-lock diff confirmed: only `@supabase/ssr` (+ its own `cookie@1.1.1` transitive dependency) added; no other new top-level dependency.
- Created `apps/web/src/lib/env.ts`: Zod `envSchema` (4 server-only vars — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_LISTENER_URL`, `EMAIL_LISTENER_API_KEY` — and 2 public vars — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), a pure `parseEnv(source)` that throws `Missing/invalid auth environment variables: <fields>` on `safeParse` failure, and a module-level `env` export that fails fast on import unless `SKIP_ENV_VALIDATION` is set.
- Created `apps/web/src/lib/env.test.ts`: 3 passing assertions — throws naming the missing var (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), returns a typed object when all vars present, and proves no `NEXT_PUBLIC_*` key (schema-level and value-level) ever carries the service-role secret.
- Created the three `@supabase/ssr` helpers, all reading exclusively from the validated `env` module:
  - `client.ts` — `"use client"` `createClient()` via `createBrowserClient`.
  - `server.ts` — async `createClient()` bound to `next/headers` `cookies()` (`getAll`/`setAll`, `setAll` wrapped in try/catch for the read-only Server Component case); docstring mandates `getUser()` over `getSession()` for authorization.
  - `middleware.ts` — `updateSession(request)` implementing the canonical `@supabase/ssr` middleware cookie-adapter pattern (writes to both `request.cookies` and a reassigned `NextResponse.next()`), calls `getUser()`, returns `{ response, user }`. Contains zero redirect/route-guard logic by design.
- Verified `npx tsc --noEmit` in `apps/web` produces zero errors under `src/lib/supabase/` or `src/lib/env.ts` — all 53 pre-existing errors are confined to the known `src/app/dev/design/` baseline (backlog 999.14), confirmed via diff against the plan's documented baseline.

## Task Commits

Each task was committed atomically:

0. **Task 0: Verify @supabase/ssr package legitimacy** — checkpoint approved by user in the prior run (no commit; gate-only). Evidence recorded: repository `git+https://github.com/supabase/ssr.git` (supabase org), MIT license, latest `0.12.0` at install time (matches STACK.md's `^0.12.0` pin), ~4.96M weekly downloads, 81 versions since 2023-09-06.
1. **Task 1: Install @supabase/ssr + Zod env schema with fail-fast startup validation** - `95d9a8e` (feat)
2. **Task 2: Create the three @supabase/ssr client helpers (browser / server / middleware)** - `47bd81b` (feat)

**Plan metadata:** (this SUMMARY.md commit, following)

## Files Created/Modified

- `apps/web/src/lib/env.ts` - New Zod-validated env schema + `parseEnv` fail-fast + typed `env` export (AUTH-05)
- `apps/web/src/lib/env.test.ts` - New test file: fail-fast message assertion + public/secret separation proof
- `apps/web/src/lib/supabase/client.ts` - New browser Supabase client (`createBrowserClient`)
- `apps/web/src/lib/supabase/server.ts` - New server Supabase client bound to Next cookies (`createServerClient` + `getUser()` contract)
- `apps/web/src/lib/supabase/middleware.ts` - New `updateSession()` session-refresh helper for Next.js middleware
- `apps/web/package.json` - Added `@supabase/ssr: ^0.12.0`
- `package-lock.json` - Regenerated (contains `@supabase/ssr` + `cookie` entries)
- `apps/web/vitest.config.ts` - Added `SKIP_ENV_VALIDATION: "true"` to `test.env` (deviation, see below)

## Decisions Made

- Followed STACK.md's `^0.12.0` pin over the plan's own stale `Task 0` text citing a `^0.5-^0.7` range — STACK.md is the source of truth per the continuation's approval evidence, and the installed version (`0.12.0`) matches it exactly.
- Kept `middleware.ts` free of any redirect/route-guard logic exactly as instructed, returning `{ response, user }` for Plan 02 to consume.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Added `SKIP_ENV_VALIDATION: "true"` to `apps/web/vitest.config.ts`'s `test.env`**
- **Found during:** Task 1, running `npx vitest run src/lib/env.test.ts`
- **Issue:** `env.ts`'s module-level `export const env = ...` executes `parseEnv(process.env)` on any import of the module — including importing just `parseEnv`/`envSchema` for direct unit testing — and would throw at module-load time (before any test assertion runs) in a test environment where the 6 required vars aren't all set as real process env vars.
- **Fix:** Added `SKIP_ENV_VALIDATION: "true"` to `apps/web/vitest.config.ts`'s `test.env`, mirroring the exact convention already used in `packages/api-client/vitest.config.ts` (which the plan's own `<interfaces>` section named as the pattern to honor). This bypasses only the module-level auto-run; `parseEnv` itself is still exercised directly and fully by all 3 test assertions.
- **Files modified:** `apps/web/vitest.config.ts`
- **Commit:** `95d9a8e`

Or otherwise: plan executed as written for all other tasks.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None for this plan. `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / other referenced env vars must exist in the real `.env.local`/`.env.staging`/`.env.production` files before `next dev`/`next build` runs outside `SKIP_ENV_VALIDATION` — this plan only wires the validation, it does not populate the values (Google Cloud OAuth client creation remains the documented user runbook per 43-CONTEXT.md).

## Next Phase Readiness

- AUTH-01 (Google-only sign-in) and AUTH-05 (env half — fail-fast on missing auth vars) groundwork is in place: `env.ts` + the three Supabase client helpers are the contracts Plan 02 (`/login` route + sign-in/out + route-protection middleware), Plan 03 (tRPC `createContext`/`protectedProcedure`), and Plan 04 (FastAPI identity forwarding) all import.
- No blockers. Plan 02 can now build `app/auth/callback/route.ts` and the real `middleware.ts` route guard directly on top of `updateSession()`.

---
*Phase: 43-auth-google-oauth-sessions-supabase-auth*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: apps/web/src/lib/env.ts
- FOUND: apps/web/src/lib/env.test.ts
- FOUND: apps/web/src/lib/supabase/client.ts
- FOUND: apps/web/src/lib/supabase/server.ts
- FOUND: apps/web/src/lib/supabase/middleware.ts
- FOUND: .planning/phases/43-auth-google-oauth-sessions-supabase-auth/43-01-SUMMARY.md
- FOUND: commit 95d9a8e (feat(43-01): install @supabase/ssr + Zod env fail-fast validation)
- FOUND: commit 47bd81b (feat(43-01): add browser/server/middleware @supabase/ssr client helpers)
