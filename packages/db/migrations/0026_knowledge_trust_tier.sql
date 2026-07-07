-- ---------------------------------------------------------------------------
-- Phase 29 — Tier Ladder + Edge Materialization: knowledge_trust_tier
-- (TIER-01, SYNTH-02, SYNTH-03).
--
-- Adds the ordinal trust-tier ladder to the dormant knowledge graph tables:
--   - `knowledge_trust_tier` enum (EXTRACTED | INFERRED | AMBIGUOUS, ordinal
--     most-to-least trusted; see knowledge-nodes.ts doc comment)
--   - `knowledge_nodes.tier`       — NOT NULL DEFAULT 'AMBIGUOUS'
--   - `knowledge_node_edges.tier`  — NOT NULL DEFAULT 'AMBIGUOUS'
--
-- Also adds the two extra edge columns the materialization path needs so
-- downstream plans (29-03) have a real database to write against:
--   - `knowledge_node_edges.provenance`  jsonb, nullable — OCR token-polygon
--     provenance `{component_id, page_index, polygon, tokens}` (SYNTH-02)
--   - `knowledge_node_edges.is_active`   boolean NOT NULL DEFAULT true —
--     supersede flag (SYNTH-03); re-confirm deactivates the prior
--     confirmation's edges and writes fresh ones, never DELETE
--   - a partial index on the deterministic active-edge identity
--     (source_node_id, target_ref_id, relation_type) WHERE is_active
--
-- The existing `confidence real` column on both tables is UNCHANGED — it
-- remains the intra-tier similarity/quality score, independent of tier.
--
-- Idempotent (T-29-01): the enum create is guarded by a DO-block catching
-- duplicate_object (mirrors the repo's ALTER TYPE ... ADD VALUE IF NOT
-- EXISTS idiom in 0012, extended here since CREATE TYPE has no native
-- IF NOT EXISTS); every ALTER/CREATE uses IF NOT EXISTS. Re-applying this
-- migration is a no-op. Both tables are empty today (verified, T-29-03) so
-- the NOT NULL DEFAULT adds no lock/backfill risk.
--
-- RLS: NOT touched — 0020's deny-all baseline on knowledge_node_edges stays;
-- the service-role writer (later plans) bypasses it by design (T-29-02).
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "knowledge_trust_tier" AS ENUM ('EXTRACTED', 'INFERRED', 'AMBIGUOUS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD COLUMN IF NOT EXISTS "tier" "knowledge_trust_tier" NOT NULL DEFAULT 'AMBIGUOUS';
--> statement-breakpoint
ALTER TABLE "knowledge_node_edges" ADD COLUMN IF NOT EXISTS "tier" "knowledge_trust_tier" NOT NULL DEFAULT 'AMBIGUOUS';
--> statement-breakpoint
ALTER TABLE "knowledge_node_edges" ADD COLUMN IF NOT EXISTS "provenance" jsonb;
--> statement-breakpoint
ALTER TABLE "knowledge_node_edges" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_node_edges_active_identity" ON "knowledge_node_edges" ("source_node_id","target_ref_id","relation_type") WHERE "is_active" = true;
