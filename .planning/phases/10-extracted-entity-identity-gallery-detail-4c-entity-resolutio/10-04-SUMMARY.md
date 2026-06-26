---
phase: 10-extracted-entity-identity-gallery-detail-4c-entity-resolutio
plan: "04"
subsystem: api-client/entities-router
tags: [trpc, entities, gallery, detail, mutations, tdd]
dependency_graph:
  requires: ["10-03"]
  provides: ["entities tRPC router — list/byId/confirmMerge/rejectMerge/unmerge"]
  affects: ["apps/web entity gallery page", "apps/web entity detail page"]
tech_stack:
  added: []
  patterns:
    - "limit+1 pagination with hasMore + nextOffset"
    - "pure exported aggregation helpers for DB-free vitest"
    - "FastAPI proxy mutations via getListenerConfig (server-side key)"
    - "D-19 conflict detection: no auto-canonical, all distinct values + provenance retained"
key_files:
  created:
    - packages/api-client/src/router/entities/gallery.ts
    - packages/api-client/src/router/entities/gallery.test.ts
    - packages/api-client/src/router/entities/detail.ts
    - packages/api-client/src/router/entities/detail.test.ts
    - packages/api-client/src/router/entities/mutations.ts
    - packages/api-client/src/router/entities/mutations.test.ts
    - packages/api-client/src/router/entities/index.ts
  modified:
    - packages/api-client/src/root.ts
decisions:
  - "D-19 conflict flagging: aggregateEntityFields marks a field conflicting=true when distinct value count > 1; ALL distinct values returned with provenance; no canonicalValue property added to conflicting fields — human decides"
  - "merged_into column accessed via raw sql EXISTS sub-select (column exists in live DB but not in Drizzle schema); read-only access, safe"
  - "has-pending-duplicates status filter applied post-query (after limit+1 fetch) because HAVING would interact incorrectly with limit+1 semantics"
  - "Drizzle execute() returns array-like RowList, not { rows: [] } — cast via unknown[] for wasMerged detection"
metrics:
  duration: ~45min
  completed: "2026-06-14"
  tasks_completed: 3
  files_changed: 8
---

# Phase 10 Plan 04: Entities tRPC Router Summary

**One-liner:** JWT-free entities tRPC router with pg_trgm gallery list, four-region byId with D-19 conflict detection, and FastAPI-proxy merge mutations — all TDD-committed in RED/GREEN pairs.

## Tasks Completed

| Task | Name | RED commit | GREEN commit | Tests |
|------|------|-----------|-------------|-------|
| 1 | entities/gallery.ts — list with filters + pg_trgm search | `f8b54e9` | `9dc9f93` | 11/11 |
| 2 | entities/detail.ts — byId with four regions + conflict flagging | `27baf04` | `630c27f` | 6/6 |
| 3 | entities/mutations.ts + index.ts + root wire | `ff1aef4` | `393b983` | 9/9 |

**Total: 26/26 tests passing across all three test files.**

## What Was Built

### gallery.ts
- `listInputSchema`: status enum `['confirmed','all','candidate','has-pending-duplicates']` default `'confirmed'` (D-02 candidates hidden); sort enum `['last_seen','name','occurrences']`; limit 1–100 default 25; search max 200 chars
- `shapeGalleryItem`: pure helper mapping raw DB row to gallery item (maps `identifiers → keyIdentifiers`, derives `status: isActive ? 'confirmed' : 'candidate'`)
- `entityGalleryProcedures.list`: Drizzle query with `source='email_extracted'` always applied (T-10-31), joins EntityTypes + ComponentEntityCandidateLinks + EmailComponents, aggregates `occurrenceCount` (distinct emailIds) and `pendingDuplicatesCount` (unselected candidate links), limit+1 pagination, pg_trgm search via parameterized `sql` ILIKE fragment (T-10-32)
- `has-pending-duplicates` applied post-query to avoid HAVING interference with limit+1

### detail.ts
- `FieldOccurrenceRow` interface and `AggregatedField` type exported for DB-free testing
- `aggregateEntityFields()`: groups by fieldSlug, `conflicting: true` when distinct value count > 1, ALL provenance entries retained per field, no `canonicalValue` added (D-19)
- `entityDetailProcedures.byId`: returns null when entity absent; five-region shape `{ entity, occurrences, fields, knowledgeNodes, pendingSuggestions, wasMerged }`; occurrences deduped by emailId preferring 'confirmed' extraction status; wasMerged via raw `sql EXISTS(SELECT 1 FROM entity_instances WHERE merged_into = id)` (column not in Drizzle schema)

### mutations.ts + index.ts + root.ts
- `confirmMerge`, `rejectMerge`, `unmerge`: FastAPI proxy mutations via `getListenerConfig()` at call time (T-10-30/D-21); all inputs zod-uuid-validated before URL interpolation
- `entitiesRouter = createTRPCRouter({ ...gallery, ...detail, ...mutations })`
- `appRouter` extended with `entities: entitiesRouter`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drizzle execute() RowList type has no `.rows` property**
- **Found during:** Task 2 GREEN — typecheck error on `mergedCheckRows.rows[0]`
- **Issue:** `ctx.db.execute()` with postgres-js returns a `RowList` which is array-like, not `{ rows: Array }`. Accessing `.rows` is a TS2339 error.
- **Fix:** Cast result via `as unknown as Array<Record<string, unknown>>` and index directly
- **Files modified:** `packages/api-client/src/router/entities/detail.ts`
- **Commit:** `630c27f` (inline fix, no separate commit needed)

## Known Stubs

None — all procedures return real DB-backed data shapes. `pendingSuggestions` in `byId` may return an empty array when no unselected candidate links exist, which is the correct empty state (not a stub).

## Threat Flags

No new network endpoints or trust boundaries were introduced beyond those modelled in the plan's threat register (T-10-30 through T-10-SC). The `merged_into` raw SQL read is scoped to the same `entity_instances` table already in scope.

## Self-Check

- `packages/api-client/src/router/entities/gallery.ts` — created ✓
- `packages/api-client/src/router/entities/gallery.test.ts` — created ✓
- `packages/api-client/src/router/entities/detail.ts` — created ✓
- `packages/api-client/src/router/entities/detail.test.ts` — created ✓
- `packages/api-client/src/router/entities/mutations.ts` — created ✓
- `packages/api-client/src/router/entities/mutations.test.ts` — created ✓
- `packages/api-client/src/router/entities/index.ts` — created ✓
- `packages/api-client/src/root.ts` — modified ✓

Commits verified:
- `f8b54e9` test(10-04) gallery RED ✓
- `9dc9f93` feat(10-04) gallery GREEN ✓
- `27baf04` test(10-04) detail RED ✓
- `630c27f` feat(10-04) detail GREEN ✓
- `ff1aef4` test(10-04) mutations RED ✓
- `393b983` feat(10-04) mutations GREEN ✓
