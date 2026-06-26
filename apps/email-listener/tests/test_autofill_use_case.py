"""Tests for AutofillUseCase (application/use_cases/autofill.py).

Uses fake ports (in-memory) and a fake AutofillProtocol implementation.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import pytest

from app.domain.entities.component import Component
from app.domain.entities.entity_type import EntityType, EntityTypeField
from app.domain.entities.extraction_record import ExtractionRecord
from app.domain.ports.autofill_protocol import AutofillResult

# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

IMPORTER_ID = "imp-001"
NOW = datetime(2026, 6, 12, 12, 0, 0, tzinfo=UTC)

FIELD_A = EntityTypeField(
    id="efield-001",
    slug="vendor_name",
    label="Vendor Name",
    data_type="string",
    is_identifier=False,
    is_required=True,
    description="Name of the vendor",
    sort_order=0,
)
FIELD_B = EntityTypeField(
    id="efield-002",
    slug="invoice_number",
    label="Invoice Number",
    data_type="string",
    is_identifier=True,
    is_required=True,
    description="Unique invoice identifier",
    sort_order=1,
)
ENTITY_TYPE = EntityType(
    id="et-001",
    importer_id=None,
    slug="invoice",
    label="Invoice",
    description="A tax invoice from a vendor",
    is_active=True,
    embedding=None,
    fields=(FIELD_A, FIELD_B),
)

COMPONENT = Component(
    id="comp-001",
    email_id="email-001",
    importer_id=IMPORTER_ID,
    attachment_id="att-001",
    parent_component_id=None,
    source_type="region",
    location={"page_index": 0},
    content_text="Acme Corp Invoice INV-001 Total: $100",
    content_markdown=None,
    content_raw=None,
    embedding=None,
    sequence_index=0,
    extraction_status="pending",
)


class FakeComponentRepository:
    def __init__(self, component: Component | None = COMPONENT) -> None:
        self._component = component

    async def find_by_id(self, component_id: str) -> Component | None:
        if self._component and self._component.id == component_id:
            return self._component
        return None

    async def save_many(self, components: list[Component]) -> list[Component]:
        return components

    async def find_by_email_id(self, email_id: str) -> list[Component]:
        return []

    async def update_embedding(self, component_id: str, embedding: tuple[float, ...]) -> None:
        pass


class FakeEntityTypeRepository:
    def __init__(self, entity_type: EntityType | None = ENTITY_TYPE) -> None:
        self._entity_type = entity_type

    async def find_by_slug(self, importer_id: str | None, slug: str) -> EntityType | None:
        if self._entity_type and self._entity_type.slug == slug:
            return self._entity_type
        return None

    async def list_active(self, importer_id: str | None) -> list[EntityType]:
        return []


class FakeExtractionRepository:
    def __init__(self) -> None:
        self.saved: list[ExtractionRecord] = []

    async def save(self, record: ExtractionRecord) -> ExtractionRecord:
        self.saved.append(record)
        return record

    async def find_by_component_id(self, component_id: str) -> list[ExtractionRecord]:
        return []

    async def supersede_active(self, component_id: str) -> None:
        pass


class FakeAutofiller:
    def __init__(self, result: AutofillResult) -> None:
        self._result = result
        self.calls: list[dict[str, object]] = []

    async def autofill(
        self,
        *,
        region_text: str,
        entity_type: EntityType,
        knowledge_base_text: str,
        examples: tuple[dict[str, object], ...] = (),
    ) -> AutofillResult:
        self.calls.append(
            {
                "region_text": region_text,
                "entity_type": entity_type,
                "knowledge_base_text": knowledge_base_text,
                "examples": examples,
            }
        )
        return self._result


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_execute_returns_autofill_result_and_saves_candidate_record() -> None:
    """Execute loads component + entity type, calls autofiller, saves a candidate ExtractionRecord."""
    from app.application.use_cases.autofill import AutofillUseCase

    expected_result = AutofillResult(
        extracted_fields={"vendor_name": "Acme", "invoice_number": "INV-001"},
        confidence_score=0.85,
        confidence_breakdown={"vendor_name": 0.9, "invoice_number": 0.8},
    )
    components = FakeComponentRepository()
    entity_types = FakeEntityTypeRepository()
    extractions = FakeExtractionRepository()
    autofiller = FakeAutofiller(result=expected_result)

    use_case = AutofillUseCase(
        components=components,
        entity_types=entity_types,
        extractions=extractions,
        autofiller=autofiller,
    )

    result = asyncio.run(
        use_case.execute(
            component_id="comp-001",
            entity_type_slug="invoice",
            importer_id=IMPORTER_ID,
        )
    )

    assert result == expected_result
    assert len(extractions.saved) == 1
    record = extractions.saved[0]
    assert record.status == "candidate"
    assert record.extracted_fields == {"vendor_name": "Acme", "invoice_number": "INV-001"}
    assert record.component_id == "comp-001"
    assert record.entity_type_id == "et-001"
    assert record.importer_id == IMPORTER_ID


def test_execute_cold_start_calls_autofiller_with_empty_examples() -> None:
    """Cold start: autofiller.autofill is called with examples=() (D-13)."""
    from app.application.use_cases.autofill import AutofillUseCase

    autofiller = FakeAutofiller(result=AutofillResult({}, 0.0, None))
    use_case = AutofillUseCase(
        components=FakeComponentRepository(),
        entity_types=FakeEntityTypeRepository(),
        extractions=FakeExtractionRepository(),
        autofiller=autofiller,
    )

    asyncio.run(
        use_case.execute(
            component_id="comp-001",
            entity_type_slug="invoice",
            importer_id=IMPORTER_ID,
        )
    )

    assert len(autofiller.calls) == 1
    call = autofiller.calls[0]
    assert call["examples"] == ()


def test_execute_passes_entity_type_description_as_knowledge_base() -> None:
    """The entity type description is passed as knowledge_base_text (cold-start KB source)."""
    from app.application.use_cases.autofill import AutofillUseCase

    autofiller = FakeAutofiller(result=AutofillResult({}, 0.0, None))
    use_case = AutofillUseCase(
        components=FakeComponentRepository(),
        entity_types=FakeEntityTypeRepository(),
        extractions=FakeExtractionRepository(),
        autofiller=autofiller,
    )

    asyncio.run(
        use_case.execute(
            component_id="comp-001",
            entity_type_slug="invoice",
            importer_id=IMPORTER_ID,
        )
    )

    call = autofiller.calls[0]
    # Entity type description is "A tax invoice from a vendor"
    assert "A tax invoice from a vendor" in str(call["knowledge_base_text"])


def test_execute_unknown_component_raises_without_saving() -> None:
    """Unknown component_id raises ValueError; no ExtractionRecord is saved."""
    from app.application.use_cases.autofill import AutofillUseCase

    extractions = FakeExtractionRepository()
    use_case = AutofillUseCase(
        components=FakeComponentRepository(component=None),
        entity_types=FakeEntityTypeRepository(),
        extractions=extractions,
        autofiller=FakeAutofiller(result=AutofillResult({}, 0.0, None)),
    )

    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(
            use_case.execute(
                component_id="does-not-exist",
                entity_type_slug="invoice",
                importer_id=IMPORTER_ID,
            )
        )

    assert len(extractions.saved) == 0


def test_execute_unknown_entity_type_raises_without_saving() -> None:
    """Unknown entity_type_slug raises ValueError; no ExtractionRecord is saved."""
    from app.application.use_cases.autofill import AutofillUseCase

    extractions = FakeExtractionRepository()
    use_case = AutofillUseCase(
        components=FakeComponentRepository(),
        entity_types=FakeEntityTypeRepository(entity_type=None),
        extractions=extractions,
        autofiller=FakeAutofiller(result=AutofillResult({}, 0.0, None)),
    )

    with pytest.raises(ValueError, match="EntityType not found"):
        asyncio.run(
            use_case.execute(
                component_id="comp-001",
                entity_type_slug="unknown-type",
                importer_id=IMPORTER_ID,
            )
        )

    assert len(extractions.saved) == 0


def test_execute_derives_importer_from_component_when_omitted() -> None:
    """D-18: importer_id omitted — tenant is the component's own importer (D-05 sender-resolved)."""
    from app.application.use_cases.autofill import AutofillUseCase

    extractions = FakeExtractionRepository()
    use_case = AutofillUseCase(
        components=FakeComponentRepository(),
        entity_types=FakeEntityTypeRepository(),
        extractions=extractions,
        autofiller=FakeAutofiller(result=AutofillResult({}, 0.5, None)),
    )

    asyncio.run(
        use_case.execute(
            component_id="comp-001",
            entity_type_slug="invoice",
        )
    )

    assert len(extractions.saved) == 1
    assert extractions.saved[0].importer_id == COMPONENT.importer_id


def test_execute_importer_mismatch_raises_without_saving() -> None:
    """D-18 auth seam: an explicit importer_id that mismatches the component 404s."""
    from app.application.use_cases.autofill import AutofillUseCase

    extractions = FakeExtractionRepository()
    use_case = AutofillUseCase(
        components=FakeComponentRepository(),
        entity_types=FakeEntityTypeRepository(),
        extractions=extractions,
        autofiller=FakeAutofiller(result=AutofillResult({}, 0.5, None)),
    )

    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(
            use_case.execute(
                component_id="comp-001",
                entity_type_slug="invoice",
                importer_id="imp-other",
            )
        )

    assert len(extractions.saved) == 0
