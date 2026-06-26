---
phase: "04-email-intelligence"
plan: "09"
subsystem: "test-corpus"
tags: ["corpus", "pdf-pipeline", "ground-truth", "D-17", "propose-regions"]
dependency_graph:
  requires: ["04-04", "04-05", "04-06"]
  provides: ["D-17 layered corpus", "forwarding harness", "end-to-end corpus test"]
  affects: ["test coverage", "pipeline confidence"]
tech_stack:
  added: []
  patterns:
    - "_HAS_PDF dep-gating (try import pypdf)"
    - "asyncio.to_thread() for sync I/O in async harness functions"
    - "InMemory fake repos for all infrastructure ports (no real S3/Supabase)"
    - "patch.object(parser, '_rasterize_page') to stub poppler in CI"
    - "asyncio.run() nested coroutine for _run_propose (Python 3.13 compatible)"
key_files:
  created:
    - "apps/email-listener/tests/corpus/__init__.py"
    - "apps/email-listener/tests/corpus/manifest.json"
    - "apps/email-listener/tests/corpus/ground_truth.json"
    - "apps/email-listener/tests/corpus/forwarding_harness.py"
    - "apps/email-listener/tests/corpus/scan_noise/rvl_cdip_invoice_001.pdf"
    - "apps/email-listener/tests/corpus/scan_noise/doclaynet_invoice_001.pdf"
    - "apps/email-listener/tests/corpus/logistics_vocab/bill_of_lading_template.pdf"
    - "apps/email-listener/tests/corpus/logistics_vocab/commercial_invoice_template.pdf"
    - "apps/email-listener/tests/corpus/logistics_vocab/packing_list_template.pdf"
    - "apps/email-listener/tests/corpus/logistics_vocab/booking_confirmation_template.pdf"
    - "apps/email-listener/tests/corpus/hard_cases/multi-invoice-in-one-pdf.pdf"
    - "apps/email-listener/tests/corpus/hard_cases/nested-entities-on-one-page.pdf"
    - "apps/email-listener/tests/corpus/hard_cases/junk-corrupt.pdf"
    - "apps/email-listener/tests/corpus/hard_cases/photo-of-screen.pdf"
    - "apps/email-listener/tests/test_corpus_pipeline.py"
    - "gen_corpus.py"
  modified: []
decisions:
  - "D-17 corpus PDFs generated as minimal but non-empty real PDFs using raw PDF byte construction (no external reportlab/fpdf dependency required)"
  - "asyncio.run() with nested _inner() coroutine used in _run_propose to avoid asyncio.get_event_loop() deprecation in Python 3.13"
  - "forwarding_harness wraps IngestInboundEmailUseCase (not DecomposeEmailUseCase) since the former is the live production entry point used by 04-06"
  - "Integration test variants gated on AWS_ACCESS_KEY_ID (Textract) and ANTHROPIC_API_KEY (LLM segmenter)"
metrics:
  duration: "~90 minutes (across two sessions)"
  completed_date: "2026-06-12"
  tasks_completed: 2
  files_created: 16
---

# Phase 04 Plan 09: Layered Test Corpus (D-17) Summary

One-liner: Layered test corpus with manifest + controlled ground truth + forwarding harness proves the parse-to-propose-regions pipeline against all four D-17 hard cases, offline-deterministic at 90% coverage.

## What Was Built

### Task 1: Corpus tree, manifest, ground truth, forwarding harness (bc0f746)

**Corpus structure** — `tests/corpus/` with three layers:

| Layer | Files | Content |
|-------|-------|---------|
| scan_noise | rvl_cdip_invoice_001.pdf, doclaynet_invoice_001.pdf | Simulated scanned invoice pages (image-only, no text layer) |
| logistics_vocab | bill_of_lading_template.pdf, commercial_invoice_template.pdf, packing_list_template.pdf, booking_confirmation_template.pdf | Format templates with realistic logistics identifiers |
| hard_cases | multi-invoice-in-one-pdf.pdf, nested-entities-on-one-page.pdf, junk-corrupt.pdf, photo-of-screen.pdf | Four named D-17 hard cases with controlled ground truth |

**manifest.json** — 10 entries, each with: `file` (relative path), `layer`, `provenance`, `content_type`, `expected_entity_types`, `has_text_layer`, `notes`.

**ground_truth.json** — keyed by hard-case relative path, each with `expected`:
- `multi-invoice-in-one-pdf.pdf`: `min_region_count=2`, `invoice_numbers=[INV-2024-10001, INV-2024-10002]`
- `nested-entities-on-one-page.pdf`: `bl_number=MSCU2024-00551`, `container_number=TCKU3001234`, `invoice_ref=INV-NEST-0099`, `assertions.parent_linkage`
- `junk-corrupt.pdf`: `parse_behavior=error_or_empty`, `min_region_count=0`, `assertions.no_raise`
- `photo-of-screen.pdf`: `parse_behavior=ocr_required`, `has_text_layer=false`

**forwarding_harness.py** — provides `forward_corpus_file(path, *, importer_id, content_type, fake_segmenter)` and six in-memory fakes:
- `LocalFileRawEmailStore` — MIME bytes dict keyed by synthetic SES message IDs
- `InMemoryAttachmentStorage` — blob dict
- `InMemoryEmailRepository`, `InMemoryAttachmentRepository`, `InMemoryComponentRepository` — dict-backed
- `FixedImporterResolver` — always returns fixed importer_id

