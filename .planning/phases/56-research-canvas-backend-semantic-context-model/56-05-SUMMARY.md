---
phase: 56-research-canvas-backend-semantic-context-model
plan: 05
subsystem: backend
tags: [python, hexagonal, promotion-gate, reuse-seam, research-canvas]

# Dependency graph
requires:
  - phase: 56-01
    provides: chat_source_ledger table (migration 0037, knowledge_node_id column, SET NULL FK)
  - phase: 56-02
    provides: SourceLedgerRepository port/adapter + SourceLedgerEntry dataclass, RunChatTurn auto-collect hook
provides:
  - "SourceLedgerRepository.set_knowledge_node_id(id, node_id) -- the ONE new write the reuse seam performs"
  - "PromoteSourceLedgerEntryUseCase -- ~50-line adapter reshaping a chat_source_ledger row onto the UNCHANGED SourceCaptureHandler.execute(), zero new promotion machinery"
  - "Git-based zero-diff proof: confirm_action_dispatch.py + promote_edge.py unchanged since the pre-plan base commit"
affects: [63]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promotion-gate reuse via reshape-and-delegate adapter (mirrors CLUS-05's PromoteEdgeUseCase reuse pattern) -- zero new tier-flip/node-upsert/edge-insert code, proven by a real git diff --stat assertion inside the test itself rather than just a docstring claim"

key-files:
  created:
    - apps/email-listener/app/application/use_cases/promote_source_ledger_entry.py
    - apps/email-listener/tests/application/test_promote_source_ledger_reuse.py
  modified:
    - apps/email-listener/app/domain/ports/source_ledger_repository.py
    - apps/email-listener/app/infrastructure/supabase/source_ledger_repository.py

key-decisions:
  - "Zero-diff proof implemented as an ACTUAL git-diff subprocess assertion inside the test file (git diff --stat <pre-plan-base-sha> -- confirm_action_dispatch.py promote_edge.py, asserting empty stdout), not just a docstring claim -- goes further than the CLUS-05 precedent test (test_source_capture_promote_reuse.py), which only asserts this in its own docstring/plan-acceptance-criterion, never as executable code. Base ref is the fixed pre-plan HEAD SHA (8bb10f4), captured before Task 1 started."
  - "Task 1's TDD RED/GREEN split across the two tasks: Task 1 lands only the adapter/port change + a 'backref'-named test subset (matching the plan's `-k backref` verify filter); Task 2 extends the SAME test file with the full reuse-proof suite once the use case exists. The plan's own Task 1 <files> list omitted the test file even though its <verify> filters within it -- resolved by building the file incrementally across both tasks rather than deviating from the plan's stated file scope."
  - "PromoteSourceLedgerEntryUseCase is NOT registered in DI and no route is exposed this phase -- exactly per the plan's stated scope boundary (Phase 63 owns the consumer). The reuse test constructs it directly with fakes."

requirements-completed: []  # RCNV-01 was already marked Complete by 56-02; this plan satisfies
  # the phase's Success Criterion #3 (promotion-gate reuse seam) which REQUIREMENTS.md notes
  # is prerequisite groundwork for RCNV-03/Phase 63, not a requirement this plan itself claims.

# Metrics
duration: ~25min
completed: 2026-07-15
---

# Phase 56 Plan 05: Promotion-Gate Reuse Seam Summary

**A ~50-line adapter (`PromoteSourceLedgerEntryUseCase`) reshapes a `chat_source_ledger` row onto the UNCHANGED `SourceCaptureHandler.execute()`, proven by a real `git diff --stat` assertion that `confirm_action_dispatch.py`/`promote_edge.py` show zero changes.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-15T07:19:35Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 modified: port + adapter, 2 created: use case + reuse test)

## Accomplishments

- `SourceLedgerRepository` Protocol gains `set_knowledge_node_id(ledger_entry_id, node_id) -> None`; `SupabaseSourceLedgerRepository` implements it as a single parameterized `table("chat_source_ledger").update({"knowledge_node_id": node_id}).eq("id", ledger_entry_id)` call — the ONE new write the reuse seam performs beyond the reused promotion machinery.
- `PromoteSourceLedgerEntryUseCase` (`promote_source_ledger_entry.py`): reads a ledger row (`{"status":"capture_failed"}` if missing, no handler call), reshapes it into `SourceCaptureHandler.execute()`'s exact `source_payload` shape (`{url, title, retrievedAt: captured_at.isoformat()}`), calls it verbatim with `action="confirm"`, `suggestion_id=ledger_entry_id` (lookup key only), `widget_interaction_id=""` (no widget — RCNV-01's anti-ceremony intent), `conversation_id=entry.conversation_id`. On a `"captured"` result, calls `set_knowledge_node_id` before returning the handler's result unchanged. Contains no tier-flip, node-upsert, or edge-insert logic of its own — verified by a dedicated test that inspects the class source for those literals.
- **The reuse proof, made executable:** `test_confirm_action_dispatch_and_promote_edge_show_zero_diff` runs `git diff --stat <pre-plan-base-sha> -- confirm_action_dispatch.py promote_edge.py` as a real subprocess (no shell, fixed argv, cwd resolved from `__file__`) and asserts empty stdout. Actual captured output:

  ```
  $ git diff --stat 8bb10f4 -- app/application/use_cases/confirm_action_dispatch.py app/application/use_cases/promote_edge.py
  (empty — zero diff)
  ```

