---
phase: 57-email-learning-loop
verified: 2026-07-15T15:34:29Z
status: human_needed
score: 3/3 must-haves verified (code-level); live-DB legs pending human application
overrides_applied: 0
human_verification:
  - test: "Apply migrations 0038 (entity_type_corrections) and 0039 (entity_resolution_dismiss_filter) to a live environment (local/staging/prod), reclassify a component's entity type via the UI dropdown, and confirm a row lands in entity_type_corrections."
    expected: "A durable, addressable entity_type_corrections row is created with the correct previous/corrected type IDs and importer scoping."
    why_human: "Migrations are authored + drizzle-kit-check-green but NOT APPLIED anywhere (local docker stack was not running during verification, no INTEGRATION_SUPABASE_* env set) — cannot be proven against a real Postgres instance in this session."
  - test: "With migration 0038 applied and correction rows seeded, run a real ingest through SuggestEntityTypesUseCase against live Bedrock and confirm the classifier's few-shot <entity_type_examples> block visibly biases its output."
    expected: "A region resembling a previously corrected one is classified using the corrected type, differing from cold-start behavior."
    why_human: "The deterministic mockable-boundary proof (ExamplesSensitiveClassifier) is code-verified and green, but a live-Bedrock run was explicitly out of scope for this plan and requires deployed migration 0038 + real corrections data."
  - test: "Run `cd apps/email-listener && uv run pytest tests/test_integration_real_postgres.py -m integration --no-cov` with INTEGRATION_SUPABASE_URL/INTEGRATION_SUPABASE_SERVICE_KEY set against an environment with migration 0039 applied."
    expected: "test_dismiss_then_resolve_excludes_both_directions_against_real_postgres passes: rejecting a merge (A,B) excludes B from ResolveEntityCandidates(A) AND excludes A from ResolveEntityCandidates(B)."
    why_human: "Currently collected-but-SKIPPED (4/4 skipped) in this environment — no live Postgres/Supabase reachable to execute the SQL-level exclusion proof."
  - test: "Via the /entities UI, dismiss a real merge suggestion and confirm the pair stops resurfacing in the resolution candidate list."
    expected: "The dismissed pair never resurfaces as a suggestion again, in either direction."
    why_human: "End-to-end UI behavior; requires migration 0039 applied and a live UI session — deferred per 57-03-SUMMARY.md to the milestone's live-acceptance runsheet."
---

# Phase 57: Email Learning Loop Verification Report

**Phase Goal:** The user can correct what an email or extracted entity *is*, and the system captures and reuses that correction to improve future classification/extraction — extending the existing suggest-only entity-resolution stance and never auto-deciding.
**Verified:** 2026-07-15T15:34:29Z
**Status:** human_needed
**Re-verification:** No — initial verification (a prior verifier run died on a session limit before writing a report; no previous VERIFICATION.md with a `gaps:` section existed to re-verify against)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A correction to email/entity classification is stored as a structured, addressable record (not a one-off that leaves no trace) | VERIFIED (code-level) / pending live-DB application | `entity_type_corrections` table (migration 0038: FKs to importers/email_components/entity_types, RLS, 2 indexes) + `EntityTypeCorrection` frozen domain entity + `SupabaseEntityTypeCorrectionRepository.save()` inserting the exact provenance payload, invoked from `SetComponentEntityTypeUseCase.execute()` load-before-mutate, only for genuine reclassifications. 7 targeted tests green. Migration authored + `drizzle-kit check` green but NOT YET APPLIED to any environment (see human_verification). |
| 2 | A later email/entity resembling a previously corrected one is classified/extracted using the accumulated signal, measurably differing from pre-correction behavior | VERIFIED (deterministic, code-level) / pending live-DB + live-Bedrock proof | **Classification axis:** `EntityTypeClassifierProtocol.classify()` gains `examples`; `_render_correction_examples_block()` renders `<entity_type_examples>` in the user turn; `SuggestEntityTypesUseCase` retrieves via one importer-scoped `find_similar()` trgm call and threads `examples` into the single `classify()` call. `test_measurably_different_suggestion_with_vs_without_corrections` proves the SAME candidate-region content applies `entity_type_id="receipt"` with corrections present vs. `"invoice"` without, deterministically, no live Bedrock. **Entity-resolution axis:** migration 0039 re-emits both BlendedRAG RPCs with a symmetric `NOT EXISTS ... was_dismissed = true` exclusion guarded by `match_subject_entity_instance_id IS NULL OR ...`; both call sites (`ResolveEntityCandidatesUseCase`, `PromoteEntityOnConfirmUseCase`) thread the subject id; unit tests prove both RPC arms + both use-case call sites. A real-Postgres integration test proving the SQL exclusion (both directions, Pitfall-1-aware) exists and is collected but SKIPPED (no live DB reachable in this session). |
| 3 | Accumulated correction signal is never auto-applied as a silent decision — every consumer stays suggest-only | VERIFIED | `SuggestEntityTypesUseCase`: only `update_role`/`update_entity_type` are written; `extraction_status` stays `'candidate'` in every scenario (with/without corrections); `CONFIDENCE_THRESHOLD = 0.5` unchanged; a below-threshold correction-backed suggestion is still skipped (`test_below_threshold_suggestion_still_skipped_when_correction_backed`). `SetComponentEntityTypeUseCase`: capture is additive to an existing human action; capture-failure is caught and the mutation still applies; `extraction_status` never touched. `ResolveEntityCandidatesUseCase`: read-only, zero writes (`test_suggest_only_no_writes`), docstring "NEVER writes a merge or flips any status". `PromoteEntityOnConfirmUseCase`: writes candidate-link provenance only, never a merge, docstring "never writes a merge or flips nauta_id automatically" — unchanged by this phase. No path in any touched file sets `extraction_status = 'confirmed'` or auto-applies a merge. |

