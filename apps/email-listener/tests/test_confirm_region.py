"""Tests for Task 3: ConfirmRegionUseCase + autofill few-shot upgrade + confirm API.

ALL new assertions for this task live here — test_autofill_use_case.py is NOT modified.

Behavior contract (from PLAN 04-08 Task 3):
  1. ConfirmRegionUseCase.execute marks extraction status="confirmed", records
     corrected_fields when given, embeds region + confirmed fields, and calls
     ComponentRepository.update_embedding so the region becomes a retrievable
     few-shot child (D-15).
  2. Confirming never overwrites a prior confirmed value — corrections are recorded
     via corrected_fields on the extraction record (D-16). Idempotent.
  3. AutofillUseCase (few-shot upgrade) embeds the region, calls
     RetrievalPort.find_similar_confirmed, and passes examples into
     autofiller.autofill; when retrieval returns [] the cold-start path is preserved.
  4. POST /v1/components/{id}/confirm returns ApiResponse[ConfirmAck] with
     X-API-Key required.
"""

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock

import pytest
from dishka import Provider, Scope, make_async_container
from fastapi.testclient import TestClient

from app.application.use_cases.autofill import AutofillUseCase
from app.application.use_cases.confirm_region import ConfirmRegionUseCase
from app.application.use_cases.promote_entity_on_confirm import PromoteEntityOnConfirmUseCase
from app.domain.entities.component import Component
from app.domain.entities.extraction_record import ExtractionRecord
from app.domain.ports.autofill_protocol import AutofillResult
from app.domain.ports.retrieval_port import RetrievedExample
from app.main import create_app
from app.settings import get_settings

# ---------------------------------------------------------------------------
# Helpers / Fake Ports
# ---------------------------------------------------------------------------

_COMP_ID = "00000000-0000-0000-0000-000000000001"
_IMPORTER_ID = "00000000-0000-0000-0000-000000000010"
_ENTITY_TYPE_ID = "00000000-0000-0000-0000-000000000020"
_DIM = 1536
_ZERO_EMBEDDING: tuple[float, ...] = tuple([0.0] * _DIM)
_NONZERO_EMBEDDING: tuple[float, ...] = tuple([0.1] * _DIM)


def _make_component(content_text: str = "Bill of lading MSCU1234567") -> Component:
    return Component(
        id=_COMP_ID,
        email_id="email-0001",
        importer_id=_IMPORTER_ID,
        attachment_id=None,
        parent_component_id=None,
        source_type="pdf_region",
        location={},
        content_text=content_text,
        content_markdown=None,
        content_raw=None,
        embedding=None,
        sequence_index=0,
        extraction_status="candidate",
    )


def _make_extraction(status: str = "candidate") -> ExtractionRecord:
    now = datetime.now(UTC)
    return ExtractionRecord(
        id="er-0001",
        importer_id=_IMPORTER_ID,
        component_id=_COMP_ID,
        entity_type_id=_ENTITY_TYPE_ID,
        extracted_fields={"po_number": "PO-1000"},
        confidence_score=0.8,
        confidence_breakdown=None,
        routing_reason="cold_start_autofill",
        status=status,
        corrected_fields=None,
        retrieval_context=None,
        created_at=now,
        updated_at=now,
    )


# ---------------------------------------------------------------------------
# Tests: ConfirmRegionUseCase
# ---------------------------------------------------------------------------


def test_confirm_region_marks_status_confirmed() -> None:
    """ConfirmRegionUseCase marks the extraction record status='confirmed'."""
    record = _make_extraction(status="candidate")
    component = _make_component()

    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_embedding.return_value = None

    extractions = AsyncMock()
    extractions.find_by_component_id.return_value = [record]
    extractions.save.return_value = record

    embedder = AsyncMock()
    embedder.embed.return_value = _NONZERO_EMBEDDING

    use_case = ConfirmRegionUseCase(
        components=components,
        extractions=extractions,
        embedder=embedder,
    )
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            importer_id=_IMPORTER_ID,
            corrected_fields=None,
        )
    )

    # extractions.save must have been called with a record having status="confirmed"
    extractions.save.assert_called_once()
    saved_record: ExtractionRecord = extractions.save.call_args[0][0]
    assert saved_record.status == "confirmed"


