"""Regression: pgvector/halfvec columns parse from PostgREST's string form.

PostgREST serializes vector/halfvec as a STRING like "[0.1,0.2]" (not a JSON
array). The repositories previously did tuple(float(v) for v in raw) which
iterated the string's characters and raised ValueError on '[' — so every
component WITH an embedding (i.e. every confirmed region) became unloadable and
autofill/confirm 404'd with "Component not found".
"""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

from app.infrastructure.supabase.component_repository import SupabaseComponentRepository
from app.infrastructure.supabase.sanitize import parse_embedding

_COMPONENT_ROW = {
    "id": "fa34ebca-0d3e-43d0-9335-6e879c853b15",
    "email_id": "e-1",
    "importer_id": "imp-1",
    "attachment_id": "att-1",
    "parent_component_id": None,
    "source_type": "region",
    "location": {"page_index": 0},
    "content_text": "x",
    "content_markdown": None,
    "content_raw": None,
    "embedding": "[0.1,0.2,0.3]",  # PostgREST string form
    "sequence_index": 0,
    "extraction_status": "candidate",
}


def test_parse_embedding_string_form() -> None:
    assert parse_embedding("[0.1,0.2,0.3]") == (0.1, 0.2, 0.3)


def test_parse_embedding_list_form() -> None:
    assert parse_embedding([0.1, 0.2]) == (0.1, 0.2)


def test_parse_embedding_null_and_empty() -> None:
    assert parse_embedding(None) is None
    assert parse_embedding("[]") is None
    assert parse_embedding([]) is None


def test_find_by_id_loads_component_with_string_embedding() -> None:
    """find_by_id must not raise on a confirmed component carrying an embedding."""
    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [_COMPONENT_ROW]

    repo = SupabaseComponentRepository(client)
    comp = asyncio.run(repo.find_by_id("fa34ebca-0d3e-43d0-9335-6e879c853b15"))

    assert comp is not None
    assert comp.embedding == (0.1, 0.2, 0.3)
