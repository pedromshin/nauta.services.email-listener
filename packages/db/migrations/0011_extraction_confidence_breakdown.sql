-- Phase 4 gap closure: extraction_records is missing two columns the
-- application has written since 04-07/04-08:
--
--   confidence_breakdown  jsonb — per-field confidence from the LLM pipeline
--   routing_reason        text  — why the record was created (audit, D-16)
--
-- Every live ExtractionRepository.save() fails with PGRST204 ("Could not find
-- the 'confidence_breakdown' column") without them. Fake-repo unit tests never
-- caught this; the real-Postgres integration test
-- (apps/email-listener/tests/test_integration_real_postgres.py) does.
--
-- ADD COLUMN IF NOT EXISTS is idempotent and safe to re-run across environments.

ALTER TABLE "extraction_records" ADD COLUMN IF NOT EXISTS "confidence_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "extraction_records" ADD COLUMN IF NOT EXISTS "routing_reason" text;
