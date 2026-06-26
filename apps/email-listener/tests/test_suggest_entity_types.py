"""Tests for SuggestEntityTypesUseCase.

Uses fake ports (in-memory) and a fake EntityTypeClassifierProtocol.
Covers:
  - Confident suggestions set role='entity' + entity_type_id on candidate regions.
  - null (slug=None) or low-confidence suggestions are skipped (region stays unclassified).
  - The ingest hook is best-effort: a classifier exception does not propagate.
  - Regions with role already set are not candidates (role is not None filter).
  - Regions with non-candidate extraction_status are skipped.
  - Empty entity type catalog skips the Bedrock call.
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.application.use_cases.suggest_entity_types import (
    CONFIDENCE_THRESHOLD,
    SuggestEntityTypesUseCase,
)
from app.domain.entities.component import Component
from app.domain.entities.entity_type import EntityType, EntityTypeField
from app.domain.ports.entity_type_classifier_protocol import (
    EntityTypeSuggestion,
    RegionToClassify,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

EMAIL_ID = "email-abc"
IMPORTER_ID = "imp-001"

ENTITY_TYPE_INVOICE = EntityType(
    id="et-invoice",
    importer_id=None,
    slug="invoice",
    label="Invoice",
    description="A tax invoice from a vendor",
    is_active=True,
    embedding=None,
    fields=(
        EntityTypeField(
            id="ef-001",
            slug="vendor_name",
            label="Vendor Name",
            data_type="string",
            is_identifier=False,
            is_required=True,
            description=None,
            sort_order=0,
        ),
    ),
)

ENTITY_TYPE_RECEIPT = EntityType(
    id="et-receipt",
    importer_id=None,
    slug="receipt",
    label="Receipt",
    description="A payment receipt",
    is_active=True,
    embedding=None,
    fields=(),
)


def _make_region(
    component_id: str,
    *,
    content_text: str = "Invoice No. 12345",
    extraction_status: str = "candidate",
    role: str | None = None,
    entity_type_id: str | None = None,
) -> Component:
    return Component(
        id=component_id,
        email_id=EMAIL_ID,
        importer_id=IMPORTER_ID,
        attachment_id="att-001",
        parent_component_id="page-001",
        source_type="region",
        location={"page_index": 0, "polygon": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        content_text=content_text,
        content_markdown=None,
        content_raw=None,
        embedding=None,
        sequence_index=0,
        extraction_status=extraction_status,
        role=role,
        entity_type_id=entity_type_id,
    )


# ---------------------------------------------------------------------------
# Fake repositories
# ---------------------------------------------------------------------------


class FakeComponentRepository:
    """In-memory component repository tracking update calls."""

    def __init__(self, components: list[Component]) -> None:
        self._components: dict[str, Component] = {c.id: c for c in components}
        self.role_updates: dict[str, str | None] = {}
        self.entity_type_updates: dict[str, str | None] = {}

    async def find_by_email_id(self, email_id: str) -> list[Component]:
        return [c for c in self._components.values() if c.email_id == email_id]

    async def find_unclassified_candidate_regions(self, email_id: str) -> list[Component]:
        return [
            c
            for c in self._components.values()
            if c.email_id == email_id
            and c.source_type == "region"
            and c.extraction_status in ("pending", "candidate")
            and c.role is None
        ]

    async def update_role(self, component_id: str, role: str | None) -> Component:
        self.role_updates[component_id] = role
        old = self._components[component_id]
        updated = Component(
            id=old.id,
            email_id=old.email_id,
            importer_id=old.importer_id,
            attachment_id=old.attachment_id,
            parent_component_id=old.parent_component_id,
            source_type=old.source_type,
            location=old.location,
            content_text=old.content_text,
            content_markdown=old.content_markdown,
            content_raw=old.content_raw,
            embedding=old.embedding,
            sequence_index=old.sequence_index,
            extraction_status=old.extraction_status,
            role=role,
            entity_type_id=old.entity_type_id,
            entity_type_field_id=old.entity_type_field_id,
        )
        self._components[component_id] = updated
        return updated

    async def update_entity_type(self, component_id: str, entity_type_id: str | None) -> Component:
        self.entity_type_updates[component_id] = entity_type_id
        old = self._components[component_id]
        updated = Component(
            id=old.id,
            email_id=old.email_id,
            importer_id=old.importer_id,
            attachment_id=old.attachment_id,
            parent_component_id=old.parent_component_id,
            source_type=old.source_type,
            location=old.location,
            content_text=old.content_text,
            content_markdown=old.content_markdown,
            content_raw=old.content_raw,
            embedding=old.embedding,
            sequence_index=old.sequence_index,
            extraction_status=old.extraction_status,
            role=old.role,
            entity_type_id=entity_type_id,
            entity_type_field_id=old.entity_type_field_id,
        )
        self._components[component_id] = updated
        return updated

    # Stubs for other protocol methods (not exercised in these tests)
    async def save_many(self, components: list[Component]) -> list[Component]:
        return components

    async def find_by_id(self, component_id: str) -> Component | None:
        return self._components.get(component_id)

    async def update_embedding(self, component_id: str, embedding: tuple[float, ...]) -> None:
        pass

    async def update_status(self, component_id: str, status: str) -> Component:
        return self._components[component_id]

    async def update_parent(self, component_id: str, parent_id: str | None) -> Component:
        return self._components[component_id]

    async def update_field_relationship(
        self,
        component_id: str,
        parent_component_id: str | None,
        entity_type_field_id: str | None,
    ) -> Component:
        return self._components[component_id]

    async def clear_candidate_fields(self, component_id: str) -> Component:
        return self._components[component_id]

    async def append_denied_polygon(self, component_id: str, polygon: list[list[float]]) -> None:
        pass

    async def find_by_page_component_id(self, page_component_id: str) -> list[Component]:
        return []

    async def find_pages_by_attachment(self, attachment_id: str) -> list[Component]:
        return []

    async def supersede_pending_regions(self, email_id: str) -> int:
        return 0


class FakeEntityTypeRepository:
    """In-memory entity type repository."""

    def __init__(self, entity_types: list[EntityType]) -> None:
        self._types = entity_types

    async def list_active(self, importer_id: str | None) -> list[EntityType]:
        return list(self._types)

    # Stubs for other protocol methods
    async def find_by_slug(self, importer_id: str | None, slug: str) -> EntityType | None:
        return next((et for et in self._types if et.slug == slug), None)

    async def find_by_id(self, entity_type_id: str) -> EntityType | None:
        return next((et for et in self._types if et.id == entity_type_id), None)

    async def create_entity_type(self, *, slug: str, label: str, description: str | None = None) -> EntityType:
        raise NotImplementedError

    async def update_entity_type(self, entity_type_id: str, **kwargs: Any) -> EntityType:
        raise NotImplementedError

    async def find_entity_type_by_id(self, entity_type_id: str) -> EntityType | None:
        return self.find_by_id(entity_type_id)  # type: ignore[return-value]

    async def find_entity_type_by_field_id(self, field_id: str) -> EntityType | None:
        return None

    async def create_field(self, entity_type_id: str, **kwargs: Any) -> EntityTypeField:
        raise NotImplementedError

    async def update_field(self, field_id: str, **kwargs: Any) -> EntityTypeField:
        raise NotImplementedError

    async def deactivate_field(self, field_id: str) -> EntityTypeField:
        raise NotImplementedError

    async def delete_field(self, field_id: str) -> None:
        pass

    async def reorder_fields(self, entity_type_id: str, ordered_field_ids: list[str]) -> None:
        pass

    async def count_confirmed_references(self, field_id: str) -> int:
        return 0


class FakeClassifier:
    """Fake EntityTypeClassifierProtocol that returns pre-configured suggestions."""

    def __init__(self, suggestions: tuple[EntityTypeSuggestion, ...]) -> None:
        self._suggestions = suggestions
        self.called_with: tuple[RegionToClassify, ...] | None = None

    async def classify(
        self,
        *,
        regions: tuple[RegionToClassify, ...],
        entity_types: tuple[object, ...],
    ) -> tuple[EntityTypeSuggestion, ...]:
        self.called_with = regions
        return self._suggestions


class ErrorClassifier:
    """Fake classifier that always raises to test best-effort handling."""

    async def classify(
        self,
        *,
        regions: tuple[RegionToClassify, ...],
        entity_types: tuple[object, ...],
    ) -> tuple[EntityTypeSuggestion, ...]:
        raise RuntimeError("Bedrock unavailable")


# ---------------------------------------------------------------------------
# Helper factory
# ---------------------------------------------------------------------------


def _make_use_case(
    components: list[Component],
    entity_types: list[EntityType],
    classifier: Any,
) -> tuple[SuggestEntityTypesUseCase, FakeComponentRepository]:
    repo = FakeComponentRepository(components)
    et_repo = FakeEntityTypeRepository(entity_types)
    use_case = SuggestEntityTypesUseCase(
        components=repo,  # type: ignore[arg-type]
        entity_types=et_repo,  # type: ignore[arg-type]
        classifier=classifier,  # type: ignore[arg-type]
    )
    return use_case, repo


# ---------------------------------------------------------------------------
# Tests: confident suggestions apply role + entity_type_id
# ---------------------------------------------------------------------------


def test_confident_suggestion_sets_role_and_entity_type() -> None:
    """A suggestion at or above CONFIDENCE_THRESHOLD sets role='entity' + entity_type_id."""
    region = _make_region("comp-001")
    suggestion = EntityTypeSuggestion(
        component_id="comp-001",
        entity_type_slug="invoice",
        confidence=CONFIDENCE_THRESHOLD,  # exactly at threshold
    )
    classifier = FakeClassifier(suggestions=(suggestion,))
    use_case, repo = _make_use_case([region], [ENTITY_TYPE_INVOICE], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    assert repo.role_updates.get("comp-001") == "entity"
    assert repo.entity_type_updates.get("comp-001") == ENTITY_TYPE_INVOICE.id


def test_confident_suggestion_above_threshold() -> None:
    """A high-confidence suggestion (0.9) is applied normally."""
    region = _make_region("comp-002")
    suggestion = EntityTypeSuggestion(
        component_id="comp-002",
        entity_type_slug="receipt",
        confidence=0.9,
    )
    classifier = FakeClassifier(suggestions=(suggestion,))
    use_case, repo = _make_use_case([region], [ENTITY_TYPE_RECEIPT], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    assert repo.role_updates.get("comp-002") == "entity"
    assert repo.entity_type_updates.get("comp-002") == ENTITY_TYPE_RECEIPT.id


# ---------------------------------------------------------------------------
# Tests: low-confidence / null suggestions are skipped
# ---------------------------------------------------------------------------


def test_null_slug_suggestion_is_skipped() -> None:
    """A suggestion with entity_type_slug=None is not applied."""
    region = _make_region("comp-003")
    suggestion = EntityTypeSuggestion(
        component_id="comp-003",
        entity_type_slug=None,
        confidence=0.8,
    )
    classifier = FakeClassifier(suggestions=(suggestion,))
    use_case, repo = _make_use_case([region], [ENTITY_TYPE_INVOICE], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    assert "comp-003" not in repo.role_updates
    assert "comp-003" not in repo.entity_type_updates


def test_below_threshold_confidence_is_skipped() -> None:
    """A suggestion below CONFIDENCE_THRESHOLD is not applied."""
    region = _make_region("comp-004")
    below = CONFIDENCE_THRESHOLD - 0.01
    suggestion = EntityTypeSuggestion(
        component_id="comp-004",
        entity_type_slug="invoice",
        confidence=below,
    )
    classifier = FakeClassifier(suggestions=(suggestion,))
    use_case, repo = _make_use_case([region], [ENTITY_TYPE_INVOICE], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    assert "comp-004" not in repo.role_updates
    assert "comp-004" not in repo.entity_type_updates


def test_zero_confidence_is_skipped() -> None:
    """A suggestion with confidence=0.0 is not applied."""
    region = _make_region("comp-005")
    suggestion = EntityTypeSuggestion(
        component_id="comp-005",
        entity_type_slug="invoice",
        confidence=0.0,
    )
    classifier = FakeClassifier(suggestions=(suggestion,))
    use_case, repo = _make_use_case([region], [ENTITY_TYPE_INVOICE], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    assert "comp-005" not in repo.role_updates
    assert "comp-005" not in repo.entity_type_updates


# ---------------------------------------------------------------------------
# Tests: non-candidate regions are not classified
# ---------------------------------------------------------------------------


def test_confirmed_regions_are_skipped() -> None:
    """Regions with extraction_status='confirmed' are not submitted to the classifier."""
    confirmed = _make_region("comp-006", extraction_status="confirmed")
    classifier = FakeClassifier(suggestions=())
    use_case, _repo = _make_use_case([confirmed], [ENTITY_TYPE_INVOICE], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    # Classifier should not have been called with that region
    assert classifier.called_with == () or classifier.called_with is None


def test_already_classified_candidate_with_role_is_skipped() -> None:
    """A candidate region with an existing role is not re-submitted."""
    already_classified = _make_region("comp-007", role="entity")
    classifier = FakeClassifier(suggestions=())
    use_case, repo = _make_use_case([already_classified], [ENTITY_TYPE_INVOICE], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    assert "comp-007" not in repo.role_updates


def test_pending_regions_are_skipped() -> None:
    """Regions with extraction_status='pending' (not yet candidate) are not submitted."""
    pending = _make_region("comp-008", extraction_status="pending")
    classifier = FakeClassifier(suggestions=())
    use_case, repo = _make_use_case([pending], [ENTITY_TYPE_INVOICE], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    assert "comp-008" not in repo.role_updates


# ---------------------------------------------------------------------------
# Tests: best-effort / non-fatal on classifier error
# ---------------------------------------------------------------------------


def test_classifier_error_does_not_raise() -> None:
    """A classifier exception must not propagate — ingest is never broken."""
    region = _make_region("comp-009")
    use_case, repo = _make_use_case([region], [ENTITY_TYPE_INVOICE], ErrorClassifier())

    # Must not raise
    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    # No updates applied
    assert "comp-009" not in repo.role_updates
    assert "comp-009" not in repo.entity_type_updates


# ---------------------------------------------------------------------------
# Tests: multiple regions classified in a single call
# ---------------------------------------------------------------------------


def test_multiple_regions_single_call() -> None:
    """All candidate regions are submitted in one classifier call."""
    region_a = _make_region("comp-010a", content_text="Invoice #100")
    region_b = _make_region("comp-010b", content_text="Receipt #200")
    suggestions = (
        EntityTypeSuggestion(component_id="comp-010a", entity_type_slug="invoice", confidence=0.9),
        EntityTypeSuggestion(component_id="comp-010b", entity_type_slug="receipt", confidence=0.8),
    )
    classifier = FakeClassifier(suggestions=suggestions)
    use_case, repo = _make_use_case(
        [region_a, region_b],
        [ENTITY_TYPE_INVOICE, ENTITY_TYPE_RECEIPT],
        classifier,
    )

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    # Both were submitted in one call
    assert classifier.called_with is not None
    submitted_ids = {r.component_id for r in classifier.called_with}
    assert submitted_ids == {"comp-010a", "comp-010b"}

    # Both suggestions were applied
    assert repo.role_updates.get("comp-010a") == "entity"
    assert repo.entity_type_updates.get("comp-010a") == ENTITY_TYPE_INVOICE.id
    assert repo.role_updates.get("comp-010b") == "entity"
    assert repo.entity_type_updates.get("comp-010b") == ENTITY_TYPE_RECEIPT.id


# ---------------------------------------------------------------------------
# Tests: no entity types available
# ---------------------------------------------------------------------------


def test_no_entity_types_skips_classification() -> None:
    """When no entity types exist the use case returns without calling the classifier."""
    region = _make_region("comp-011")
    classifier = FakeClassifier(suggestions=())
    use_case, repo = _make_use_case([region], [], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    # Classifier was never called
    assert classifier.called_with is None
    assert "comp-011" not in repo.role_updates


# ---------------------------------------------------------------------------
# Tests: empty region content is skipped
# ---------------------------------------------------------------------------


def test_empty_content_text_region_skipped() -> None:
    """Regions with blank content_text are not submitted to the classifier."""
    empty = _make_region("comp-012", content_text="   ")
    classifier = FakeClassifier(suggestions=())
    use_case, repo = _make_use_case([empty], [ENTITY_TYPE_INVOICE], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    assert classifier.called_with is None or len(classifier.called_with) == 0
    assert "comp-012" not in repo.role_updates


# ---------------------------------------------------------------------------
# Tests: extraction_status stays 'candidate' after suggestion (never auto-confirmed)
# ---------------------------------------------------------------------------


def test_suggestion_does_not_change_extraction_status() -> None:
    """Applying a suggestion sets role + entity_type_id but never touches extraction_status."""
    region = _make_region("comp-013")
    assert region.extraction_status == "candidate"

    suggestion = EntityTypeSuggestion(
        component_id="comp-013",
        entity_type_slug="invoice",
        confidence=0.85,
    )
    classifier = FakeClassifier(suggestions=(suggestion,))
    use_case, repo = _make_use_case([region], [ENTITY_TYPE_INVOICE], classifier)

    asyncio.run(use_case.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID))

    # role and entity_type_id were set
    assert repo.role_updates.get("comp-013") == "entity"
    assert repo.entity_type_updates.get("comp-013") == ENTITY_TYPE_INVOICE.id

    # extraction_status should NOT appear in any update method we track
    # (our fake does not even have update_status tracked above)
    # The component row's extraction_status is unchanged at 'candidate'
    component = repo._components["comp-013"]
    assert component.extraction_status == "candidate"
