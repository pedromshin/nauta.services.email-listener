-- Phase 4: HNSW indexes for halfvec embedding columns.
-- drizzle-kit cannot emit halfvec_cosine_ops, so these are custom migrations.
-- Requires pgvector >= 0.7 (halfvec type + hnsw access method).
-- Supabase managed instances ship pgvector >= 0.7 as of 2024.

-- email_components.embedding — cosine similarity for component retrieval
CREATE INDEX IF NOT EXISTS "idx_email_components_embedding_hnsw"
  ON "email_components"
  USING hnsw ("embedding" halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);
--> statement-breakpoint

-- entity_types.embedding — cosine similarity for entity type matching
CREATE INDEX IF NOT EXISTS "idx_entity_types_embedding_hnsw"
  ON "entity_types"
  USING hnsw ("embedding" halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);
