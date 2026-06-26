-- Phase 4 gap closure: add component lifecycle values to the extraction_status enum.
--
-- email_components.extraction_status reuses the extraction_status enum, but the
-- PDF parser (apps/email-listener/.../pdf/pdf_parser.py) and ProposeRegionsUseCase
-- emit "pending" (freshly parsed/proposed, awaiting extraction) and "error" (a page
-- or region the parser could not process). Those two labels were never in the enum,
-- so the live ingest pipeline failed on every real attachment with Postgres 22P02
-- ("invalid input value for enum extraction_status"). Fake-repo unit tests never
-- caught this because they bypass the real DB enum.
--
-- ADD VALUE IF NOT EXISTS is idempotent and safe to re-run across environments.
-- (Local already had these applied manually during debugging; this migration makes
-- staging/prod consistent and captures the change in source control.)

ALTER TYPE "public"."extraction_status" ADD VALUE IF NOT EXISTS 'pending';--> statement-breakpoint
ALTER TYPE "public"."extraction_status" ADD VALUE IF NOT EXISTS 'error';
