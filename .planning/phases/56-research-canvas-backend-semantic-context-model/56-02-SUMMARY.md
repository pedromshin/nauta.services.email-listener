---
phase: 56-research-canvas-backend-semantic-context-model
plan: 02
subsystem: backend
tags: [python, hexagonal, chat-tool-loop, source-ledger, research-canvas]

# Dependency graph
requires:
  - phase: 56-01
    provides: chat_source_ledger table (migration 0037, AUTHORED/GENERATED, not yet applied) + Drizzle schema
provides:
  - "SourceLedgerRepository domain port (SourceLedgerEntry dataclass + Protocol: insert_entries, get)"
  - "SupabaseSourceLedgerRepository adapter -- idempotent upsert on the (conversation_id, tool_use_id, result_index) dedupe index"
  - "RunChatTurn's fail-open auto-collect write hook (_write_source_ledger_entries), fired inside _run_server_tool_round for every gated web_search result"
  - "container.py DI wiring: SupabaseSourceLedgerRepository -> SourceLedgerRepository, threaded into _provide_run_chat_turn"
affects: [56-03, 56-04, 56-05, 57, 63]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "additive-default collaborator posture (source_ledger: SourceLedgerRepository | None = None) mirrored exactly from email_repository -- feature structurally OFF when unwired, byte-identical regression guard proven by test"
    - "fail-open try/except-Exception-then-log-and-return idiom mirrored from _list_captured_sources/_resolve_thread_id, applied to a WRITE path instead of a read path"

key-files:
  created:
    - apps/email-listener/app/domain/ports/source_ledger_repository.py
    - apps/email-listener/app/infrastructure/supabase/source_ledger_repository.py
    - apps/email-listener/tests/application/test_run_chat_turn_source_ledger.py
  modified:
    - apps/email-listener/app/application/use_cases/run_chat_turn.py
    - apps/email-listener/app/container.py

key-decisions:
  - "SourceLedgerEntry is ONE dataclass serving both the write-time shape (insert_entries -- id/captured_at/knowledge_node_id unset) and the read-time shape (get -- fully populated), per the plan's explicit instruction rather than two separate DTOs."
  - "The ledger-eligible tool allowlist (_LEDGER_ELIGIBLE_TOOL_NAMES) is a plain module-level frozenset, not a self._ instance attribute, since it never varies per-instance -- matches _WEB_SEARCH_TOOL_NAME's own module-constant placement immediately above it."
  - "No settings kill-switch added (A4 from 56-RESEARCH.md) -- gating is inherited transitively from WEB_SEARCH_TOOL_ENABLED; the hook only ever fires for an already-gated tool."

requirements-completed: [RCNV-01]  # Satisfied at the deterministic/unit-test layer this plan --
  # see "Deferred Human-Verifiable Follow-up" below for the live-DB caveat.

# Metrics
duration: ~35min
completed: 2026-07-15
---

# Phase 56 Plan 02: Fail-Open Auto-Collect Source Ledger Hook Summary

**RunChatTurn now writes one chat_source_ledger row per web_search result automatically, inside the existing tool-round loop, with zero capture-confirm ceremony and zero knowledge-graph writes -- fail-open at every step.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-15T06:15:00Z
- **Tasks:** 2/2 completed
- **Files modified:** 5 (2 created domain/infra, 1 created test file, 2 modified: run_chat_turn.py, container.py)

## Accomplishments

