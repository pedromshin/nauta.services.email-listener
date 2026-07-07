"""Tests for few-shot example + known-entity-context rendering (RECALL-01, Plan 31-01).

Covers the previously-verified gap: AnthropicAutofiller accepted `examples`
but never rendered them into the Bedrock messages. Also covers the new
`entity_context` (aliases + identifiers) known-entity-context block.

All tests mock AsyncAnthropicBedrock so no real API calls are made.
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import MagicMock

from app.domain.entities.entity_type import EntityType, EntityTypeField

# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

_FIELD_A = EntityTypeField(
    id="efield-001",
    slug="vendor_name",
    label="Vendor Name",
    data_type="string",
    is_identifier=False,
    is_required=True,
    description="Name of the vendor",
    sort_order=0,
)
_FIELD_B = EntityTypeField(
    id="efield-002",
    slug="invoice_number",
    label="Invoice Number",
    data_type="string",
    is_identifier=True,
    is_required=True,
    description="Unique invoice identifier",
    sort_order=1,
)
_ENTITY_TYPE = EntityType(
    id="et-001",
    importer_id=None,
    slug="invoice",
    label="Invoice",
    description="A tax invoice from a vendor",
    is_active=True,
    embedding=None,
    fields=(_FIELD_A, _FIELD_B),
)


def _make_tool_use_block(fields: dict[str, Any], confidences: dict[str, Any] | None = None) -> MagicMock:
    block = MagicMock()
    block.type = "tool_use"
    block.input = {
        "extracted_fields": fields,
        "field_confidences": confidences or {},
    }
    return block


def _make_response(blocks: list[Any]) -> MagicMock:
    response = MagicMock()
    response.content = blocks
    return response


def _make_capturing_client() -> tuple[MagicMock, list[dict[str, Any]]]:
    captured: list[dict[str, Any]] = []

    async def fake_create(**kwargs: Any) -> Any:
        captured.append(kwargs)
        return _make_response([_make_tool_use_block({})])

    mock_messages = MagicMock()
    mock_messages.create = fake_create
    mock_client = MagicMock()
    mock_client.messages = mock_messages
    return mock_client, captured


# ---------------------------------------------------------------------------
# Few-shot example rendering
# ---------------------------------------------------------------------------


def test_examples_rendered_in_user_message() -> None:
    """Non-empty examples must render content_text + extracted_fields in the user turn."""
    from app.infrastructure.llm.autofill_adapter import AnthropicAutofiller

    mock_client, captured = _make_capturing_client()
    autofiller = AnthropicAutofiller(client=mock_client, model_id="test-model")

    examples = (
        {
            "content_text": "Vendor: Beta Corp, Invoice: INV-777",
            "extracted_fields": {"vendor_name": "Beta Corp", "invoice_number": "INV-777"},
            "score": 0.9,
        },
    )

    asyncio.run(
        autofiller.autofill(
            region_text="new region text",
            entity_type=_ENTITY_TYPE,
            knowledge_base_text="KB",
            examples=examples,
        )
    )

    assert len(captured) == 1
    user_content = str(captured[0]["messages"][0]["content"])
    assert "<example>" in user_content
    assert "Beta Corp" in user_content
    assert "INV-777" in user_content
    assert "vendor_name" in user_content


def test_examples_not_in_system_prompt() -> None:
    """Example content must NEVER leak into the system prompt (D-14)."""
    from app.infrastructure.llm.autofill_adapter import AnthropicAutofiller

    mock_client, captured = _make_capturing_client()
    autofiller = AnthropicAutofiller(client=mock_client, model_id="test-model")

    examples = (
        {
            "content_text": "SECRET_EXAMPLE_MARKER",
            "extracted_fields": {"vendor_name": "Beta Corp"},
            "score": 0.9,
        },
    )

    asyncio.run(
        autofiller.autofill(
            region_text="region",
            entity_type=_ENTITY_TYPE,
            knowledge_base_text="KB",
            examples=examples,
        )
    )

    system_prompt = str(captured[0].get("system", ""))
    assert "SECRET_EXAMPLE_MARKER" not in system_prompt


# ---------------------------------------------------------------------------
# Known-entity-context rendering (aliases + identifiers)
# ---------------------------------------------------------------------------


def test_entity_context_rendered_in_user_message() -> None:
    """entity_context aliases + identifiers must appear in a delimited block in the user turn."""
    from app.infrastructure.llm.autofill_adapter import AnthropicAutofiller

    mock_client, captured = _make_capturing_client()
    autofiller = AnthropicAutofiller(client=mock_client, model_id="test-model")

    entity_context = {
        "aliases": ["Acme Corp", "Acme Corporation"],
        "identifiers": {"tax_id": "12-3456789"},
    }

    asyncio.run(
        autofiller.autofill(
            region_text="region",
            entity_type=_ENTITY_TYPE,
            knowledge_base_text="KB",
            entity_context=entity_context,
        )
    )

    user_content = str(captured[0]["messages"][0]["content"])
    assert "<known_entity_context>" in user_content
    assert "Acme Corp" in user_content
    assert "Acme Corporation" in user_content
    assert "12-3456789" in user_content


def test_entity_context_not_in_system_prompt() -> None:
    """Aliases/identifiers must NEVER leak into the system prompt (D-14)."""
    from app.infrastructure.llm.autofill_adapter import AnthropicAutofiller

    mock_client, captured = _make_capturing_client()
    autofiller = AnthropicAutofiller(client=mock_client, model_id="test-model")

    entity_context = {
        "aliases": ["SECRET_ALIAS_MARKER"],
        "identifiers": {"tax_id": "SECRET_ID_MARKER"},
    }

    asyncio.run(
        autofiller.autofill(
            region_text="region",
            entity_type=_ENTITY_TYPE,
            knowledge_base_text="KB",
            entity_context=entity_context,
        )
    )

    system_prompt = str(captured[0].get("system", ""))
    assert "SECRET_ALIAS_MARKER" not in system_prompt
    assert "SECRET_ID_MARKER" not in system_prompt


def test_entity_context_alias_cap_applied() -> None:
    """More aliases than the defensive cap must be truncated in the rendered block."""
    from app.infrastructure.llm.autofill_adapter import _MAX_RENDERED_ALIASES, AnthropicAutofiller

    mock_client, captured = _make_capturing_client()
    autofiller = AnthropicAutofiller(client=mock_client, model_id="test-model")

    many_aliases = [f"alias-{i}" for i in range(_MAX_RENDERED_ALIASES + 10)]
    entity_context = {"aliases": many_aliases, "identifiers": {}}

    asyncio.run(
        autofiller.autofill(
            region_text="region",
            entity_type=_ENTITY_TYPE,
            knowledge_base_text="KB",
            entity_context=entity_context,
        )
    )

    user_content = str(captured[0]["messages"][0]["content"])
    rendered_count = sum(1 for alias in many_aliases if alias in user_content)
    assert rendered_count <= _MAX_RENDERED_ALIASES
    assert rendered_count == _MAX_RENDERED_ALIASES


# ---------------------------------------------------------------------------
# Cold-start contract regression guard
# ---------------------------------------------------------------------------


def test_cold_start_no_examples_no_entity_context_unchanged_form() -> None:
    """examples=() AND entity_context=None => single user message, region-only form (byte-identical)."""
    from app.infrastructure.llm.autofill_adapter import AnthropicAutofiller

    mock_client, captured = _make_capturing_client()
    autofiller = AnthropicAutofiller(client=mock_client, model_id="test-model")

    asyncio.run(
        autofiller.autofill(
            region_text="plain region text",
            entity_type=_ENTITY_TYPE,
            knowledge_base_text="KB",
            examples=(),
            entity_context=None,
        )
    )

    assert len(captured[0]["messages"]) == 1
    user_content = captured[0]["messages"][0]["content"]
    expected = "<document_content>plain region text</document_content>\n\nExtract the fields as JSON."
    assert user_content == expected
    assert "<example>" not in user_content
    assert "<known_entity_context>" not in user_content


def test_cold_start_empty_entity_context_dict_omits_block() -> None:
    """An empty entity_context dict (no aliases, no identifiers) omits the block entirely."""
    from app.infrastructure.llm.autofill_adapter import AnthropicAutofiller

    mock_client, captured = _make_capturing_client()
    autofiller = AnthropicAutofiller(client=mock_client, model_id="test-model")

    asyncio.run(
        autofiller.autofill(
            region_text="plain region text",
            entity_type=_ENTITY_TYPE,
            knowledge_base_text="KB",
            entity_context={"aliases": [], "identifiers": {}},
        )
    )

    user_content = str(captured[0]["messages"][0]["content"])
    assert "<known_entity_context>" not in user_content
