-- Phase 4: Seed the default single-tenant importer.
-- The ingestion pipeline (apps/email-listener) is single-tenant for now and
-- stamps every email/attachment with DEFAULT_IMPORTER_ID
-- (00000000-0000-0000-0000-000000000001). That importer row must exist or the
-- emails.importer_id FK fails on first ingest.
--
-- importer_id = NULL is reserved for system-default entity_types only; a real
-- importer needs a real row. When recipient-address -> importer routing lands,
-- this default becomes the fallback rather than the sole tenant.
--
-- ON CONFLICT (slug) DO NOTHING keeps it idempotent across local/staging/prod.

INSERT INTO "importers" ("id", "slug", "name")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Default Importer'
)
ON CONFLICT ("slug") DO NOTHING;
