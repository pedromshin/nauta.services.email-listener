---
phase: 05-review-ui-inbox-email-detail-with-document-preview-and-entit
plan: "02"
subsystem: api
tags: [supabase, storage, signed-url, next-js, route-handler, drizzle]

requires:
  - phase: 04-email-intelligence
    provides: email_attachments table with storageKey column populated by ingest pipeline

provides:
  - GET /api/attachments/[id] — server-side signed-URL generation for attachment bytes (60s TTL)
  - @supabase/supabase-js installed in apps/web
  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY documented and set locally

affects:
  - 05-03 (attachments-card fetch)
  - 05-04 (PDF preview pane fetch)

tech-stack:
  added:
    - "@supabase/supabase-js ^2 (apps/web dependency)"
  patterns:
    - "Next.js 15 async params in route handlers: `params: Promise<{ id: string }>` + `await params`"
    - "Missing-secret guard: check env vars at handler entry, return 500 with console.error before constructing client"
    - "Server-side only secret: read from process.env, never prefix NEXT_PUBLIC_, never in response body"

key-files:
  created:
    - apps/web/src/app/api/attachments/[id]/route.ts
  modified:
    - apps/web/package.json
    - .env.example

key-decisions:
  - "Params async pattern for Next.js 15 compatibility: `{ params }: { params: Promise<{ id: string }> }` + `await params` — discovered via typecheck failure"
  - "UUID validated via regex (not zod) — zod is a transitive dep but not directly importable from apps/web without a named dep; regex is simpler and sufficient per plan fallback clause"
  - "Service-role key is a local well-known dev default (the same key in every Supabase local stack), acceptable for local .env.local; never committed for staging/prod"

patterns-established:
  - "Route handler secret guard: check both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before constructing createClient"
  - "Error shape contract: only { url } on success, { error } with friendly copy on failure; raw error detail to console.error only"

requirements-completed: ["Decision-driven"]

duration: 15min
completed: 2026-06-12
---

# Phase 5 Plan 02: Signed-URL Route Handler Summary

**Server-side `GET /api/attachments/[id]` route that mints 60s Supabase Storage signed URLs using service-role key, with UUID validation (400), not-found handling (404), and missing-secret guard (500).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-12T00:00:00Z
- **Completed:** 2026-06-12T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3 (created 1, modified 2)

## Accomplishments

- Added `@supabase/supabase-js ^2` to `apps/web/package.json` dependencies and ran `npm install`
- Documented `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.example` with local/staging/prod guidance and server-side-only warning
- Created `apps/web/src/app/api/attachments/[id]/route.ts` — App Router GET handler with full validation, DB lookup, signed-URL generation, and security guardrails

## Task Commits

1. **Task 1: Add @supabase/supabase-js dependency + env plumbing** — `2e28605` (feat)
2. **Task 2: GET /api/attachments/[id] signed-URL route handler** — `5a2334e` (feat)

**Plan metadata:** see docs commit (this file)

## Files Created/Modified

- `apps/web/src/app/api/attachments/[id]/route.ts` — App Router GET handler: UUID validation, missing-secret guard, Drizzle DB lookup, createSignedUrl(60), server-side error logging
- `apps/web/package.json` — Added `@supabase/supabase-js: ^2` to dependencies
- `.env.example` — Added "Web app (apps/web) — Supabase Storage" section with SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY documentation for local/staging/prod

## Decisions Made

- **Next.js 15 async params:** Discovered during typecheck that Next.js 15 requires `params: Promise<{ id: string }>` and `await params`. Applied fix inline (Rule 1 auto-fix).
- **UUID regex over zod:** Plan allowed UUID regex as fallback if zod was not directly importable — used regex for simplicity; `z` is available transitively but not a direct `apps/web` dep.
- **Local service_role key in .env.local:** The local Supabase stack always uses a well-known demo JWT (not a real secret). Written to `.env.local` which is gitignored; staging/prod values documented as placeholders in `.env.example`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js 15 requires params as Promise in route handlers**
- **Found during:** Task 2 (typecheck after writing route handler)
- **Issue:** `tsc --noEmit` failed with type error: `params` in Next.js 15 App Router route handlers must be typed as `Promise<{ id: string }>` and awaited, not accessed synchronously
- **Fix:** Changed `{ params }: { params: { id: string } }` to `{ params }: { params: Promise<{ id: string }> }` and added `await params`
- **Files modified:** `apps/web/src/app/api/attachments/[id]/route.ts`
- **Verification:** `npm run typecheck` exits 0 after fix
- **Committed in:** `5a2334e` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — framework API change)
**Impact on plan:** Necessary for typecheck compliance with Next.js 15. No scope change.

## Issues Encountered

None — typecheck pass confirmed after the async-params fix.

## User Setup Required

**External services require manual configuration for staging/prod.**

For local development, `.env.local` is already populated with the local Supabase stack values.

For staging/prod, set the following in `.env.staging` / `.env.production`:
- `SUPABASE_URL` — Supabase Dashboard → Project Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Project Settings → API → service_role secret (server-side only, never expose to browser)

## Next Phase Readiness

- `GET /api/attachments/[id]` is ready for 05-03 (attachments-card) and 05-04 (PDF preview pane) to call via `fetch()`
- No blockers

## Self-Check

- `apps/web/src/app/api/attachments/[id]/route.ts` exists on disk: FOUND
- Commit `2e28605` (Task 1) exists: FOUND
- Commit `5a2334e` (Task 2) exists: FOUND
- `grep -q "export async function GET"` in route.ts: PASS
- `grep -q "createSignedUrl"` in route.ts: PASS
- `grep -q "EmailAttachments.storageKey"` in route.ts: PASS
- `grep -q "SUPABASE_SERVICE_ROLE_KEY"` in route.ts: PASS
- `! grep -q "console.log"` in route.ts: PASS
- `! grep -q "NEXT_PUBLIC_SUPABASE_SERVICE"` in route.ts: PASS
- `cd apps/web && npm run typecheck` exits 0: PASS

## Self-Check: PASSED

---
*Phase: 05-review-ui-inbox-email-detail-with-document-preview-and-entit*
*Completed: 2026-06-12*