- `SourceLedgerRepository` domain port (`SourceLedgerEntry` frozen dataclass + `Protocol` with `insert_entries`/`get`) -- domain-layer-only, import-linter clean, mirrors `KnowledgeGraphRepository`'s Protocol shape exactly.
- `SupabaseSourceLedgerRepository` adapter: `insert_entries` is a no-op for `[]` (never touches the DB), otherwise upserts on `on_conflict="conversation_id,tool_use_id,result_index"` (idempotent-retry-safe against migration 0037's dedupe index); `get` reads via `.maybe_single()` (confirmed via `postgrest` source: returns `None` for zero rows, a `SingleAPIResponse` with `.data` as a plain dict for exactly one row).
- `RunChatTurn` gains an additive-default `source_ledger: SourceLedgerRepository | None = None` constructor param (mirrors `email_repository`'s exact posture) and a private `_write_source_ledger_entries` fail-open helper, following the SAME `try/except Exception -> logger.warning -> return` idiom as `_list_captured_sources`/`_resolve_thread_id`.
- The hook fires inside `_run_server_tool_round`, immediately after `cap_tool_output` (i.e. AFTER the FOUND-6 envelope-quarantine gate), guarded by `self._source_ledger is not None and result.is_error is False and tool_name in _LEDGER_ELIGIBLE_TOOL_NAMES` (`_LEDGER_ELIGIBLE_TOOL_NAMES = frozenset({_WEB_SEARCH_TOOL_NAME})`).
- `container.py`: registers `provider.provide(SupabaseSourceLedgerRepository, provides=SourceLedgerRepository)` and threads `source_ledger=source_ledger` into `_provide_run_chat_turn`'s `RunChatTurn(...)` construction.
- Zero knowledge-graph writes anywhere in this plan's diff -- `grep -c "knowledge_node" run_chat_turn.py` is unchanged from baseline (2 -> 2; the new docstring deliberately avoids the literal substring so a mechanical count stays a meaningful signal).

## Task Commits

Each task was committed atomically:

1. **Task 1: SourceLedgerRepository port + Supabase adapter** - `6a726a3` (feat)
2. **Task 2: Fail-open write hook in _run_server_tool_round + DI wiring** - `7f896db` (feat)

**Plan metadata:** (this commit, see below)

## Files Created/Modified

- `apps/email-listener/app/domain/ports/source_ledger_repository.py` - `SourceLedgerEntry` dataclass + `SourceLedgerRepository` Protocol
- `apps/email-listener/app/infrastructure/supabase/source_ledger_repository.py` - `SupabaseSourceLedgerRepository` (`_entry_to_row`/`_row_to_entry` builders, `insert_entries`/`get`)
- `apps/email-listener/app/application/use_cases/run_chat_turn.py` - `_LEDGER_ELIGIBLE_TOOL_NAMES` constant, `source_ledger` constructor param + `self._source_ledger`, `_write_source_ledger_entries` helper, hook call site inside `_run_server_tool_round`
- `apps/email-listener/app/container.py` - `SourceLedgerRepository`/`SupabaseSourceLedgerRepository` imports, `provider.provide` registration, `source_ledger` factory param + threading into `RunChatTurn(...)`
- `apps/email-listener/tests/application/test_run_chat_turn_source_ledger.py` - adapter call-shape tests (4) + hook behavior tests (5): correct per-result mapping, ineligible-tool no-op, is_error no-op, truncation-induced malformed-envelope fail-open, no-collaborator byte-identical regression guard

## Decisions Made

- Kept `SourceLedgerEntry` as a single dataclass covering both write and read shapes, per the plan's explicit `<action>` instruction ("read-only capted_at/knowledge_node_id on the read shape") rather than splitting into a write DTO + read DTO.
- Verified `postgrest` (the installed version, via `inspect.getsource`) rather than assuming `.maybe_single().execute()`'s no-row behavior -- confirmed it returns Python `None` (not an object with `.data = None`), which the adapter's `get` now handles explicitly (`if result is None or not result.data: return None`).
- Tested Pitfall 1 (56-RESEARCH.md: `cap_tool_output`'s mid-JSON truncation) directly rather than as a hypothetical -- built a real oversized-but-envelope-gate-passing fixture (`"snippet": "S" * 2500`) that provably breaks JSON only AFTER truncation, proving the fail-open path end-to-end rather than merely asserting via a mocked JSONDecodeError.

## Deviations from Plan

None — plan executed exactly as written. The domain port, Supabase adapter, hook placement, DI wiring, and test coverage all match the plan's `<action>`/`<behavior>`/`<acceptance_criteria>` specifications. One self-correction during execution: the adapter's `Client` import initially followed the domain port's `TYPE_CHECKING`-only convention, which broke dishka's `provider.provide(SupabaseSourceLedgerRepository, ...)` type analysis (`UndefinedTypeAnalysisError: Type 'Client' is not defined`) — fixed by moving `from supabase import Client` to a real top-level import, matching `knowledge_graph_repository.py`'s own adapter-file convention exactly (Rule 3, blocking issue, caught by `tests/test_container.py`'s DI-graph-resolution test before commit).

## Issues Encountered

None blocking. `ruff format` reformatted one line in the adapter (`get`'s chained call collapsed to a single 120-char line, under the repo's `line-length = 120` limit) — accepted the formatter's output, no manual override needed.

## User Setup Required

None — no external service configuration required. As documented in 56-01-SUMMARY.md, migration 0037 (`chat_source_ledger`/`chat_context_edges`) is AUTHORED + GENERATED but NOT APPLIED to any environment. This plan's hook is written to feature-detect implicitly: the fail-open `try/except Exception` wrapping `insert_entries` means an unapplied table (a Supabase "relation does not exist" error) degrades to a logged warning, never a crash — no separate `tableColumnExists`-style pre-check was needed on the Python side (the existing fail-open contract already covers it).

## Deferred Human-Verifiable Follow-up

Per the plan's own `<success_criteria>`: RCNV-01 / Success Criterion #1 is proven at the deterministic/unit-test layer this plan (a fake-executor web_search round provably produces the correct ledger insert with no confirm step, plus the fail-open/regression guarantees). Full live-DB proof — apply migration 0037 to a real environment, issue a real web_search chat turn, confirm a row lands in `chat_source_ledger` — is NOT yet performed (Docker/Supabase availability was not reprobed this session; consistent with 56-01's "authored, not applied" posture). This is a `checkpoint:human-verify`-shaped follow-up, not a code gap:
1. Apply migration 0037 (local -> staging -> prod, per the deploy playbook's migrations-first convention).
2. Issue a real chat turn that triggers `web_search` (requires `WEB_SEARCH_TOOL_ENABLED=True`, already flipped per 54-02/54-07).
3. Query `chat_source_ledger` for the conversation and confirm rows appeared with no confirm-widget interaction.

REQUIREMENTS.md marks RCNV-01 complete (mechanism proven, mirrors this milestone's established "code-complete + unit-tested against fakes, live-UAT is a documented follow-up" posture from Phase 54) — the live-DB step above remains open and should be folded into the milestone's live-acceptance runsheet (`MORNING-CHECKLIST.md` §H-style) alongside the other deferred live legs.

## Next Phase Readiness

- `SourceLedgerRepository`/`SupabaseSourceLedgerRepository` and the `chat_source_ledger` write path are ready for 56-05's promotion-gate reuse seam (`PromoteSourceLedgerEntryUseCase`, per 56-RESEARCH.md Pattern 4) to build against `get`.
- No blockers for 56-03 (tRPC `chat_context_edges` seam) or 56-04 (linked-context read/inject pipeline) — this plan touched neither `chat_context_edges` nor `_execute_turn`'s system-prompt assembly.
- Concurrent Phase 55 execution was active throughout this session (node_modules-touching files visible in `git status` were never staged or touched by this plan, per the shared-file discipline in this plan's execution rules).

---
*Phase: 56-research-canvas-backend-semantic-context-model*
*Completed: 2026-07-15*

## Self-Check: PASSED

All created files verified present on disk (source_ledger_repository.py x2,
test_run_chat_turn_source_ledger.py, this SUMMARY.md). Both task commits
(6a726a3, 7f896db) verified present in `git log --oneline --all`. Full test
file green (9/9), regression suites green (thread_context, envelope_gate,
tool_loop, tool_loop_e2e, real_tools_wiring, source_capture_*,
tool_envelope_contract, test_container -- 288 application-layer tests total).
ruff check/format, mypy, bandit all clean on every touched/created file.
lint-imports contract intact (3 kept, 0 broken).
