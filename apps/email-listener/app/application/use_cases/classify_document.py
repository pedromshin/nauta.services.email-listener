"""ClassifyDocumentUseCase — treat a whole multi-page attachment as one entity.

A region is normally page-scoped (one page's tokens). Some documents, however,
are a single entity whose fields span every page — e.g. a 4-page contract or
itemized invoice that is ONE document. This use case creates one candidate
region whose content_text is
the concatenation of every page's text in page order, anchored to the first page
with a full-page polygon so it renders, selects, autofills, and confirms exactly
like any other region.

Architecture contract: imports ONLY domain ports and entities.
"""

from __future__ import annotations

import uuid

import structlog

from app.domain.entities.component import Component
from app.domain.ports.component_repository import ComponentRepository

logger = structlog.get_logger(__name__)

_FULL_PAGE_POLYGON: list[list[float]] = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]


def _page_index(component: Component) -> int:
    location = component.location or {}
    idx = location.get("page_index")
    return idx if isinstance(idx, int) else 0


class ClassifyDocumentUseCase:
    """Create one candidate region spanning an entire attachment (all pages)."""

    def __init__(self, *, components: ComponentRepository) -> None:
        self._components = components

    async def execute(self, *, page_component_id: str) -> Component:
        """Create a document-scoped region for the attachment of the given page.

        page_component_id may be ANY attachment_page component of the attachment;
        all of the attachment's pages are gathered regardless of which is passed.

        Raises:
            ValueError: if the page component or its attachment cannot be found.
        """
        log = logger.bind(page_component_id=page_component_id)

        anchor = await self._components.find_by_id(page_component_id)
        if anchor is None or anchor.attachment_id is None:
            log.warning("classify_document_component_not_found")
            raise ValueError(f"Component not found: {page_component_id}")

        pages = await self._components.find_pages_by_attachment(anchor.attachment_id)
        if not pages:
            log.warning("classify_document_no_pages")
            raise ValueError(f"No pages for attachment: {anchor.attachment_id}")

        # Reprocess can leave duplicate page components per page_index — keep one
        # per page, in ascending page order, and concatenate their text.
        by_index: dict[int, Component] = {}
        for page in pages:
            idx = _page_index(page)
            if idx not in by_index:
                by_index[idx] = page
        ordered = [by_index[i] for i in sorted(by_index)]
        content_text = "\n\n".join((p.content_text or "").strip() for p in ordered).strip()

        first = ordered[0]
        new_id = str(uuid.uuid4())
        region = Component(
            id=new_id,
            email_id=first.email_id,
            importer_id=first.importer_id,
            attachment_id=first.attachment_id,
            parent_component_id=first.id,
            source_type="region",
            location={
                "page_index": _page_index(first),
                "polygon": _FULL_PAGE_POLYGON,
                "scope": "document",
            },
            content_text=content_text,
            content_markdown=None,
            content_raw={"lineage": {"origin": "human_document", "page_count": len(ordered)}},
            embedding=None,
            sequence_index=0,
            extraction_status="candidate",
        )

        persisted = await self._components.save_many([region])
        if not persisted:
            raise RuntimeError(f"save_many returned empty result for document region {new_id}")

        log.info("classify_document_done", new_component_id=new_id, page_count=len(ordered))
        return persisted[0]
