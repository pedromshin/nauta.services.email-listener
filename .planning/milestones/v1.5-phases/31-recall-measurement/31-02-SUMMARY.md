---
phase: 31-recall-measurement
plan: 02
subsystem: autofill-instrumentation
tags: [recall, measurement, instrumentation, migration, best-effort, rls]
dependency-graph:
  requires:
    - AutofillUseCase._resolve_entity_context (Phase 31-01, RECALL-01)
    - ExtractionRecord.corrected_fields (existing correction signal)
  provides:
    - autofill_retrieval_events table (migration 0028) + RLS deny-all
    - AutofillRetrievalEvent domain entity + AutofillRetrievalEventRepository port
    - SupabaseAutofillRetrievalEventRepository (best-effort writer)
    - AutofillUseCase._save_retrieval_event (one event per execute run)
    - packages/db/scripts/retrieval-miss-rate.ts + RETRIEVAL-MISS-RATE.md
  affects:
    - apps/email-listener/app/container.py (_provide_autofill_use_case now wires
      AutofillRetrievalEventRepository)
tech-stack:
  added: []
  patterns:
    - "Best-effort instrumentation write (try/except log-and-swallow) mirrors both
       confirm_region.py's synthesis-hook posture and SupabaseGenerationAuditRepository's
       adapter-level swallow — defense in depth: the adapter never raises AND the use case
       additionally wraps its own call (T-31-04)"
    - "Human-correction linkage derived AT QUERY TIME (JOIN on component_id), never by
       mutating a persisted event — one write path, no second write path for corrections"
    - "entity_context dict carries a non-rendered entity_instance_id key: the prompt
       adapter only ever reads 'aliases'/'identifiers', so an extra key is safe to add
       for internal instrumentation use without touching the untrusted-content contract"
key-files:
  created:
    - packages/db/migrations/0028_autofill_retrieval_events.sql
    - packages/db/scripts/verify-0028-live.ts
    - packages/db/src/schema/autofill-retrieval-events.ts
    - packages/db/scripts/retrieval-miss-rate.ts
    - packages/db/scripts/RETRIEVAL-MISS-RATE.md
    - apps/email-listener/app/domain/entities/autofill_retrieval_event.py
    - apps/email-listener/app/domain/ports/autofill_retrieval_event_repository.py
    - apps/email-listener/app/infrastructure/supabase/autofill_retrieval_event_repository.py
    - apps/email-listener/tests/test_autofill_instrumentation.py
  modified:
    - packages/db/migrations/meta/_journal.json
    - packages/db/src/schema/index.ts
    - apps/email-listener/app/application/use_cases/autofill.py
    - apps/email-listener/app/container.py
    - apps/email-listener/tests/test_autofill_entity_context.py
decisions:
  - "Miss definition (written in RETRIEVAL-MISS-RATE.md): Type A = had retrieval context
     (seed_hits or injected entity_context) yet the human corrected it anyway; Type B = no
     context at all AND the human confirmed with corrections present (hand-filled). A run
     with no matching confirmed extraction_records row is excluded from the numerator but
     still counted in total_runs."
  - "Zero-events miss_rate reported as 0 (not NaN/N/A) — an empty history is a valid,
     unambiguous starting state for the stage-3 go/no-go gate, not evidence either way."
  - "retrieval-miss-rate.ts self-tests its own join/classification SQL via an inline VALUES
     fixture (no writes to any real table, no FK entanglement with email_components) rather
     than seeding-then-cleaning-up live rows — simpler, zero side effects, still proves the
     query logic before printing the real report."
  - "seed_hits stores {id, score} per retrieved example (component_id + RRF score) — no
     content_text/extracted_fields duplication, since those already live on the confirmed
     extraction_records row the miss-rate join reaches."
metrics:
  duration_minutes: 45
  completed: 2026-07-07
---

# Phase 31 Plan 02: Recall & Measurement — Instrumentation + Miss-Rate Artifact (RECALL-02) Summary

Every `AutofillUseCase.execute` run now persists one best-effort instrumentation record
(seed hits, injected alias/identifier context, routing_reason) to a new
`autofill_retrieval_events` table (migration 0028, RLS deny-all, live-verified), and a
committed script (`retrieval-miss-rate.ts`) computes the retrieval-miss rate as a number by
joining those events to `extraction_records.corrected_fields` at query time — the concrete
artifact gating the deferred stage-3 BFS work (KGX-01..03).

## What Was Built

