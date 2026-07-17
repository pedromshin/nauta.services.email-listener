# Tenancy Architecture Audit — ADR-Ready

**Author:** tenancy-arch (night-run) · **Date:** 2026-07-17 · **Scope:** READ-ONLY audit
**Question:** Personal-use product today. Does the ARCHITECTURE accommodate open-sourcing / commercial / multi-user / teams-orgs-workspaces later, *without building it now*?

**One-line verdict:** The foundation is unusually well-positioned. Single-user tenancy is already enforced for real (v1.7 Phase 44), through a **central ownership chokepoint**, with a clean **user-as-tenant** anchor. The expensive-to-reverse risks are not in what was built — they are in a handful of *conventions* that need to be written down now so future code doesn't calcify the wrong assumption (importer≠tenant, RLS-is-secondary, auth.users coupling, storage-authz-by-DB-not-path).

---

## 1. What is ALREADY multi-tenant-safe

| Area | Reality | Why it's safe |
|---|---|---|
| **Tenant anchor** | `user_id uuid` → `auth.users(id)`, `ON DELETE cascade`, `NOT NULL`, indexed, on **importers, chat_conversations, chat_cost_ledger, forwarding_addresses** (migrations 0031–0035). | One clear principal. Descendants inherit tenancy — no ambiguous second axis. |
| **Ownership chokepoint** | `packages/db/src/ownership.ts` — every `assert*` (importer, email, component, thread, conversation, forwarding-address, source-ref) is the *single* place scope is resolved. Two anchor styles: importer-join (`→ importers.user_id`) and direct-user_id. | **This is the reversibility seam.** Re-point tenancy (e.g. user→org) by editing one file, not N call sites. Guarded by `cross-tenant-adversarial.test.ts` + per-router `*-user-scoping.test.ts`. |
| **Fail-closed semantics** | `OwnershipError` gives no signal distinguishing "missing" from "not yours"; tRPC maps both → `NOT_FOUND` (`_ownership.ts`), attachment route → 404, chat-SSE → pre-stream 404. | No existence oracle / IDOR enumeration. |
| **tRPC identity** | `protectedProcedure` requires `ctx.user`; identity is server-verified via `supabase.auth.getUser()` in the route handler, **never** from client input. `api-client` stays Supabase-free (`SessionUser` shape). | Acting identity can't be spoofed by request body. |
| **FastAPI identity** | `X-User-Id` trusted **only** because FastAPI is reachable server-to-server behind `require_api_key`; header is computed by the trusted BFF from a verified session. `require_user_id` guards presence; ownership lives in the repo layer. | Two-tier trust boundary is explicit and documented. |
| **Storage authz** | Single private bucket `email-attachments`; download only via server-minted **signed URL (3600s)** *after* `assertImporterOwnership`. Service-role key never leaves the server. | Authz is by DB ownership join, **not** by path guessing. |
| **ID strategy** | UUIDv4 random PKs everywhere (`defaultRandom`); deterministic uuid5 only for idempotent attachment ids. | No sequential enumeration; globally unique → mergeable/sharable across future tenants. |
| **Per-user metering seam** | `chat_cost_ledger` carries `user_id` directly at write time. | Billing attribution already captured — aggregate up later. |
| **Secrets** | `@t3-oss/env-core` + Zod validate env at the boundary; runtime missing-secret guards (attachment route 500s cleanly). No hardcoded secrets found. | Startup/boundary validation matches the guardrail. |
| **Deliberate non-scoping** | `genui_generation_events`, `ui_spec_templates` intentionally have no `user_id` — exact-match **cache** tables where cross-tenant hits are the *intended* behavior (documented in schema + PROJECT.md). | Correctly reasoned, not a gap. |

**Importer clarification (load-bearing):** `importer` is **NOT** the tenant. `ImporterResolver.list_importer_ids_for_user` returns a *list* — a user owns *many* importers (one per forwarding sender-domain). Importer is a sub-user grouping; `auth.users` is the tenant. This is already the settled model but is the single easiest thing for a future contributor to get wrong.

---

## 2. The 5 decisions EXPENSIVE to reverse (each: default + cheap accommodate-now)

### D1 — Tenant granularity: individual user vs organization/workspace
Every scoped table FKs `auth.users(id)` directly. Retrofitting orgs later means either re-pointing every FK or threading a new axis through all queries.
- **Recommended default:** Ship **user-as-tenant**. Introduce orgs later as a `memberships(user_id, account_id, role)` table + an `account_id` indirection, resolved *inside* `ownership.ts`.
- **Cheap accommodate-now (ADR, not code):** (a) Mandate that **all** scope resolution flows through `ownership.ts` — forbid inline `auth.uid()`/`user_id =` joins in new routers (the chokepoint is the seam; protect it). (b) Adopt the vocabulary "**owner principal**" for `user_id` in docs so a future `accounts` table slots in without a rename. *Do not add `account_id` columns yet* — the chokepoint makes that a later, mechanical migration.

