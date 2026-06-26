---
phase: 04-email-intelligence
plan: "14"
subsystem: domain/ports + infrastructure/llm + application
tags: [python, llm, segmentation, geometry, bbox, grounding, d-12, d-14]
gap_closure: true

requires:
  - "04-13 (per-token geometry persisted in content_raw — the coordinates regions are grounded in)"
  - "04-05 (AnthropicSegmenter robustness contract this preserves)"
  - "04-11 (ProposeRegionsUseCase wiring in the live ingest path)"

provides:
  - "PageToken (index, text, bbox) + token-based SegmenterProtocol.segment() seam"
  - "ProposedRegion carries token_indices (model selection) instead of an invented polygon"
  - "segment_document tool schema: model selects token_indices per region"
  - "ProposeRegionsUseCase grounds each region polygon = union of selected tokens' real bboxes (page-polygon fallback when no valid tokens)"

affects:
  - "Phase 5 (region overlays render boxes anchored to real token coordinates)"

tech-stack:
  added: []
  patterns:
    - "Numbered-token presentation ([i] text) in the user turn; model returns token_indices"
    - "Geometry grounded in document coordinates, not LLM-drawn"

key-files:
  created: []
  modified:
    - apps/email-listener/app/domain/ports/segmenter_protocol.py
    - apps/email-listener/app/infrastructure/llm/segmentation_adapter.py
    - apps/email-listener/app/application/use_cases/propose_regions.py
    - apps/email-listener/tests/test_segmentation_adapter.py
    - apps/email-listener/tests/test_propose_regions.py
    - apps/email-listener/tests/test_corpus_pipeline.py

key-decisions:
  - "ProposedRegion drops the model-drawn `polygon` and carries `token_indices`; the use case computes the polygon as the union of the selected tokens' bboxes (4-corner [x,y] pairs, matching page-polygon shape) — grounded, not invented"
  - "Region whose token selection resolves to no valid tokens (empty/out-of-range/no page tokens) falls back to the page's own polygon — never an invented box (T-04-GEO)"
  - "_MAX_PAGE_CHARS now caps the serialized numbered-token block; empty token list short-circuits to [] with no API call"
  - "Region polygon shape changed from a flat tuple to 4-corner [x,y] pairs (consistent with page polygons); non-breaking — Phase 5 not yet built"
  - "Textract detect_document_text -> analyze_document: EVALUATED, DEFERRED — per-word geometry from 04-13 already suffices to ground polygons; analyze_document changes response parsing + adds cost; revisit as a separate follow-up for table/KV extraction"

requirements-completed: []

duration: "~40m"
completed: "2026-06-12"
---

# Phase 04 Plan 14: Ground Region Polygons in Real Token Coordinates Summary

**The segmenter seam now receives coordinate-bearing tokens (from 04-13) and the model selects which tokens compose each region; ProposeRegionsUseCase computes each region polygon as the union of the selected tokens' real bboxes — so region overlays are anchored to actual document coordinates instead of LLM-hallucinated boxes — while every 04-05 robustness guarantee is preserved.**

## Accomplishments

- **Token seam**: `PageToken(index, text, bbox)` added; `SegmenterProtocol.segment` now takes `tokens: tuple[PageToken, ...]` instead of `page_text`. `ProposedRegion` drops the invented `polygon` and carries `token_indices`.
- **AnthropicSegmenter**: presents tokens as a numbered list (`[i] text`) inside `<document_content>` (D-14 preserved); the `segment_document` tool schema replaces `polygon` with `token_indices` (array of integers); the system prompt instructs token selection. `_parse_region` reads `token_indices`. Empty token list short-circuits to `[]` without an API call; `_MAX_PAGE_CHARS` now caps the serialized token block; retries and the `[]`-on-failure contract unchanged.
- **ProposeRegionsUseCase**: reads each page's tokens from 04-13 `content_raw` (`_page_tokens`), passes them to `segment()`, and computes each child region's polygon as the union of its selected tokens' bboxes (`_union_polygon`), falling back to the page polygon (`_page_polygon`) when no valid tokens are selected. Empty-content skip, per-page exception isolation, parent_index resolution, and sequential `sequence_index` all unchanged. Stays import-clean (no infrastructure import).

## Task Commits

1. **Ground region polygons in real token coordinates** - `feat(04-14)` (see git log)

## Deviations from Plan

**1. [Regression repair, in scope of the contract change]** `tests/test_corpus_pipeline.py` (not in the original files_modified) carried three fake segmenters on the old `segment(page_text=...)`/`polygon=` contract; updated them to the token contract so the full suite stays green. This was required by the seam change, not new scope.

## Verification

- Full quality gate green: ruff, ruff format, mypy (79 files), import-linter (3 contracts), full pytest suite at **89.60% coverage**.
- `test_propose_regions.py`: region polygon equals the union of selected token bboxes (exact, multi/single-token); overlapping + nested regions keep correct grounded geometry; empty/out-of-range/no-token selections fall back to the page polygon (never invented); 04-11 behaviors (empty-page skip, per-page isolation, attachment_page-only, sequential index) preserved.
- `test_segmentation_adapter.py`: D-14 (tokens in user turn, system byte-identical under injection), token_indices flow-through, junk→[], retry-then-[], empty-tokens→[] with no API call.

## Notes for Downstream

- **Phase 5** overlays should read region `location.polygon` (4-corner [x,y] pairs) — now grounded in real token coordinates.
- **Follow-up candidate**: switch `TextractOcrAdapter` to `analyze_document` for table/form/KV geometry (deferred here).
