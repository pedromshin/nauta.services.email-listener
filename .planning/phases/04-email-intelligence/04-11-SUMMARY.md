---
phase: "04"
plan: "11"
subsystem: email-intelligence
tags: [use-case, di-container, parser-dispatch, region-proposal, bedrock, tdd]
dependency-graph:
  requires: ["04-10"]
  provides: ["ProposeRegionsUseCase", "IngestInboundEmailUseCase.parser-dispatch", "container-segmenter"]
  affects: ["IngestInboundEmailUseCase", "container.py"]
tech-stack:
  added: [AsyncAnthropicBedrock, AnthropicSegmenter, TextractOcrAdapter, PdfParser, ProposeRegionsUseCase]
  patterns: [clean-architecture-use-case, dishka-factory-workaround, dataclasses-replace-immutable-stitch]
key-files:
  created:
    - apps/email-listener/app/application/use_cases/propose_regions.py
    - apps/email-listener/tests/test_propose_regions.py
  modified:
    - apps/email-listener/app/application/use_cases/ingest_inbound_email.py
    - apps/email-listener/app/container.py
    - apps/email-listener/tests/test_ingest_use_case.py
    - apps/email-listener/tests/test_container.py
decisions:
  - "dishka factory workaround: ParserRegistryPort=Callable with forward-refs causes UndefinedTypeAnalysisError; solved by annotating _provide_parser_registry as -> object and using factory function _provide_ingest_use_case to bypass class introspection"
  - "ParserRegistryPort cast via type: ignore[assignment] inside factory; no inline N814 alias"
  - "ProposeRegionsUseCase.execute: save_many called once with all children across pages; per-page failures isolated"
  - "IngestInboundEmailUseCase.execute: propose_regions called once post-attachment loop wrapped in try/except"
metrics:
  duration: "~6h (including context compaction)"
  completed: "2026-06-12T13:08:04Z"
  tasks: 2
  files: 5
---

# Phase 04 Plan 11: ProposeRegionsUseCase + Ingest Dispatch Summary

ProposeRegionsUseCase segments attachment_page Components via SegmenterProtocol; IngestInboundEmailUseCase dispatches attachments through ParserRegistryPort and calls ProposeRegionsUseCase post-persist; dishka container wired with Bedrock+Textract providers.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | ProposeRegionsUseCase + container providers (Bedrock, Segmenter, PdfParser, registry) | ca42216 | propose_regions.py, container.py, test_propose_regions.py, test_container.py |
| 2 | Parser-registry dispatch + ProposeRegionsUseCase hook in IngestInboundEmailUseCase | 2176edf | ingest_inbound_email.py, container.py, test_ingest_use_case.py |

## Verification

All quality gates passed after Task 2:
- `uv run ruff check .` — 0 errors
- `uv run ruff format --check .` — 88 files formatted
- `uv run mypy app` — Success: no issues found in 67 source files
- `uv run lint-imports` — 3 contracts kept, 0 broken
- `uv run pytest --no-cov` — 170 passed, 1 warning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] mypy error on dict[str,object].get() return type**
- **Found during:** Task 1 (mypy gate)
- **Issue:** `page.location.get("page_index", 0)` returns `object`; `int(object)` has no overload
- **Fix:** Narrowed with `isinstance(raw_page_index, (int, float, str))` before int() call
- **Files modified:** propose_regions.py
- **Commit:** ca42216

**2. [Rule 3 - Blocking] dishka UndefinedTypeAnalysisError for ParserRegistryPort**
- **Found during:** Task 1 (container wiring)
- **Issue:** `ParserRegistryPort = Callable[["str"], "ParserProtocol | None"]` uses string annotations dishka cannot resolve at runtime
- **Fix:** `_provide_parser_registry` annotated `-> object`; registered with `provides=ParserRegistryPort`; cast inside `_provide_ingest_use_case` factory with `# type: ignore[assignment]`
- **Files modified:** container.py
- **Commit:** ca42216

**3. [Rule 3 - Blocking] dishka UndefinedTypeAnalysisError for IngestInboundEmailUseCase constructor**
- **Found during:** Task 2 (container wiring)
- **Issue:** After adding `parser_registry: ParserRegistryPort` to `__init__`, dishka's `_make_factory_by_class` fails on forward-ref resolution
- **Fix:** Replaced `provider.provide(IngestInboundEmailUseCase)` with explicit `_provide_ingest_use_case` factory function
- **Files modified:** container.py
- **Commit:** 2176edf

**4. [Rule 2 - Ruff/Style] 23 ruff errors before Task 2 commit**
- **Found during:** Task 2 quality gate
- **Issue:** N814 inline alias, RUF059 unused unpacked variables (mocks/repo), N806 CamelCase local var
- **Fix:** Removed inline imports (used ParserRegistryPort directly), renamed mocks→_mocks (6 places), repo→_repo (7 places), ProposeRegionsUseCase→use_case_cls
- **Files modified:** container.py, test_ingest_use_case.py, test_propose_regions.py
- **Commit:** 2176edf

## Known Stubs

None — all wiring is production-grade (Bedrock IAM role, Textract OCR, real PdfParser).

## Self-Check: PASSED

- [x] `apps/email-listener/app/application/use_cases/propose_regions.py` — exists
- [x] `apps/email-listener/app/application/use_cases/ingest_inbound_email.py` — exists
- [x] `apps/email-listener/app/container.py` — exists
- [x] Commit ca42216 — Task 1
- [x] Commit 2176edf — Task 2
- [x] 170 tests passing
