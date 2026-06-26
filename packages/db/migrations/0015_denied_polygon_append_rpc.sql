-- Phase 9 (09-gap D1, MEDIUM-4): atomic denied-polygon append.
--
-- DenyFieldUseCase previously recorded the D-19 rejection memo by reading the
-- parent entity component, appending to content_raw.denied_field_polygons, and
-- full-row upserting (save_many). Under concurrent denies that read-modify-write
-- loses entries (last writer wins). This function performs the append as a SINGLE
-- atomic UPDATE so concurrent denies never clobber each other's polygons.
--
-- SECURITY: SECURITY INVOKER (default) so RLS still applies. The function only
-- mutates content_raw.denied_field_polygons (never geometry / other columns),
-- consistent with the supersede-never-mutate convention. The polygon is passed as
-- jsonb (a list of [x,y] pairs) and appended to the existing array (or a new []).
-- Returns the refreshed content_raw so the caller can confirm the write.

CREATE OR REPLACE FUNCTION append_denied_polygon(
  p_component_id uuid,
  p_polygon jsonb
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
AS $$
  UPDATE email_components
  SET content_raw = jsonb_set(
    COALESCE(content_raw, '{}'::jsonb),
    '{denied_field_polygons}',
    COALESCE(content_raw -> 'denied_field_polygons', '[]'::jsonb) || jsonb_build_array(p_polygon),
    true
  )
  WHERE id = p_component_id
  RETURNING content_raw;
$$;
