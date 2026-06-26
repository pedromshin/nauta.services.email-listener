-- Phase 4 (04-08): hybrid-retrieval RPC functions for the learning flywheel (D-15).
-- SupabaseRetrievalRepository.find_similar_confirmed calls these two RPCs; without
-- them retrieval silently no-ops (cold-start fallback). Each returns confirmed
-- regions for a given importer + entity type, exposing the columns the Python
-- repository reads: id, content_text, extracted_fields.
--
-- Both functions JOIN email_components -> extraction_records because the confirmed
-- status, entity_type_id, and field values live on the extraction record while the
-- embedding / content_text / importer scoping live on the component.
--
-- SECURITY: SECURITY INVOKER (default) so RLS still applies; both functions filter
-- match_importer_id on every row (T-04-28 cross-tenant isolation). corrected_fields
-- (human overrides) take precedence over extracted_fields when present (D-16).
-- DISTINCT ON (c.id) collapses multiple confirmed records per component to one row.

-- ---------------------------------------------------------------------------
-- Vector cosine similarity over confirmed regions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_components_by_embedding(
  query_embedding halfvec(1536),
  match_importer_id uuid,
  match_entity_type_id uuid,
  match_statuses text[],
  match_count int
)
RETURNS TABLE (
  id uuid,
  content_text text,
  extracted_fields jsonb,
  distance real
)
LANGUAGE sql
STABLE
AS $$
  SELECT id, content_text, extracted_fields, distance
  FROM (
    SELECT DISTINCT ON (c.id)
      c.id,
      c.content_text,
      COALESCE(er.corrected_fields, er.extracted_fields) AS extracted_fields,
      (c.embedding <=> query_embedding) AS distance
    FROM email_components c
    JOIN extraction_records er ON er.component_id = c.id
    WHERE c.importer_id = match_importer_id
      AND er.importer_id = match_importer_id
      AND er.entity_type_id = match_entity_type_id
      AND er.status::text = ANY(match_statuses)
      AND c.embedding IS NOT NULL
    ORDER BY c.id, (c.embedding <=> query_embedding)
  ) sub
  ORDER BY distance
  LIMIT match_count;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- pg_trgm similarity over confirmed regions' content_text
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_components_by_trgm(
  query_text text,
  match_importer_id uuid,
  match_entity_type_id uuid,
  match_statuses text[],
  match_count int
)
RETURNS TABLE (
  id uuid,
  content_text text,
  extracted_fields jsonb,
  sim real
)
LANGUAGE sql
STABLE
AS $$
  SELECT id, content_text, extracted_fields, sim
  FROM (
    SELECT DISTINCT ON (c.id)
      c.id,
      c.content_text,
      COALESCE(er.corrected_fields, er.extracted_fields) AS extracted_fields,
      similarity(c.content_text, query_text) AS sim
    FROM email_components c
    JOIN extraction_records er ON er.component_id = c.id
    WHERE c.importer_id = match_importer_id
      AND er.importer_id = match_importer_id
      AND er.entity_type_id = match_entity_type_id
      AND er.status::text = ANY(match_statuses)
      AND c.content_text IS NOT NULL
      AND query_text <> ''
    ORDER BY c.id, similarity(c.content_text, query_text) DESC
  ) sub
  WHERE sim > 0
  ORDER BY sim DESC
  LIMIT match_count;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- pg_trgm GIN index on email_components.content_text to back the trgm RPC.
-- (drizzle-kit cannot emit gin_trgm_ops; added here as custom DDL.)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_email_components_content_text_trgm
  ON email_components USING gin (content_text gin_trgm_ops);
