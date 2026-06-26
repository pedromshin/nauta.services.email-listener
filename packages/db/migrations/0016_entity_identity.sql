-- Phase 10 (D-03/D-04): entity_instances identity-store reshape.
--
-- Repurposes entity_instances from a Nauta-only mirror into the cross-email
-- identity store (D-01): nauta_id becomes nullable so email-extracted rows
-- (nauta_id NULL, source='email_extracted') can coexist with Nauta-synced rows
-- (nauta_id set, source='nauta_sync') in the same table.
--
-- Scoped strictly to the Phase-10 entity_instances change — no re-emission of
-- 0010/0011/0012/0013/0014/0015 custom objects (enum values, columns, functions)
-- that were applied live but not captured in the drizzle-kit meta snapshot.
-- All statements use IF NOT EXISTS / IF EXISTS guards for idempotency (T-10-01).
--
-- Statements:
--   1. DROP NOT NULL on nauta_id  (allows email-extracted rows)
--   2. ADD COLUMN source (discriminator: email_extracted | nauta_sync)
--   3. DROP old unique constraint (entity_instances_importer_entity_type_nauta_id_unique)
--   4. CREATE partial unique WHERE nauta_id IS NOT NULL (preserve Nauta-row uniqueness)
--   5. CREATE gallery index (importer_id, entity_type_id, source) — D-17

ALTER TABLE "entity_instances" ALTER COLUMN "nauta_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "entity_instances" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'email_extracted';
--> statement-breakpoint
ALTER TABLE "entity_instances" DROP CONSTRAINT IF EXISTS "entity_instances_importer_entity_type_nauta_id_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entity_instance_unique_per_importer" ON "entity_instances" ("importer_id","entity_type_id","nauta_id") WHERE "nauta_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entity_instances_gallery" ON "entity_instances" USING btree ("importer_id","entity_type_id","source");
