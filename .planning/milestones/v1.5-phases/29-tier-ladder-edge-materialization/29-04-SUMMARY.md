---
phase: 29-tier-ladder-edge-materialization
plan: 04
subsystem: knowledge-graph
tags: [hexagonal-architecture, dishka, dependency-injection, best-effort, tier-ladder]
dependency-graph:
  requires:
    - KnowledgeSynthesizer / KnowledgeGraphRepository ports + SupabaseKnowledgeGraphRepository (29-02)
    - KnowledgeSynthesizerService (29-03)
  provides:
    - ConfirmRegionUseCase.knowledge_synthesizer wiring (D-13 hook live)
    - container._provide_confirm_region_use_case DI factory
  affects:
    - apps/email-listener/app/application/use_cases/confirm_region.py
    - apps/email-listener/app/container.py
tech-stack:
  added: []
  patterns:
    - "Best-effort try/except around a post-persist side-effect call, mirroring components.py:250-257's convention — log+swallow, never re-raise"
key-files:
  created: []
  modified:
    - apps/email-listener/app/application/use_cases/confirm_region.py
    - apps/email-listener/app/container.py
    - apps/email-listener/tests/test_confirm_region.py
decisions:
  - "Task 1 and Task 2 edits landed as two separate commits (matching the plan's task boundaries) even though the container.py edit was required before test_confirm_region.py's dishka-backed app could import — verified Task 1 in isolation first via the container error message confirming the hook itself was correctly wired, then completed Task 2 to unblock the full suite"
metrics:
  duration_minutes: 30
  completed: 2026-07-07
---

# Phase 29 Plan 04: Activate the D-13 Synthesis Hook Summary

Activated the dormant D-13 synthesis-trigger comment in `ConfirmRegionUseCase` with a real,
best-effort call to `KnowledgeSynthesizer.synthesize_from_confirmation`, then wired the concrete
`SupabaseKnowledgeGraphRepository` + `KnowledgeSynthesizerService` through the DI container so a
real region-confirm now materializes `knowledge_nodes` and EXTRACTED-tier
`knowledge_node_edges` rows (SYNTH-01) — the previously empty tables become queryable immediately
after a confirm.

## What Was Built

**Task 1 — Wire the best-effort call into `ConfirmRegionUseCase`.** Added a keyword-only
`knowledge_synthesizer: KnowledgeSynthesizer | None = None` constructor param (default keeps every
existing test — none of which pass the new port — working unchanged). Hoisted
`confirmed_record: ExtractionRecord | None = None` above the `if candidate is not None:` branch so
it is always in scope for the hook, including the no-candidate path where it is never assigned.
Replaced the 20-line comment-only D-13 injection block with a live `if self._knowledge_synthesizer
is not None: try: await ...synthesize_from_confirmation(...) except Exception: log.warning(...,
exc_info=True)` — positioned after `update_embedding`, passing `component_id`, `importer_id`,
`confirmed_record`, `corrected_fields`, and `source="learned_from_correction"`. The synthesizer can
never fail the confirm: `confirm_region_done` still logs regardless of synthesis outcome.

**Task 2 — Wire `SupabaseKnowledgeGraphRepository` + `KnowledgeSynthesizerService` in the DI
container.** Added `_provide_confirm_region_use_case(components, extractions, embedder,
entity_instances, client) -> ConfirmRegionUseCase`, mirroring the existing
`_provide_promote_entity_use_case` pattern: instantiates `SupabaseKnowledgeGraphRepository(client=
client)` directly (concrete infra, not a port — dishka can't bind a Protocol-typed param via
`provide(class)`), builds `KnowledgeSynthesizerService(components=components, knowledge=
<that repo>, entity_instances=entity_instances)`, and returns `ConfirmRegionUseCase(...,
knowledge_synthesizer=<that service>)`. Replaced `provider.provide(ConfirmRegionUseCase)` with
`provider.provide(_provide_confirm_region_use_case, provides=ConfirmRegionUseCase)`. Container
builds cleanly (`create_container()` succeeds with no dishka `GraphMissingFactoryError`); confirmed
by first attempting a test run with only Task 1's edit landed, which surfaced the exact expected
`GraphMissingFactoryError` for the new `KnowledgeSynthesizer | None` dependency — proof the port
plumbing itself was correct before the factory closed the gap.

**Task 3 — Test coverage.** Added four tests to `test_confirm_region.py`: (a) ordering + kwargs —
a shared parent `AsyncMock` proves `synthesize_from_confirmation` is awaited strictly after
`update_embedding`, with `component_id`, `importer_id`, and `source="learned_from_correction"`
asserted; (b) best-effort — a `RuntimeError`-raising synthesizer does not propagate out of
`execute()`, and `update_status`/`update_embedding` still ran; (c) no-candidate path — asserts
`confirmed_record=None` is what reaches the synthesizer, proving the hoist fix; (d) an HTTP-seam
test wiring a *real* `ConfirmRegionUseCase` (not a mocked use case) through the existing
`_make_confirm_client` TestClient helper, asserting `POST /confirm` returns 200 and the synthesizer
was awaited — proving the wired path is reachable end-to-end through the API, not just at the
use-case unit level. All 18 tests in the file pass (14 pre-existing + 4 new); full suite (excluding
the pre-existing, already-logged `test_genui_retrieval_provider.py` flake) passes with no
regressions; `ruff`, `lint-imports` clean on all touched files; the one `mypy` error surfaced in
`test_confirm_region.py` (line 156, dict-invariance on `corrected_fields`) is pre-existing —
confirmed via `git stash` diff, not introduced by this plan.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 auto-fixes were needed.

## Commits

- `c639aff` — feat(29-04): wire best-effort synthesis call into ConfirmRegionUseCase
- `5d9fdce` — feat(29-04): wire SupabaseKnowledgeGraphRepository + KnowledgeSynthesizerService in DI container
- `8b2b1d4` — test(29-04): cover best-effort synthesis wiring + HTTP-seam invocation

## Self-Check: PASSED

- FOUND: apps/email-listener/app/application/use_cases/confirm_region.py (knowledge_synthesizer param + hook)
- FOUND: apps/email-listener/app/container.py (_provide_confirm_region_use_case)
- FOUND: apps/email-listener/tests/test_confirm_region.py (4 new tests)
- FOUND: commit c639aff
- FOUND: commit 5d9fdce
- FOUND: commit 8b2b1d4
- Verified: 18/18 test_confirm_region.py tests pass; full suite (minus pre-existing flake file)
  passes with no regressions; container builds without dishka resolution errors; ruff +
  lint-imports clean on all touched files