### Task 2: End-to-end corpus pipeline test (639264b)

`tests/test_corpus_pipeline.py` — 26 tests across 8 test classes:

| Test class | Coverage |
|-----------|----------|
| `test_manifest_*` (3) | Manifest integrity — files exist, non-empty, all 3 layers present, GT covers all hard cases |
| `TestTextLayerFiles` (6 parametrized) | parse() yields non-empty content_text for text-layer PDFs |
| `TestImageOnlyFiles` (4 parametrized) | parse() does not raise for image-only PDFs; _rasterize_page mocked |
| `TestJunkCorruptFile` (2) | no-raise + zero regions from empty segmenter |
| `TestMultiInvoiceHardCase` (3) | parse multi-page + >=2 invoice regions + identifier text in extracted content |
| `TestNestedEntitiesHardCase` (3) | parse + identifier text + parent_component_id sibling linkage |
| `TestPhotoOfScreenHardCase` (2) | no-raise + _rasterize_page called |
| `test_layer_has_parseable_file` (3 parametrized) | One file per layer must parse cleanly |
| Integration variants (5, skipped offline) | Live OCR (Textract) + live LLM segmenter variants |

All 26 offline-deterministic tests pass. 5 integration tests skip when credentials absent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] asyncio.get_event_loop() removed; Python 3.13 incompatible**
- **Found during:** Task 2 first test run
- **Issue:** `asyncio.get_event_loop().run_until_complete()` raises `RuntimeError: There is no current event loop in thread 'MainThread'` in Python 3.13 — the event loop is no longer auto-created
- **Fix:** Rewrote `_run_propose` to use a nested `async def _inner()` coroutine and `asyncio.run(_inner())`, which creates and manages its own event loop. Also removed the now-unused `_make_component_repo` helper that had the same bug.
- **Files modified:** `tests/test_corpus_pipeline.py`
- **Commit:** 639264b (inline with Task 2 commit)

**2. [Rule 3 - Blocking] 25 ruff errors in forwarding_harness.py from prior session**
- **Found during:** Task 1 (continuation from previous session)
- **Issue:** F401 unused imports, UP037 quoted annotations, RUF100 unused noqa, I001 import sort, ASYNC240 blocking I/O in async function
- **Fix:** Complete rewrite of harness — removed quoted annotations (from __future__ import annotations renders them redundant), replaced `Path.read_bytes()` with `await asyncio.to_thread(Path(path).read_bytes)`, replaced `# noqa: ARG002` with `_ = var` pattern
- **Files modified:** `tests/corpus/forwarding_harness.py`
- **Commit:** bc0f746

## Known Stubs

None. All 10 corpus PDFs are non-empty genuine files (verified by manifest integrity check and the `CORPUS_MANIFEST_OK` assertion). The corpus PDFs are minimal but structurally valid: text-layer PDFs contain real logistics vocabulary text, the 2-page multi-invoice PDF has two distinct pages, and the junk-corrupt PDF is a deliberately truncated/invalid byte sequence.

Note: Corpus PDFs were generated using raw PDF byte construction (no reportlab/fpdf). The `gen_corpus.py` script at repo root can regenerate them. For the photo-of-screen and scan_noise cases, the files are image-only PDFs — their text content is intentionally absent; OCR is the pipeline path for these.

## Threat Flags

None. No new network endpoints or auth paths introduced — this plan is test infrastructure only.

The T-04-31 threat (junk/corrupt fixture hangs test run) is mitigated: `junk-corrupt.pdf` is 181 bytes (truncated minimal PDF), the parser's PSEOF handler degrades gracefully without blocking, and the test asserts `no_raise` (confirmed passing).

## Self-Check: PASSED

Files created:
- FOUND: apps/email-listener/tests/corpus/__init__.py
- FOUND: apps/email-listener/tests/corpus/manifest.json
- FOUND: apps/email-listener/tests/corpus/ground_truth.json
- FOUND: apps/email-listener/tests/corpus/forwarding_harness.py
- FOUND: apps/email-listener/tests/corpus/hard_cases/multi-invoice-in-one-pdf.pdf
- FOUND: apps/email-listener/tests/corpus/hard_cases/nested-entities-on-one-page.pdf
- FOUND: apps/email-listener/tests/corpus/hard_cases/junk-corrupt.pdf
- FOUND: apps/email-listener/tests/corpus/hard_cases/photo-of-screen.pdf
- FOUND: apps/email-listener/tests/test_corpus_pipeline.py

Commits:
- FOUND: bc0f746 (Task 1 — corpus tree, manifest, ground truth, forwarding harness)
- FOUND: 639264b (Task 2 — end-to-end corpus pipeline test against ground truth)

Quality gates:
- ruff check: All checks passed
- ruff format --check: 102 files already formatted
- mypy app: Success: no issues found in 74 source files
- lint-imports: 3 contracts kept, 0 broken
- pytest --no-cov (26 tests, 5 integration skipped): PASSED
- pytest --cov=app --cov-fail-under=80 (full suite): 90.06% coverage — PASSED
