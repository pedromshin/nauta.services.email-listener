---
phase: 23-2d-canvas-panels-as-nodes-shared-state
plan: 01
subsystem: database, api
tags: [drizzle, postgres, supabase, rls, trpc, zod, canvas, prototype-pollution-guard]

# Dependency graph
requires:
  - phase: 22-chat-spine-persistence-streaming
    provides: chat_conversations table, chat tRPC router barrel pattern, migration tooling (drizzle-kit + hand-authored RLS SQL)
provides:
  - chat_canvas_layouts Drizzle table (one row per conversation) live in local Postgres with RLS deny-all
  - The canonical CANVAS SNAPSHOT SHAPE (nodes/edges/viewport/sharedState/nodeRegistryVersion) — the data contract every later canvas plan (23-02..23-05) builds against
  - CanvasSnapshotSchema + hasForbiddenKeyDeep — the FOUND-6 prototype-pollution + no-spec-content boundary
  - chat.getCanvasLayout / chat.saveCanvasLayout tRPC procedures (upsert by conversationId)
affects: [23-02, 23-03, 23-04, 23-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layout rows carry NO genui spec content (D-05) — only provenance refs; specs rehydrate from chat_messages by (messageId, partIndex, runId)"
    - "hasForbiddenKeyDeep recursive prototype-pollution guard (mirrors packages/genui/src/renderer/render-node.tsx FORBIDDEN_KEYS) reused for both dotted-path segments (edge sourcePath/targetKey) and arbitrary JSON records (sharedState)"
    - "onConflictDoUpdate upsert-by-unique-column (Drizzle) — first use in this codebase; target the UNIQUE conversation_id index"
    - "drizzle-kit generate + hand-authored RLS SQL gotcha: registering the journal entry by hand BEFORE running generate causes drizzle-kit to assign the NEXT free idx (25, not 24) since it diffs against the last real snapshot on disk (0023) — fix is to keep the hand-authored migration SQL, delete the auto-named file, and rename the generated snapshot file to the intended idx"

key-files:
  created:
    - packages/db/src/schema/chat-canvas-layouts.ts
    - packages/db/migrations/0024_chat_canvas_layouts.sql
    - packages/db/migrations/meta/0024_snapshot.json
    - packages/api-client/src/router/chat/canvas.ts
    - packages/api-client/src/router/chat/__tests__/canvas.test.ts
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/migrations/meta/_journal.json
    - packages/api-client/src/router/chat/index.ts

key-decisions:
  - "hasForbiddenKeyDeep + hasForbiddenPathSegment are hand-mirrored copies of render-node.tsx's FORBIDDEN_KEYS/resolveDataRef guard rather than an import — packages/genui doesn't currently export these as a shared utility; kept as duplicated pure functions per the plan's explicit instruction (\"mirror this exact set\"), a shared-util extraction is a candidate follow-up if a third consumer appears"
  - "sharedState size cap set to 100,000 serialized chars (MAX_SHARED_STATE_SERIALIZED_CHARS) — the plan left the exact bound to Claude's discretion; chosen as a generous-but-bounded ceiling for a per-conversation shared-state store of primitives/small objects"

requirements-completed: [CANVAS-02]

# Metrics
duration: 35min
completed: 2026-07-04
---

# Phase 23 Plan 01: Canvas Persistence Spine Summary

**`chat_canvas_layouts` Drizzle table (migration 0024, RLS deny-all, live in local Postgres) plus `chat.getCanvasLayout`/`chat.saveCanvasLayout` tRPC procedures gated by a `CanvasSnapshotSchema` Zod boundary that rejects prototype pollution, embedded spec content, and over-cap payloads.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 completed
- **Files modified:** 8 (2 created + 1 modified in `packages/db/src/schema`, 1 migration + 2 meta files, 1 created + 1 modified in `packages/api-client/src/router/chat`, 1 test file)

## Accomplishments

- Modeled `ChatCanvasLayouts` (one row per conversation, UNIQUE `conversation_id` index) carrying node positions/sizes/type/data-refs, edges, viewport, and shared-state — explicitly **without** genui spec content (D-05), so a saved layout can never smuggle stale or tampered spec payloads past the canonical `chat_messages` store.
- Hand-authored migration 0024 mirroring 0023's RLS-deny-all + `IF NOT EXISTS` style; applied to local Supabase Postgres and verified live (RLS enabled, both `anon`/`authenticated` RESTRICTIVE deny-all policies present, unique index present) via a direct `pg_catalog`/`information_schema` query.
- Built the `CanvasSnapshotSchema` Zod boundary — the interface-first contract plan 23-02 (node-data-schemas) and all later canvas plans build against verbatim — enforcing:
  - **D-05** — `node.data` rejects `spec`/`root` keys (no embedded spec content).
  - **FOUND-6/T-23-01** — `hasForbiddenKeyDeep` rejects `__proto__`/`constructor`/`prototype` at any depth in `sharedState`; a per-segment guard rejects the same in edge `sourcePath`/`targetKey` dotted paths.
  - **T-23-04** — `MAX_CANVAS_NODES=200` / `MAX_CANVAS_EDGES=400` array caps plus a 100k-char serialized-size cap on `sharedState`.
- Implemented `chat.getCanvasLayout` (read the single row or `null`) and `chat.saveCanvasLayout` (Drizzle `onConflictDoUpdate` upsert by `conversationId` — last-write-wins, no CRDT per D-06), registered in the chat router barrel.
- TDD: RED (11 failing tests, module absent) → GREEN (all 11 pass; full `chat` router suite is 38/38 green; `tsc --noEmit` clean in both `packages/db` and `packages/api-client`; `packages/api-client` build clean).

## Task Commits

Each task was committed atomically:

1. **Task 1: chat_canvas_layouts Drizzle schema module + barrel export + hand-authored migration 0024 SQL** - `78e8266` (feat)
2. **Task 2 [BLOCKING]: Generate/reconcile snapshot + apply migration 0024 to LOCAL Supabase Postgres** - `247edb1` (feat)
3. **Task 3 RED: add failing CanvasSnapshotSchema boundary tests** - `8fe5f83` (test)
3. **Task 3 GREEN: implement chat.getCanvasLayout/saveCanvasLayout + CanvasSnapshotSchema** - `80602a0` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `packages/db/src/schema/chat-canvas-layouts.ts` - `ChatCanvasLayouts` pgTable: nodes/edges/viewport/shared_state jsonb, node_registry_version, UNIQUE conversation_id index, inferred row/insert types
- `packages/db/src/schema/index.ts` - barrel re-export of the new module
- `packages/db/migrations/0024_chat_canvas_layouts.sql` - CREATE TABLE + FK cascade + unique index + RLS deny-all (anon + authenticated), mirrors 0023's style
- `packages/db/migrations/meta/_journal.json` - registered migration 0024 (tag `0024_chat_canvas_layouts`)
- `packages/db/migrations/meta/0024_snapshot.json` - drizzle-kit schema snapshot (renamed from the auto-generated 0025 snapshot — see Deviations)
- `packages/api-client/src/router/chat/canvas.ts` - `CanvasSnapshotSchema`, `hasForbiddenKeyDeep`, `saveCanvasLayoutInputSchema`, `getCanvasLayoutInputSchema`, `chatCanvasProcedures` (getCanvasLayout query + saveCanvasLayout upsert mutation)
- `packages/api-client/src/router/chat/index.ts` - spread `chatCanvasProcedures` into `chatRouter`
- `packages/api-client/src/router/chat/__tests__/canvas.test.ts` - 11 DB-free tests covering the schema boundary + input schemas + `hasForbiddenKeyDeep`

## Decisions Made

- **`hasForbiddenKeyDeep`/`hasForbiddenPathSegment` are duplicated, not imported** from `packages/genui/src/renderer/render-node.tsx` — that module doesn't currently export `FORBIDDEN_KEYS`/`resolveDataRef` as a shared utility, and the plan's `<read_first>` explicitly said "mirror this exact set." Kept as small pure functions local to `canvas.ts`; worth promoting to a shared `@nauta`-level util if a third consumer appears (candidate: plan 23-02's node-data-schemas, which shares the canonical snapshot shape).
- **`sharedState` serialized-size cap = 100,000 chars** — left to discretion by the plan; chosen as a generous bound for a per-conversation store of primitives/small objects while still closing the unbounded-payload threat (T-23-04).
- **`viewport` is optional in the Zod schema but nullable in the DB column** — matches the plan's "nullable until first pan/zoom" semantics; `saveCanvasLayout` writes `snapshot.viewport ?? null`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-kit assigned idx 25 instead of 24 on `migration:generate`**
- **Found during:** Task 2 (generate/apply migration)
- **Issue:** Because Task 1 had already hand-registered a `_journal.json` entry at idx 24 (tag `0024_chat_canvas_layouts`) before `migration:generate` ran, drizzle-kit diffed the current schema against the last *real* snapshot on disk (`0023_snapshot.json` — there was no `0024_snapshot.json` yet) and, seeing idx 24 already claimed in the journal, emitted the new migration at idx 25 (`0025_fantastic_trauma.sql` / `0025_snapshot.json`) instead of producing a 0024 snapshot.
- **Fix:** Confirmed the auto-generated SQL matched the hand-authored `0024_chat_canvas_layouts.sql` table shape exactly (same columns/FK/index — no RLS, as expected since RLS lives only in raw SQL), then deleted `0025_fantastic_trauma.sql`, renamed `0025_snapshot.json` → `0024_snapshot.json`, and removed the stray idx-25 journal entry (keeping only the idx-24 entry from Task 1). Re-ran `migration:generate` — "No schema changes, nothing to migrate" confirms convergence; re-ran `migrate:local` — idempotent (21 tables).
- **Files modified:** `packages/db/migrations/meta/0024_snapshot.json` (renamed), `packages/db/migrations/meta/_journal.json` (reverted to Task 1's single idx-24 entry); `0025_fantastic_trauma.sql` deleted (never committed)
- **Committed in:** `247edb1` (Task 2 commit)

**2. [Rule 1 - Bug] Test-file TS union-type inference broke `tsc --noEmit`**
- **Found during:** Task 3 GREEN verification (`pnpm tsc --noEmit`)
- **Issue:** `vitest run` passed (esbuild doesn't type-check), but `tsc --noEmit` failed: `makeValidSnapshot()`'s untyped return caused TypeScript to infer a narrow discriminated-union type from the two literal node objects in the fixture, so later reassignments (`snapshot.nodes = [...]`, `snapshot.sharedState = ...`) failed structural checks against that inferred union.
- **Fix:** Explicitly typed `makeValidSnapshot(): CanvasSnapshot` (the exported `z.infer` type from `canvas.ts`), which widens `data` to `Record<string, unknown>` uniformly; removed now-unnecessary `as unknown as Record<string, unknown>` casts in Tests 5/6.
- **Files modified:** `packages/api-client/src/router/chat/__tests__/canvas.test.ts`
- **Committed in:** `80602a0` (Task 3 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking migration-tooling gotcha, 1 bug in the test fixture's type — both resolved before their respective task's verification step; no scope creep, no architectural changes)
**Impact on plan:** Both fixes were required to reach each task's stated acceptance criteria exactly as written (idempotent migration; `tsc --noEmit` clean). No deferred work.

## Issues Encountered

None beyond the two Rule-1/Rule-3 items above.

## User Setup Required

None — local Supabase Postgres (localhost:54322) already running from a prior session; `chat_canvas_layouts` is now live with the migration applied. Staging/prod are explicitly **PENDING DEPLOY** per this milestone's local/sandbox-only scope — `migrate:staging`/`migrate:prod` were intentionally NOT run.

## Threat Flags

None — all new surface (RLS deny-all on `chat_canvas_layouts`, the `CanvasSnapshotSchema` boundary's prototype-pollution guard, the spec-content guard, and the payload-size caps) was already enumerated in the plan's `<threat_model>` (T-23-01 through T-23-04) and implemented exactly as dispositioned. No new trust-boundary surface introduced beyond what the plan anticipated.

## Next Phase Readiness

- The canvas persistence spine is live: `chat_canvas_layouts` in local Postgres (RLS deny-all verified), `CanvasSnapshotSchema` + `chatCanvasProcedures` exported from `@nauta/api-client`'s chat router.
- Plan 23-02 (node-data-schemas / `NODE_TYPE_REGISTRY`) can now build directly on the CANONICAL SNAPSHOT SHAPE defined here — node/edge/viewport/sharedState/nodeRegistryVersion — without redefining it.
- `hasForbiddenKeyDeep` is available (currently local to `canvas.ts`) as the reference implementation for any later plan needing the same prototype-pollution guard over arbitrary JSON.

---
*Phase: 23-2d-canvas-panels-as-nodes-shared-state*
*Completed: 2026-07-04*

## Self-Check: PASSED

All 8 created/modified files confirmed present on disk; all 4 task commits (`78e8266`, `247edb1`, `8fe5f83`, `80602a0`) confirmed present in `git log --oneline`. `chat_canvas_layouts` confirmed live in local Postgres with RLS enabled and both deny-all policies present via direct query.