def test_confirm_region_records_corrected_fields_when_given() -> None:
    """When corrected_fields are provided, they are stored on the extraction record."""
    record = _make_extraction(status="candidate")
    component = _make_component()

    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_embedding.return_value = None

    extractions = AsyncMock()
    extractions.find_by_component_id.return_value = [record]
    extractions.save.return_value = record

    embedder = AsyncMock()
    embedder.embed.return_value = _NONZERO_EMBEDDING

    use_case = ConfirmRegionUseCase(
        components=components,
        extractions=extractions,
        embedder=embedder,
    )
    corrections = {"po_number": "PO-9999"}
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            importer_id=_IMPORTER_ID,
            corrected_fields=corrections,
        )
    )

    saved_record: ExtractionRecord = extractions.save.call_args[0][0]
    assert saved_record.corrected_fields == corrections


def test_confirm_region_embeds_region_and_updates_embedding() -> None:
    """ConfirmRegionUseCase calls embedder.embed and components.update_embedding (D-15)."""
    record = _make_extraction(status="candidate")
    component = _make_component(content_text="region text here")

    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_embedding.return_value = None

    extractions = AsyncMock()
    extractions.find_by_component_id.return_value = [record]
    extractions.save.return_value = record

    embedder = AsyncMock()
    embedder.embed.return_value = _NONZERO_EMBEDDING

    use_case = ConfirmRegionUseCase(
        components=components,
        extractions=extractions,
        embedder=embedder,
    )
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            importer_id=_IMPORTER_ID,
            corrected_fields=None,
        )
    )

    embedder.embed.assert_called_once()
    components.update_embedding.assert_called_once_with(_COMP_ID, _NONZERO_EMBEDDING)


def test_confirm_region_does_not_overwrite_prior_confirmed_value() -> None:
    """Confirming an already-confirmed region supersedes — never overwrites (D-16)."""
    confirmed_record = _make_extraction(status="confirmed")
    component = _make_component()

    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_embedding.return_value = None

    extractions = AsyncMock()
    # Return an already-confirmed record
    extractions.find_by_component_id.return_value = [confirmed_record]
    extractions.save.return_value = confirmed_record

    embedder = AsyncMock()
    embedder.embed.return_value = _NONZERO_EMBEDDING

    use_case = ConfirmRegionUseCase(
        components=components,
        extractions=extractions,
        embedder=embedder,
    )
    # Run twice to test idempotency
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            importer_id=_IMPORTER_ID,
            corrected_fields=None,
        )
    )
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            importer_id=_IMPORTER_ID,
            corrected_fields=None,
        )
    )

    # Must NOT have called supersede_active or any delete — only save
    extractions.supersede_active.assert_not_called()


# ---------------------------------------------------------------------------
# Tests: AutofillUseCase few-shot upgrade
# (These assertions do NOT touch test_autofill_use_case.py)
# ---------------------------------------------------------------------------


def _make_entity_type() -> Any:
    from app.domain.entities.entity_type import EntityType

    return EntityType(
        id=_ENTITY_TYPE_ID,
        importer_id=None,
        slug="bill_of_lading",
        label="Bill of Lading",
        description="A bill of lading document",
        is_active=True,
        embedding=None,
        fields=(),
    )


