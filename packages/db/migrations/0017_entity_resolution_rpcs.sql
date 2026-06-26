-- Phase 10 (D-07/D-12): entity resolution RPC functions for BlendedRAG arms.
--
-- match_entities_by_embedding — dense vector arm (HNSW cosine) over entity_instances.
-- match_entities_by_trgm      — lexical arm (pg_trgm) over display_name + identifiers
--                               + aliases; returns per-arm sub-scores (name_sim /
--                               identifier_sim / alias_sim) alongside the composite sim
--                               so the 10-02 resolver can attribute the winning arm
--                               deterministically (D-09 audit trail).  An alias hit is
--                               never mislabelled identifier_fuzzy.
--
-- Both functions:
--   • filter importer_id = match_importer_id on every row (T-10-02 cross-tenant isolation,
--     matches T-04-28 precedent from match_components_by_* in 0009)
--   • filter source = 'email_extracted' (nauta_sync rows never surfaced)
--   • filter is_active = true
--   • SECURITY INVOKER (default) so RLS still applies
--
-- Three GIN trgm indexes (display_name, identifiers::text, aliases) are created here
-- with IF NOT EXISTS guards so the migration is idempotent.

-- ---------------------------------------------------------------------------
-- Dense vector arm — cosine similarity over entity_instances.embedding
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_entities_by_embedding(
  query_embedding halfvec(1536),
  match_importer_id uuid,
  match_entity_type_id uuid,
  match_count int
)
RETURNS TABLE (
  id uuid,
  display_name text,
  distance real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id,
    display_name,
    (embedding <=> query_embedding) AS distance
  FROM entity_instances
  WHERE importer_id = match_importer_id
    AND entity_type_id = match_entity_type_id
    AND source = 'email_extracted'
    AND embedding IS NOT NULL
    AND is_active = true
  ORDER BY (embedding <=> query_embedding)
  LIMIT match_count;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Lexical arm — pg_trgm similarity over display_name + identifiers + aliases
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_entities_by_trgm(
  query_text text,
  match_importer_id uuid,
  match_entity_type_id uuid,
  match_count int
)
RETURNS TABLE (
  id uuid,
  display_name text,
  sim real,
  name_sim real,
  identifier_sim real,
  alias_sim real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id,
    display_name,
    sim,
    name_sim,
    identifier_sim,
    alias_sim
  FROM (
    SELECT
      id,
      display_name,
      similarity(display_name, query_text)                                         AS name_sim,
      similarity(identifiers::text, query_text)                                    AS identifier_sim,
      similarity(coalesce(array_to_string(aliases, ' '), ''), query_text)          AS alias_sim,
      greatest(
        similarity(display_name, query_text),
        similarity(identifiers::text, query_text),
        similarity(coalesce(array_to_string(aliases, ' '), ''), query_text)
      )                                                                            AS sim
    FROM entity_instances
    WHERE importer_id = match_importer_id
      AND entity_type_id = match_entity_type_id
      AND source = 'email_extracted'
      AND is_active = true
      AND query_text <> ''
  ) sub
  WHERE sim > 0
  ORDER BY sim DESC
  LIMIT match_count;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- GIN trgm indexes — back all three lexical sub-scores (D-09)
-- (drizzle-kit cannot emit expression GIN indexes; live here as custom DDL)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_entity_instances_display_name_trgm
  ON entity_instances USING gin (display_name gin_trgm_ops);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_entity_instances_identifiers_trgm
  ON entity_instances USING gin ((identifiers::text) gin_trgm_ops);
--> statement-breakpoint

-- Immutable wrapper needed because array_to_string is STABLE in some Postgres
-- builds; GIN expression indexes require IMMUTABLE functions.
CREATE OR REPLACE FUNCTION immutable_array_to_text(arr text[])
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT coalesce(array_to_string(arr, ' '), '');
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_entity_instances_aliases_trgm
  ON entity_instances USING gin (immutable_array_to_text(aliases) gin_trgm_ops);
