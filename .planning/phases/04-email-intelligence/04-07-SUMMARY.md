---
phase: "04"
plan: "07"
subsystem: autofill
tags: [llm, bedrock, autofill, cold-start, structured-output, clean-arch]
dependency_graph:
  requires: [04-04, 04-05, 04-06]
  provides: [AutofillProtocol, AnthropicAutofiller, AutofillUseCase, POST /v1/components/{id}/autofill]
  affects: [container, main, extraction_repository]
tech_stack:
  added: [AsyncAnthropicBedrock tool-schema structured output]
  patterns: [AutofillProtocol port, TDD RED->GREEN, D-14 prompt-injection defense, cold-start D-13, candidate-only T-04-25, importer-scoped fallback T-04-26]
key_files:
  created:
    - apps/email-listener/app/domain/ports/autofill_protocol.py
    - apps/email-listener/app/infrastructure/llm/autofill_adapter.py
    - apps/email-listener/app/application/use_cases/autofill.py
    - apps/email-listener/app/presentation/api/v1/components.py
    - apps/email-listener/tests/test_autofill_adapter.py
    - apps/email-listener/tests/test_autofill_use_case.py
    - apps/email-listener/tests/test_components_api.py
  modified:
    - apps/email-listener/app/container.py
    - apps/email-listener/app/main.py
decisions:
  - "D-14 enforced structurally: region content only in user turn inside <document_content> delimiters; system prompt built from schema+KB only"
  - "Cold-start uses entity_type.description as KB; examples=() always passed; Plan 04-08 extends with retrieval"
  - "AutofillUseCase inserts only status=candidate records (T-04-25); nothing auto-confirms"
  - "find_by_slug falls back importer_id -> None for system-default entity types (T-04-26)"
  - "Confidence = field_completeness x mean_self_confidence (RESEARCH §5)"
  - "Retry: 3 attempts, (2,5,15)s delays; returns empty AutofillResult on total failure, never raises"
  - "from __future__ import annotations excluded from components.py router (Pydantic forward-ref fix)"
metrics:
  duration: "~45 minutes (continued from prior session)"
  completed: "2026-06-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 2
  tests_added: 13
  coverage_total: "89.99%"
---

# Phase 04 Plan 07: Cold-start Autofill Summary

Cold-start LLM field extraction via AWS Bedrock tool-schema structured output with D-14 prompt-injection defense, candidate-only persistence, and importer-scoped entity type fallback.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | AutofillProtocol + AnthropicAutofiller | 75fa4a5 | autofill_protocol.py, autofill_adapter.py, test_autofill_adapter.py |
| 2 | AutofillUseCase + API + DI wiring | e8475c1 | autofill.py, components.py, container.py, main.py, test_autofill_use_case.py, test_components_api.py |

## What Was Built

**AutofillProtocol** (`app/domain/ports/autofill_protocol.py`): frozen dataclass `AutofillResult` + `Protocol` port with `autofill(*, region_text, entity_type, knowledge_base_text, examples)`.

**AnthropicAutofiller** (`app/infrastructure/llm/autofill_adapter.py`): AWS Bedrock adapter implementing AutofillProtocol. System prompt contains schema+KB only (never region content). Region placed in user turn inside `<document_content>` delimiters (D-14). Uses `extract_fields` tool schema for structured output. Retry loop 3 attempts with (2,5,15)s delays; returns `AutofillResult({}, 0.0, None)` on exhaustion, never raises.

**AutofillUseCase** (`app/application/use_cases/autofill.py`): loads Component via `find_by_id`, loads EntityType via `find_by_slug(importer_id)` with `find_by_slug(None)` fallback for system defaults (T-04-26), calls `autofiller.autofill(..., examples=())`, persists `status=candidate` ExtractionRecord (T-04-25). No infrastructure imports (lint-imports contract kept).

**POST /v1/components/{id}/autofill** (`app/presentation/api/v1/components.py`): `AutofillRequest(entity_type_slug)` body, `AutofillResultView` response wrapped in `ApiResponse`. `ValueError` → 404. Router uses `require_api_key` dependency.

**DI wiring**: `_provide_autofiller` factory in `container.py` (returns `AutofillProtocol`), `AutofillUseCase` registered directly (dishka introspects `__init__`). `components_router` included in `main.py`.

## Test Results

- 202 tests total, all passing
- 13 new tests added across 3 test files
- Coverage: 89.99% (target 80%)
- ruff, mypy, lint-imports: all clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] mypy call-overload on messages.create**
- Found during: Task 1 GREEN
- Issue: Bedrock client has multiple overloads; mypy cannot resolve dict-based `messages` argument
- Fix: `# type: ignore[call-overload]` on `messages.create` call (same pattern as segmentation_adapter.py)
- Files modified: autofill_adapter.py

**2. [Rule 1 - Bug] Pydantic PydanticUserError in components API tests**
- Found during: Task 2 GREEN
- Issue: `from __future__ import annotations` in components.py made type hints lazy strings; Pydantic cannot resolve `ApiResponse[AutofillResultView]` at runtime
- Fix: Removed `from __future__ import annotations` from components.py router
- Files modified: components.py

**3. [Rule 1 - Bug] Auth test returned 200 instead of 401**
- Found during: Task 2 GREEN
- Issue: DEVELOPMENT env with no `API_KEY` set bypasses auth; test client inherited no-key environment
- Fix: Set `os.environ["API_KEY"] = "test-secret-key"` + `get_settings.cache_clear()` before building auth client, following `test_reprocess_requires_api_key` pattern
- Files modified: test_components_api.py

**4. [Rule 1 - Bug] ruff RUF002 ambiguous Unicode × in docstring**
- Found during: Task 2 quality gate
- Issue: `×` (MULTIPLICATION SIGN U+00D7) in `_compute_confidence` docstring flagged as ambiguous
- Fix: Replaced with ASCII `x`
- Files modified: autofill_adapter.py

## Known Stubs

None — all fields are wired; cold-start KB uses entity_type.description which is a real DB column.

## Threat Flags

None — no new network endpoints beyond the single `/v1/components/{id}/autofill` which is gated by `require_api_key`. No new auth paths, file access patterns, or schema changes at trust boundaries.

## Self-Check: PASSED

- `apps/email-listener/app/domain/ports/autofill_protocol.py` — FOUND (committed 75fa4a5)
- `apps/email-listener/app/infrastructure/llm/autofill_adapter.py` — FOUND (committed 75fa4a5, e8475c1)
- `apps/email-listener/app/application/use_cases/autofill.py` — FOUND (committed e8475c1)
- `apps/email-listener/app/presentation/api/v1/components.py` — FOUND (committed e8475c1)
- Task 1 commit 75fa4a5 — exists in git log
- Task 2 commit e8475c1 — exists in git log
- 202 tests passing, 89.99% coverage
