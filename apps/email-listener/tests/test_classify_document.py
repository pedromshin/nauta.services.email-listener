"""Tests for ClassifyDocumentUseCase — whole multi-page attachment as one entity."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.classify_document import ClassifyDocumentUseCase
from app.domain.entities.component import Component

ATT_ID = "att-1"
EMAIL_ID = "email-1"
IMPORTER_ID = "imp-1"


def _page(comp_id: str, page_index: int, text: str) -> Component:
    return Component(
        id=comp_id,
        email_id=EMAIL_ID,
        importer_id=IMPORTER_ID,
        attachment_id=ATT_ID,
        parent_component_id=None,
        source_type="attachment_page",
        location={"page_index": page_index},
        content_text=text,
        content_markdown=None,
        content_raw=None,
        embedding=None,
        sequence_index=page_index,
        extraction_status="pending",
    )


def _build(anchor: Component | None, pages: list[Component]):
    components = AsyncMock()
    components.find_by_id.return_value = anchor
    components.find_pages_by_attachment.return_value = pages
    components.save_many.side_effect = lambda comps: comps  # echo back persisted
    return ClassifyDocumentUseCase(components=components), components


def test_classify_document_concatenates_all_pages_in_order() -> None:
    # Pages returned out of order + a duplicate of page 0 (reprocess leftover)
    p0 = _page("p0", 0, "Bill of Lading")
    p1 = _page("p1", 1, "Container MSCU1234567")
    p0_dup = _page("p0-dup", 0, "Bill of Lading")
    use_case, components = _build(anchor=p1, pages=[p1, p0, p0_dup])

    region = asyncio.run(use_case.execute(page_component_id="p1"))

    saved = components.save_many.call_args[0][0][0]
    assert saved.source_type == "region"
    assert saved.extraction_status == "candidate"
    assert saved.location["scope"] == "document"
    assert saved.location["page_index"] == 0
    assert saved.parent_component_id == "p0"  # anchored to first page
    assert saved.content_text == "Bill of Lading\n\nContainer MSCU1234567"
    assert saved.content_raw["lineage"]["origin"] == "human_document"
    assert saved.content_raw["lineage"]["page_count"] == 2
    assert region.content_text == saved.content_text


def test_classify_document_unknown_component_raises() -> None:
    use_case, components = _build(anchor=None, pages=[])

    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(page_component_id="missing"))

    components.save_many.assert_not_called()


def test_classify_document_no_pages_raises() -> None:
    anchor = _page("p0", 0, "x")
    use_case, components = _build(anchor=anchor, pages=[])

    with pytest.raises(ValueError, match="No pages"):
        asyncio.run(use_case.execute(page_component_id="p0"))

    components.save_many.assert_not_called()
