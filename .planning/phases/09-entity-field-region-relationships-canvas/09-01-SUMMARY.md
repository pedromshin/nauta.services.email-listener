---
phase: 09-entity-field-region-relationships-canvas
plan: 01
subsystem: data-layer
tags: [drizzle, migration, schema, postgres, relationship-model]
dependency_graph:
  requires: []
  provides:
    - "componentRoleEnum pgEnum (component_role = entity|field|unrelated)"
    - "email_components.role column (nullable, NULL = unclassified)"
    - "email_components.entity_type_id FK -> entity_types.id (ON DELETE SET NULL)"
    - "email_components.entity_type_field_id FK -> entity_type_fields.id (ON DELETE SET NULL)"
    - "idx_email_components_role + idx_email_components_entity_type_id"
    - "migration 0013_fixed_jamie_braddock applied to local Postgres"
  affects:
    - "09-02 (autofill-fields backend reads role/entity_type_id)"
    - "09-03 (entity-type delete-guard relies on SET NULL FKs)"
    - "09-04 (emails/detail.ts exposes role/entity_type_id/entity_type_field_id)"
    - "every canvas/inbox surface reading the new columns"
tech_stack:
  added: []
  patterns:
    - "Drizzle nullable declared-FK column (onDelete: set null) per 09-PATTERNS §5"
    - "Scoped + idempotent custom migration (IF NOT EXISTS) mirroring 0010/0011/0012"
key_files:
  created:
    - "packages/db/migrations/0013_fixed_jamie_braddock.sql"
    - "packages/db/migrations/meta/0013_snapshot.json"
  modified:
    - "packages/db/src/schema/enums.ts"
    - "packages/db/src/schema/components.ts"
    - "packages/db/migrations/meta/_journal.json"
decisions:
  - "0013 scoped to the Phase 9 change only: drizzle-kit re-emitted drift statements (region/pending/error enum values + extraction_records.confidence_breakdown/routing_reason) from the un-snapshotted custom migrations 0010/0011/0012 — these were removed and IF NOT EXISTS guards added (the values/columns already exist live)."
  - "role column is nullable (no .notNull()): NULL = unclassified/standalone per D-01/D-02; 'unclassified' is intentionally NOT an enum value."
  - "entity_type_id/entity_type_field_id use declared FKs with onDelete: set null (D-03/D-04): deleting a referenced entity-type/field nulls the component link rather than cascade-deleting components."
metrics:
  duration: "~4m"
  completed: "2026-06-13"
---

# Phase 9 Plan 01: Relationship Model Migration Summary

Added the `component_role` pgEnum plus three nullable relationship columns (`role`, `entity_type_id`, `entity_type_field_id`) and two indexes to `email_components`, then generated and applied migration `0013` to local Postgres — the blocking data-layer foundation for the whole phase (D-01..D-05).

## What Was Built