**Score:** 3/3 truths code-verified; all 3 have a live-DB leg that is explicitly deferred (migrations 0038/0039 authored but applied nowhere) and requires human/live-environment follow-through.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/migrations/0038_entity_type_corrections.sql` | `entity_type_corrections` table + RLS + `match_entity_type_corrections_by_trgm` RPC (importer-scoped only, no entity_type_id filter) | VERIFIED | Read in full: table with 4 FKs (importer/component/prev-type/corrected-type), 2 indexes, RLS policy `entity_type_corrections_owner_authenticated`, RPC has exactly `query_text, match_importer_id, match_count` params (no entity-type filter), both JOINed tables filter `match_importer_id`. |
| `packages/db/migrations/0039_entity_resolution_dismiss_filter.sql` | Both BlendedRAG RPCs re-emitted with `match_subject_entity_instance_id` param + symmetric `NOT EXISTS was_dismissed` filter | VERIFIED | Read in full: both `match_entities_by_embedding` and `match_entities_by_trgm` gain the trailing `DEFAULT NULL` param; both check BOTH `(component_id, entity_instance_id)` orderings; all pre-existing filters/ORDER BY/LIMIT/indexes preserved verbatim. |
| `packages/db/src/schema/entity-type-corrections.ts` | Drizzle mirror | VERIFIED | Exported from `src/schema/index.ts`; `drizzle-kit check` green. |
| `app/domain/entities/entity_type_correction.py` | Frozen `EntityTypeCorrection` dataclass | VERIFIED | `@dataclass(frozen=True)`, mirrors table 1:1. |
| `app/domain/ports/entity_type_correction_repository.py` | `EntityTypeCorrectionRepository` Protocol (save + find_similar) | VERIFIED | Domain-layer-only (no infra imports); `find_similar` explicitly importer-scoped only. |
| `app/infrastructure/supabase/entity_type_correction_repository.py` | Supabase impl | VERIFIED | `save()` inserts exact payload, propagates exceptions (caller owns best-effort); `find_similar()` degrade-safe try/except → `[]`. |
| `app/application/use_cases/set_component_relationship.py` | `SetComponentEntityTypeUseCase` capture hook | VERIFIED | Load-before-mutate, genuine-reclassification-only gate, best-effort try/except, mutation always applies. |
| `app/domain/ports/entity_type_classifier_protocol.py` | `classify()` + `examples` param | VERIFIED | Default `()`; docstring documents D-14 rendering contract. |
| `app/infrastructure/llm/entity_type_classifier_adapter.py` | `<entity_type_examples>` user-turn rendering | VERIFIED | `_render_correction_examples_block()` appended to `user_content` only; `_build_system_prompt()` untouched by examples (tested byte-identical). |
| `app/application/use_cases/suggest_entity_types.py` | Correction retrieval + few-shot pass-through | VERIFIED | One `find_similar()` call, best-effort, no new vector/embed call, threaded into the single `classify()` call. |
| `app/domain/ports/entity_resolution_repository.py` | `find_candidates` + optional `subject_entity_instance_id` | VERIFIED | Documented, backward-compatible, defaults to `None`. |
| `app/infrastructure/supabase/entity_resolution_repository.py` | Both RPC arms pass `match_subject_entity_instance_id` | VERIFIED | `_vector_query` and `_trgm_query` both include the key (explicit `None` when omitted). |
| `app/container.py` | DI wiring for all 3 plans | VERIFIED | `_provide_entity_type_correction_repository`, `_provide_set_component_entity_type_use_case`, `_provide_suggest_entity_types_use_case` factories all present and registered; live-resolved via `container.get()` in this session (see Behavioral Spot-Checks). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SetComponentEntityTypeUseCase.execute` | `EntityTypeCorrectionRepository.save` | best-effort capture before `update_entity_type`, only when previous≠None≠new≠previous | WIRED | Code read directly; matches plan exactly. |
| `SupabaseEntityTypeCorrectionRepository.find_similar` | `match_entity_type_corrections_by_trgm` | importer-scoped RPC call | WIRED | `.rpc("match_entity_type_corrections_by_trgm", {...})`. |
| `SuggestEntityTypesUseCase.execute` | `EntityTypeCorrectionRepository.find_similar` | importer-scoped retrieval, best-effort try/except | WIRED | Confirmed + tested (`FakeCorrectionRepository`). |
| `SuggestEntityTypesUseCase.execute` | `EntityTypeClassifierProtocol.classify` | `examples=(...)` passed into the single Bedrock call | WIRED | Confirmed; single-call contract preserved (tested). |
| `AnthropicEntityTypeClassifier.classify` | `user_content` | `<entity_type_examples>` block, never system prompt | WIRED | Confirmed + tested (byte-identical system prompt with/without examples). |
| `ResolveEntityCandidatesUseCase.execute` | `resolution_repo.find_candidates` | `subject_entity_instance_id=entity_instance_id` | WIRED | Code + test (`test_threads_subject_entity_instance_id_to_resolution_repo`). |
| `PromoteEntityOnConfirmUseCase.execute` | `resolution_repo.find_candidates` | `subject_entity_instance_id=persisted.id` | WIRED | Code + test. |
| `match_entities_by_trgm` / `match_entities_by_embedding` | `component_entity_candidate_links.was_dismissed` | `NOT EXISTS`, both orderings | WIRED (SQL authored, unapplied) | Read in full; symmetric on both orderings for both functions. Not yet exercised against live Postgres in this session (integration test skipped). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `SetComponentEntityTypeUseCase` resolves via live DI container with `corrections` actually wired (not left `None`) | `container.get(SetComponentEntityTypeUseCase)` with patched external clients | `resolved: SetComponentEntityTypeUseCase`, `corrections wired: True` | PASS |
| `SuggestEntityTypesUseCase` resolves via live DI container with `corrections` wired | `tests/test_container.py::test_suggest_entity_types_use_case_resolves` | pass | PASS |
| Migration journal/snapshot coherence (0038/0039) | `cd packages/db && npm run check` | `Everything's fine` | PASS |
| Full pytest suite + coverage ratchet | `cd apps/email-listener && uv run pytest -q` | 100% pass, **66.76% coverage** (≥65% ratchet); exit 0 | PASS — resolves 57-02-SUMMARY's mid-run 63.72% dip (concurrent sibling-executor files have since committed their own coverage) |
| Targeted suites (all 6 files named in task) | `uv run pytest tests/test_entity_type_correction_repository.py tests/test_set_component_relationship.py tests/test_entity_type_classifier_adapter.py tests/test_suggest_entity_types.py tests/test_entity_resolution.py tests/test_container.py --no-cov` | all pass | PASS |
| Integration test collection/skip behavior | `uv run pytest tests/test_integration_real_postgres.py -m integration --no-cov` | 4 collected, 4 SKIPPED (`INTEGRATION_SUPABASE_URL` unset) | PASS (skip is expected/correct — never blocks unattended suite) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` conventional probes exist for this repository/phase; none declared in the 3 PLAN.md files. Skipped — N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LEARN-01 | 57-01-PLAN.md | User can correct classification/extraction; correction captured as structured, addressable signal | SATISFIED (code-level) | `entity_type_corrections` table + capture hook, fully tested. Live-DB application pending (human_verification). |
| LEARN-02 | 57-02-PLAN.md, 57-03-PLAN.md | Accumulated corrections improve subsequent classification/extraction for same/similar entities, suggest-only | SATISFIED (code-level, deterministic proof) | Few-shot classifier bias (57-02) + dismiss-filter RPC consumption (57-03), both tested deterministically. Live-DB application pending (human_verification). |

No orphaned requirements — REQUIREMENTS.md maps only LEARN-01 and LEARN-02 to Phase 57, both claimed across the 3 plans.

### Anti-Patterns Found

None. Scanned all 14 files touched across the 3 plans (domain entities/ports, infrastructure adapters, application use cases, container.py, both migration SQL files) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`, "not yet implemented", "coming soon" — zero matches. No hardcoded empty-return stubs found in the touched files (all touched functions have real logic, verified by direct reading, not just grep).

