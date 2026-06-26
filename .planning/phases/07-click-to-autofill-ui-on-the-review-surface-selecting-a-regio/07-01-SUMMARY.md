---
phase: "07"
plan: "01"
subsystem: api-client
tags: [trpc, drizzle, entity-types, mutations, proxy, tdd]
dependency_graph:
  requires: [06-02]
  provides: [emails.autofillComponent, emails.confirmComponent, emails.reprocessEmail, entityTypes.list, emails.detail.correctedFields]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [tRPC-proxy-mutation, pure-row-grouping, SKIP_ENV_VALIDATION-test-gate]
key_files:
  created:
    - packages/api-client/src/router/__tests__/mutations.test.ts
    - packages/api-client/src/router/__tests__/entity-types.test.ts
    - packages/api-client/src/router/entity-types.ts
  modified:
    - packages/api-client/src/router/emails/mutations.ts
    - packages/api-client/src/router/emails/detail.ts
    - packages/api-client/src/root.ts
    - packages/api-client/vitest.config.ts
decisions:
  - "EMAIL_LISTENER_API_KEY read only in getListenerConfig() at call time — never NEXT_PUBLIC_ (T-07-01)"
  - "z.string().uuid() validates componentId/emailId before URL path interpolation (T-07-02)"
  - "correctedFields typed z.record(z.unknown()).nullable() — opaque overlay, not rendered here (T-07-03)"
  - "groupEntityTypeRows is a pure exported function enabling unit testing without DB (matches geometry.test.ts pattern)"
  - "SKIP_ENV_VALIDATION=true in vitest.config.ts prevents db/client.ts env gate from crashing tests"
  - "EntityTypeField and EntityTypeItem must be exported because TypeScript infers them through appRouter type chain (auto-fix Rule 1)"
metrics:
  duration: "~20m"
  completed: "2026-06-12"
  tasks_completed: 3
  files_changed: 7
---

# Phase 7 Plan 1: API Client Data Layer (autofill/confirm/reprocess + entity types) Summary

Phase 7 plan 1 adds the tRPC data layer for click-to-autofill: three server-side proxy mutations (`autofillComponent`, `confirmComponent`, `reprocessEmail`), a new `entityTypesRouter` with Drizzle-powered entity-type enumeration, and extends `emails.detail` with three extraction-record fields needed by the autofill panel.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add autofill/confirm/reprocess mutations (TDD) | `6e80b51` | mutations.ts, mutations.test.ts, vitest.config.ts |
| 2 | entityTypesRouter + groupEntityTypeRows | `96710e8` | entity-types.ts, root.ts |
| 3 | Extend emails.detail + entity-types tests | `dd966ee` | detail.ts, entity-types.test.ts |

## What Was Built

**Three new tRPC proxy mutations** appended to `componentMutationProcedures` in `mutations.ts`:
- `autofillComponent(componentId, entityTypeSlug)` — POST `/v1/components/{id}/autofill`
- `confirmComponent(componentId, correctedFields)` — POST `/v1/components/{id}/confirm`
- `reprocessEmail(emailId)` — POST `/v1/emails/{id}/reprocess`

All three share: UUID validation before URL interpolation, `getListenerConfig()` env guard (server-side only), `parseErrorDetail()` for structured FastAPI error propagation.

**`entityTypesRouter`** in a new `entity-types.ts` file with:
- `list` query: Drizzle `leftJoin` of `EntityTypes + EntityTypeFields` where `isActive=true`, ordered by label then sortOrder
- `groupEntityTypeRows`: pure row-grouping helper (immutable spread on every output object); exported for unit testing

**`emails.detail` extended** with three new columns in the component select block:
- `correctedFields` (jsonb nullable) — human override overlay
- `confidenceBreakdown` (jsonb nullable) — per-field confidence values
- `extractionRecordStatus` (enum) — candidate/confirmed/superseded lifecycle state

## Test Coverage

| File | Tests | Coverage |
|------|-------|---------|
| mutations.test.ts | 8 | request shape, null body, env guard, error propagation |
| entity-types.test.ts | 5 | collapse, null fields, immutability, dataType, order |
| geometry.test.ts | 14 | pre-existing |
| **Total** | **27** | all pass |

## Security Verification

- Grep gate: `EMAIL_LISTENER_API_KEY` does not appear in any `NEXT_PUBLIC_*` context
- `z.string().uuid()` on `componentId` and `emailId` before all URL interpolations
- `correctedFields` accepted as opaque `z.record(z.unknown()).nullable()` — never rendered or eval'd in this layer
- FastAPI backend not modified (plan constraint honored)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript export inference failure on EntityTypeItem/EntityTypeField**
- **Found during:** Task 2 typecheck
- **Issue:** `EntityTypeItem` and `EntityTypeField` were declared without `export`. TypeScript infers them through the `appRouter` type chain and requires they be named for export — `tsc --noEmit` failed with "Exported variable 'createCaller' has or is using name 'EntityTypeItem' from external module but cannot be named"
- **Fix:** Added `export` keyword to both interfaces
- **Files modified:** `packages/api-client/src/router/entity-types.ts`
- **Commit:** `96710e8`

**2. [Rule 3 - Blocking] SKIP_ENV_VALIDATION required in vitest.config.ts**
- **Found during:** Task 1 RED phase
- **Issue:** `packages/db/src/client.ts` calls `createEnv()` which validates `POSTGRES_URL` at import time. The test file imports `appRouter` which chains to `@nauta/db/client`, causing "Invalid environment variables" before any test runs
- **Fix:** Added `env: { SKIP_ENV_VALIDATION: "true" }` to `packages/api-client/vitest.config.ts` — same pattern used in CI/lint/build scenarios already present in `db/client.ts`
- **Files modified:** `packages/api-client/vitest.config.ts`
- **Commit:** `6e80b51`

## Known Stubs

None — all three mutations proxy to real FastAPI endpoints, `entityTypesRouter.list` reads from the live DB, and `emails.detail` fields map to real schema columns. No placeholder data.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All mutations are server-side proxies behind the existing `X-API-Key` gate inherited from Phase 6 mutations. `correctedFields` is treated as opaque data (not rendered), removing XSS risk at this layer.

## Self-Check

### Created files exist

- `packages/api-client/src/router/__tests__/mutations.test.ts` — FOUND
- `packages/api-client/src/router/__tests__/entity-types.test.ts` — FOUND
- `packages/api-client/src/router/entity-types.ts` — FOUND

### Commits exist

- `6e80b51` (Task 1) — FOUND
- `96710e8` (Task 2) — FOUND
- `dd966ee` (Task 3) — FOUND

## Self-Check: PASSED
