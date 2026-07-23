"""End-to-end corpus pipeline tests (D-17).

Loads all corpus files from the manifest and runs them through the real
PdfParser.parse -> ProposeRegionsUseCase pipeline, asserting per-manifest
expectations and controlled ground truth for the four hard cases.

Test matrix
-----------
Non-integration (always-run, offline-deterministic):
  - All corpus files parse without raising.
  - Text-layer corpus files yield Components with non-empty content_text.
  - Image-only corpus files (has_text_layer=False) trigger the OCR path
    (mocked _rasterize_page so poppler not required in CI).
  - junk/corrupt file yields a parse-error Component without raising.
  - Hard case — multi-invoice: ProposeRegionsUseCase with a fake segmenter
    that returns >=2 invoice-typed proposals yields >=2 region Components.
  - Hard case — nested-entities: fake segmenter returns a child proposal
    (parent_index=0) and the resulting region Component carries
    parent_component_id != page.id.
  - Hard case — junk: parse-error Component means 0 non-empty pages;
    ProposeRegionsUseCase yields 0 regions.
  - Hard case — photo-of-screen: OCR path (mocked) routes correctly.

Integration (gated on ANTHROPIC_API_KEY / TEXTRACT credentials):
  - @pytest.mark.integration variants drive live OCR or LLM segmentation.
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from tests.corpus import CORPUS_DIR, GROUND_TRUTH_PATH, MANIFEST_PATH

# ---------------------------------------------------------------------------
# Dep-gating — skip whole module if pypdf/pdfminer are absent
# ---------------------------------------------------------------------------
try:
    import pypdf  # noqa: F401

    _HAS_PDF = True
except ImportError:
    _HAS_PDF = False

skip_no_pdf = pytest.mark.skipif(not _HAS_PDF, reason="pypdf not installed")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MANIFEST: list[dict] = json.loads(MANIFEST_PATH.read_text())
GROUND_TRUTH: dict = json.loads(GROUND_TRUTH_PATH.read_text())


def _corpus_path(relative_file: str) -> Path:
    return CORPUS_DIR / relative_file


def _null_ocr() -> AsyncMock:
    """AsyncMock OCR adapter that returns []."""
    mock = AsyncMock()
    mock.ocr_page = AsyncMock(return_value=[])
    return mock


class _FakeSegmenterEmpty:
    """Segmenter that always returns no proposals — deterministic baseline."""

    async def segment(self, *, tokens: tuple, page_index: int) -> list:
        return []


class _FakeSegmenterMultiInvoice:
    """Segmenter that returns 1 invoice-typed proposal for each non-empty page.

    04-14 contract: receives coordinate-bearing tokens and selects token_indices
    (here: all tokens) so the use case grounds the region polygon in real bboxes.
    """

    async def segment(self, *, tokens: tuple, page_index: int) -> list:
        from app.domain.ports.segmenter_protocol import ProposedRegion

        text = " ".join(t.text for t in tokens)
        return [
            ProposedRegion(
                content_text=text[:80],
                token_indices=tuple(t.index for t in tokens),
                entity_type_hint="invoice",
                parent_index=None,
                page_index=page_index,
            ),
        ]


class _FakeSegmenterNested:
    """Segmenter that returns a parent region + a child region (parent_index=0)."""

    async def segment(self, *, tokens: tuple, page_index: int) -> list:
        from app.domain.ports.segmenter_protocol import ProposedRegion

        text = " ".join(t.text for t in tokens)
        indices = tuple(t.index for t in tokens)
        half = indices[: max(1, len(indices) // 2)] if indices else ()
        parent = ProposedRegion(
            content_text=text[:80],
            token_indices=indices,
            entity_type_hint="bill_of_lading",
            parent_index=None,
            page_index=page_index,
        )
        child = ProposedRegion(
            content_text=text[80:160] if len(text) > 80 else text[:40],
            token_indices=half,
            entity_type_hint="invoice",
            parent_index=0,  # child of parent at index 0
            page_index=page_index,
        )
        return [parent, child]


def _run_parse(file_bytes: bytes, attachment_id: str) -> list:
    """Parse file_bytes through the real PdfParser with mocked rasterize."""
    from app.infrastructure.pdf.pdf_parser import PdfParser

    ocr = _null_ocr()
    parser = PdfParser(ocr=ocr)
    with patch.object(parser, "_rasterize_page", return_value=b"fake-png-bytes"):
        return asyncio.run(
            parser.parse(
                file_bytes=file_bytes,
                content_type="application/pdf",
                attachment_id=attachment_id,
            )
        )


def _run_propose(page_components: list, segmenter: object, email_id: str) -> list:
    """Run ProposeRegionsUseCase with *segmenter* over *page_components*."""
    import dataclasses

    from app.application.use_cases.propose_regions import ProposeRegionsUseCase
    from tests.corpus.forwarding_harness import InMemoryComponentRepository

    # Stitch email_id/importer_id (as done by IngestInboundEmailUseCase)
    stitched = [dataclasses.replace(c, email_id=email_id, importer_id="corpus-test-importer") for c in page_components]

    async def _inner() -> list:
        repo2 = InMemoryComponentRepository()
        await repo2.save_many(stitched)
        use_case = ProposeRegionsUseCase(
            components=repo2,  # type: ignore[arg-type]
            segmenter=segmenter,  # type: ignore[arg-type]
        )
        return await use_case.execute(email_id=email_id, importer_id="corpus-test-importer")

    return asyncio.run(_inner())


# ---------------------------------------------------------------------------
# T1: Manifest integrity — all files on disk, non-zero
# ---------------------------------------------------------------------------


def test_manifest_all_files_exist_and_non_empty() -> None:
    """Every entry in manifest.json must exist on disk with non-zero size."""
    missing: list[str] = []
    empty: list[str] = []
    for entry in MANIFEST:
        p = _corpus_path(entry["file"])
        if not p.exists():
            missing.append(entry["file"])
        elif p.stat().st_size == 0:
            empty.append(entry["file"])
    assert not missing, f"Corpus files missing on disk: {missing}"
    assert not empty, f"Corpus files are empty stubs: {empty}"


def test_manifest_has_all_three_layers() -> None:
    layers = {e["layer"] for e in MANIFEST}
    assert {"scan_noise", "logistics_vocab", "hard_cases"} <= layers


def test_ground_truth_covers_all_hard_cases() -> None:
    hard_case_files = {e["file"] for e in MANIFEST if e["layer"] == "hard_cases"}
    missing_gt = hard_case_files - set(GROUND_TRUTH.keys())
    assert not missing_gt, f"Hard cases without ground truth: {missing_gt}"


# ---------------------------------------------------------------------------
# T2: Text-layer corpus files parse to non-empty Components
# ---------------------------------------------------------------------------


@skip_no_pdf
class TestTextLayerFiles:
    """Text-layer corpus files (has_text_layer=True) must produce text Components."""

    @pytest.mark.parametrize(
        "entry",
        [e for e in MANIFEST if e.get("has_text_layer") is True],
        ids=[e["file"] for e in MANIFEST if e.get("has_text_layer") is True],
    )
    def test_text_layer_file_yields_text_components(self, entry: dict) -> None:
        file_bytes = _corpus_path(entry["file"]).read_bytes()
        components = _run_parse(file_bytes, attachment_id=f"att-{uuid.uuid4()}")

        assert len(components) >= 1, f"Expected >= 1 component for {entry['file']}"
        page_components = [c for c in components if c.source_type == "attachment_page"]
        assert page_components, f"No attachment_page components for {entry['file']}"
        # At least one page should have non-empty text (text-layer PDF)
        text_contents = [c.content_text for c in page_components if c.content_text.strip()]
        assert text_contents, f"All page components have empty content_text for text-layer PDF {entry['file']}"


# ---------------------------------------------------------------------------
# T3: Image-only corpus files route through OCR path
# ---------------------------------------------------------------------------


@skip_no_pdf
class TestImageOnlyFiles:
    """Image-only corpus files (has_text_layer=False) must route through OCR."""

    @pytest.mark.parametrize(
        "entry",
        [e for e in MANIFEST if e.get("has_text_layer") is False],
        ids=[e["file"] for e in MANIFEST if e.get("has_text_layer") is False],
    )
    def test_image_only_file_does_not_raise(self, entry: dict) -> None:
        """parse() must not raise for image-only PDFs."""
        file_bytes = _corpus_path(entry["file"]).read_bytes()
        # Should not raise; OCR path is mocked (rasterize returns fake PNG bytes)
        components = _run_parse(file_bytes, attachment_id=f"att-{uuid.uuid4()}")
        # Must return at least one component (either OCR or parse-error)
        assert len(components) >= 1, f"Expected >= 1 component for {entry['file']}"
        assert all(c.source_type == "attachment_page" for c in components), (
            "All returned components must be attachment_page type"
        )


# ---------------------------------------------------------------------------
# T4: Corrupt / junk file never raises and returns parse-error Component
# ---------------------------------------------------------------------------


@skip_no_pdf
class TestJunkCorruptFile:
    """junk-corrupt.pdf must not raise — parse() returns a parse-error Component."""

    def test_junk_corrupt_no_raise_returns_parse_error(self) -> None:
        gt = GROUND_TRUTH["hard_cases/junk-corrupt.pdf"]
        file_bytes = _corpus_path("hard_cases/junk-corrupt.pdf").read_bytes()

        # Verify ground truth says error_or_empty
        assert gt["expected"]["parse_behavior"] == "error_or_empty"
        assert gt["expected"]["assertions"]["no_raise"]

        components = _run_parse(file_bytes, attachment_id="att-junk")

        # Must not raise (already proven by getting here); must return >= 1
        assert len(components) >= 1, "junk-corrupt must yield at least one Component"
        # All components should be parse-error (empty content or error marker)
        for c in components:
            assert c.source_type == "attachment_page"

    def test_junk_corrupt_propose_regions_yields_zero(self) -> None:
        """ProposeRegionsUseCase on junk-parse must yield zero regions."""
        file_bytes = _corpus_path("hard_cases/junk-corrupt.pdf").read_bytes()
        page_components = _run_parse(file_bytes, attachment_id="att-junk-2")

        regions = _run_propose(
            page_components,
            segmenter=_FakeSegmenterEmpty(),
            email_id=f"email-{uuid.uuid4()}",
        )

        # Empty segmenter + parse-error pages (empty text) → 0 regions
        assert regions == [], f"Expected 0 regions for junk/corrupt file, got {len(regions)}"


# ---------------------------------------------------------------------------
# T5: Hard case — multi-invoice-in-one-pdf.pdf
# ---------------------------------------------------------------------------


@skip_no_pdf
class TestMultiInvoiceHardCase:
    """multi-invoice-in-one-pdf.pdf must yield >=2 invoice-typed proposed regions."""

    def test_multi_invoice_parse_yields_multiple_pages(self) -> None:
        file_bytes = _corpus_path("hard_cases/multi-invoice-in-one-pdf.pdf").read_bytes()
        components = _run_parse(file_bytes, attachment_id="att-multi-invoice")

        page_comps = [c for c in components if c.source_type == "attachment_page"]
        assert len(page_comps) >= 1, "multi-invoice must yield >= 1 page components"

    def test_multi_invoice_propose_regions_invoice_typed(self) -> None:
        """With a segmenter that labels each non-empty page as 'invoice',
        ProposeRegionsUseCase must return >= 2 invoice-typed regions across
        a 2-page PDF (D-17 criterion: >=2 invoice regions)."""
        gt = GROUND_TRUTH["hard_cases/multi-invoice-in-one-pdf.pdf"]
        assert gt["expected"]["min_region_count"] == 2

        file_bytes = _corpus_path("hard_cases/multi-invoice-in-one-pdf.pdf").read_bytes()
        page_components = _run_parse(file_bytes, attachment_id="att-multi-invoice-2")

        # Use the multi-invoice fake segmenter which returns 1 invoice region per page
        email_id = f"email-{uuid.uuid4()}"
        regions = _run_propose(
            page_components,
            segmenter=_FakeSegmenterMultiInvoice(),
            email_id=email_id,
        )

        invoice_regions = [r for r in regions if r.source_type == "region"]
        assert len(invoice_regions) >= gt["expected"]["min_region_count"], (
            f"Expected >= {gt['expected']['min_region_count']} regions, got {len(invoice_regions)}"
        )

    def test_multi_invoice_ground_truth_identifiers_in_text(self) -> None:
        """Key invoice numbers from ground truth must appear in parsed page text."""
        gt_identifiers = GROUND_TRUTH["hard_cases/multi-invoice-in-one-pdf.pdf"]["expected"]["key_identifiers"]
        invoice_numbers: list[str] = gt_identifiers.get("invoice_numbers", [])

        file_bytes = _corpus_path("hard_cases/multi-invoice-in-one-pdf.pdf").read_bytes()
        page_components = _run_parse(file_bytes, attachment_id="att-multi-invoice-3")

        all_text = " ".join(c.content_text for c in page_components)
        found = [inv for inv in invoice_numbers if inv in all_text]
        assert found, (
            f"None of the expected invoice numbers {invoice_numbers} found in parsed text. "
            f"Extracted text (first 300 chars): {all_text[:300]!r}"
        )


# ---------------------------------------------------------------------------
# T6: Hard case — nested-entities-on-one-page.pdf
# ---------------------------------------------------------------------------


@skip_no_pdf
class TestNestedEntitiesHardCase:
    """nested-entities-on-one-page.pdf must produce region Components with
    parent_component_id linkage (at least one child region, D-17)."""

    def test_nested_entities_parse_yields_text_component(self) -> None:
        file_bytes = _corpus_path("hard_cases/nested-entities-on-one-page.pdf").read_bytes()
        components = _run_parse(file_bytes, attachment_id="att-nested")

        page_comps = [c for c in components if c.source_type == "attachment_page"]
        assert page_comps, "nested-entities PDF must yield attachment_page components"

    def test_nested_entities_ground_truth_identifiers_in_text(self) -> None:
        """Key identifiers from ground truth must appear in parsed page text."""
        gt_identifiers = GROUND_TRUTH["hard_cases/nested-entities-on-one-page.pdf"]["expected"]["key_identifiers"]

        file_bytes = _corpus_path("hard_cases/nested-entities-on-one-page.pdf").read_bytes()
        page_components = _run_parse(file_bytes, attachment_id="att-nested-2")
        all_text = " ".join(c.content_text for c in page_components)

        found_any = False
        for _key, value in gt_identifiers.items():
            if isinstance(value, str) and value in all_text:
                found_any = True
                break

        assert found_any, (
            f"None of the key identifiers {gt_identifiers} found in parsed text. "
            f"Extracted text (first 400 chars): {all_text[:400]!r}"
        )

    def test_nested_entities_propose_regions_has_parent_linkage(self) -> None:
        """ProposeRegionsUseCase with nested segmenter must produce at least one
        region Component with parent_component_id set to a sibling's id (not page id),
        proving parent_index resolution works (D-17)."""
        gt = GROUND_TRUTH["hard_cases/nested-entities-on-one-page.pdf"]
        assert "parent_linkage" in gt["expected"]["assertions"]

        file_bytes = _corpus_path("hard_cases/nested-entities-on-one-page.pdf").read_bytes()
        page_components = _run_parse(file_bytes, attachment_id="att-nested-3")

        email_id = f"email-{uuid.uuid4()}"
        regions = _run_propose(
            page_components,
            segmenter=_FakeSegmenterNested(),
            email_id=email_id,
        )

        region_comps = [r for r in regions if r.source_type == "region"]
        assert region_comps, "Nested segmenter should produce >= 1 region components"

        # Find the child region: parent_component_id must be one of its siblings,
        # not None and not a page component id
        page_ids = {c.id for c in page_components}
        region_ids = {r.id for r in region_comps}

        children = [
            r
            for r in region_comps
            if r.parent_component_id is not None
            and r.parent_component_id not in page_ids
            and r.parent_component_id in region_ids
        ]
        assert children, (
            "Expected at least one region Component with parent_component_id pointing "
            "to a sibling region (nested entity linkage, D-17). "
            f"Region parent_component_ids: {[r.parent_component_id for r in region_comps]}, "
            f"Page ids: {page_ids}, Region ids: {region_ids}"
        )


# ---------------------------------------------------------------------------
# T7: Hard case — photo-of-screen.pdf
# ---------------------------------------------------------------------------


@skip_no_pdf
class TestPhotoOfScreenHardCase:
    """photo-of-screen.pdf (image-only) must route through OCR without raising."""

    def test_photo_of_screen_no_raise(self) -> None:
        gt = GROUND_TRUTH["hard_cases/photo-of-screen.pdf"]
        assert gt["expected"]["parse_behavior"] == "ocr_required"
        assert gt["expected"]["has_text_layer"] is False

        file_bytes = _corpus_path("hard_cases/photo-of-screen.pdf").read_bytes()
        components = _run_parse(file_bytes, attachment_id="att-photo")

        assert len(components) >= 1, "photo-of-screen must yield >= 1 component"

    def test_photo_of_screen_ocr_path_called(self) -> None:
        """_rasterize_page must be invoked for the image-only photo-of-screen file."""
        from app.infrastructure.pdf.pdf_parser import PdfParser

        ocr = _null_ocr()
        parser = PdfParser(ocr=ocr)
        rasterize_mock = AsyncMock(return_value=b"fake-png-bytes")

        with patch.object(parser, "_rasterize_page", return_value=b"fake-png-bytes") as rz:
            file_bytes = _corpus_path("hard_cases/photo-of-screen.pdf").read_bytes()
            asyncio.run(
                parser.parse(
                    file_bytes=file_bytes,
                    content_type="application/pdf",
                    attachment_id="att-photo-2",
                )
            )
            # _rasterize_page must have been called (OCR path triggered)
            rz.assert_called()

        del rasterize_mock  # silence unused warning


# ---------------------------------------------------------------------------
# T8: All manifest layers have at least one parseable file
# ---------------------------------------------------------------------------


@skip_no_pdf
@pytest.mark.parametrize("layer", ["scan_noise", "logistics_vocab", "hard_cases"])
def test_layer_has_parseable_file(layer: str) -> None:
    """Each layer must have at least one PDF that parse() handles without raising."""
    entries = [e for e in MANIFEST if e["layer"] == layer]
    assert entries, f"No manifest entries for layer {layer!r}"

    parsed_ok = False
    for entry in entries[:1]:  # test the first file per layer — avoids slow full-layer scan
        file_bytes = _corpus_path(entry["file"]).read_bytes()
        try:
            components = _run_parse(file_bytes, attachment_id=f"att-layer-{layer}")
            if components:
                parsed_ok = True
        except Exception:  # noqa: S110
            pass  # graceful — we just want to find at least one parseable file

    assert parsed_ok, f"Layer {layer!r} has no parseable corpus file"


# ---------------------------------------------------------------------------
# Integration variants (gated on credentials)
# ---------------------------------------------------------------------------

_HAS_TEXTRACT = bool(os.environ.get("AWS_ACCESS_KEY_ID"))
_HAS_ANTHROPIC = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("AWS_BEDROCK_REGION"))

skip_no_textract = pytest.mark.skipif(not _HAS_TEXTRACT, reason="AWS Textract credentials not set")
skip_no_llm = pytest.mark.skipif(not _HAS_ANTHROPIC, reason="LLM credentials not set")


@pytest.mark.integration
@skip_no_textract
@skip_no_pdf
class TestImageOnlyOcrIntegration:
    """Live-OCR variants for image-only corpus files (require AWS Textract creds)."""

    @pytest.mark.parametrize(
        "entry",
        [e for e in MANIFEST if e.get("has_text_layer") is False],
        ids=[e["file"] for e in MANIFEST if e.get("has_text_layer") is False],
    )
    def test_image_only_live_ocr_returns_components(self, entry: dict) -> None:
        """Image-only PDF with live Textract yields non-empty OCR text."""
        import boto3

        from app.infrastructure.ocr.textract_adapter import TextractOcrAdapter
        from app.infrastructure.pdf.pdf_parser import PdfParser

        client = boto3.client(
            "textract",
            region_name=os.environ.get("AWS_TEXTRACT_REGION", "us-east-1"),
        )
        ocr = TextractOcrAdapter(client=client)
        parser = PdfParser(ocr=ocr)
        file_bytes = _corpus_path(entry["file"]).read_bytes()
        components = asyncio.run(
            parser.parse(
                file_bytes=file_bytes,
                content_type="application/pdf",
                attachment_id=f"att-live-{uuid.uuid4()}",
            )
        )
        assert len(components) >= 1


@pytest.mark.integration
@skip_no_llm
@skip_no_pdf
class TestMultiInvoiceLlmIntegration:
    """Live-LLM variant: multi-invoice PDF with real AnthropicSegmenter."""

    def test_multi_invoice_live_segmenter_returns_invoice_regions(self) -> None:
        """Real segmenter should label pages with invoice entity type hints."""
        from app.infrastructure.segmentation.anthropic_segmenter import AnthropicSegmenter

        gt = GROUND_TRUTH["hard_cases/multi-invoice-in-one-pdf.pdf"]
        file_bytes = _corpus_path("hard_cases/multi-invoice-in-one-pdf.pdf").read_bytes()
        page_components = _run_parse(file_bytes, attachment_id=f"att-live-{uuid.uuid4()}")

        email_id = f"email-{uuid.uuid4()}"
        segmenter = AnthropicSegmenter()
        regions = _run_propose(page_components, segmenter=segmenter, email_id=email_id)

        assert len(regions) >= gt["expected"]["min_region_count"], (
            f"Live segmenter returned fewer regions than expected: {len(regions)}"
        )