## Suggest-Only Invariant — Adversarial Check

Explicitly asked: did ANY path gain an auto-apply capability in this phase? Answer: No.

- `SetComponentEntityTypeUseCase`: the ONLY behavioral change is a best-effort, try/except-wrapped `corrections.save()` call inserted before an EXISTING mutation the human already triggered via this same setter. The mutation (`update_entity_type`) is unconditional in every scenario (verified by 6 behavior tests including save-failure). No new decision point was added.
- `SuggestEntityTypesUseCase`: `examples` only changes what the classifier's SUGGESTION is; the write path (`update_role`/`update_entity_type`) and gating logic (`CONFIDENCE_THRESHOLD`, `entity_type_slug is None` skip) are byte-identical to pre-phase code. `extraction_status` is never referenced by a write anywhere in this file.
- `ResolveEntityCandidatesUseCase` / `PromoteEntityOnConfirmUseCase`: the dismiss-filter change only REMOVES redundant candidates from a read-only list; it cannot cause a merge because neither use case has a merge-write code path (confirmed: `PromoteEntityOnConfirmUseCase` writes provenance + entity_instances upsert + candidate-link rows, same as before this phase — no new write type introduced; `ResolveEntityCandidatesUseCase` remains fully read-only, `test_suggest_only_no_writes` passes).
- No `entity_type_id`/`extraction_status` write anywhere in the phase's touched files sets a value autonomously without an existing human-triggered call path.