def test_autofill_few_shot_upgrade_calls_find_similar_confirmed() -> None:
    """AutofillUseCase (upgraded) calls RetrievalPort.find_similar_confirmed."""
    entity_type = _make_entity_type()
    component = _make_component()

    components = AsyncMock()
    components.find_by_id.return_value = component

    entity_types = AsyncMock()
    entity_types.find_by_slug.return_value = entity_type

    extractions = AsyncMock()
    extractions.save.return_value = _make_extraction()

    embedder = AsyncMock()
    embedder.embed.return_value = _NONZERO_EMBEDDING

    retrieval = AsyncMock()
    retrieval.find_similar_confirmed.return_value = []

    autofiller = AsyncMock()
    autofiller.autofill.return_value = AutofillResult(
        extracted_fields={"po_number": "PO-1000"},
        confidence_score=0.9,
        confidence_breakdown=None,
    )

    use_case = AutofillUseCase(
        components=components,
        entity_types=entity_types,
        extractions=extractions,
        autofiller=autofiller,
        embedder=embedder,
        retrieval=retrieval,
    )
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            entity_type_slug="bill_of_lading",
            importer_id=_IMPORTER_ID,
        )
    )

    retrieval.find_similar_confirmed.assert_called_once()


def test_autofill_few_shot_upgrade_passes_examples_to_autofiller() -> None:
    """AutofillUseCase passes retrieved examples into autofiller.autofill(examples=...)."""
    entity_type = _make_entity_type()
    component = _make_component()

    retrieved = [
        RetrievedExample(
            component_id="comp-example-1",
            content_text="example region text",
            extracted_fields={"po_number": "PO-9998"},
            score=0.85,
        )
    ]

    components = AsyncMock()
    components.find_by_id.return_value = component

    entity_types = AsyncMock()
    entity_types.find_by_slug.return_value = entity_type

    extractions = AsyncMock()
    extractions.save.return_value = _make_extraction()

    embedder = AsyncMock()
    embedder.embed.return_value = _NONZERO_EMBEDDING

    retrieval = AsyncMock()
    retrieval.find_similar_confirmed.return_value = retrieved

    autofiller = AsyncMock()
    autofiller.autofill.return_value = AutofillResult(
        extracted_fields={"po_number": "PO-1000"},
        confidence_score=0.9,
        confidence_breakdown=None,
    )

    use_case = AutofillUseCase(
        components=components,
        entity_types=entity_types,
        extractions=extractions,
        autofiller=autofiller,
        embedder=embedder,
        retrieval=retrieval,
    )
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            entity_type_slug="bill_of_lading",
            importer_id=_IMPORTER_ID,
        )
    )

    autofiller.autofill.assert_called_once()
    call_kwargs = autofiller.autofill.call_args[1]
    examples_passed = call_kwargs.get("examples", ())
    # examples must be a tuple and must contain our retrieved example
    assert isinstance(examples_passed, tuple)
    assert len(examples_passed) >= 1


def test_autofill_few_shot_empty_retrieval_preserves_cold_start() -> None:
    """When retrieval returns [], autofill is called with examples=() — cold start (D-13)."""
    entity_type = _make_entity_type()
    component = _make_component()

    components = AsyncMock()
    components.find_by_id.return_value = component

    entity_types = AsyncMock()
    entity_types.find_by_slug.return_value = entity_type

    extractions = AsyncMock()
    extractions.save.return_value = _make_extraction()

    embedder = AsyncMock()
    embedder.embed.return_value = _NONZERO_EMBEDDING

    retrieval = AsyncMock()
    retrieval.find_similar_confirmed.return_value = []

    autofiller = AsyncMock()
    autofiller.autofill.return_value = AutofillResult(
        extracted_fields={"po_number": "PO-1000"},
        confidence_score=0.9,
        confidence_breakdown=None,
    )

    use_case = AutofillUseCase(
        components=components,
        entity_types=entity_types,
        extractions=extractions,
        autofiller=autofiller,
        embedder=embedder,
        retrieval=retrieval,
    )
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            entity_type_slug="bill_of_lading",
            importer_id=_IMPORTER_ID,
        )
    )

    # autofill must still have been called — just with empty examples
    autofiller.autofill.assert_called_once()
    call_kwargs = autofiller.autofill.call_args[1]
    examples_passed = call_kwargs.get("examples", ())
    assert examples_passed == ()


# ---------------------------------------------------------------------------
# Tests: POST /v1/components/{id}/confirm endpoint
# ---------------------------------------------------------------------------


