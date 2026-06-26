---
phase: 09-entity-field-region-relationships-canvas
plan: 04
subsystem: api-client-data-layer
tags: [trpc, drizzle, zod, server-side-proxy, x-api-key, entity-summary, relationship-mutations, entity-types-write, vitest, tdd]
dependency_graph:
  requires:
    - "09-01: email_components.role / entity_type_id / entity_type_field_id columns (D-01..D-04) — detail.ts reads them, entity-summary joins entity_types on entityTypeId"
    - "09-02a: PATCH /v1/components/{id}/role|/entity-type|/field-relationship + POST /deny endpoints — the new component mutations proxy these"
    - "09-02b: POST /v1/components/{id}/autofill-fields endpoint — autofillFields proxies it"
    - "09-03: /v1/entity-types CRUD router (POST / PATCH /{id} POST /{id}/fields PATCH /fields/{id} DELETE /fields/{id} POST /{id}/fields/reorder) — the entity-types write mutations proxy these"
  provides:
    - "emails.detail now surfaces role / entityTypeId / entityTypeFieldId per component"
    - "emails.entitySummary batch query (per-email entity-type label+count rollup, D-23) + the pure aggregateEntitySummary helper"
    - "emails.setRole / setEntityType / setFieldRelationship / autofillFields / denyField / confirmField mutations (server-side proxy, D-15)"
    - "entityTypes.create / update / createField / updateField / deleteField / reorderFields write mutations (D-26)"
    - "shared _listener-config.ts (getListenerConfig + parseErrorDetail) reused across emails + entity-types mutations"
  affects:
    - "09-06 (glassy inbox — entity-chips consume emails.entitySummary, D-23/D-24)"
    - "09-07 (/entity-types management page drives entityTypes.create/update + field CRUD/reorder)"
    - "09-08/09-09 (canvas — use-role-mutations + use-autofill-fields hooks consume the new component mutations + detail.role/entityTypeId/entityTypeFieldId)"
tech_stack:
  added: []
  patterns:
    - "Extract-to-shared: getListenerConfig/parseErrorDetail moved out of emails/mutations.ts into router/_listener-config.ts; both the component mutations and the entity-type write mutations import the single definition (no duplication — the option PATTERNS flagged)"
    - "Server-side proxy: every mutation reads creds via getListenerConfig() at CALL time; EMAIL_LISTENER_API_KEY appears only inside _listener-config.ts, never NEXT_PUBLIC_ (T-09-30)"
    - "z.string().uuid() on every id before URL path interpolation (path-segment injection guard, T-09-31); z.enum allowlists for role + fieldType at the tRPC boundary (T-09-32, defense-in-depth with the Pydantic validators in 09-02/03)"
    - "snake_case body mapping at the proxy seam (entityTypeId -> entity_type_id, parentComponentId -> parent_component_id, fieldType -> field_type, orderedFieldIds -> ordered_field_ids, isActive -> is_active); optional keys spread only when defined"
    - "entitySummary is a single parameterized inArray() batch query keyed by the visible page of email ids (.max(100), T-09-33) — no per-row fetch; rejected/superseded entity regions excluded so denied/redrawn boxes never produce chips"
    - "Pure DB-free aggregation helper (aggregateEntitySummary) exported for unit testing, mirroring the existing groupEntityTypeRows testability pattern; immutable outputs (spread, new objects)"
    - "detail.role/entityTypeId/entityTypeFieldId are direct EmailComponents column reads — no join change (EntityTypes is still joined via the extraction record for the label/slug)"
key_files:
  created:
    - "packages/api-client/src/router/_listener-config.ts"
    - "packages/api-client/src/router/emails/entity-summary.ts"
    - "packages/api-client/src/router/entity-types-write.ts"
    - "packages/api-client/src/router/__tests__/component-relationship-mutations.test.ts"
    - "packages/api-client/src/router/__tests__/entity-summary.test.ts"
    - "packages/api-client/src/router/__tests__/entity-types-write.test.ts"
  modified:
    - "packages/api-client/src/router/emails/mutations.ts"
    - "packages/api-client/src/router/emails/detail.ts"
    - "packages/api-client/src/router/emails/index.ts"
    - "packages/api-client/src/router/entity-types.ts"