- `test_promote_source_ledger_reuse.py` (6 tests, all green): 2 adapter call-shape tests for the backref (Task 1), the captured→promoted happy path (asserts the correct `upsert_node`/`insert_edge` calls reach the real `SourceCaptureHandler`, plus `set_knowledge_node_id` called with the returned node id), the missing-row `capture_failed` path (handler never called), the no-promotion-logic source-inspection guard, and the git-based zero-diff proof.

## Task Commits

Each task was committed atomically:

1. **Task 1: set_knowledge_node_id on the ledger port + adapter** - `4f2225f` (feat)
2. **Task 2: PromoteSourceLedgerEntryUseCase + zero-diff reuse proof** - `3260c41` (feat)

**Plan metadata:** (this commit, see below)

## Files Created/Modified

- `apps/email-listener/app/domain/ports/source_ledger_repository.py` - `set_knowledge_node_id` added to the `SourceLedgerRepository` Protocol
- `apps/email-listener/app/infrastructure/supabase/source_ledger_repository.py` - `SupabaseSourceLedgerRepository.set_knowledge_node_id` implementation
- `apps/email-listener/app/application/use_cases/promote_source_ledger_entry.py` - `PromoteSourceLedgerEntryUseCase` (the reuse-seam adapter)
- `apps/email-listener/tests/application/test_promote_source_ledger_reuse.py` - adapter backref tests (Task 1) + reuse-proof suite incl. the git-based zero-diff assertion (Task 2)

## Decisions Made

- Implemented the zero-diff proof as an actual `git diff --stat` subprocess assertion inside the test file, comparing the working tree against a fixed pre-plan base SHA (`8bb10f4`, captured as the HEAD commit immediately before this plan's Task 1). This goes beyond the CLUS-05 precedent (`test_source_capture_promote_reuse.py`), whose docstring claims the same zero-diff property but never asserts it in code — this plan's `<execution_rules>` explicitly asked for "an actual `git diff --stat` assertion," so it is now enforced, not just documented.
- Split the reuse test file's construction across both tasks to satisfy Task 1's `<verify>` command (`pytest ... -k backref`), which filters within `test_promote_source_ledger_reuse.py` even though that file isn't in Task 1's declared `<files>` list. Landed the adapter-only "backref" tests in Task 1's commit, then extended the same file with the full reuse-proof suite in Task 2 — avoids a plan deviation while keeping each task's commit buildable/importable/testable in isolation.
- `git` executable resolved via `shutil.which("git")` (falls back to the bare `"git"` string) rather than a literal `"git"` argv element, satisfying the repo's bandit/ruff `S607` (partial executable path) rule; bandit itself already excludes `tests/` per `pyproject.toml`, so this is a ruff-driven fix, not a bandit finding.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria are met: the port/adapter backref method exists and is tested; the use case exists, delegates entirely to the unchanged `SourceCaptureHandler`, and the reuse test proves both the promotion path and the zero-diff property. The Task 1/Task 2 test-file-construction-order clarification above is a scope note, not a deviation — no plan-specified behavior was changed.

## Issues Encountered

None blocking. Two ruff findings surfaced during Task 2 verification and were fixed inline before commit: `PT018` (a combined `isinstance(...) and node_id` assertion split into two asserts) and `S607` (the `git` argv element resolved via `shutil.which` instead of a bare string). `ruff format` reformatted the test file once (wrapped a multi-line `find_active_node` signature) — accepted as-is.

## User Setup Required

None — no external service configuration required. Migration 0037's `chat_source_ledger.knowledge_node_id` column (from 56-01) remains AUTHORED + GENERATED but NOT APPLIED to any environment, matching this milestone's standing posture; `set_knowledge_node_id`'s adapter call degrades the same way every other Supabase write in this codebase does against an unapplied table (an exception the caller — Phase 63's future consumer — must itself handle or the fail-open convention must be extended when that consumer lands, since this use case does not wrap the call in its own try/except by design, matching `SourceCaptureHandler.execute()`'s own "never raise past execute()" contract instead).

## Next Phase Readiness

- The promotion-gate reuse seam (`PromoteSourceLedgerEntryUseCase`) is ready for Phase 63's canon-curation UX to wire into DI and expose via a route/consumer — this phase deliberately claims neither.
- Success Criterion #3 is satisfied: a `chat_source_ledger` row is promotable into the suggest-only knowledge graph through the existing gate with zero new promotion code, proven by an executable zero-diff reuse test, and the promoted node id is back-referenced onto the ledger row.
- No blockers for any other Phase 56 plan — this plan touched neither `chat_context_edges` nor `_execute_turn`'s system-prompt assembly, and modified only files this plan's own `<files_modified>` list declared plus the one new use-case file plus the one new test file.

---
*Phase: 56-research-canvas-backend-semantic-context-model*
*Completed: 2026-07-15*

## Self-Check: PASSED

All created/modified files verified present on disk (source_ledger_repository.py x2,
promote_source_ledger_entry.py, test_promote_source_ledger_reuse.py, this SUMMARY.md).
Both task commits (4f2225f, 3260c41) verified present in `git log --oneline --all`.
Full reuse test file green (6/6); adjacent regression suites green (test_source_capture_dispatch,
test_source_capture_promote_reuse, test_run_chat_turn_source_ledger, test_container -- 60 total
tests across all five files, --no-cov). ruff check/format, mypy, bandit, lint-imports all clean
on every touched/created file. Actual `git diff --stat 8bb10f4 -- confirm_action_dispatch.py
promote_edge.py` output captured above: empty (zero diff).
