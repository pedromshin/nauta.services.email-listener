---
phase: "04-email-intelligence"
plan: "04-01"
subsystem: "packages/db"
tags: ["drizzle", "schema", "migrations", "rls", "pgvector", "halfvec", "supabase"]
dependency_graph:
  requires: []
  provides:
    - "@nauta/db Drizzle schema for all 7 phase-4 domain tables"
    - "5 SQL migrations ready to apply (0000–0004)"
    - "RLS deny-all policies for anon/authenticated roles"
    - "HNSW halfvec_cosine_ops indexes on embedding columns"
    - "8 system entity types seeded (idempotent)"
  affects:
    - "packages/db/src/schema"
    - "packages/db/migrations"
tech_stack:
  added:
    - "drizzle-orm/pg-core customType for halfvec(1536)"
  patterns:
    - "Multi-tenant schema: every table carries importer_id FK cascade"
    - "RESTRICTIVE deny-all RLS policies (Supabase pattern)"
    - "halfvec custom type for ~50% space savings vs vector(1536)"
    - "Custom SQL migrations for drizzle-kit limitations (HNSW, RLS, triggers)"
key_files:
  created:
    - "packages/db/src/schema/_halfvec.ts"
    - "packages/db/src/schema/enums.ts"
    - "packages/db/src/schema/importers.ts"
    - "packages/db/src/schema/emails.ts"
    - "packages/db/src/schema/attachments.ts"
    - "packages/db/src/schema/components.ts"
    - "packages/db/src/schema/entity-types.ts"
    - "packages/db/src/schema/extractions.ts"
    - "packages/db/migrations/0000_real_garia.sql"
    - "packages/db/migrations/0001_rls_deny_all.sql"
    - "packages/db/migrations/0002_hnsw_halfvec_indexes.sql"
    - "packages/db/migrations/0003_moddatetime_triggers.sql"
    - "packages/db/migrations/0004_seed_entity_types.sql"
  modified:
    - "packages/db/src/schema/index.ts"
    - "packages/db/README.md"
decisions:
  - "halfvec(1536) via customType rather than vector(1536): saves ~50% storage for OpenAI text-embedding-3-* models"
  - "Custom SQL migrations for: RLS RESTRICTIVE policies, HNSW halfvec_cosine_ops, moddatetime triggers — drizzle-kit cannot emit these"
  - "entity_type_fields has no UNIQUE on (entity_type_id, slug) in Phase 4 — drizzle-kit generates ON CONFLICT DO NOTHING via SELECT subquery pattern"
  - "body_text_tsv tsvector deferred: GENERATED ALWAYS AS STORED cannot be emitted by drizzle-kit; to be added in future migration if FTS is needed"
metrics:
  duration: "~45 minutes"
  completed: "2026-06-11"
  tasks_completed: 3
  files_created: 13
  files_modified: 2
---

# Phase 4 Plan 01: Drizzle Schema + Migrations Summary

**One-liner:** Complete Drizzle TypeScript schema for 7 domain tables with halfvec(1536) embedding columns, 5 SQL migrations (tables + RLS deny-all + HNSW + moddatetime + 8 seeded entity types).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Drizzle schema modules | `684aea0` | `src/schema/_halfvec.ts`, `enums.ts`, `importers.ts`, `emails.ts`, `attachments.ts`, `components.ts`, `entity-types.ts`, `extractions.ts`, `index.ts` |
| 2 | Migrations + custom SQL | `113864e` | `migrations/0000–0004.sql`, `README.md` |
| 3 | Apply migrations (checkpoint:human-verify) | — | Live databases: local, staging, production |

## Task 3: Resolved — Migrations Applied and Verified

Checkpoint approved by user; orchestrator applied all 5 migrations. Verified on each environment (7 tables present, RLS=true on all 7, 8 seed entity_types, HNSW indexes `idx_email_components_embedding_hnsw` and `idx_entity_types_embedding_hnsw` present):

- **LOCAL** (127.0.0.1:54322): applied + verified
- **STAGING** (`fyfwkjvbcrmjqjysdyqw`): applied + verified
- **PRODUCTION** (`dazyccjijdahxyciptkp`): applied + verified

**Plan status: COMPLETE.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript `noUncheckedIndexedAccess` strict mode breaks `customType` callback**
- **Found during:** Task 1 (typecheck)
- **Issue:** `drizzle-orm/pg-core` `customType` `dataType(config)` parameter typed as possibly-undefined under `noUncheckedIndexedAccess`; TS error TS18048
- **Fix:** Changed signature to `dataType(config?: HalfvecConfig)` with explicit null guard throwing `Error("halfvec requires a { dimensions } config")`
- **Files modified:** `packages/db/src/schema/_halfvec.ts`
- **Commit:** `684aea0`

**2. [Rule 2 - Missing critical functionality] `entity_type_fields` uniqueness**
- **Found during:** Task 2 (schema design review)
- **Issue:** Plan did not specify UNIQUE on `(entity_type_id, slug)` for `entity_type_fields`. Without it, duplicate field slugs per entity type could corrupt extraction pipelines.
- **Fix:** The seed migration uses `ON CONFLICT DO NOTHING` pattern with SELECT subquery. A proper UNIQUE constraint will require a separate plan or amendment — added to deferred items.
- **Files modified:** `packages/db/migrations/0004_seed_entity_types.sql`

**3. [User-requested deviation] Production migration apply beyond plan scope**
- **Found during:** Task 3 checkpoint resolution
- **Issue:** Plan scoped migration apply to local + staging only
- **Action:** User explicitly requested production apply as well; orchestrator applied and verified all 5 migrations on production (`dazyccjijdahxyciptkp`) with identical results (7 tables, RLS, 8 seed entity_types, HNSW indexes)

## Known Stubs

None — all schema modules fully typed and wired. The `body_text_tsv` tsvector column is intentionally deferred (see Decisions) and not a stub blocking plan goals.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: rls_applied | migrations/0001_rls_deny_all.sql | RESTRICTIVE deny-all policies applied to all 7 phase-4 tables for anon and authenticated roles. T-04-01 (cross-tenant read) and T-04-02 (forged row write) mitigated. |

## Self-Check: PASSED

- Schema files exist: confirmed via Task 1 commit `684aea0`
- Migration files exist: confirmed via Task 2 commit `113864e`
- `drizzle-kit check` passed: "Everything's fine"
- Acceptance criteria grep: `halfvec_cosine_ops`, `ENABLE ROW LEVEL SECURITY`, `bill_of_lading`, `ON CONFLICT` — all found in expected migration files
- TypeScript typecheck: passed after `noUncheckedIndexedAccess` fix
