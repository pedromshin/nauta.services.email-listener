CREATE TABLE "forwarding_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importer_id" uuid NOT NULL,
	"subject" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "thread_id" uuid;--> statement-breakpoint
ALTER TABLE "forwarding_addresses" ADD CONSTRAINT "forwarding_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_forwarding_addresses_token_unique" ON "forwarding_addresses" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_forwarding_addresses_user_id_unique" ON "forwarding_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_threads_importer_id" ON "threads" USING btree ("importer_id");--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_emails_thread_id" ON "emails" USING btree ("thread_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- RLS defense-in-depth (Phase 45 — Threads + Forwarding Seam), mirroring
-- 0034_rls_user_scoping.sql's idiom. These are brand-new tables, so unlike
-- 0034 (which DROPs a pre-existing deny-all authenticated policy before
-- creating the owner policy) there is no deny-all authenticated policy to
-- drop here — RLS is enabled and the owner-authenticated policy is created
-- directly. anon stays fully denied per the 0001_rls_deny_all.sql idiom.
--
-- IMPORTANT — same caveat as 0034: Drizzle connects as the Postgres
-- superuser (packages/db/src/client.ts:28-36) and FastAPI connects with
-- service_role — both bypass RLS entirely. These policies are
-- DEFENSE-IN-DEPTH ONLY; the PRIMARY enforcement wall is the app-boundary
-- ownership sweep (assertThreadOwnership / assertForwardingAddressOwnership).
-- See .planning/PROJECT.md Key Decisions ("v1.7 Phase 44 (TENA-04)").
--
-- Threat mitigations: T-45-01-01 (threads cross-tenant read),
-- T-45-01-02 (forwarding_addresses token leak).
-- ---------------------------------------------------------------------------

-- threads — importer-anchored (join through importers.user_id)
ALTER TABLE "threads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_threads_anon" ON "threads"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "threads_owner_authenticated" ON "threads"
  AS PERMISSIVE FOR ALL TO authenticated
  USING (importer_id IN (SELECT id FROM importers WHERE user_id = auth.uid()))
  WITH CHECK (importer_id IN (SELECT id FROM importers WHERE user_id = auth.uid()));
--> statement-breakpoint

-- forwarding_addresses — direct user_id (no importer join)
ALTER TABLE "forwarding_addresses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_forwarding_addresses_anon" ON "forwarding_addresses"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "forwarding_addresses_owner_authenticated" ON "forwarding_addresses"
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());