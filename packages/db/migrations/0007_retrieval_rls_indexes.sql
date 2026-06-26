-- Phase 4: RLS deny-all, HNSW halfvec, pg_trgm GIN, and moddatetime trigger
-- for the retrieval schema tables (RESEARCH §3.6, §3.8, §3.9, §3.10).
-- Threat mitigations: T-04-27 (poisoned few-shot), T-04-28 (cross-tenant leak)
-- Service_role and postgres roles bypass RLS by Supabase design.

-- ---------------------------------------------------------------------------
-- knowledge_nodes
-- ---------------------------------------------------------------------------
ALTER TABLE "knowledge_nodes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_knowledge_nodes_anon" ON "knowledge_nodes"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_knowledge_nodes_authenticated" ON "knowledge_nodes"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- entity_instances
-- ---------------------------------------------------------------------------
ALTER TABLE "entity_instances" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_entity_instances_anon" ON "entity_instances"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_entity_instances_authenticated" ON "entity_instances"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- sender_profiles
-- ---------------------------------------------------------------------------
ALTER TABLE "sender_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_sender_profiles_anon" ON "sender_profiles"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_sender_profiles_authenticated" ON "sender_profiles"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- component_knowledge_node_links
-- ---------------------------------------------------------------------------
ALTER TABLE "component_knowledge_node_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_component_knowledge_node_links_anon" ON "component_knowledge_node_links"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_component_knowledge_node_links_authenticated" ON "component_knowledge_node_links"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- component_entity_candidate_links
-- ---------------------------------------------------------------------------
ALTER TABLE "component_entity_candidate_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_component_entity_candidate_links_anon" ON "component_entity_candidate_links"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "deny_all_component_entity_candidate_links_authenticated" ON "component_entity_candidate_links"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- HNSW halfvec_cosine_ops indexes (pgvector >= 0.7)
-- drizzle-kit cannot emit halfvec_cosine_ops operator class.
-- ---------------------------------------------------------------------------

-- knowledge_nodes.embedding — cosine similarity for few-shot retrieval
CREATE INDEX IF NOT EXISTS "idx_knowledge_nodes_embedding_hnsw"
  ON "knowledge_nodes"
  USING hnsw ("embedding" halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);
--> statement-breakpoint

-- entity_instances.embedding — cosine similarity for entity resolution
CREATE INDEX IF NOT EXISTS "idx_entity_instances_embedding_hnsw"
  ON "entity_instances"
  USING hnsw ("embedding" halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- pg_trgm GIN index on entity_instances.identifiers::text
-- Enables fuzzy identifier match (PO numbers, BL numbers, container codes).
-- drizzle-kit cannot emit expression indexes; pg_trgm must be loaded first.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    CREATE EXTENSION "pg_trgm";
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entity_instances_identifiers_trgm"
  ON "entity_instances"
  USING gin ((identifiers::text) gin_trgm_ops);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- moddatetime BEFORE UPDATE trigger on knowledge_nodes.updated_at
-- Requires moddatetime extension (Supabase ships it in the extensions schema).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER "set_knowledge_nodes_updated_at"
  BEFORE UPDATE ON "knowledge_nodes"
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime("updated_at");