**Task 1 — Migration 0028 + live verification.** Hand-wrote
`0028_autofill_retrieval_events.sql` (CREATE TABLE IF NOT EXISTS, uuid PK, three btree
indexes on `component_id`/`importer_id`/`created_at`, RESTRICTIVE deny-all RLS for anon +
authenticated per the 0020 template) and registered it in `meta/_journal.json` (idx 28).
Added the Drizzle schema source (`autofill-retrieval-events.ts`, barrel-exported from
`schema/index.ts`) and `verify-0028-live.ts` (direct `pg` query — all 11 columns'
udt/nullable, `relrowsecurity=true`, and both RESTRICTIVE policies present). Applied via
`npm run migrate:local` and live-verified against local Postgres — VERIFICATION PASSED.

**Task 2 — Best-effort instrumentation write (TDD).** New `AutofillRetrievalEvent` frozen
domain entity + `AutofillRetrievalEventRepository` Protocol (`save(event) -> None`, no
update/mutation method exposed by design). `SupabaseAutofillRetrievalEventRepository`
mirrors `SupabaseGenerationAuditRepository`'s best-effort posture exactly (asyncio.to_thread
offload, catch-log-swallow, never raises). `AutofillUseCase` gained an optional
`retrieval_events: AutofillRetrievalEventRepository | None` param and a new
`_save_retrieval_event` private method called at the END of `execute` (after the
`ExtractionRecord` save) — builds the event from the run's `retrieved` list
(`{id: component_id, score}` per example), the resolved `entity_context` (alias/identifier
counts + a newly-added, non-rendered `entity_instance_id` key), and `routing_reason`, then
calls `save` inside its OWN try/except (defense in depth on top of the adapter's own
swallow — T-31-04). `container.py::_provide_autofill_use_case` now wires the writer through
a new `_provide_autofill_retrieval_event_repository` factory. 6 new tests in
`test_autofill_instrumentation.py` (RED confirmed via `TypeError: unexpected keyword
argument` before the constructor param existed) cover: exactly-one-save with correct
seed/injection fields (few-shot case), per-example seed-hit id/score, cold-start zero
counts, best-effort isolation (raising `save` doesn't propagate), no-port no-op, and
no-save-on-raised-ValueError. **Deviation (Rule 1/3):** two pre-existing
`test_autofill_entity_context.py` exact-dict-equality assertions broke when
`_resolve_entity_context`'s returned dict gained the new `entity_instance_id` key (needed
by `_save_retrieval_event` to populate `injected_entity_instance_id`) — updated both
assertions to include the new key; the prompt adapter (`_render_entity_context_block`)
only ever reads `"aliases"`/`"identifiers"`, so the untrusted-content contract from 31-01
is unaffected (confirmed no regression in the adapter test suite).

**Task 3 — Retrieval-miss-rate artifact + written definition.** `RETRIEVAL-MISS-RATE.md`
writes down the miss definition next to the artifact: Type A (had retrieval context yet
the human corrected it) and Type B (no context at all, human hand-filled), explicitly named
as the stage-3 (KGX-01..03) go/no-go gate. `retrieval-miss-rate.ts` runs one SQL query
(`buildMissRateQuery`, a shared CTE fragment) joining `autofill_retrieval_events` to
`extraction_records` on `component_id` — `WHERE status='confirmed'`, classifying by
`had_context` (seed_hit_count>0 OR injected_entity_instance_id IS NOT NULL) crossed with
`was_corrected` (non-empty `corrected_fields`) — prints `total_runs`, `total_misses`, the
type-A/type-B breakdown, and `miss_rate` (0..1, reported as `0` not `NaN` on an empty
table). A self-contained self-test runs the SAME query function against an inline `VALUES`
fixture (one no-context event + one corrected confirmation for the same synthetic
component_id) proving the join/classification logic — no writes to any real table, no FK
entanglement with `email_components`/`extraction_records`. Live run against local Postgres:
`total_runs=0 miss_rate=0.0000` (empty table, real data) followed by `Self-test PASSED`
(`total_runs=1 miss_type_b=1 miss_rate=1.0000` on the fixture) and `VERIFICATION PASSED`.

## Deviations from Plan

**1. [Rule 1/3 — pre-existing test drift from the entity_instance_id addition] Updated 2
`test_autofill_entity_context.py` exact-dict-equality assertions.** Not in the plan's own
`files_modified` list for that file, but adding `entity_instance_id` to the
`_resolve_entity_context` return dict (needed so `_save_retrieval_event` can populate
`injected_entity_instance_id` without a second lookup) broke the two tests asserting exact
equality against the pre-31-02 dict shape. Fixed by adding the expected
`"entity_instance_id": "ent-selected-001"` / `"ent-candidate-001"` key to each assertion —
no assertion was weakened, and a dedicated re-run of the full adapter/use-case test suite
confirmed no regression in the untrusted-content-only-in-user-turn contract from 31-01.

