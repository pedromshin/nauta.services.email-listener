---
phase: 57-email-learning-loop
plan: 02
subsystem: backend
tags: [python, hexagonal, bedrock, entity-type-classification, learning-loop, few-shot]

# Dependency graph
requires: ["57-01"]
provides:
  - "EntityTypeClassifierProtocol.classify() examples parameter (few-shot correction examples, default () = cold start, back-compat)"
  - "AnthropicEntityTypeClassifier <entity_type_examples> user-turn rendering (D-14: never the system prompt)"
  - "SuggestEntityTypesUseCase importer-scoped trgm correction retrieval feeding the classifier's few-shot examples (best-effort, single retrieval call, no new vector call)"
  - "container.py DI wiring: SuggestEntityTypesUseCase provided via a factory threading the optional EntityTypeCorrectionRepository collaborator"
affects: [57-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "few-shot examples rendered ONLY in the Bedrock user turn (D-14), mirrored verbatim from autofill_adapter._render_examples_block onto the entity-type classifier"
    - "single-retrieval-call-per-batch: SuggestEntityTypesUseCase calls find_similar ONCE per execute() (using the first candidate region's content_text as the trgm query), not once per region — preserves the one-Bedrock-call-per-document reliability contract and avoids N retrieval calls"
    - "dishka factory for a defaulted-Optional collaborator param (mirrors _provide_autofill_use_case / _provide_set_component_entity_type_use_case) — SuggestEntityTypesUseCase's corrections param needed the same treatment"
    - "hand-crafted git apply --cached partial patch to stage only this plan's hunks out of a container.py being concurrently edited by a sibling Wave-2 executor in the same shared working tree — avoids committing another agent's in-flight, uncommitted work"

key-files:
  created:
    - apps/email-listener/tests/test_entity_type_classifier_adapter.py
    - .planning/phases/57-email-learning-loop/deferred-items.md
  modified:
    - apps/email-listener/app/domain/ports/entity_type_classifier_protocol.py
    - apps/email-listener/app/infrastructure/llm/entity_type_classifier_adapter.py
    - apps/email-listener/app/application/use_cases/suggest_entity_types.py
    - apps/email-listener/app/container.py
    - apps/email-listener/tests/test_suggest_entity_types.py
    - apps/email-listener/tests/test_container.py

key-decisions:
  - "Retrieval query text: the batch's FIRST candidate region's content_text is used as the single trgm query (not per-region, not an aggregate) — keeps the retrieval to exactly ONE call per execute(), matching the plan's explicit 'ONE retrieval call, no per-region work' instruction."
  - "Correction examples dict shape sent to classify(): {'content_text': ..., 'corrected_entity_type_slug': ...} — mirrors EntityTypeCorrectionExample's two signal fields (score is retrieval-internal, not rendered into the prompt, matching autofill's example dict shape which also omits its own internal score from the rendered block content)."
  - "Avoided the literal substring 'embed' in ALL new prose (docstrings + inline comments) in suggest_entity_types.py, not just code — an early draft's wording ('No new embed call is added') would have tripped the acceptance grep gate `grep -c 'embed\\|EmbeddingProtocol' returns 0` despite no actual embedding import existing. Reworded to 'No new vector call' throughout (mirrors 57-01's identical self-correction for 'match_entity_type_id' in its own SUMMARY)."
  - "container.py was being concurrently edited by a sibling Wave-2 executor (Phase 56-04 RCNV-04, ChatContextEdgeRepository wiring) in the SAME shared working tree during this plan's execution. Rather than `git add` the whole file (which would have committed the sibling's uncommitted, unrelated, untested work under this plan's commit), a partial patch was hand-built from `git diff` and applied via `git apply --cached --check` (dry-run) then `git apply --cached` to stage ONLY this plan's two hunks (the new factory function + the provider registration line change). Verified via `git diff --cached` before each commit that no sibling-agent lines were included."
  - "The container.py factory hunk landed in the Task 1 commit (b596530) rather than Task 2 (4d1e38e) because it was already staged via the partial-patch operation before the Task 1 commit ran. Both hunks are exclusively this plan's own code (verified) — only the commit-message attribution is imprecise, not the code scope."

requirements-completed: [LEARN-02]

# Metrics
duration: ~15min (task execution; DI safety verification and coverage investigation added on top)
completed: 2026-07-15
---

# Phase 57 Plan 02: Entity-Type Few-Shot Classification + Importer-Scoped Retrieval Summary

**`EntityTypeClassifierProtocol.classify()` now accepts few-shot correction examples rendered ONLY in the Bedrock user turn (D-14); `SuggestEntityTypesUseCase` retrieves them via one importer-scoped trgm call and the same candidate region provably classifies differently with vs. without prior corrections — deterministic, no live Bedrock, suggest-only invariants unchanged.**

## Performance

- **Duration:** ~15 min for the two tasks; additional time spent verifying/enforcing shared-file (`container.py`) commit safety against a concurrently-running sibling executor, and investigating a full-suite coverage gate failure traced to that sibling's unrelated in-flight work.
- **Completed:** 2026-07-15
- **Tasks:** 2/2 completed
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `EntityTypeClassifierProtocol.classify()` gains `examples: tuple[dict[str, object], ...] = ()` — default preserves today's cold-start behavior exactly (back-compat, no callers broken).
- `AnthropicEntityTypeClassifier` renders a new `_render_correction_examples_block()` — `<entity_type_examples>` block appended to the Bedrock **user turn only**; `_build_system_prompt()` is untouched and asserted byte-identical whether or not examples are supplied (D-14 anti-prompt-injection). 7 new targeted tests (`tests/test_entity_type_classifier_adapter.py`) cover cold start, back-compat, single/multi-example rendering, the system-prompt-isolation invariant, and the single-Bedrock-call-per-document contract.
- `SuggestEntityTypesUseCase` gains an optional `corrections: EntityTypeCorrectionRepository | None = None` collaborator. Before the single `classify()` call, if `corrections` is supplied, ONE importer-scoped `find_similar()` trgm retrieval runs (using the first candidate region's `content_text` as the query, `top_n=3`) and its results are threaded through as `examples`. Any retrieval exception is caught and degrades to `examples=()` — classification still proceeds (best-effort, D-13 cold-start posture). No new embedding/vector call was added to the classification path (Q2 decision preserved).
- **SC2 proven deterministically:** a new `ExamplesSensitiveClassifier` test double returns `"receipt"` when it receives an example tagged `corrected_entity_type_slug="receipt"` and `"invoice"` otherwise — the same candidate region content applies a **different** `entity_type_id` with corrections present vs. absent, with zero live Bedrock calls.
- **Suggest-only invariant re-verified under the new code path:** in both the with- and without-corrections runs, `extraction_status` stays `'candidate'`; a below-`CONFIDENCE_THRESHOLD` suggestion is still skipped even when correction-backed; the only writes are `update_role`/`update_entity_type` (unchanged).
- `container.py`: `SuggestEntityTypesUseCase` is now provided via `_provide_suggest_entity_types_use_case`, a factory mirroring `_provide_set_component_entity_type_use_case`'s defaulted-Optional-collaborator pattern — dishka does not auto-inject `EntityTypeCorrectionRepository | None`. New `test_container.py` coverage (`test_suggest_entity_types_use_case_resolves`) asserts the use case resolves and its `_corrections` collaborator is wired (not left at the `None` default) in the live container graph.

## Task Commits

Each task was committed atomically:

1. **Task 1: examples param on classify() + `<entity_type_examples>` user-turn rendering** — `b596530` (feat). *Note: this commit also carries the `container.py` DI-wiring hunk for Task 2 (see key-decisions) because that hunk was already staged via the partial-patch operation before this commit ran; the hunk's content belongs entirely to Task 2's scope, only the commit boundary is imprecise.*
2. **Task 2: correction retrieval in `SuggestEntityTypesUseCase` + measurably-different-suggestion proof** — `4d1e38e` (feat)

## Files Created/Modified

- `apps/email-listener/app/domain/ports/entity_type_classifier_protocol.py` — `classify()` gains `examples` param + docstring
- `apps/email-listener/app/infrastructure/llm/entity_type_classifier_adapter.py` — `_render_correction_examples_block()`, examples threaded into `classify()`, appended to `user_content` only when non-empty
- `apps/email-listener/tests/test_entity_type_classifier_adapter.py` — 7 tests: cold start, back-compat default, examples rendering (single + multi), D-14 system-prompt isolation (content + byte-identical), single-Bedrock-call contract
- `apps/email-listener/app/application/use_cases/suggest_entity_types.py` — `corrections` optional collaborator; one importer-scoped `find_similar()` call feeding `examples` into the existing single `classify()` call; best-effort try/except degrade
- `apps/email-listener/app/container.py` — `_provide_suggest_entity_types_use_case` factory + provider registration change (partial-patch staged to exclude an unrelated, concurrently-in-flight sibling-executor hunk in the same file)
- `apps/email-listener/tests/test_suggest_entity_types.py` — `FakeCorrectionRepository`, `ExamplesSensitiveClassifier`, `FakeClassifier` extended to accept/record `examples`; 8 new tests covering cold-start-with-corrections-collaborator, importer-scoped retrieval, SC2 measurably-different-suggestion, suggest-only invariant preserved, below-threshold-still-skipped, retrieval-failure-falls-back, no-collaborator-backward-compat
- `apps/email-listener/tests/test_container.py` — `test_suggest_entity_types_use_case_resolves` DI-graph resolution test
- `.planning/phases/57-email-learning-loop/deferred-items.md` — documents the full-suite coverage gate failure traced to concurrent, unrelated sibling-executor work (see Deviations below)

## Decisions Made

See `key-decisions` in frontmatter for the full list. Summary:
- Retrieval uses the batch's first candidate region's `content_text` as the single trgm query — exactly one retrieval call per `execute()`, per the plan's explicit instruction.
- Reworded all new prose to avoid the literal substring `embed` (would have false-tripped the acceptance grep gate that checks for zero `embed`/`EmbeddingProtocol` references — Q2 trgm-only enforcement).
- `container.py` was being concurrently edited by a sibling Wave-2 executor in the same shared working tree; a hand-built `git apply --cached` partial patch was used (dry-run `--check` first) to stage ONLY this plan's two hunks, verified via `git diff --cached` before each commit — the sibling's `ChatContextEdgeRepository` wiring hunks were deliberately left unstaged for that executor to commit independently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] "No new embed call" prose would have tripped its own acceptance grep gate**
- **Found during:** Task 2, before first grep-gate check
- **Issue:** An early docstring/comment draft in `suggest_entity_types.py` used the literal substring "embed" (e.g., "No new embed call is added") to describe the Q2 trgm-only retrieval decision — exactly the string the acceptance criteria's `grep -c 'embed\|EmbeddingProtocol' ... returns 0` gate checks for, despite no actual embedding import or call existing.
- **Fix:** Reworded to "No new vector call is added" throughout (docstring + inline comment).
- **Files modified:** `apps/email-listener/app/application/use_cases/suggest_entity_types.py`
- **Commit:** `4d1e38e`

### Process notes (not code deviations)

**2. Shared-file (`container.py`) concurrent-edit safety — partial-patch staging**
- **Found during:** Pre-commit staging for Task 1
- **Issue:** `apps/email-listener/app/container.py` had 8 distinct diff hunks in the working tree at commit time — 2 belonging to this plan (the `_provide_suggest_entity_types_use_case` factory + its provider registration) and 6 belonging to a sibling Wave-2 executor's concurrent, uncommitted Phase 56-04 (`ChatContextEdgeRepository`) work. A plain `git add apps/email-listener/app/container.py` would have committed the sibling's in-flight, untested work under this plan's commit.
- **Fix:** Extracted a `git diff` of the file, hand-built a patch containing only this plan's two hunks, verified with `git apply --cached --check` (dry run), then applied with `git apply --cached` to stage exactly those two hunks. Verified via `git diff --cached` that no sibling-agent content was staged before each commit. The sibling's hunks remain unstaged in the working tree, untouched, for that executor to commit independently.
- **Files affected:** `apps/email-listener/app/container.py` (no functional deviation — same code this plan intended, just staged surgically)
- **Commit:** `b596530` (factory + registration hunks)

## Issues Encountered

**Full-suite coverage ratchet (`uv run pytest -q`) currently FAILS at 63.72% (below the 65% gate), traced to concurrent sibling-executor work, NOT this plan.** Details and reasoning captured in `.planning/phases/57-email-learning-loop/deferred-items.md`. Summary: `git status` at run time showed uncommitted, in-progress work from other Wave-2 executors touching disjoint files this plan never modifies (`linked_context.py` — new, 83 statements, 0% covered; `chat_context_edge_repository.py` — new, 22 statements, 0% covered; plus in-flight edits to `run_chat_turn.py`, `knowledge_graph_repository.py`, `entity_resolution_repository.py`, and others). This plan's own targeted test suites (`test_entity_type_classifier_adapter.py`, `test_suggest_entity_types.py`, `test_container.py`) are 48/48 green, and this plan's new adapter test file is a net coverage *improvement* for `entity_type_classifier_adapter.py` (0% direct coverage before this plan → 66% after). Per the SCOPE BOUNDARY rule, this is logged to `deferred-items.md`, not fixed here — it should self-resolve (or be independently investigated) once all three concurrent Wave-2 plans have committed.

## User Setup Required

None. No new migrations, no new environment variables, no package installs. `classify()`'s `examples` default of `()` means every existing caller (and every environment, including one where migration `0038` from 57-01 is not yet applied) behaves exactly as before this plan — the correction-retrieval path is additive and fails open.

## Deferred Human-Verifiable Follow-up

Live-DB proof (apply migration 0038 from 57-01, seed `entity_type_corrections` rows, run a real ingest, confirm the classifier's few-shot examples visibly bias its Bedrock output) is deferred to the milestone's live-acceptance runsheet, consistent with 57-01's posture — this plan's proof is the deterministic, mockable-boundary test (`ExamplesSensitiveClassifier`), not a live-Bedrock run.

## Next Phase Readiness

- LEARN-02's classification axis is closed: `EntityTypeClassifierProtocol.classify()` accepts few-shot examples, the adapter renders them D-14-safely, and `SuggestEntityTypesUseCase` retrieves + passes them through, all suggest-only-gated and tested deterministically.
- No blockers for 57-03 introduced by this plan.
- **Action item for whoever runs the phase-level full-suite gate next:** re-run `cd apps/email-listener && uv run pytest -q` once all Wave-2 executors (57-02, the chat-path Python plan, the resolver SQL/Python plan) have committed, to re-verify the 65% ratchet at the phase level — see `deferred-items.md`.
- `apps/email-listener/app/container.py` still has unstaged, uncommitted sibling-executor work (Phase 56-04, `ChatContextEdgeRepository`) in the working tree as of this plan's completion — untouched by this plan, left for that executor to commit.

---
*Phase: 57-email-learning-loop*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 7 modified/created source/test files verified present on disk (7/7), plus this
SUMMARY.md and `deferred-items.md`. Both task commits (`b596530`, `4d1e38e`) verified
present in `git log --oneline --all`. Targeted test suites green: 48/48
(`test_entity_type_classifier_adapter.py` 7/7, `test_suggest_entity_types.py` 33/33,
`test_container.py` 8/8 relevant subset — full file run confirmed no regressions).
All three Task 2 acceptance grep gates pass (`find_similar` >= 1, `app.infrastructure`
== 0, `embed|EmbeddingProtocol` == 0). `container.py` staged/committed content verified
via `git diff --cached` to contain ONLY this plan's two hunks, no sibling-executor
content. Full-suite coverage gate (65% ratchet) currently failing at 63.72% due to
concurrent, unrelated sibling-executor work — documented in `deferred-items.md`, not a
regression introduced by this plan's changes.
