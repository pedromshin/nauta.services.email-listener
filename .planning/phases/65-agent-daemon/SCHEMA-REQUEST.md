# SCHEMA-REQUEST — Phase 65 (Lane C, the daemon)

**Status: REQUEST ONLY. No migration was generated, no drizzle-kit was run** (LANE-CONTRACTS.md
§Migrations queue — journal collisions destroyed work in v1.6). The orchestrator generates
migrations sequentially at merge.

**Nothing in Phase 65's slice depends on these tables.** The daemon's runtime source of truth is
the FILE store (`<stateDir>/allowlist.json` + `audit.jsonl`), which is deliberate: the daemon must
boot and enforce permissions with no database, no network, and no web app running. These tables
are for the future web-facing allowlist panel and the cross-device audit view.

---

## 1. `daemon_capabilities` — the registry table (65-CONTEXT.md: "registry table = SCHEMA-REQUEST only")

Mirrors the capability registry (`apps/daemon/src/tools/registry.ts`) into the DB so the web app
can render "what can this daemon do?" without dialing the daemon.

**Note (D2/INV-2/INV-3):** this table's columns are deliberately the frozen descriptor field
names. When `packages/capabilities` lands (Phase 68), this table is the persistence side of the
SAME registry — it should not be re-modelled.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK default gen | surrogate key |
| `user_id` | `uuid` NOT NULL | tenancy (LANE-CONTRACTS.md §6 — standard ownership column) |
| `capability_id` | `text` NOT NULL | the REGISTRY id (`fs.read`, `terminal.exec`, …) — the resolution key |
| `describe` | `text` NOT NULL | human/LLM-readable purpose |
| `risk` | `text` NOT NULL | enum: `read` \| `write` \| `exec` |
| `cost` | `text` NOT NULL | enum: `free` \| `cheap` \| `moderate` \| `expensive` |
| `source` | `text` NOT NULL | enum: `builtin` \| `external` (INV-3) |
| `trust` | `text` NOT NULL | enum: `first-party` \| `verified` \| `claimed` \| `unvetted` (INV-3) |
| `input_schema` | `jsonb` NOT NULL | zod→JSON-Schema projection |
| `output_schema` | `jsonb` NOT NULL | zod→JSON-Schema projection |
| `created_at` | `timestamptz` NOT NULL default now() | |
| `updated_at` | `timestamptz` NOT NULL default now() | |

Indexes: unique `(user_id, capability_id)`; index on `(user_id, source)`.

## 2. `daemon_permission_rules` — the allowlist, mirrored

The FILE remains authoritative at runtime. This table exists so the web app can show and revoke
grants. **A row here must never be treated as authority by the daemon** — sync is file → DB.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | matches `PermissionRule.id` |
| `user_id` | `uuid` NOT NULL | tenancy |
| `capability_id` | `text` NOT NULL | INV-2: keyed on the registry id |
| `risk` | `text` NOT NULL | `read` \| `write` \| `exec` |
| `scope` | `text` NOT NULL | canonical path prefix, or executable basename for `terminal.exec` |
| `decision` | `text` NOT NULL | `allow` \| `deny` — deny beats allow at match time |
| `origin` | `text` NOT NULL | `perm.decision` \| `seed` \| `cli` |
| `created_at` | `timestamptz` NOT NULL default now() | |
| `revoked_at` | `timestamptz` NULL | soft revoke, so a grant's history survives |

Indexes: index `(user_id, capability_id)`; index `(user_id, revoked_at)`.

## 3. `daemon_audit_events` — the audit trail, mirrored

Append-only. Mirrors `audit.jsonl`.

**Redaction is structural and MUST be preserved here:** there is no content column, and `meta` is
numbers/booleans only. Do not add a `stdout`/`content`/`args` column — the file-side type makes
leaking impossible by construction, and this table should keep that property.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL | tenancy |
| `ts` | `timestamptz` NOT NULL | |
| `event` | `text` NOT NULL | `decision` \| `execution` |
| `capability_id` | `text` NOT NULL | |
| `scope` | `text` NOT NULL | |
| `verdict` | `text` NULL | `allow` \| `deny` |
| `code` | `text` NULL | the deny code |
| `meta` | `jsonb` NULL | numbers/booleans ONLY — never contents, never the token |

Indexes: index `(user_id, ts desc)`; index `(user_id, capability_id, ts desc)`.

---

## Tenancy note

Every table carries `user_id` per LANE-CONTRACTS.md §6. `importer_id` is NOT applicable — daemon
capabilities are user-scoped machine access, not content-scoped email data.

## Deliberately NOT requested

- No table for sessions (Lane E / phase 67 will request what it needs).
- No table for the daemon's config: the config is a local file naming local paths, and moving it
  to a shared DB would let a remote row change what the daemon may touch — the exact inversion the
  permission model exists to prevent.
