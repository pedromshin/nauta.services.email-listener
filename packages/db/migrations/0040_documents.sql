CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled document' NOT NULL,
	"spec" jsonb NOT NULL,
	"source_ledger_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_ledger_id_chat_source_ledger_id_fk" FOREIGN KEY ("source_ledger_id") REFERENCES "public"."chat_source_ledger"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_documents_user_id" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_documents_source_ledger_id" ON "documents" USING btree ("source_ledger_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- RLS owner-scoping (Phase 70 — Documents / INV-8/INV-9), mirroring
-- 0035_threads_forwarding.sql's brand-new-table idiom. `documents` is created
-- HERE, so — unlike 0034 (which DROPs a pre-existing deny-all authenticated
-- policy before creating the owner policy) — there is no deny-all authenticated
-- policy to drop: RLS is enabled and the owner-authenticated policy is created
-- directly. anon stays fully denied per the 0001_rls_deny_all.sql idiom.
--
-- IMPORTANT — same caveat as 0034/0035: Drizzle connects as the Postgres
-- superuser (packages/db/src/client.ts) and FastAPI connects with service_role
-- — both bypass RLS entirely. These policies are DEFENSE-IN-DEPTH ONLY; the
-- PRIMARY enforcement wall is the app-boundary ownership sweep
-- (assertDocumentOwnership, ownership.ts). See .planning/PROJECT.md Key
-- Decisions ("v1.7 Phase 44 (TENA-04)").
--
-- documents — direct user_id (no importer join), same shape as
-- forwarding_addresses / chat_conversations.
-- ---------------------------------------------------------------------------
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_documents_anon" ON "documents"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "documents_owner_authenticated" ON "documents"
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());