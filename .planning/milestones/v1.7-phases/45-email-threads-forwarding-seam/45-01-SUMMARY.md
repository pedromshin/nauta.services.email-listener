---
phase: 45-email-threads-forwarding-seam
plan: 01
subsystem: database
tags: [drizzle, postgres, migrations, tenancy, threads, forwarding]

# Dependency graph
requires:
  - phase: 44-tenancy-user-id-scoping-enforced-isolation
    plan: 01
    provides: importers.user_id + _auth.ts AuthUsers stub — the tenant anchor threads/forwarding_addresses hang off
  - phase: 44-tenancy-user-id-scoping-enforced-isolation
    plan: 02
    provides: "@polytoken/db/ownership central chokepoint pattern + OwnershipError — assertThreadOwnership/assertForwardingAddressOwnership extend it"
provides:
  - "threads table (importer-anchored: importerId FK cascade + index, subject, timestamps)"
  - "emails.thread_id nullable FK to threads (ON DELETE SET NULL, append-only-safe) + index"
  - "forwarding_addresses table (direct user_id FK cascade, UNIQUE token, UNIQUE user_id)"
  - "assertThreadOwnership + assertForwardingAddressOwnership in @polytoken/db/ownership"
  - "migration 0035 applied locally with RLS defense-in-depth (4 policies: 2 anon-deny, 2 owner-authenticated)"
