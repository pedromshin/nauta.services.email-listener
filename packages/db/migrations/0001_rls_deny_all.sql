-- Phase 4: RLS deny-all for anon and authenticated roles
-- Every phase-4 table gets ENABLE ROW LEVEL SECURITY + RESTRICTIVE deny-all
-- for the anon and authenticated roles.
-- The service_role and postgres roles bypass RLS by design (Supabase default).
-- Threat mitigations: T-04-01 (cross-tenant read), T-04-02 (forged row write)

-- importers
ALTER TABLE "importers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_importers_anon" ON "importers"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_importers_authenticated" ON "importers"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- emails
ALTER TABLE "emails" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_emails_anon" ON "emails"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_emails_authenticated" ON "emails"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- email_attachments
ALTER TABLE "email_attachments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_email_attachments_anon" ON "email_attachments"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_email_attachments_authenticated" ON "email_attachments"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- email_components
ALTER TABLE "email_components" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_email_components_anon" ON "email_components"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_email_components_authenticated" ON "email_components"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- entity_types
ALTER TABLE "entity_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_entity_types_anon" ON "entity_types"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_entity_types_authenticated" ON "entity_types"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- entity_type_fields
ALTER TABLE "entity_type_fields" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_entity_type_fields_anon" ON "entity_type_fields"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_entity_type_fields_authenticated" ON "entity_type_fields"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- extraction_records
ALTER TABLE "extraction_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_extraction_records_anon" ON "extraction_records"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_extraction_records_authenticated" ON "extraction_records"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