**Task 1 — Drizzle schema (commit `e1c5cc5`)**
- `enums.ts`: new `componentRoleEnum = pgEnum("component_role", ["entity","field","unrelated"])`. NULL on the `role` column represents the unclassified state; "unclassified" is deliberately not an enum value (manual override always wins, D-01/D-02).
- `components.ts`:
  - imported `componentRoleEnum` from `./enums` and `EntityTypes, EntityTypeFields` from `./entity-types`.
  - three nullable columns added immediately after `extractionStatus`:
    - `role: componentRoleEnum("role")` — nullable (D-01/D-02).
    - `entityTypeId: uuid("entity_type_id").references(() => EntityTypes.id, { onDelete: "set null" })` (D-03).
    - `entityTypeFieldId: uuid("entity_type_field_id").references(() => EntityTypeFields.id, { onDelete: "set null" })` (D-04).
  - two indexes added: `idx_email_components_role` (on `role`), `idx_email_components_entity_type_id` (on `entity_type_id`).
  - `parentComponentId` left as the existing plain self-ref uuid (Claude's Discretion: not promoted now).
  - inferred types `EmailComponentRow`/`InsertEmailComponent` pick up the new columns automatically — no extra exports.
- Verification: `cd packages/db && npx tsc --noEmit` exits 0.

**Task 2 — Migration generated AND applied (commit `c8a1463`)**
- `npm run migration:generate` produced `packages/db/migrations/0013_fixed_jamie_braddock.sql` (drizzle-kit `out: "./migrations"`, confirmed via drizzle.config.ts — NOT `src/migrations/`).
- `npm run migrate:local` applied it to local Postgres: `Migrations completed in 34ms (12 tables)`, exit 0.
- Live verification (information_schema + pg_type + pg_indexes + pg_constraint):
  ```
  === email_components columns ===
  entity_type_field_id | uuid | nullable=YES
  entity_type_id       | uuid | nullable=YES
  role                 | USER-DEFINED | nullable=YES
  row_count=3
  === component_role enum ===
  component_role: entity
  component_role: field
  component_role: unrelated
  enum_label_count=3
  === indexes ===
  idx_email_components_entity_type_id
  idx_email_components_role
  index_count=2
  === FK constraints (confdeltype n=SET NULL) ===
  email_components_entity_type_field_id_entity_type_fields_id_fk | confdeltype=n
  email_components_entity_type_id_entity_types_id_fk            | confdeltype=n
  fk_count=2
  ```
  All four checks pass: 3 columns, 3 enum labels, 2 indexes, 2 FKs with `confdeltype=n` (SET NULL).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Pre-existing drizzle-kit migration-journal drift**
- **Found during:** Task 2 (`migration:generate`).
- **Issue:** The generated `0013` SQL re-emitted statements from prior **custom** migrations that were never captured in the drizzle-kit `meta/` snapshot: `ALTER TYPE component_source_type ADD VALUE 'region'`, `ALTER TYPE extraction_status ADD VALUE 'pending'/'error'` (from custom 0010/0012), and `ALTER TABLE extraction_records ADD COLUMN confidence_breakdown/routing_reason` (from custom 0011). Those enum values and columns already exist live; re-adding them (and `ALTER TYPE ... ADD VALUE` running inside the migrator's transaction) would have made `migrate:local` fail for reasons unrelated to this plan, and would not have been a scoped, "no destructive drops" Phase 9 migration.
- **Fix:** Scoped `0013` to the Phase 9 change only — removed the four drift statements and added `IF NOT EXISTS` guards to the `ADD COLUMN`/`CREATE INDEX` statements (mirroring the idempotent pattern used by the prior custom migrations 0010/0011/0012). `CREATE TYPE component_role` and the two `ADD CONSTRAINT` statements are unguarded because they are genuinely new (Postgres has no `IF NOT EXISTS` for those). A header comment documents the rationale.
- **Files modified:** `packages/db/migrations/0013_fixed_jamie_braddock.sql`.
- **Commit:** `c8a1463`.

**2. [Correction applied] Migration path**
- The plan frontmatter/tasks referenced `packages/db/src/migrations/`, but `drizzle.config.ts` has `out: "./migrations"` and `src/migrate.ts` uses `migrationsFolder: "migrations"`. The migration was correctly generated/applied under `packages/db/migrations/` (latest prior file `0012_*`, new file `0013_*`). No code change needed — this was a path correction in the briefing, not a deviation in the artifact.

## Pending Deploy Follow-up (human/deploy action)

The migration is applied **locally only**. Before/with the next deploy of the web + listener that reads these columns, run from `packages/db`:
- `npm run migrate:staging` (applies `0013` to staging Supabase)
- `npm run migrate:prod` (applies `0013` to production Supabase)

`0013` is idempotent (`IF NOT EXISTS` on columns/indexes); `CREATE TYPE component_role` is new in all environments. Tracked alongside the still-open Phase-4 deploy follow-ups in STATE.md.

## Authentication Gates

None. Local DB credentials in repo-root `.env.local` were present, so the Task 2 blocking checkpoint resolved automatically without escalation.

## Known Stubs

None. Schema columns are live and queryable; downstream plans (09-02..09-04) consume them.

## Self-Check: PASSED

- `packages/db/migrations/0013_fixed_jamie_braddock.sql` — FOUND
- `packages/db/migrations/meta/0013_snapshot.json` — FOUND
- `packages/db/src/schema/enums.ts` (componentRoleEnum) — FOUND
- `packages/db/src/schema/components.ts` (role/entity_type_id/entity_type_field_id + indexes) — FOUND
- Commit `e1c5cc5` (Task 1) — FOUND
- Commit `c8a1463` (Task 2) — FOUND
- Live DB: 3 columns + component_role enum (3 labels) + 2 indexes + 2 SET NULL FKs — VERIFIED