affects: [45-02, 45-03, 45-04, 45-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "drizzle-kit generate --custom emits an EMPTY placeholder file (snapshot cloned from the prior entry, no diff) — it is NOT the way to auto-generate DDL for new schema; use plain `drizzle-kit generate` (auto-diff) whenever the migration needs computed CREATE TABLE/ALTER statements, then hand-append non-schema SQL (RLS policies) to the generated file afterward"

key-files:
  created:
    - packages/db/src/schema/threads.ts
    - packages/db/src/schema/forwarding-addresses.ts
    - packages/db/migrations/0035_threads_forwarding.sql
    - packages/db/migrations/meta/0035_snapshot.json
  modified:
    - packages/db/src/schema/emails.ts
    - packages/db/src/schema/index.ts
    - packages/db/src/ownership.ts
    - packages/db/src/ownership.test.ts
    - packages/db/migrations/meta/_journal.json

key-decisions:
  - "requirements.mark-complete NOT run for THRD-01/THRD-04 despite being this plan's own frontmatter requirements — ROADMAP.md's Wave breakdown shows THRD-01 spans Plans 01/02/03 (schema -> grouping service -> ThreadResolver+ingest+backfill) and THRD-04 spans Plans 01/06 (schema -> token generation/resolution+runbook); this plan delivers only the persistence foundation. Marking either Complete now would repeat the exact premature-completion bug documented and reverted in 44-02-SUMMARY.md (TENA-03). REQUIREMENTS.md traceability rows already read 'Pending' and were left untouched."

patterns-established:
  - "New importer-anchored tables (like emails/email_components) get an importerId FK cascade + a plain btree index; new direct-user_id tables (like chat_conversations) get a userId FK cascade + index — threads and forwarding_addresses instantiate both idioms respectively, extending the Phase-44 ownership/RLS pattern to Phase 45's first tables"

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-07-10
---

# Phase 45 Plan 01: Threads + Forwarding Seam Schema Summary

**Migration 0035 adds an importer-anchored `threads` table + nullable `emails.thread_id` (SET NULL) and a direct-user_id `forwarding_addresses` table (unique token, unique user_id), both carrying Phase-44-style RLS defense-in-depth, plus `assertThreadOwnership`/`assertForwardingAddressOwnership` extending the central ownership chokepoint.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-10T03:35:00-03:00 (approx.)
- **Completed:** 2026-07-10T03:51:05-03:00
- **Tasks:** 3
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- `threads` table live: `id`, `importerId` (FK -> importers, ON DELETE cascade, indexed), `subject` (nullable — the resolver derives it in a later plan), `createdAt`/`updatedAt`
- `emails.thread_id` live: nullable, FK -> threads, ON DELETE SET NULL (not cascade — preserves append-only emails per D-03 when a thread is deleted/merged), indexed
- `forwarding_addresses` table live: `id`, `userId` (FK -> auth.users, ON DELETE cascade), `token` (UNIQUE — the resolution key), `userId` also UNIQUE (exactly one forwarding address per user, deterministic get-or-create), `createdAt`; schema comment documents the `u-{token}@{FORWARDING_EMAIL_DOMAIN}` seam contract for Plans 45-05 (FastAPI resolver) and 45-06 (web surfacing)
- `assertThreadOwnership` (Threads -> Importers join, mirrors `assertEmailOwnership`) and `assertForwardingAddressOwnership` (direct user_id, mirrors `assertConversationOwnership`) added to `@polytoken/db/ownership`, both fail-closed via the shared `OwnershipError`
- Migration `0035_threads_forwarding.sql` applied + live-verified against the local DB: `information_schema.columns` confirms `emails.thread_id` is nullable uuid; `pg_constraint` confirms all 3 new FKs; `pg_policies` confirms 4 new policies (`deny_all_threads_anon`, `threads_owner_authenticated`, `deny_all_forwarding_addresses_anon`, `forwarding_addresses_owner_authenticated`)
- `npm run check` (drizzle-kit) reports "Everything's fine" — zero schema drift
- No `CREATE TABLE "auth"."users"` emitted (the `_auth.ts` stub already has a snapshot since migration 0031, per the 44-01 gotcha this plan's interfaces flagged)

## Task Commits

Each task was committed atomically:

1. **Task 1: threads table + emails.thread_id FK + assertThreadOwnership helper** - `08dcb91` (feat)
2. **Task 2: forwarding_addresses table (token -> user) + ownership helper** - `8e955c1` (feat)
3. **Task 3: [BLOCKING] Generate + hand-finish + apply migration 0035** - `efd96ba` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/db/src/schema/threads.ts` - `Threads` table (importer-anchored) + `ThreadRow`/`InsertThread` types
- `packages/db/src/schema/forwarding-addresses.ts` - `ForwardingAddresses` table (direct user_id) + `ForwardingAddressRow`/`InsertForwardingAddress` types, seam-contract schema comment
- `packages/db/src/schema/emails.ts` - Adds nullable `threadId` FK (SET NULL) + index
- `packages/db/src/schema/index.ts` - Exports `./threads` between `./importers`/`./emails`; `./forwarding-addresses` after `./autofill-retrieval-events`
- `packages/db/src/ownership.ts` - Adds `assertThreadOwnership` + `assertForwardingAddressOwnership`
- `packages/db/src/ownership.test.ts` - Adds 6 tests (owned/other-user/missing x 2 new functions) — 21/21 total passing
- `packages/db/migrations/0035_threads_forwarding.sql` - `CREATE TABLE threads/forwarding_addresses`, `ALTER TABLE emails ADD thread_id`, + hand-appended RLS (6 statements: 2 ENABLE RLS, 2 RESTRICTIVE anon-deny, 2 PERMISSIVE owner-authenticated)
- `packages/db/migrations/meta/_journal.json` - New entry idx 35, `when: 1784140800000` (> prior max `1784054400000`), `tag: "0035_threads_forwarding"`
- `packages/db/migrations/meta/0035_snapshot.json` - Post-migration schema snapshot (26 tables)

## Decisions Made

- **`requirements.mark-complete` skipped for THRD-01/THRD-04** — see key-decisions above. This is the correct outcome per the 44-02 precedent; REQUIREMENTS.md traceability rows for both were already "Pending" and needed no reversion.
- **Plain `drizzle-kit generate` over `generate --custom` for the auto-diffed DDL** — see Deviations below; `--custom` does not compute a schema diff, it only stamps an empty placeholder file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `migration:generate:custom` does not diff schema — produces an empty placeholder migration**
- **Found during:** Task 3, first `npm run migration:generate:custom -- --name=threads_forwarding` call (the plan's primary suggested command)
- **Issue:** `drizzle-kit generate --custom` is designed for hand-written migrations: it stamps a fresh `meta/NNNN_snapshot.json` cloned from the current head (0034's snapshot, unchanged) and an empty `-- Custom SQL migration file, put your code below! --` SQL file — it does NOT compute a diff against the schema TypeScript files. Confirmed by inspecting the emitted `0035_snapshot.json`: it contained none of `threads`/`forwarding_addresses`. Applying migrate:local against this would have produced a migration with zero DDL, silently failing to create either new table while still advancing the journal past idx 35 — a state that could not be corrected by re-running the same command (drizzle-kit would then see 0035 as already the current snapshot baseline).
- **Fix:** Reverted the empty artifacts (`rm 0035_threads_forwarding.sql migrations/meta/0035_snapshot.json`, stripped the idx-35 journal entry) before anything was committed. Re-ran with the plain `npm run migration:generate` (auto-diff), which correctly computed `CREATE TABLE forwarding_addresses`, `CREATE TABLE threads`, `ALTER TABLE emails ADD COLUMN thread_id`, both new FKs, and all 4 new indexes — no `auth.users` CREATE TABLE (the `_auth.ts` stub's snapshot already existed from migration 0031, so the auto-diff correctly saw no delta there). Renamed the drizzle-kit-generated random-named file (`0035_needy_husk.sql`) to the plan-mandated `0035_threads_forwarding.sql` and corrected the journal `tag` to match (drizzle's migrator resolves migration content by `${tag}.sql`, so tag and filename must agree).
- **Files modified:** `packages/db/migrations/0035_threads_forwarding.sql`, `packages/db/migrations/meta/0035_snapshot.json`, `packages/db/migrations/meta/_journal.json`
- **Verification:** Re-inspected the regenerated SQL (no `auth.users` CREATE TABLE, confirmed via grep); `npm run migrate:local` applied cleanly, `npm run check` reports no drift
- **Committed in:** `efd96ba` (Task 3 commit — the empty-file revert never reached a commit)
- **Follow-up flag:** The plan's own interfaces note offered `migration:generate:custom` as an equally-valid alternative to plain `generate` ("auto-name") for this task; that equivalence does not hold when the migration needs auto-computed DDL (only when it's purely hand-written SQL, e.g. RLS-only migrations like 0034 which used plain `generate` too, or true custom migrations like 0025-0030 per 44-01's own deviation history). Future plans generating a migration with real schema changes should default to plain `generate`, reserving `--custom` for hand-authored-only migrations.

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking, a pre-existing drizzle-kit tooling nuance, not a logic error in this plan's own schema code)
**Impact on plan:** Necessary to produce a migration that actually creates the new tables; caught and corrected before any commit or `migrate:local` run against the wrong artifacts, so no partial/incorrect state ever touched the local DB. No scope creep.

## Issues Encountered

None beyond the deviation above (resolved inline, before any commit).

## User Setup Required

None - no external service configuration required. `FORWARDING_EMAIL_DOMAIN` (referenced in the `forwarding_addresses` schema comment) is a future plan's (45-05/45-06) env var, not needed by this plan's schema-only scope.

## Next Phase Readiness

- Plan 45-02 (pure thread-grouping domain service) is unblocked — no direct schema dependency, but the `threads`/`emails.thread_id` shape it will eventually write to now exists.
- Plan 45-03 (ThreadResolver port + Supabase adapter + ingest wiring + backfill) is unblocked: `threads` table + `emails.thread_id` FK are live; `assertThreadOwnership` is available for any tRPC/route-level ownership check it needs.
- Plan 45-06 (forwarding seam web surface: `getOrCreateMyAddress` tRPC + FORWARDING-RUNBOOK.md) is unblocked: `forwarding_addresses` table + `assertForwardingAddressOwnership` are live; the UNIQUE `userId` index makes get-or-create semantics enforceable at the DB level (a second insert for the same user will conflict, not silently duplicate).
- Flag for whoever next runs `drizzle-kit generate` (plain or `--custom`) on this repo: verify the new journal entry's `when` exceeds the current max (now `1784140800000` after this plan) — see 44-01's Deviation 2, still an open repo-wide latent defect (unaddressed at the source, per that plan's own follow-up flag).
- THRD-01 and THRD-04 remain `Pending` in REQUIREMENTS.md by design (see Decisions Made) — they complete at Plan 03 and Plan 06 respectively.

## Self-Check: PASSED

- Created files verified on disk: `packages/db/src/schema/threads.ts`, `packages/db/src/schema/forwarding-addresses.ts`, `packages/db/migrations/0035_threads_forwarding.sql`, `packages/db/migrations/meta/0035_snapshot.json` — all FOUND
- Commits verified in `git log --oneline`: `08dcb91`, `8e955c1`, `efd96ba` — all FOUND
- Re-ran plan-level `<verification>`:
  - `npm run migrate:local` — applies with zero errors; second run completes in 11ms (idempotent no-op)
  - `npx tsc --noEmit` — clean in packages/db
  - `pg_policies` query — confirms `deny_all_threads_anon`/`threads_owner_authenticated`/`deny_all_forwarding_addresses_anon`/`forwarding_addresses_owner_authenticated`, all 4 present
  - `npm run check` — "Everything's fine"
- Acceptance criteria re-verified: `grep -c "ENABLE ROW LEVEL SECURITY"` = 2, `grep -c "AS RESTRICTIVE"` = 2, `grep -c "AS PERMISSIVE"` = 2, `grep -c 'CREATE TABLE "auth"'` = 0 in `0035_threads_forwarding.sql`
- `npm run test -- ownership` — 21/21 passing (15 pre-existing + 3 `assertThreadOwnership` + 3 `assertForwardingAddressOwnership`)

---
*Phase: 45-email-threads-forwarding-seam*
*Completed: 2026-07-10*
