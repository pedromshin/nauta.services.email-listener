# @polytoken/db — Drizzle ORM Schema & Migrations

Application-level database package: Drizzle schema is the single source of truth;
migrations are generated and applied through drizzle-kit/tsx. The root `/supabase`
folder is system config only (local stack via `config.toml`, bootstrap migrations).

## Layout

```
src/
├── schema/      → Table definitions (one dir per domain, barrel-exported)
├── client.ts    → Env validation + Drizzle client factory
├── migrate.ts   → Migration runner (ensures vector/uuid-ossp/pg_trgm extensions)
└── index.ts     → Barrel export
drizzle.config.ts → drizzle-kit config (schema → ./migrations)
migrations/       → Generated SQL migrations + journal (committed)
```

## Environments

| Env     | Project       | Ref                    | Env file (repo root) |
| ------- | ------------- | ---------------------- | -------------------- |
| local   | Docker stack  | —                      | `.env.local`         |
| staging | nauta-staging | `fyfwkjvbcrmjqjysdyqw` | `.env.staging`       |
| prod    | nauta-prod    | `dazyccjijdahxyciptkp` | `.env.production`    |

Hosted projects: `pkms-vercel` org, `sa-east-1`, Postgres 17. See `.env.example`
for connection string templates (drizzle uses `POSTGRES_URL_NON_POOLING`).

## Commands (from repo root)

```bash
npm run sb:start            # start local Supabase stack (API 54321, DB 54322, Studio 54323)
npm run sb:reset            # reset local DB (re-applies supabase bootstrap migrations)
npm run db:generate         # drizzle-kit generate (schema diff → migrations/)
npm run db:migrate          # apply migrations to local
npm run db:migrate:staging  # apply migrations to nauta-staging
npm run db:migrate:prod     # apply migrations to nauta-prod
npm run db:studio           # Drizzle Studio UI
npm run db:check            # drizzle-kit check (migration integrity)
```

## Migration Order (Phase 4)

Phase 4 introduced 5 migrations. They must be applied in journal order:

| Migration | Type | Contents |
| --------- | ---- | -------- |
| `0000_real_garia.sql` | drizzle-kit generated | Enums + all 7 domain tables + FKs + btree indexes |
| `0001_rls_deny_all.sql` | custom | `ENABLE ROW LEVEL SECURITY` + RESTRICTIVE deny-all policies for anon/authenticated on all 7 tables |
| `0002_hnsw_halfvec_indexes.sql` | custom | HNSW `halfvec_cosine_ops` indexes on `email_components.embedding` and `entity_types.embedding` |
| `0003_moddatetime_triggers.sql` | custom | `moddatetime` extension + BEFORE UPDATE triggers on `extraction_records.updated_at` and `email_components.updated_at` |
| `0004_seed_entity_types.sql` | custom | 8 system entity types (importer_id NULL) + fields, idempotent via `ON CONFLICT DO NOTHING` |

Custom migrations were required because drizzle-kit cannot emit `halfvec_cosine_ops`, `RESTRICTIVE` RLS policies, moddatetime triggers, or `GENERATED ALWAYS AS STORED` columns.

## Conventions (mirrors examples/acme-os-dev/packages/db)

- One schema directory per domain entity, re-exported from `src/schema/index.ts`
- All tables get RLS policies; pgvector columns use `halfvec(1536)` for this project
- Additive-only changes to existing tables; never delete columns without a migration plan
- Migration journal in `migrations/` must stay sequential — no gaps
- Test against local stack before `migrate:staging`; staging before `migrate:prod`
- Python services access via Supabase client — Drizzle is the schema source of truth

## Supabase CLI (system-level, runs from repo root)

- Linked ref: `fyfwkjvbcrmjqjysdyqw` (staging). Prod operations always pass
  `--project-ref dazyccjijdahxyciptkp` explicitly.
- CLI auth: `npx supabase login --token <personal-access-token>`