decisions:
  - "confirmField reuses the existing /confirm proxy rather than duplicating it. confirmComponent (Phase 7) already POSTs /v1/components/{id}/confirm with {corrected_fields}; per the plan's 'reuse it rather than duplicating' guidance I kept confirmComponent AND added a Phase-9-named confirmField alias (correctedFields optional/nullable) so the review loop reads symmetrically with denyField. Both call the same endpoint; no behavioural divergence."
  - "entitySummary uses the role/entityTypeId DIRECT path (the cheaper option the plan prefers now 09-01 added the columns): components with role='entity' + entity_type_id, left-joined to entity_types for the label. No traversal through extraction_records is needed for the chip rollup; rejected/superseded regions are filtered out so the chips track the live entity set."
  - "aggregateEntitySummary returns one row per REQUESTED email id (in request order), with an empty entities array for emails that have no typed entity region — so the caller can zip the result straight onto its visible page of emails without a second lookup."
  - "_listener-config.ts is prefixed with an underscore (matching the emails/index.ts internal-module convention) and is NOT a tRPC router — it exports only the two server-side helpers. The api-client package.json '.' export resolves src/index.ts -> root.ts; the helper is pulled in transitively only by the mutation modules (server-side), never by a client-importable barrel."
  - "Rebuilt packages/api-client/dist (gitignored build artifact) so apps/web typechecks/builds against the new procedure surface — Phase 6/7 hit stale-dist gaps where new procedures were missing from dist. Verified entitySummary/setFieldRelationship/reorderFields + _listener-config are present in dist before running web tsc."
metrics:
  duration: "~7m"
  completed: "2026-06-13"
---

# Phase 9 Plan 04: TypeScript Data Layer over the Relationship Backend Summary

Wired the TypeScript/tRPC data layer over the Phase-9 backends (09-01/02/03): `emails.detail` now surfaces `role` / `entityTypeId` / `entityTypeFieldId` per component; six component relationship+review mutations (`setRole`, `setEntityType`, `setFieldRelationship`, `autofillFields`, `denyField`, `confirmField`) proxy the FastAPI endpoints via the `getListenerConfig` server-side idiom; a per-email entity rollup (`emails.entitySummary`, D-23) powers the glassy-inbox chips in one batch query; and the entity-type write mutations (`entityTypes.create/update` + field `create/update/delete/reorder`, D-26) proxy `/v1/entity-types`. `getListenerConfig`/`parseErrorDetail` were extracted into a shared `_listener-config.ts` so both mutation surfaces share one definition. The browser NEVER holds `EMAIL_LISTENER_API_KEY`; every id is `z.string().uuid()` validated before URL interpolation. This is the seam the canvas (09-08/09), inbox (09-06), and entity-types page (09-07) consume.

## What Was Built

**Task 1 — shared listener config + six component mutations + detail exposure (commit `6ae641b`)**
- `router/_listener-config.ts` (new): exports `getListenerConfig()` (call-time env read, throws if `EMAIL_LISTENER_URL`/`EMAIL_LISTENER_API_KEY` unset) and `parseErrorDetail()` verbatim, moved out of `emails/mutations.ts`. `EMAIL_LISTENER_API_KEY` now lives in exactly one source file.
- `emails/mutations.ts`: removed the duplicated helper definitions, imports them from `../_listener-config`. Added `setRole` (PATCH `/role`, body `{role}` with the `entity|field|unrelated` enum, nullable), `setEntityType` (PATCH `/entity-type`, body `{entity_type_id}`), `setFieldRelationship` (PATCH `/field-relationship`, body `{parent_component_id, entity_type_field_id}`), `autofillFields` (POST `/autofill-fields`, empty body), `denyField` (POST `/deny`, empty body), and `confirmField` (POST `/confirm`, body `{corrected_fields}` — Phase-9-named alias over the existing `/confirm` proxy). Each carries `X-API-Key`; ids are uuid-validated.
- `emails/detail.ts`: added `role`, `entityTypeId`, `entityTypeFieldId` to the component `.select({})` as direct `EmailComponents` column reads (no join change).

**Task 2 — emails.entitySummary per-email entity rollup (commit `27e9255`)**
- `emails/entity-summary.ts` (new): `entitySummary` query — input `{ emailIds: z.array(z.string().uuid()).max(100) }`. Single parameterized `inArray(EmailComponents.emailId, ...)` query filtered to `role='entity'`, `extraction_status != rejected/superseded`, left-joined to `entity_types` for labels; aggregated by the pure `aggregateEntitySummary` helper to `{ emailId, entities: [{ entityTypeId, label, count }] }[]`, one row per requested id. `emailEntitySummaryProcedures` spread into `emailsRouter` in `emails/index.ts`.
- `aggregateEntitySummary(rows, requestedEmailIds)`: pure, DB-free, immutable — collapses repeated entity types into one `{ label, count }` (first-appearance order), skips rows with null type/label, emits an empty `entities` array for emails with none.

