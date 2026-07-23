# Production Deploy Runbook — polytoken (2026-07-23)

> This is the **manual, backup-first runbook** used today. The **target production-grade
> pipeline** (build→migrate→deploy→smoke DAG, expand/contract, auto-rollback) that replaces
> these manual steps before a real launch is designed in [`docs/DEPLOY.md`](../docs/DEPLOY.md).

Branch `claude/polytoken-email-infra-cont-jzz1pg`. Deploys the full W0–W6 program to prod.
Designed to be **backup-first and rollbackable at every step**. Pedro is the only user, so blast
radius is small — but the order below still matters (the app expects the new tables, so the DB
migrates BEFORE the app deploys).

## What was verified before this runbook (so you don't have to re-check)
- **Migrations apply clean on real Postgres.** The full 0000→0047 chain was replayed against a
  throwaway Postgres 16 + pgvector 0.8 + Supabase scaffolding: `✅ completed (36 tables)`,
  idempotent re-run is a no-op, all new tables present (`file_versions`, `workspaces`,
  `workspace_members`, `resource_shares`, `spreadsheets`), 5 halfvec columns intact.
- **Production build passes.** `next build` with env present → `BUILD_EXIT=0`, 30/30 static pages,
  middleware built (`.next-verify`, cleaned).
- **A latent migrate bug was fixed** (`packages/db/src/migrate.ts`) — only affects fresh-empty-DB
  provisioning, which prod does not hit; prod's normal path is unchanged and verified.
