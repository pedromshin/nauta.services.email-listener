-- ---------------------------------------------------------------------------
-- Phase 30 — Suggest-Only Promotion Gate: edge_promotion_provenance (TIER-03).
--
-- Adds a nullable `promotion jsonb` column to `knowledge_node_edges` that
-- holds HUMAN-promotion provenance — distinct from the existing `provenance`
-- column (Phase 29, OCR/synthesis provenance):
--   { promoted_at, from_tier, mechanism }
--
-- Written ONLY by the promote_edge repo method when a human reviewer flips
-- an ACTIVE INFERRED/AMBIGUOUS edge to EXTRACTED via the authenticated
-- POST /v1/knowledge/edges/{id}/promote endpoint (T-30-05/T-30-08). Nothing
-- else writes this column — the tier only ever flips through that guarded,
-- fail-closed use case.
--
-- Idempotent (mirrors 0026's style): ADD COLUMN IF NOT EXISTS. Re-applying
-- this migration is a no-op. The existing `provenance` column is UNCHANGED.
-- ---------------------------------------------------------------------------

ALTER TABLE "knowledge_node_edges" ADD COLUMN IF NOT EXISTS "promotion" jsonb;
