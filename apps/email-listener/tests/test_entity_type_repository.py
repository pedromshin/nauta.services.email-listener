"""Tests for SupabaseEntityTypeRepository row mapping.

Regression guard: entity_type_fields rows use the `field_type` column and
store `is_identifier` inside the `config` jsonb (migration 0000 / packages/db
schema) — NOT top-level `data_type`/`is_identifier`. A prior mapping read the
wrong keys and 500'd every live autofill (KeyError: 'data_type'); fake-repo
unit tests never exercised a real row shape.
"""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

from app.infrastructure.llm.autofill_adapter import _build_system_prompt
from app.infrastructure.supabase.entity_type_repository import SupabaseEntityTypeRepository

# Real Supabase REST row shape for entity_types with embedded entity_type_fields(*)
ENTITY_TYPE_ROW = {
    "id": "400fb6ec-89d4-423b-befd-f29c447af02b",
    "importer_id": None,
    "slug": "invoice",
    "label": "Invoice",
    "description": "A tax invoice",
    "is_active": True,
    "embedding": None,
    "entity_type_fields": [
        {
            "id": "940d3e36-cc5c-470d-8cc1-9946ec85667d",
            "entity_type_id": "400fb6ec-89d4-423b-befd-f29c447af02b",
            "importer_id": None,
            "slug": "order_number",
            "label": "Order Number",
            "description": "The PO number printed on the document.",
            "field_type": "string",
            "is_required": True,
            "sort_order": 0,
            "config": {"is_identifier": True},
            "created_at": "2026-06-11T22:17:08.606185+00:00",
        },
        {
            "id": "b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e",
            "slug": "amount",
            "label": "Amount",
            "description": None,
            "field_type": "number",
            "is_required": False,
            "sort_order": 1,
            "config": {},
        },
    ],
}


def _repo_returning(row: dict[str, object]) -> SupabaseEntityTypeRepository:
    client = MagicMock()
    query = client.table.return_value.select.return_value.eq.return_value.eq.return_value
    query.is_.return_value.execute.return_value.data = [row]
    query.eq.return_value.execute.return_value.data = [row]
    return SupabaseEntityTypeRepository(client)


def test_find_by_slug_maps_field_type_and_config_identifier() -> None:
    """field_type → data_type; config.is_identifier → is_identifier (real row shape)."""
    repo = _repo_returning(ENTITY_TYPE_ROW)

    entity_type = asyncio.run(repo.find_by_slug(None, "invoice"))

    assert entity_type is not None
    assert entity_type.slug == "invoice"
    assert len(entity_type.fields) == 2

    order_no = entity_type.fields[0]
    assert order_no.slug == "order_number"
    assert order_no.data_type == "string"  # from field_type
    assert order_no.is_identifier is True  # from config.is_identifier
    assert order_no.is_required is True
    assert order_no.sort_order == 0

    amount = entity_type.fields[1]
    assert amount.data_type == "number"
    assert amount.is_identifier is False  # absent in config → default False
    assert amount.is_required is False
    assert amount.description is None


def test_field_id_is_mapped_from_row() -> None:
    """HIGH-3 / CRIT-1: the field's uuid id is surfaced on the domain entity."""
    repo = _repo_returning(ENTITY_TYPE_ROW)

    entity_type = asyncio.run(repo.find_by_slug(None, "invoice"))

    assert entity_type is not None
    assert entity_type.fields[0].id == "940d3e36-cc5c-470d-8cc1-9946ec85667d"


# Row carrying one active + one soft-deactivated (config.is_active=False) field.
ENTITY_TYPE_ROW_WITH_DEACTIVATED = {
    "id": "400fb6ec-89d4-423b-befd-f29c447af02b",
    "importer_id": None,
    "slug": "invoice",
    "label": "Invoice",
    "description": "A tax invoice",
    "is_active": True,
    "embedding": None,
    "entity_type_fields": [
        {
            "id": "940d3e36-cc5c-470d-8cc1-9946ec85667d",
            "slug": "order_number",
            "label": "Order Number",
            "description": None,
            "field_type": "string",
            "is_required": True,
            "sort_order": 0,
            "config": {"is_identifier": True},
        },
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "slug": "retired_field",
            "label": "Retired Field",
            "description": None,
            "field_type": "string",
            "is_required": False,
            "sort_order": 1,
            "config": {"is_active": False},
        },
    ],
}


def test_deactivated_field_excluded_from_active_read_path() -> None:
    """CRIT-2: config.is_active=False fields are dropped from EntityType.fields."""
    repo = _repo_returning(ENTITY_TYPE_ROW_WITH_DEACTIVATED)

    entity_type = asyncio.run(repo.find_by_slug(None, "invoice"))

    assert entity_type is not None
    slugs = [f.slug for f in entity_type.fields]
    assert "order_number" in slugs
    assert "retired_field" not in slugs  # soft-deactivated → hidden


def test_deactivated_field_absent_from_autofill_system_prompt() -> None:
    """CRIT-2: the deactivated field never leaks into the autofill schema block.

    The autofill system prompt is built directly from EntityType.fields, so a
    field hidden by the active read path can never be re-mapped by the LLM.
    """
    repo = _repo_returning(ENTITY_TYPE_ROW_WITH_DEACTIVATED)
    entity_type = asyncio.run(repo.find_by_slug(None, "invoice"))
    assert entity_type is not None

    prompt = _build_system_prompt(entity_type=entity_type, knowledge_base_text="")

    assert "order_number" in prompt
    assert "retired_field" not in prompt
