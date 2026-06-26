-- Custom SQL migration file, put your code below! --
-- ---------------------------------------------------------------------------
-- knowledge_node_edges — RLS deny-all baseline (Phase 11 follow-up)
--
-- Migration 0019 created knowledge_node_edges (the Phase 11 §4e write-seam) but
-- omitted the RESTRICTIVE deny-all policy that every sibling application table
-- carries (see 0001_rls_deny_all.sql and 0007_retrieval_rls_indexes.sql, which
-- covers the related knowledge_nodes / component_knowledge_node_links). Without
-- it the table diverges from the deny-all baseline: an anon/authenticated
-- Supabase client could read/write it directly, bypassing the importerId data
-- filter the knowledge graph relies on (D-12). service_role and postgres bypass
-- RLS by design (the tRPC backend connects as postgres), so this is invisible to
-- the app but closes the direct-access hole. Threat mitigations: T-04-01
-- (cross-tenant read), T-04-02 (forged row write). Idempotent so it is safe to
-- re-run against an environment where it was applied manually.
-- ---------------------------------------------------------------------------
ALTER TABLE "knowledge_node_edges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_knowledge_node_edges_anon" ON "knowledge_node_edges";--> statement-breakpoint
CREATE POLICY "deny_all_knowledge_node_edges_anon" ON "knowledge_node_edges"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_knowledge_node_edges_authenticated" ON "knowledge_node_edges";--> statement-breakpoint
CREATE POLICY "deny_all_knowledge_node_edges_authenticated" ON "knowledge_node_edges"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