**Task 3 — entity-types write mutations (commit `be22a71`)**
- `router/entity-types-write.ts` (new): `entityTypesWriteProcedures` using the shared `getListenerConfig`/`parseErrorDetail` — `create` (POST `/v1/entity-types`), `update` (PATCH `/{id}`, snake_cased `{label?, description?, is_active?}`), `createField` (POST `/{id}/fields`), `updateField` (PATCH `/fields/{id}`, only-provided-keys snake_cased), `deleteField` (DELETE `/fields/{id}`), `reorderFields` (POST `/{id}/fields/reorder`, body `{ordered_field_ids}`). `fieldType` validated with `z.enum(["string","number","date","array","object"])`; every id uuid-validated.
- `router/entity-types.ts`: spread `entityTypesWriteProcedures` into `entityTypesRouter` (the existing `list` is preserved).

**Task 4 — vitest coverage (TDD, commit `0ca1302`)**
- `__tests__/component-relationship-mutations.test.ts` (12 tests): each of the six mutations hits the right path/method/header/snake_cased body; `role=null` and omitted `correctedFields` serialise correctly; non-2xx throws the parsed `{detail}` (and falls back to the mutation label); the env guard fires before any fetch; a non-uuid id is rejected before fetch.
- `__tests__/entity-summary.test.ts` (6 tests): `aggregateEntitySummary` collapses repeated types, yields empty entities for an entity-less email, preserves first-appearance order, skips null type/label rows, preserves requested email-id order one-per-id, and does not mutate input.
- `__tests__/entity-types-write.test.ts` (10 tests): create/update/createField/updateField/deleteField/reorderFields issue the correct requests; an out-of-allowlist `fieldType` is rejected at the Zod boundary; a non-uuid id is rejected before fetch; a 409 slug conflict surfaces the FastAPI `{detail}`; the env guard fires before any fetch.

## Verification Results

- `npm run build -w @nauta/api-client`: clean (EXIT 0). New procedures confirmed present in `dist/` (`entitySummary`, `setFieldRelationship`, `reorderFields`, `_listener-config.js`) before web typecheck.
- `npm test -w @nauta/api-client` (vitest run): **55 passed (6 files)** — including the 28 new tests (12 + 6 + 10). The three new test files all pass.
- `packages/api-client` `npx tsc --noEmit`: EXIT 0.
- `apps/web` `npx tsc --noEmit`: EXIT 0 (web typechecks against the rebuilt api-client surface).
- Security greps: `EMAIL_LISTENER_API_KEY` is read in exactly one source file (`_listener-config.ts`); no `NEXT_PUBLIC_.*API_KEY` anywhere. All ids `z.string().uuid()` validated before interpolation.

## Deviations from Plan

None — plan executed as written. One naming clarification applied within the plan's own guidance: the plan said to add `confirmField` "IF a confirm proxy is not already present... reuse it rather than duplicating." `confirmComponent` (Phase 7) already proxies `/confirm`, so `confirmField` was added as a thin Phase-9-named alias (same endpoint, `correctedFields` optional/nullable) rather than a second divergent proxy — satisfying the success-criterion naming while honouring the reuse instruction.

## TDD Gate Compliance

Task 4 is the `tdd="true"` task. The implementation procedures it covers were authored in Tasks 1–3 (committed `6ae641b`/`27e9255`/`be22a71`); the test files were then added and committed separately as `test(09-04): ...` (`0ca1302`). The vitest run was GREEN on first execution (55/55) because the procedures under test already existed — there is no behaviour the tests assert that lacks an implementation. No test passed "unexpectedly" against a missing feature: each new test exercises a procedure shipped in this same plan.

## Known Stubs

None. Every procedure issues a real fetch to a live FastAPI endpoint (09-02/03) or, for `entitySummary`, runs a real Drizzle query. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Self-Check: PASSED

Files created (all present):
- `packages/api-client/src/router/_listener-config.ts`
- `packages/api-client/src/router/emails/entity-summary.ts`
- `packages/api-client/src/router/entity-types-write.ts`
- `packages/api-client/src/router/__tests__/component-relationship-mutations.test.ts`
- `packages/api-client/src/router/__tests__/entity-summary.test.ts`
- `packages/api-client/src/router/__tests__/entity-types-write.test.ts`

Commits (all present in git log):
- `6ae641b` feat(09-04): extract listener-config + add component relationship mutations
- `27e9255` feat(09-04): add emails.entitySummary per-email entity rollup (D-23)
- `be22a71` feat(09-04): add entity-types write mutations (D-26)
- `0ca1302` test(09-04): vitest coverage for relationship mutations + entity-summary
