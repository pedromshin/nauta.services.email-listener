---
phase: 04-email-intelligence
plan: "13"
subsystem: infrastructure/pdf
tags: [python, pdf, pdfminer, ocr, geometry, bbox, d-12]
gap_closure: true

requires:
  - "04-04 (PdfParser adaptive text-layer + Textract OCR — the pipeline this refines)"

provides:
  - "Per-token normalized geometry persisted in Component.content_raw on BOTH paths: {source, tokens:[{text, bbox:[left,top,width,height]}]}"
  - "Text-layer page polygon = union of real pdfminer element bboxes (not hardcoded full-page)"
  - "Shared token bbox layout (0-1, top-left origin) across text-layer and OCR via _union_polygon / _PageExtract"

affects:
  - "04-14 (grounds ProposedRegion polygons in these real token coordinates)"
  - "Phase 5 (region overlays can render boxes aligned to where text actually sits)"

tech-stack:
  added: []
  patterns:
    - "pdfminer bbox Y-flip + normalize to 0-1 top-left origin to match Textract OcrWord layout"
    - "Graceful degradation: empty/zero-area/malformed elements skipped; empty tokens → full-page polygon; never raises"

key-files:
  created: []
  modified:
    - apps/email-listener/app/infrastructure/pdf/pdf_parser.py
    - apps/email-listener/tests/test_pdf_parser.py

key-decisions:
  - "content_raw token shape unified across both paths: {\"source\": \"text_layer\"|\"ocr\", \"tokens\": [{\"text\", \"bbox\": [left, top, width, height]}]} — all normalized 0-1, top-left origin"
  - "pdfminer LTTextContainer bbox (x0,y0,x1,y1, bottom-left origin, PDF points) normalized by page width/height and Y-flipped to top-left: left=x0/W, top=(H-y1)/H, width=(x1-x0)/W, height=(y1-y0)/H, clamped [0,1]"
  - "_extract_text_layers now returns list[_PageExtract] (text + tokens); _count_pages_pypdf returns empty _PageExtract per page (no geometry on the OCR-fallback path)"
  - "Non-breaking: only ADDS content_raw (jsonb column already present) + refines the page polygon — no migration, no API change"

requirements-completed: []

duration: "~30m"
completed: "2026-06-12"
---

# Phase 04 Plan 13: Retain Word/Line BBox Geometry Summary

**The PDF parser now persists per-token normalized geometry in `content_raw` on both the text-layer and OCR paths, and the text-layer page polygon is the union of real pdfminer element bboxes instead of a hardcoded full-page rectangle — giving Phase 5 overlays and 04-14 region grounding real coordinates to draw against.**

## Accomplishments

- **Text-layer path**: `_extract_text_layers` now captures each `LTTextContainer.bbox`, normalizes it to 0-1 and flips the Y axis to a top-left origin (matching Textract/`OcrWord`), and returns a `_PageExtract(text, tokens)` per page. `_component_from_text` persists `content_raw={"source":"text_layer","tokens":[...]}` and sets the page polygon to the union of those element bboxes (full-page fallback only when no tokens).
- **OCR path**: `_component_from_ocr` persists `content_raw={"source":"ocr","tokens":[{"text","bbox"}]}` (one token per `OcrWord`, bbox already normalized) while keeping the existing union polygon.
- **Shared helpers**: `_union_polygon` (over `(left,top,width,height)` boxes) backs both `_bbox_union(words)` and the text-layer union; `_normalize_text_element` does the pdfminer normalize+Y-flip with graceful skips; `_clamp01` bounds coordinates.
- **Graceful degradation preserved**: empty-text / zero-area / malformed elements are skipped; an empty token set falls back to the full-page polygon; the timeout/pypdf fallback yields empty `_PageExtract`s; `parse()` still never raises (T-04-11/T-04-13).

## Task Commits

1. **Retain word/line bbox geometry on both PDF paths** - `feat(04-13)` (see git log)

## Deviations from Plan

**1. [Incidental lint fixes]** Touching the `parse()` block surfaced two pre-existing ruff findings in the same function (`N806` on the local timeout constant, `UP041` on `asyncio.TimeoutError`); fixed inline (`pdfminer_timeout_s`, builtin `TimeoutError`) to keep the gate green.

## Verification

- Full quality gate green: ruff, ruff format, mypy (79 files), import-linter (3 contracts), full pytest suite at **89.67% coverage**.
- New tests: text-layer + OCR `content_raw` token bboxes persisted and normalized 0-1; text-layer polygon equals the token-bbox union (asserted exactly) and is not full-page; empty tokens / empty OCR degrade to full-page polygon with `tokens: []`; integration test on a real born-digital PDF confirms normalized token bboxes end-to-end.

## Notes for Downstream

- **04-14** reads `page.content_raw["tokens"]` to present numbered, coordinate-bearing tokens to the segmenter and computes region polygons as the union of model-selected token bboxes.
