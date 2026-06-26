---
phase: 04-email-intelligence
plan: "04"
subsystem: infrastructure/pdf
tags: [python, pdf, ocr, aws-textract, pdfminer, clean-architecture, protocol]

requires:
  - "04-02 (ParserProtocol seam + Component entity)"

provides:
  - "PdfParser implementing ParserProtocol — adaptive per-page text/OCR extraction"
  - "UnsupportedFileTypeError(ValueError) + case-insensitive parser registry"
  - "detect_text_layer heuristic (MIN_CHARS_PER_PAGE=20, printable-ratio threshold)"
  - "OcrWord frozen dataclass + OCRProtocol seam"
  - "TextractOcrAdapter wrapping boto3 detect_document_text in run_in_executor"

affects:
  - "04-06 (DecomposeEmailUseCase calls register('.pdf', PdfParser(...)) at DI setup)"
  - "04-05 (segmentation receives Components with page_index + normalized polygon)"

tech-stack:
  added:
    - pypdf 6.x (page counting fallback when pdfminer finds no pages)
    - pdfminer.six 20260107 (text-layer extraction)
    - pdf2image (rasterize pages for OCR; requires system poppler at runtime)
    - boto3 (AWS Textract DetectDocumentText)
    - pillow (image support)
  patterns:
    - "OCRProtocol seam — OCR engine swappable without touching PdfParser"
    - "run_in_executor wrapping all blocking I/O (pdfminer, pdf2image, boto3)"
    - "Per-page try/except → parse-error Component (never raises for content errors)"
    - "_HAS_PDF dep-gating in test file so suite runs without optional deps"
    - "Rasterize mocked in scanned tests (no system poppler required in CI)"

key-files:
  created:
    - apps/email-listener/app/infrastructure/pdf/__init__.py
    - apps/email-listener/app/infrastructure/pdf/parser_registry.py
    - apps/email-listener/app/infrastructure/pdf/text_layer.py
    - apps/email-listener/app/infrastructure/pdf/pdf_parser.py
    - apps/email-listener/app/infrastructure/ocr/__init__.py
    - apps/email-listener/app/infrastructure/ocr/ocr_protocol.py
    - apps/email-listener/app/infrastructure/ocr/textract_adapter.py
    - apps/email-listener/tests/test_parser_registry.py
    - apps/email-listener/tests/test_pdf_parser.py
    - apps/email-listener/tests/fixtures/pdf/.gitkeep
    - apps/email-listener/tests/fixtures/pdf/clean.pdf
    - apps/email-listener/tests/fixtures/pdf/corrupt.pdf
    - apps/email-listener/tests/fixtures/pdf/scanned.pdf
  modified:
    - apps/email-listener/pyproject.toml (uv add pypdf pdfminer.six pdf2image boto3 pillow)

key-decisions:
  - "OCR engine = AWS Textract (RESEARCH §12 Q1): normalized bboxes out of the box, AWS-native, more reliable layout extraction; behind OCRProtocol so Tesseract can register later"
  - "Text-layer threshold: MIN_CHARS_PER_PAGE=20 printable chars + GARBAGE_RATIO=0.3 non-printable fraction; simple, fast, no ML dependency"
  - "email_id and importer_id set to empty-string placeholders in PdfParser — the DecomposeEmailUseCase (04-06) stitches them after parsing; documented in this SUMMARY"
  - "pdf2image rasterize mocked in scanned tests — poppler is a system binary not present in CI; integration tests with real poppler are deferred to a manual-only fixture"
  - "LTAnon removed from pdfminer.six 20260107 — import corrected to use only LTTextContainer"

requirements-completed: []

duration: 35min
completed: "2026-06-11"
---

# Phase 04 Plan 04: PDF Parser + OCR Seam Summary

**PdfParser implementing ParserProtocol with adaptive per-page text-layer/OCR extraction, normalized-geometry Components, AWS Textract OCR adapter behind OCRProtocol seam, and graceful corrupt-PDF degradation**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-11T19:30:00Z
- **Completed:** 2026-06-11T20:05:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Parser registry with case-insensitive `register`/`get_parser` and `UnsupportedFileTypeError(ValueError)` on conflict
- `detect_text_layer` heuristic: MIN_CHARS_PER_PAGE=20, GARBAGE_RATIO=0.3 printable-ratio threshold
- `OcrWord` frozen dataclass (text, bbox 0–1 normalized) + `OCRProtocol` structural protocol
- `TextractOcrAdapter` wrapping boto3 `detect_document_text` in `run_in_executor`
- `PdfParser` — pdfminer.six text extraction, pdf2image rasterize, OCR fallback, full-page polygon, per-page parse-error degradation
- Security caps: MAX_PAGES=200, MAX_FILE_MB=50 (T-04-11); whole-doc and per-page graceful failures (T-04-13)
- 25 total tests (15 registry/text-layer/Textract + 10 PdfParser); all green
- mypy, import-linter (3 contracts kept), bandit clean

