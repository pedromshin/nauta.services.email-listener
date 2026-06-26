-- Phase 4: moddatetime triggers for updated_at columns.
-- The moddatetime extension auto-sets updated_at on every UPDATE.
-- Supabase ships moddatetime in the extensions schema.

-- Ensure moddatetime extension is available (Supabase ships it by default)
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;
--> statement-breakpoint

-- extraction_records.updated_at trigger
CREATE OR REPLACE TRIGGER "set_extraction_records_updated_at"
  BEFORE UPDATE ON "extraction_records"
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime("updated_at");
--> statement-breakpoint

-- email_components.updated_at trigger
CREATE OR REPLACE TRIGGER "set_email_components_updated_at"
  BEFORE UPDATE ON "email_components"
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime("updated_at");