## Gaps Summary

No code-level gaps. All three ROADMAP success criteria are implemented, wired, and covered by deterministic tests that pass. The one substantive open item across all three plans is consistent and self-disclosed by every SUMMARY: migrations 0038 and 0039 are authored, `drizzle-kit check`-clean, and unit/integration-test-ready, but **not yet applied to any environment** (local, staging, or prod) — this environment had no live Postgres/Supabase reachable during verification (Docker was not running, no `INTEGRATION_SUPABASE_*` set), consistent with the same posture already established for Phase 56's migration 0037. Until applied:
- The `entity_type_corrections` table and its RPC do not exist in any live database, so `save()`/`find_similar()` calls degrade or fail (both paths have production-safe fallbacks already tested: `save()`'s failure is caught by the use case's best-effort wrapper; `find_similar()` degrades to `[]` internally).
- The re-emitted resolution RPCs' new parameter/filter do not exist live yet; `SupabaseEntityResolutionRepository`'s existing `try/except → []` degrade-safe wrapper (D-12) already covers a pre-migration RPC-signature mismatch, so no crash risk — but the actual `was_dismissed` exclusion has zero live effect until 0039 is applied.

This is a deployment/ops gap, not an implementation gap — the code is correct, tested, and fails open. Per the verification rules ("Live-DB legs... → human_needed, NOT failed"), this routes the phase to `human_needed` rather than `gaps_found`.

---
*Verified: 2026-07-15T15:34:29Z*
*Verifier: Claude (gsd-verifier)*