No architectural changes; no Rule 4 checkpoints triggered.

## Commits

- `9230a63` — feat(31-02): add autofill_retrieval_events table + RLS deny-all (Task 1)
- `63b2e3a` — feat(31-02): best-effort autofill retrieval-event instrumentation (Task 2)
- `bdb6a6f` — feat(31-02): retrieval-miss-rate artifact + written miss definition (Task 3)

## Verification

- `cd packages/db && npm run migrate:local && npm run with-env -- tsx
  scripts/verify-0028-live.ts` — VERIFICATION PASSED (columns + relrowsecurity=true + both
  RESTRICTIVE policies confirmed live).
- `pytest tests/test_autofill_instrumentation.py tests/test_autofill_entity_context.py
  tests/test_autofill_use_case.py tests/test_autofill_adapter.py
  tests/test_autofill_adapter_examples.py --no-cov` — 31/31 pass.
- Full email-listener suite (`pytest tests/ --no-cov`, excluding the known pre-existing
  `test_genui_retrieval_provider.py` flake) — all green, zero regressions
  (`tests/test_container.py` confirms the new DI binding boots cleanly).
- `ruff check` clean on all edited/created Python files; `mypy` clean on the 4 files this
  plan directly authored/edited in the instrumentation path
  (`autofill_retrieval_event.py`, `autofill_retrieval_event_repository.py` port+adapter,
  `autofill.py`); `container.py`'s 12 pre-existing transitive mypy errors are the same
  already-logged class documented in 31-01-SUMMARY.md (unrelated files, e.g.
  `genui_generator_adapter.py`, `supabase_ui_spec_template_repository.py`) — none newly
  introduced by this plan.
- `lint-imports` — 3/3 contracts kept (Domain has no external deps; Application does not
  import infrastructure; Infrastructure does not import presentation).
- `cd packages/db && npm run with-env -- tsx scripts/retrieval-miss-rate.ts` —
  `total_runs=0 miss_rate=0.0000` (real, empty table) then `Self-test PASSED` +
  `VERIFICATION PASSED`.
- `grep -c "RESTRICTIVE FOR ALL" packages/db/migrations/0028_autofill_retrieval_events.sql`
  → 2. `grep -n "retrieval_event" apps/email-listener/app/application/use_cases/autofill.py`
  → 11 hits (write call + supporting method, no in-place mutation of prior events).
  `grep -ni "UPDATE\|DELETE" packages/db/scripts/retrieval-miss-rate.ts` → 0 hits (query-time
  join only, no event mutation).
- `npx tsc --noEmit` clean in `packages/db`.

## TDD Gate Compliance

Task 2 (`tdd="true"`): RED confirmed first (`uv run pytest tests/test_autofill_instrumentation.py
-x -q` failed with `TypeError: AutofillUseCase.__init__() got an unexpected keyword argument
'retrieval_events'` before the constructor param existed), then GREEN (all 6 new tests +
2 updated pre-existing tests pass together with the full autofill regression suite). No
separate REFACTOR-only commit was needed — implementation and tests landed in one commit per
this plan's tight implementation↔test coupling (consistent with 31-01's documented
convention).

## Self-Check: PASSED

- FOUND: packages/db/migrations/0028_autofill_retrieval_events.sql
- FOUND: packages/db/scripts/verify-0028-live.ts
- FOUND: packages/db/src/schema/autofill-retrieval-events.ts
- FOUND: packages/db/scripts/retrieval-miss-rate.ts
- FOUND: packages/db/scripts/RETRIEVAL-MISS-RATE.md
- FOUND: apps/email-listener/app/domain/entities/autofill_retrieval_event.py
- FOUND: apps/email-listener/app/domain/ports/autofill_retrieval_event_repository.py
- FOUND: apps/email-listener/app/infrastructure/supabase/autofill_retrieval_event_repository.py
- FOUND: apps/email-listener/tests/test_autofill_instrumentation.py
- FOUND: commit 9230a63
- FOUND: commit 63b2e3a
- FOUND: commit bdb6a6f
- Verified: migration 0028 live-verified (RLS on); 31/31 targeted tests pass; full suite
  green; ruff/mypy/lint-imports clean on touched files; retrieval-miss-rate.ts prints a
  numeric rate + self-test PASSED against local Postgres.
