CREATE TABLE "entity_type_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importer_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"previous_entity_type_id" uuid NOT NULL,
	"corrected_entity_type_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_type_corrections" ADD CONSTRAINT "entity_type_corrections_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type_corrections" ADD CONSTRAINT "entity_type_corrections_component_id_email_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."email_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type_corrections" ADD CONSTRAINT "entity_type_corrections_previous_entity_type_id_entity_types_id_fk" FOREIGN KEY ("previous_entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type_corrections" ADD CONSTRAINT "entity_type_corrections_corrected_entity_type_id_entity_types_id_fk" FOREIGN KEY ("corrected_entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_entity_type_corrections_importer_id" ON "entity_type_corrections" USING btree ("importer_id");--> statement-breakpoint
CREATE INDEX "idx_entity_type_corrections_component_id" ON "entity_type_corrections" USING btree ("component_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Phase 57 (LEARN-01): entity_type_corrections RLS + importer-scoped trgm
-- retrieval RPC.
--
-- RLS: importer-descendant hard-FK table, mirroring migration 0034's shape
-- (app-boundary tenancy is PRIMARY; this policy is defense-in-depth).
-- ---------------------------------------------------------------------------
ALTER TABLE "entity_type_corrections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "entity_type_corrections_owner_authenticated" ON "entity_type_corrections"
  AS PERMISSIVE FOR ALL TO authenticated
  USING (importer_id IN (SELECT id FROM importers WHERE user_id = auth.uid()))
  WITH CHECK (importer_id IN (SELECT id FROM importers WHERE user_id = auth.uid()));--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- match_entity_type_corrections_by_trgm — importer-scoped ONLY (Pitfall 4):
-- this RPC runs BEFORE the entity type is known (it is the signal used to
-- help decide the type), so it has NO entity-type filter parameter and
-- returns corrections across ALL entity types, each tagged with its own
-- corrected type slug. Reuses the existing GIN trgm index on
-- email_components.content_text (migration 0009) — no new index needed.
--
-- SECURITY INVOKER (default) so RLS still applies; both JOINed tables filter
-- match_importer_id on every row (T-04-28 / T-57-01 cross-tenant isolation).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_entity_type_corrections_by_trgm(
  query_text text,
  match_importer_id uuid,
  match_count int
)
RETURNS TABLE (
  correction_id uuid,
  content_text text,
  corrected_entity_type_slug text,
  sim real
)
LANGUAGE sql
STABLE
AS $$
  SELECT etc.id, c.content_text, t.slug, similarity(c.content_text, query_text) AS sim
  FROM entity_type_corrections etc
  JOIN email_components c ON c.id = etc.component_id
  JOIN entity_types t ON t.id = etc.corrected_entity_type_id
  WHERE etc.importer_id = match_importer_id
    AND c.importer_id = match_importer_id
    AND c.content_text IS NOT NULL
    AND query_text <> ''
    AND similarity(c.content_text, query_text) > 0
  ORDER BY sim DESC
  LIMIT match_count;
$$;