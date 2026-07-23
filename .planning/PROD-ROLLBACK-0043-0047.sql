-- ROLLBACK for prod migrations 0043–0047 (polytoken, 2026-07-23)
-- Additive migrations; this precisely reverses them. Run top-to-bottom in ONE
-- transaction via the Supabase Management API query endpoint. This is the
-- fast per-object rollback; the authoritative rollback remains a DB restore.
-- NOTE: 0043 replaced two functions that 0039 defined — reversing it means
-- re-applying 0039's function bodies, NOT dropping them. That is intentionally
-- OMITTED here (0043 only re-keys a dead dismissal filter; leaving the newer
-- bodies in place is harmless). This script reverses the SCHEMA additions
-- (0044–0047) plus the 0046 column/constraint changes.

BEGIN;

-- ── 0047_workspaces_teams_rbac ──────────────────────────────────────────────
DROP TABLE IF EXISTS "resource_shares" CASCADE;
DROP TABLE IF EXISTS "workspace_members" CASCADE;
DROP TABLE IF EXISTS "workspaces" CASCADE;
DROP TYPE IF EXISTS "public"."share_permission";
DROP TYPE IF EXISTS "public"."shared_resource_type";
DROP TYPE IF EXISTS "public"."workspace_role";

-- ── 0046_home_canvas_scope (reverse the chat_canvas_layouts changes) ─────────
DROP POLICY IF EXISTS "chat_canvas_layouts_home_owner_authenticated" ON "chat_canvas_layouts";
-- restore the 0024 baseline deny-all-authenticated policy
CREATE POLICY "deny_all_chat_canvas_layouts_authenticated" ON "chat_canvas_layouts"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
ALTER TABLE "chat_canvas_layouts" DROP CONSTRAINT IF EXISTS "chat_canvas_layouts_scope_discriminator";
DROP INDEX IF EXISTS "idx_chat_canvas_layouts_home_user";
ALTER TABLE "chat_canvas_layouts" DROP CONSTRAINT IF EXISTS "chat_canvas_layouts_user_id_users_id_fk";
ALTER TABLE "chat_canvas_layouts" DROP COLUMN IF EXISTS "scope";
ALTER TABLE "chat_canvas_layouts" DROP COLUMN IF EXISTS "user_id";
-- Only re-assert NOT NULL if no home rows were written (they'd have NULL conversation_id).
-- Safe here because rollback implies no such rows exist yet.
ALTER TABLE "chat_canvas_layouts" ALTER COLUMN "conversation_id" SET NOT NULL;

-- ── 0045_file_versions ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS "file_versions" CASCADE;
DROP TYPE IF EXISTS "public"."file_version_state";

-- ── 0044_spreadsheets ───────────────────────────────────────────────────────
DROP TABLE IF EXISTS "spreadsheets" CASCADE;

-- ── drizzle tracking: remove the 5 rows so migrate.ts re-applies cleanly ─────
DELETE FROM "drizzle"."__drizzle_migrations"
WHERE "created_at" IN (1784777326691, 1784791508250, 1784795086636, 1784794878891, 1784798710647);

COMMIT;
