-- Purge the maritime residue left behind by 0049.
--
-- 0049 only DEACTIVATED the six maritime system entity_types (importer_id IS
-- NULL) because extraction_records holds a RESTRICT FK to entity_types. This
-- migration finishes the job: it deletes the dependent data in FK-safe order
-- and then hard-deletes the six type rows themselves.
--
-- FK behaviors (verified against packages/db/src/schema/*.ts):
--   * entity_type_corrections.previous/corrected_entity_type_id -> NO ACTION
--   * knowledge_nodes.scope_ref_id                              -> polymorphic, no FK
--   * knowledge_node_edges.target_ref_id                        -> polymorphic, no FK
--   * knowledge_node_edges.source_node_id                       -> CASCADE (follows node delete)
--   * component_knowledge_node_links.knowledge_node_id          -> CASCADE (follows node delete)
--   * chat_source_ledger.knowledge_node_id                      -> SET NULL (follows node delete)
--   * sender_profiles.linked_entity_instance_id                 -> NO ACTION (null out first)
--   * entity_instances.merged_into (self-FK)                    -> NO ACTION (null out first)
--   * entity_instances.entity_type_id                           -> NO ACTION (delete before types)
--   * component_entity_candidate_links.entity_instance_id       -> CASCADE
--   * component_entity_candidate_links.entity_type_id           -> NO ACTION (delete before types)
--   * extraction_records.entity_type_id                         -> RESTRICT (delete before types)
--   * entity_type_fields.entity_type_id                         -> CASCADE
--   * email_components.entity_type_id / entity_type_field_id    -> SET NULL
--
-- Single DO block = single statement = one transaction, with RAISE NOTICE
-- row-count logging per step so the prod Action log shows what was purged.
-- Idempotent: on a re-run the type-id array is empty and every step is a no-op.
DO $$
DECLARE
  maritime_type_ids uuid[];
  maritime_instance_ids uuid[];
  n bigint;
BEGIN
  SELECT COALESCE(array_agg(id), '{}') INTO maritime_type_ids
  FROM entity_types
  WHERE importer_id IS NULL
    AND slug IN ('bill_of_lading', 'container', 'booking', 'shipment', 'maritime_line', 'supplier');

  RAISE NOTICE '0050: found % maritime system entity_types to purge', COALESCE(array_length(maritime_type_ids, 1), 0);

  SELECT COALESCE(array_agg(id), '{}') INTO maritime_instance_ids
  FROM entity_instances
  WHERE entity_type_id = ANY (maritime_type_ids);

  RAISE NOTICE '0050: found % maritime-typed entity_instances', COALESCE(array_length(maritime_instance_ids, 1), 0);

  -- (a) Corrections referencing a maritime type on either FK column (NO ACTION FKs).
  DELETE FROM entity_type_corrections
  WHERE previous_entity_type_id = ANY (maritime_type_ids)
     OR corrected_entity_type_id = ANY (maritime_type_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: deleted % entity_type_corrections', n;

  -- (b) Knowledge nodes scoped to maritime-typed entity instances.
  -- scope_ref_type value verified against the listener contract:
  -- knowledge_graph_repository uses scope_ref_type='entity_instance' for
  -- instance-scoped nodes; the scope enum column is authoritative, key on both.
  DELETE FROM knowledge_nodes
  WHERE scope = 'entity_instance'
    AND scope_ref_id = ANY (maritime_instance_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: deleted % instance-scoped knowledge_nodes (edges/links cascade)', n;

  -- (b2) Knowledge nodes scoped directly to the six maritime types — they
  -- would dangle once the type rows are gone.
  DELETE FROM knowledge_nodes
  WHERE scope = 'entity_type'
    AND scope_ref_id = ANY (maritime_type_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: deleted % type-scoped knowledge_nodes', n;

  -- (b3) Polymorphic edges (no FK) pointing at maritime instances would dangle.
  DELETE FROM knowledge_node_edges
  WHERE target_ref_type = 'entity_instance'
    AND target_ref_id = ANY (maritime_instance_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: deleted % knowledge_node_edges targeting maritime instances', n;

  -- (c) Unlink references INTO maritime instances before deleting them.
  UPDATE sender_profiles
  SET linked_entity_instance_id = NULL
  WHERE linked_entity_instance_id = ANY (maritime_instance_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: unlinked % sender_profiles from maritime instances', n;

  UPDATE entity_instances
  SET merged_into = NULL
  WHERE merged_into = ANY (maritime_instance_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: cleared merged_into on % entity_instances', n;

  -- (e) Candidate links keyed on a maritime TYPE (entity_type_id FK is NO
  -- ACTION; instance-keyed rows would also cascade with the instance delete).
  DELETE FROM component_entity_candidate_links
  WHERE entity_type_id = ANY (maritime_type_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: deleted % component_entity_candidate_links', n;

  -- (c, continued) Now the maritime-typed instances themselves.
  DELETE FROM entity_instances
  WHERE entity_type_id = ANY (maritime_type_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: deleted % entity_instances', n;

  -- (d) Extraction records (the RESTRICT FK that forced 0049 to soft-delete).
  DELETE FROM extraction_records
  WHERE entity_type_id = ANY (maritime_type_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: deleted % extraction_records', n;

  -- (f) The six type rows. entity_type_fields cascade;
  -- email_components.entity_type_id / entity_type_field_id go SET NULL.
  DELETE FROM entity_types
  WHERE id = ANY (maritime_type_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: deleted % entity_types', n;

  -- (g) Maritime sender categories (free-text column, no FK).
  UPDATE sender_profiles
  SET category = NULL
  WHERE category IN ('freight_forwarder', 'maritime_line', 'customs_broker', 'supplier');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0050: cleared maritime category on % sender_profiles', n;
END $$;