### D2 — RLS as defense-in-depth vs primary enforcement
Both real query paths **bypass RLS today**: Drizzle connects as the Postgres **superuser** (`POSTGRES_URL_NON_POOLING`, port 5432), FastAPI uses **service_role**. RLS policies (auth.uid()-scoped, 13 tables) exist but never execute for app traffic. Promoting RLS to primary later requires a non-superuser role + per-request `set_config('request.jwt.claims'…)` on every connection — a deep plumbing change.
- **Recommended default:** Keep **app-boundary as primary** (it is the enforced, adversarially-tested wall). Keep RLS current as a live second wall — never let it rot into dead policies.
- **Cheap accommodate-now (ADR + convention):** The bypass is already documented in `0034_rls_user_scoping.sql`'s header — promote that to a standing ADR. Add a rule: **every new user-owned table ships BOTH a `deny_all_<t>_anon` (RESTRICTIVE) and an `<t>_owner_authenticated` (PERMISSIVE, auth.uid()) policy in the same migration.** That keeps RLS promotable to primary with zero backfill. Don't build the non-superuser connection path now.

### D3 — Importer as a scoping unit (importer ≠ tenant)
The costliest *silent* mistake available: a future feature treats `importer` as the org/tenant and builds sharing/billing on it. Because importers are per-sender-domain and many-per-user, that would need a painful untangling later.
- **Recommended default:** Keep importer as an intra-user grouping. Tenancy is `user_id`, always resolved via the importer→user join for importer-anchored tables.
- **Cheap accommodate-now (ADR):** One paragraph: "`importer` is a per-sender sub-grouping owned by a user; it is never the tenant boundary. New tenant features anchor on the owner principal, not importer_id." Prevents a multi-week future migration.

### D4 — Storage layout & authz model
Single bucket, keys `{importer_id}/{email_id}/{attachment_id}/{filename}`. Fine today, but two things would be expensive if assumed wrong later: (a) per-tenant buckets / lifecycle / residency require moving objects; (b) any code that authorizes by *path prefix* instead of DB ownership.
- **Recommended default:** Keep **one private bucket + path prefix + signed URLs**. `importer_id` prefix is stable (never reassigned across users), so it is a safe partition key.
- **Cheap accommodate-now (ADR):** Record two invariants: (1) **storage keys are opaque; authorization is ALWAYS a DB ownership assert, never path parsing** (already true — lock it in). (2) New buckets/keys prepend a stable owner-derived prefix so a future per-tenant bucket move is a prefix copy. No code change.

### D5 — Auth provider coupling (Supabase `auth.users`)
Every tenant FK is a **cross-schema** reference to `auth.users(id)`, a Supabase-managed table. Migrating off Supabase Auth (or open-sourcing for self-hosters who use another IdP) means re-pointing every FK.
- **Recommended default:** Accept Supabase Auth for launch.
- **Cheap accommodate-now (genuinely worth doing — the one place code may be warranted):** Add a `public.profiles` / `public.users` mirror table (id = `auth.users.id`, populated by a trigger — the standard Supabase pattern) and let *new* app FKs point at the **public** schema you own. This decouples the app from the auth vendor at near-zero cost and is the canonical Supabase approach. If not adopted, at minimum an ADR recording the coupling. (Existing FKs can stay; this is about the seam for future tables.)

### D6 (bonus) — Billing/metering attribution
`chat_cost_ledger` already writes `user_id` at event time — the hard part (attribution-at-write) is done. The reversible-only-expensively part is *forgetting to attribute new billable events*.
- **Recommended default:** Per-user metering now; aggregate user→org when orgs land.
- **Cheap accommodate-now (ADR):** "Every metered/billable event row carries the owner principal at creation." Don't build plans/quotas/subscriptions.

---

## 3. What to explicitly NOT build yet

- **Organizations / teams / workspaces tables**, memberships, invitations, seat management.
- **RBAC / roles / permission matrix** — user-as-owner is binary and sufficient.
- **Non-superuser DB role + RLS-as-primary** connection plumbing (`set_config` JWT claims per request).
- **Per-tenant storage buckets**, per-tenant encryption keys, data-residency partitioning.
- **Billing engine** — subscriptions, plans, quotas, usage limits, Stripe integration. (Keep only the per-user ledger already present.)
- **Row-level sharing / collaboration** (shared canvases, shared threads across users).
- **Audit-log tables**, SSO/SAML/SCIM, org-level SSO.
- **Cross-tenant admin / impersonation** tooling.

**Rationale:** none of these are blocked by the current schema. Each becomes a mechanical, chokepoint-localized migration *if* the six conventions in §2 are written down now. Building any of them today adds surface area with no personal-use payoff.

---

## Appendix — Evidence map
- Anchor + FKs: `packages/db/migrations/0031_add_user_id_columns.sql`, `0033_user_id_not_null.sql`; `packages/db/src/schema/{importers,forwarding-addresses}.ts`
- Chokepoint: `packages/db/src/ownership.ts` (all `assert*`, `OwnershipError`, `assertSourceRefOwnership`)
- tRPC: `packages/api-client/src/trpc.ts` (`protectedProcedure`); `_scope.ts`, `_ownership.ts`
- FastAPI trust: `apps/email-listener/app/presentation/middleware/user_context.py`
- RLS + bypass: `packages/db/migrations/0034_rls_user_scoping.sql` (header documents both bypasses); `packages/db/src/client.ts` (superuser session conn)
- Storage: `apps/web/src/app/api/attachments/[id]/route.ts`; `apps/email-listener/app/infrastructure/supabase/attachment_storage.py`; key layout in `ingest_inbound_email.py:245`
- Importer≠tenant: `apps/email-listener/app/domain/ports/importer_resolver.py` (`list_importer_ids_for_user` returns list)
- Cache-table non-scoping + decisions: `.planning/PROJECT.md` (v1.7 Phase 44 rows)