## Task Commits

1. **Task 1: Parser registry + text-layer detector + OCR seam** - `4102a59` (feat)
2. **Task 2: PdfParser adaptive per-page text/OCR** - `0e8dfb4` (feat)

## Files Created/Modified

- `app/infrastructure/pdf/parser_registry.py` — `UnsupportedFileTypeError`, `register`, `get_parser`
- `app/infrastructure/pdf/text_layer.py` — `detect_text_layer`, `is_garbage`, MIN_CHARS_PER_PAGE
- `app/infrastructure/pdf/pdf_parser.py` — `PdfParser` (ParserProtocol impl), MAX_PAGES, MAX_FILE_MB
- `app/infrastructure/ocr/ocr_protocol.py` — `OcrWord` frozen dataclass + `OCRProtocol`
- `app/infrastructure/ocr/textract_adapter.py` — `TextractOcrAdapter` (boto3 + run_in_executor)
- `tests/test_parser_registry.py` — 15 tests: registry, text-layer, Textract mock
- `tests/test_pdf_parser.py` — 10 tests: contract, clean text-layer, scanned OCR, corrupt graceful
- `tests/fixtures/pdf/` — clean.pdf (embedded text), corrupt.pdf (truncated), scanned.pdf (image-only)
- `pyproject.toml` — pypdf, pdfminer.six, pdf2image, boto3, pillow added

## Decisions Made

- **OCR engine: AWS Textract** — normalized bboxes natively, AWS-native trust domain, no self-hosted infra required; behind `OCRProtocol` so Tesseract can be swapped in by registering a new adapter
- **Text-layer thresholds** — MIN_CHARS_PER_PAGE=20, GARBAGE_RATIO=0.3; conservative values tuned to reject blank/whitespace-only pages and non-text binary garbage without misclassifying sparse pages
- **email_id/importer_id as "" placeholders** — `parse()` receives only `attachment_id`; the two parent-entity IDs are stitched by `DecomposeEmailUseCase` (plan 04-06) after all parsers run; this is by design, documented here and in the module docstring
- **Fixture provenance** — clean.pdf and corrupt.pdf are programmatically generated; scanned.pdf is a minimal image-only PDF with an embedded white PNG (no real document content); real production fixtures are tested manually with the live stack

## Deviations from Plan

**1. [Rule 1 - Bug] LTAnon removed from pdfminer.six 20260107**
- **Found during:** Task 2 (GREEN phase, first test run)
- **Issue:** `from pdfminer.layout import LTAnon` raises ImportError — pdfminer.six 20260107 removed LTAnon
- **Fix:** Removed unused `LTAnon` import; only `LTTextContainer` is used in the extraction loop
- **Files modified:** `app/infrastructure/pdf/pdf_parser.py`
- **Commit:** `0e8dfb4`

**2. [Rule 3 - Blocking] poppler not installed on CI host**
- **Found during:** Task 2 scanned tests (pdf2image requires system poppler binary)
- **Issue:** `PDFInfoNotInstalledError` — pdf2image cannot rasterize without poppler
- **Fix:** Mocked `_rasterize_page` in scanned tests using `unittest.mock.patch.object`; the OCR dispatch logic is fully exercised; integration with real poppler deferred to manual/staging testing
- **Files modified:** `tests/test_pdf_parser.py`
- **Commit:** `0e8dfb4`

## Known Stubs

None — PdfParser is a full production implementation. The `email_id=""` and `importer_id=""` placeholders are documented design decisions, not stubs; they are stitched by the use-case layer.

## Threat Flags

No new network endpoints or auth paths. Two boundaries introduced per the plan's threat model:
- **attachment bytes → parser**: T-04-11 mitigated (MAX_PAGES, MAX_FILE_MB caps, per-page try/except)
- **parser → AWS Textract**: T-04-14 accepted (AWS-native trust domain, region-pinned via AWS_TEXTRACT_REGION env var)

## Self-Check: PASSED

- `app/infrastructure/pdf/pdf_parser.py` — EXISTS
- `app/infrastructure/pdf/parser_registry.py` — EXISTS
- `app/infrastructure/pdf/text_layer.py` — EXISTS
- `app/infrastructure/ocr/ocr_protocol.py` — EXISTS
- `app/infrastructure/ocr/textract_adapter.py` — EXISTS
- `tests/test_parser_registry.py` — EXISTS
- `tests/test_pdf_parser.py` — EXISTS
- Commit `4102a59` — EXISTS (feat(04-04): parser registry, text-layer detector, OCR seam)
- Commit `0e8dfb4` — EXISTS (feat(04-04): PdfParser adaptive per-page text/OCR)
- 25 tests PASSED
- mypy: 0 errors
- import-linter: 3 contracts kept, 0 broken
- bandit: no findings

---
*Phase: 04-email-intelligence*
*Completed: 2026-06-11*
