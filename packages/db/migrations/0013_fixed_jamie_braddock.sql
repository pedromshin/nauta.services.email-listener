-- Phase 9 (D-01..D-04): the region relationship model.
--
-- Adds the component_role enum + three nullable columns on email_components
-- (role / entity_type_id / entity_type_field_id) with declared FKs (ON DELETE
-- SET NULL) and indexes on role + entity_type_id.
--
-- NOTE: drizzle-kit also re-emitted ALTER TYPE ... ADD VALUE for region/pending/
-- error and ADD COLUMN for extraction_records.confidence_breakdown/routing_reason.
-- Those were already applied live via the custom migrations 0010/0011/0012 (which
-- used IF NOT EXISTS but were not captured in the drizzle-kit meta snapshot, so
-- the generator re-diffed them). They are intentionally REMOVED here — this
-- migration is scoped to the Phase 9 change only and must not re-add existing
-- enum values/columns (which would error on a live DB). IF NOT EXISTS guards are
-- added so the migration is idempotent and safe to re-run across environments.

CREATE TYPE "public"."component_role" AS ENUM('entity', 'field', 'unrelated');--> statement-breakpoint
ALTER TABLE "email_components" ADD COLUMN IF NOT EXISTS "role" "component_role";--> statement-breakpoint
ALTER TABLE "email_components" ADD COLUMN IF NOT EXISTS "entity_type_id" uuid;--> statement-breakpoint
ALTER TABLE "email_components" ADD COLUMN IF NOT EXISTS "entity_type_field_id" uuid;--> statement-breakpoint
ALTER TABLE "email_components" ADD CONSTRAINT "email_components_entity_type_id_entity_types_id_fk" FOREIGN KEY ("entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_components" ADD CONSTRAINT "email_components_entity_type_field_id_entity_type_fields_id_fk" FOREIGN KEY ("entity_type_field_id") REFERENCES "public"."entity_type_fields"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_components_role" ON "email_components" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_components_entity_type_id" ON "email_components" USING btree ("entity_type_id");