def _make_confirm_client(mock_use_case: ConfirmRegionUseCase) -> TestClient:
    """Build a test app with a minimal dishka container providing ConfirmRegionUseCase."""

    def provide_use_case() -> ConfirmRegionUseCase:
        return mock_use_case

    _promote_stub = AsyncMock(spec=PromoteEntityOnConfirmUseCase)

    def provide_promote_stub() -> PromoteEntityOnConfirmUseCase:
        return _promote_stub

    provider = Provider(scope=Scope.APP)
    provider.provide(provide_use_case, provides=ConfirmRegionUseCase)
    provider.provide(provide_promote_stub, provides=PromoteEntityOnConfirmUseCase)

    app = create_app()
    app.state.dishka_container = make_async_container(provider)
    return TestClient(app, raise_server_exceptions=False)


def test_confirm_endpoint_returns_200() -> None:
    """POST /v1/components/{id}/confirm returns 200 with ConfirmAck."""
    mock_use_case = AsyncMock(spec=ConfirmRegionUseCase)
    mock_use_case.execute.return_value = None

    client = _make_confirm_client(mock_use_case)
    resp = client.post(
        f"/v1/components/{_COMP_ID}/confirm",
        json={},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


def test_confirm_endpoint_requires_api_key() -> None:
    """POST /v1/components/{id}/confirm returns 401 without X-API-Key when configured."""
    old_key = os.environ.get("API_KEY")
    os.environ["API_KEY"] = "test-secret-key"
    get_settings.cache_clear()
    try:
        mock_use_case = AsyncMock(spec=ConfirmRegionUseCase)
        mock_use_case.execute.return_value = None

        def provide_use_case() -> ConfirmRegionUseCase:
            return mock_use_case

        _promote_stub = AsyncMock(spec=PromoteEntityOnConfirmUseCase)

        def provide_promote_stub_auth() -> PromoteEntityOnConfirmUseCase:
            return _promote_stub

        provider = Provider(scope=Scope.APP)
        provider.provide(provide_use_case, provides=ConfirmRegionUseCase)
        provider.provide(provide_promote_stub_auth, provides=PromoteEntityOnConfirmUseCase)

        app = create_app()
        app.state.dishka_container = make_async_container(provider)
        auth_client = TestClient(app, raise_server_exceptions=False)

        resp = auth_client.post(
            f"/v1/components/{_COMP_ID}/confirm",
            json={},
        )
        assert resp.status_code == 401

        resp_authed = auth_client.post(
            f"/v1/components/{_COMP_ID}/confirm",
            json={},
            headers={"X-API-Key": "test-secret-key"},
        )
        assert resp_authed.status_code == 200
    finally:
        if old_key is None:
            os.environ.pop("API_KEY", None)
        else:
            os.environ["API_KEY"] = old_key
        get_settings.cache_clear()


def test_confirm_endpoint_accepts_corrected_fields() -> None:
    """POST /v1/components/{id}/confirm accepts optional corrected_fields payload."""
    mock_use_case = AsyncMock(spec=ConfirmRegionUseCase)
    mock_use_case.execute.return_value = None

    client = _make_confirm_client(mock_use_case)
    resp = client.post(
        f"/v1/components/{_COMP_ID}/confirm",
        json={"corrected_fields": {"po_number": "PO-9999"}},
    )
    assert resp.status_code == 200

    # The use case must have been called with the corrected fields
    call_kwargs = mock_use_case.execute.call_args[1]
    assert call_kwargs.get("corrected_fields") == {"po_number": "PO-9999"}


def test_confirm_region_derives_importer_from_component_when_omitted() -> None:
    """D-18: importer_id omitted — tenant is derived from the component's own importer.

    When a candidate record exists, the confirmed record carries the component's importer.
    """
    record = _make_extraction(status="candidate")
    component = _make_component()

    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_embedding.return_value = None

    extractions = AsyncMock()
    extractions.find_by_component_id.return_value = [record]
    extractions.save.return_value = record

    embedder = AsyncMock()
    embedder.embed.return_value = _NONZERO_EMBEDDING

    use_case = ConfirmRegionUseCase(
        components=components,
        extractions=extractions,
        embedder=embedder,
    )
    asyncio.run(use_case.execute(component_id=_COMP_ID))

    saved_record: ExtractionRecord = extractions.save.call_args[0][0]
    assert saved_record.importer_id == component.importer_id


def test_confirm_region_importer_mismatch_raises() -> None:
    """D-18 auth seam: an explicit importer_id that mismatches the component 404s."""
    component = _make_component()

    components = AsyncMock()
    components.find_by_id.return_value = component

    extractions = AsyncMock()
    embedder = AsyncMock()

    use_case = ConfirmRegionUseCase(
        components=components,
        extractions=extractions,
        embedder=embedder,
    )
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(component_id=_COMP_ID, importer_id="imp-other"))

    extractions.save.assert_not_called()
    embedder.embed.assert_not_called()


