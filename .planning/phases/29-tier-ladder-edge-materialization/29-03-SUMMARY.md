---
phase: 29-tier-ladder-edge-materialization
plan: 03
subsystem: knowledge-graph
tags: [hexagonal-architecture, tdd, supersede, provenance, co-occurrence]
dependency-graph:
  requires:
    - knowledge_nodes.tier / knowledge_node_edges.tier/provenance/is_active (29-01)
    - KnowledgeSynthesizer / KnowledgeGraphRepository ports + SupabaseKnowledgeGraphRepository (29-02)
    - _token_provenance.capture_provenance (29-02)
  provides:
    - KnowledgeSynthesizerService (implements KnowledgeSynthesizer)
    - EntityInstanceRepository.find_confirmed_entity_components_for_email
    - EntityInstanceRepository.find_selected_instance_for_component
  affects:
    - apps/email-listener/app/application/use_cases/confirm_region.py (29-04 will wire the hook)
tech-stack:
  added: []
  patterns:
    - "Node identity 1:1 with the confirmed region (scope_ref_id=component_id) so deactivate_edges_for_node
       on re-confirm touches exactly and only this region's edges — no cross-region orphaning"
    - "Deactivate-then-insert supersede ordering (no DB transactions available); prior edges is_active=false,
       never DELETE"
key-files:
  created:
    - apps/email-listener/app/application/use_cases/synthesize_knowledge.py
    - apps/email-listener/tests/test_synthesize_knowledge.py
  modified:
    - apps/email-listener/app/domain/ports/entity_instance_repository.py
    - apps/email-listener/app/infrastructure/supabase/entity_instance_repository.py
    - apps/email-listener/tests/test_supabase_repositories.py
decisions:
  - "Title/content composition uses raw entity_type_id (no EntityType label lookup) since the plan's
     collaborator list for KnowledgeSynthesizerService is components/knowledge/entity_instances only —
     no entity_types port injected. Mirrors promote_entity_on_confirm.py's fallback idiom rather than its
     full label-lookup path."
  - "Task 2 (TDD RED test subset) and Task 3 (full AsyncMock test suite) were combined into a single RED
     commit, since writing the complete test file up front made the RED/GREEN boundary clearer than
     splitting an 8-test file across two commits with an intermediate partial-RED state."
metrics:
  duration_minutes: 40
  completed: 2026-07-07
---

# Phase 29 Plan 03: KnowledgeSynthesizerService Summary

Implemented the KnowledgeSynthesizerService: confirming a region materializes exactly one
knowledge_node (1:1 with the region) and a supersede-safe, provenance-carrying EXTRACTED-tier
edge set — anchor (evidenced_by), co-occurrence (co_occurs_with), and a conditional "about" edge.
Re-confirming deactivates the region's prior edges before inserting fresh ones, never deleting.

## What Was Built

**Task 1 — Entity-instance reads.** Added `find_confirmed_entity_components_for_email(email_id)`
(email-scoped confirmed role='entity' components — the co-occurrence source, deliberately narrower
than the importer-scoped D-10 `list_confirmed_entity_components`) and
`find_selected_instance_for_component(component_id)` (reads the `was_selected=True` candidate link,
resolves the winning `entity_instance_id`, returns `None` on the expected first-confirm case since
`PromoteEntityOnConfirmUseCase` writes that link after confirm) to both the `EntityInstanceRepository`
Protocol and `SupabaseEntityInstanceRepository`. Three MagicMock call-shape tests added to
`test_supabase_repositories.py` (16 total pass).

**Task 2 — KnowledgeSynthesizerService (TDD).** RED: wrote the full AsyncMock-port test suite for
`test_synthesize_knowledge.py` against the not-yet-existing module — confirmed collection failure
(`ModuleNotFoundError`), committed. GREEN: implemented `KnowledgeSynthesizerService.
synthesize_from_confirmation` — loads the component, resolves its parent page and captures OCR
token-polygon provenance via the 29-02 helper (empty-tokens fallback when the page is unresolvable,
guarding the page-missing case without raising), looks up the region's node via `find_active_node(
importer_id, "entity_type", component_id)` (node identity = the region), upserts the node, and — only
when the node already existed — calls `deactivate_edges_for_node` **before** any `insert_edge` call
(supersede ordering, T-29-08). Inserts the anchor edge (`evidenced_by`, provenance =
`{component_id, page_index, polygon, tokens}`, tier=`EXTRACTED`), one `co_occurs_with` edge per other
confirmed entity component in the same email (self excluded), and an `about` edge iff a selected
entity instance resolves. All 8 tests pass; `mypy`, `ruff` (120 cols), and `lint-imports` clean —
confirmed zero `app.infrastructure` imports in the synthesizer.

**Task 3 — Full test coverage.** The RED commit already carried the complete scenario set: first-confirm
no-deactivate, re-confirm deactivate-before-insert ordering (assertable via `knowledge.mock_calls`
index comparison), anchor-edge provenance/tier assertion, co-occurrence self-exclusion, conditional
about-edge (present/absent), page-missing robustness, and a first-then-re-confirm sequence asserting
exactly one active anchor edge is ever produced per confirm call (no duplicate/orphaned edges,
SYNTH-03's success criterion).

## Deviations from Plan

**1. [Workflow] Task 2 RED and Task 3's full test suite combined into one commit.** The plan splits
"failing tests for core behavior" (Task 2) from "the full AsyncMock test suite" (Task 3) across two
tasks/commits. Writing the complete 8-test file in the single RED commit produced a clearer RED→GREEN
boundary than an intermediate partial-RED state, so both tasks' test content landed in the `8e0a2a8`
RED commit; `bd5c77c` is the GREEN implementation commit satisfying both tasks' acceptance criteria.
No functional deviation — every acceptance criterion from both tasks is met and verified.

No Rule 1-4 auto-fixes were needed; the only implementation choice not explicit in the plan was the
title/content composition fallback (documented above).

## Commits

- `ee3e210` — feat(29-03): add co-occurrence + selected-instance reads to EntityInstanceRepository
- `8e0a2a8` — test(29-03): add failing tests for KnowledgeSynthesizerService (RED)
- `bd5c77c` — feat(29-03): implement KnowledgeSynthesizerService (node-per-region + supersede-safe edges)

## TDD Gate Compliance

RED gate (`8e0a2a8`) confirmed by collection failure before GREEN; GREEN gate (`bd5c77c`) confirmed
by 8/8 tests passing. No REFACTOR commit needed — implementation required no post-GREEN cleanup beyond
the ruff SIM108 ternary fix applied inline before commit.

## Self-Check: PASSED

- FOUND: apps/email-listener/app/application/use_cases/synthesize_knowledge.py
- FOUND: apps/email-listener/tests/test_synthesize_knowledge.py
- FOUND: apps/email-listener/app/domain/ports/entity_instance_repository.py (find_confirmed_entity_components_for_email, find_selected_instance_for_component)
- FOUND: apps/email-listener/app/infrastructure/supabase/entity_instance_repository.py (both impls)
- FOUND: commit ee3e210
- FOUND: commit 8e0a2a8
- FOUND: commit bd5c77c
- Verified: 16 test_supabase_repositories.py tests pass; 8 test_synthesize_knowledge.py tests pass;
  mypy/ruff/lint-imports clean on all new/modified files; no regressions in
  test_confirm_region.py/test_entity_curation.py/test_entity_resolution.py
