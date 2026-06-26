"""Tests for SupabaseExtractionRepository persistence sanitization.

LLM-extracted jsonb payloads can carry NUL (U+0000) chars that Postgres
rejects (22P05) — same live failure mode the component repository hit.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from unittest.mock import MagicMock

from app.domain.entities.extraction_record import ExtractionRecord
from app.infrastructure.supabase.extraction_repository import SupabaseExtractionRepository

NOW = datetime(2026, 6, 12, 12, 0, 0, tzinfo=UTC)

ROW = {
    "id": "er-001",
    "importer_id": "imp-abc",
    "component_id": "comp-001",
    "entity_type_id": "et-001",
    "extracted_fields": {"po_number": "PO-1000"},
    "confidence_score": 0.8,
    "confidence_breakdown": None,
    "routing_reason": "cold_start_autofill",
    "status": "candidate",
    "corrected_fields": None,
    "retrieval_context": None,
    "created_at": NOW.isoformat(),
    "updated_at": NOW.isoformat(),
}


def _record_with_nuls() -> ExtractionRecord:
    return ExtractionRecord(
        id="er-001",
        importer_id="imp-abc",
        component_id="comp-001",
        entity_type_id="et-001",
        extracted_fields={"po_number": "PO\x00-1000", "nested": {"note": "a\x00b"}},
        confidence_score=0.8,
        confidence_breakdown=None,
        routing_reason="cold\x00_start",
        status="candidate",
        corrected_fields=None,
        retrieval_context={"examples": ["x\x00y"]},
        created_at=NOW,
        updated_at=NOW,
    )


def test_save_strips_nul_chars_from_persisted_payload() -> None:
    """NUL chars are recursively removed from every string before upsert (22P05 guard)."""
    client = MagicMock()
    upsert = client.table.return_value.upsert
    upsert.return_value.execute.return_value.data = [ROW]

    repo = SupabaseExtractionRepository(client)
    asyncio.run(repo.save(_record_with_nuls()))

    payload = upsert.call_args[0][0]
    assert payload["extracted_fields"] == {"po_number": "PO-1000", "nested": {"note": "ab"}}
    assert payload["routing_reason"] == "cold_start"
    assert payload["retrieval_context"] == {"examples": ["xy"]}
    assert "\x00" not in str(payload)