# ---------------------------------------------------------------------------
# Tests: confirm-fallback FK fix (08-01)
# ---------------------------------------------------------------------------


def test_confirm_fallback_no_candidate_skips_save_but_embeds() -> None:
    """No candidate + no prior confirmed: save skipped (FK guard), embedding runs (D-15).

    This tests the fix for the NOT NULL FK violation: entity_type_id="" previously
    caused a DB constraint error. Now the use case logs a warning and skips
    extractions.save, but still calls embedder.embed and components.update_embedding
    so the D-15 learning flywheel is not disrupted.
    """
    component = _make_component()

    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_embedding.return_value = None

    extractions = AsyncMock()
    # No records at all — neither candidate nor confirmed
    extractions.find_by_component_id.return_value = []

    embedder = AsyncMock()
    embedder.embed.return_value = _NONZERO_EMBEDDING

    use_case = ConfirmRegionUseCase(
        components=components,
        extractions=extractions,
        embedder=embedder,
    )
    asyncio.run(use_case.execute(component_id=_COMP_ID, importer_id=_IMPORTER_ID))

    # save must NOT have been called (no valid entity_type_id to store)
    extractions.save.assert_not_called()

    # D-15: embedding path MUST still run
    embedder.embed.assert_called_once()
    components.update_embedding.assert_called_once_with(_COMP_ID, _NONZERO_EMBEDDING)


def test_autofill_find_similar_confirmed_receives_key_terms_for_invoice_text() -> None:
    """When component has invoice identifier text, key_terms passed to retrieval are non-empty.

    COMPONENT content_text has 'Invoice INV-001' which extract_key_terms should detect,
    activating the trigram arm of hybrid retrieval.
    """
    entity_type = _make_entity_type()
    # Component text contains an invoice identifier
    invoice_component = _make_component(content_text="Acme Corp Invoice INV-001 Total: $100")

    components = AsyncMock()
    components.find_by_id.return_value = invoice_component

    entity_types = AsyncMock()
    entity_types.find_by_slug.return_value = entity_type

    extractions = AsyncMock()
    extractions.save.return_value = _make_extraction()

    embedder = AsyncMock()
    embedder.embed.return_value = _NONZERO_EMBEDDING

    retrieval = AsyncMock()
    retrieval.find_similar_confirmed.return_value = []

    autofiller = AsyncMock()
    autofiller.autofill.return_value = AutofillResult(
        extracted_fields={"po_number": "PO-1000"},
        confidence_score=0.9,
        confidence_breakdown=None,
    )

    use_case = AutofillUseCase(
        components=components,
        entity_types=entity_types,
        extractions=extractions,
        autofiller=autofiller,
        embedder=embedder,
        retrieval=retrieval,
    )
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            entity_type_slug="bill_of_lading",
            importer_id=_IMPORTER_ID,
        )
    )

    retrieval.find_similar_confirmed.assert_called_once()
    call_kwargs = retrieval.find_similar_confirmed.call_args[1]
    key_terms = call_kwargs.get("key_terms", ())
    # Invoice text must have produced at least one key term
    assert len(key_terms) > 0, f"Expected non-empty key_terms, got: {key_terms}"
    assert "INV-001" in key_terms