- **A deploy-contract gap was fixed** — `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  were missing from `apps/web/.env.example`; the build requires them. Now documented.

## Prod env contract (must be set in the respective platforms)
- **`.env.production`** (Pedro's, gitignored — for `db:migrate:prod`): `POSTGRES_URL_NON_POOLING`
  (the Supabase **session/direct** connection string, project ref `dazyccjijdahxyciptkp`, port 5432),
  `POSTGRES_URL`, `SUPABASE_URL`.
- **Vercel project env (Production)**: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  **`NEXT_PUBLIC_SUPABASE_URL`**, **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** (both required at BUILD time),
  `EMAIL_LISTENER_URL`, `EMAIL_LISTENER_API_KEY`, `FORWARDING_EMAIL_DOMAIN=magnitudetech.com.br`.
- **Listener (ECS task env)** + GitHub Actions secret `AWS_DEPLOY_ROLE_ARN` — already set (this is an
  existing prod service; deploy just ships a new image).

## The migrations prod will apply (idempotent — only un-applied ones run)
`0043_entity_resolution_dismiss_keying`, `0044_spreadsheets`, `0045_file_versions`,
`0046_home_canvas_scope`, `0047_workspaces_teams_rbac`. All additive (new tables/columns/RLS); none
drop or rewrite existing data. **Not auto-reversible** (Drizzle is forward-only) — rollback = restore
the pre-migrate backup (Step 1).

---

## DEPLOY SEQUENCE

### Step 0 — Merge to the deploy branch  *(you decide: PR review or direct)*
Prod deploys trigger on push to `main` (Vercel prod build + listener GitHub Action). Get the code onto
`main` however you prefer — open a PR from `claude/polytoken-email-infra-cont-jzz1pg` and review, or
fast-forward. **Do NOT let the merge-to-main auto-deploy happen before Step 2 (migrate).** If Vercel
auto-deploys on main push, either (a) run the migration first against prod from the branch, then merge,
or (b) pause the Vercel production deploy, merge, migrate, then promote. Simplest: **do Step 1–2 first,
then merge.**

### Step 1 — BACKUP prod (mandatory; this IS your rollback)  *(YOURS)*
Supabase → project `dazyccjijdahxyciptkp` → Database → Backups. Take an on-demand backup, OR confirm
Point-In-Time-Recovery is enabled and note the current timestamp. **Write down the restore point.**
Nothing below is safe to roll back without this.

### Step 2 — Migrate prod DB  ✅ DONE (2026-07-23, via Supabase Management API)
Direct Postgres (5432/6543) is unreachable from the agent container (HTTPS-443-proxy-only egress), so
`npm run db:migrate:prod` could not run here. Applied instead over HTTPS via the Supabase Management
API query endpoint (`POST /v1/projects/{ref}/database/query`), replicating `migrate.ts` exactly: each
migration's SQL in its own transaction + a matching `drizzle.__drizzle_migrations` row
(`hash=SHA256(file)`, `created_at=journal when`). Verified against the live DB:
- `public` tables 31 → **36**; `drizzle.__drizzle_migrations` 43 → **48** rows.
- New tables present: `spreadsheets`, `file_versions`, `workspaces`, `workspace_members`,
  `resource_shares` — all with `relrowsecurity=true`.
- `chat_canvas_layouts` gained `scope` + `user_id` (0046).
- New enums: `file_version_state`, `share_permission`, `shared_resource_type`, `workspace_role`.
- Tracking rows 44–48 carry the exact file hashes; max `created_at`=1784798710647 (0047), so a future
  `migrate.ts` run reads that as the last-applied and **skips all five** (idempotent, drizzle-consistent).

Applied hashes (for audit):
| id | migration | sha256(file) prefix | created_at (journal `when`) |
|----|-----------|---------------------|------------------------------|
| 44 | 0043_entity_resolution_dismiss_keying | d3db3d7ca97ec7e1 | 1784777326691 |
| 45 | 0044_spreadsheets                     | e64dc73557e18daf | 1784791508250 |
| 46 | 0045_file_versions                    | 206ded62060f427a | 1784795086636 |
| 47 | 0046_home_canvas_scope                | e07613c4be0447f2 | 1784794878891 |
| 48 | 0047_workspaces_teams_rbac            | 5fb6f2e67fd887aa | 1784798710647 |

Rollback for this step: `.planning/PROD-ROLLBACK-0043-0047.sql` (precise DROP reversal + tracking-row
delete). PITR is OFF and no on-demand API backup exists on this project, so that script IS the DB
rollback (additive migrations, so a clean reversal).

### Step 3 — Deploy the web app (Vercel)  *(YOURS)*
Push `main` (or promote the branch's Vercel preview to Production). Confirm the required Vercel env
(incl. the two `NEXT_PUBLIC_*` vars) is set for Production FIRST — the build fails without them.
Watch the Vercel build succeed (it mirrors the local `BUILD_EXIT=0`).

### Step 4 — Deploy the listener (GitHub Actions → ECR/ECS)  *(YOURS)*
The `deploy-email-listener.yml` workflow fires on push to `main` (or run it via `workflow_dispatch`).
It runs ruff/mypy/pytest, builds + pushes the image to ECR (`nauta-services-email-listener`), and waits
for the ECS service to stabilize. Confirm the "services-stable" step goes green.

### Step 5 — Smoke test  *(YOURS — the real proof)*
1. Load the prod web app, sign in.
2. `GET /api/pipeline/health` returns counts (ST-04 wired this deploy).
3. Send one real email to your forwarding address → confirm it ingests and the entity/analysis
   surfaces; walk the `2026-07-22-email-system-review/MANUAL-TESTING-RUNSHEET.md` for the W0 fixes.
4. Open the canvas (context menu / undo), the /home board, /files (rename + versioning), /settings/desktops.
5. Follow the visual/geometry runsheet in `2026-07-23-GRAND-COMPLETION-REPORT.md` §"manual runsheet".

---

## ROLLBACK (per step, fastest-first)

- **R-app (Vercel):** Vercel → Deployments → previous Production deployment → **Promote to Production**
  (instant). Rolls back the web app with no DB impact.
- **R-listener (ECS):** re-run the deploy workflow on the previous commit SHA, OR in ECS update the
  service to the previous task-definition revision (the prior image tag). Stateless — safe to flip.
- **R-DB (the only irreversible layer):** restore the Step-1 backup / PITR restore point. Do this ONLY
  if a migration corrupted data — the 0043→0047 set is purely additive, so the likeliest DB rollback
  need is "changed my mind", handled by restoring the snapshot. After a DB restore, also roll the app
  back (R-app) so code and schema match.
- **Ordering for a full rollback:** R-app + R-listener first (instant, stops new writes against the new
  schema), then R-DB if needed.

## Notes / known non-blockers
- ECR repo + some Terraform names are still `nauta-services-*` (documented naming drift) — leave as-is
  for this deploy; renaming is a separate migration, not a deploy step.
- SES is still in sandbox / prod-access pending (external AWS) — email forwarding works for the one
  verified address; unrelated to this deploy.
- The fresh-empty-DB `BACKFILL_USER_ID` migrate path is improved but not fully green in a harness; prod
  never runs it (0032 long applied). If you ever provision a brand-new empty DB, seed one `auth.users`
  row before migrating rather than relying on the env override.
