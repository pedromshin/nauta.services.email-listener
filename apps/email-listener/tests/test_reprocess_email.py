"""Tests for ReprocessEmailUseCase replace-not-stack semantics.

Reprocess bulk-supersedes the email's pending (auto-proposed) region components
in a single query so the re-ingest replaces them instead of piling duplicate
pending boxes onto the preview. Accepted/confirmed/rejected regions and page
components are preserved — enforced by the repository filter, covered by the
SupabaseComponentRepository test below.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

from app.application.use_cases.reprocess_email import ReprocessEmailUseCase
from app.domain.entities.email import Email
from app.infrastructure.supabase.component_repository import SupabaseComponentRepository

NOW = datetime(2026, 6, 13, 12, 0, 0, tzinfo=UTC)
EMAIL_ID = "9b0e2e4d-563b-46d1-8029-41f0048ce587"
IMPORTER_ID = "imp-001"


def _email() -> Email:
    return Email(
        id=EMAIL_ID,
        importer_id=IMPORTER_ID,
        message_id="<m@x>",
        in_reply_to=None,
        references_ids=(),
        received_at=NOW,
        sender_address="s@x.com",
        sender_name=None,
        to_addresses=("agent@x",),
        cc_addresses=(),
        subject="s",
        body_html=None,
        body_text="b",
        raw_storage_key="inbound/local/ses-abc",
        parse_status="parsed",
        parse_error=None,
        parsed_at=NOW,
        created_at=NOW,
    )


def test_reprocess_bulk_supersedes_pending_then_reingests() -> None:
    emails = AsyncMock()
    emails.find_by_id.return_value = _email()

    components = AsyncMock()
    components.supersede_pending_regions.return_value = 984  # the duplicate pile

    extractions = AsyncMock()
    ingest = AsyncMock()

    use_case = ReprocessEmailUseCase(
        emails=emails,
        components=components,
        extractions=extractions,
        ingest=ingest,
    )

    result = asyncio.run(use_case.execute(email_id=EMAIL_ID))

    components.supersede_pending_regions.assert_awaited_once_with(EMAIL_ID)
    ingest.execute.assert_awaited_once_with("ses-abc")
    assert result == {"email_id": EMAIL_ID, "superseded_components": 984}


def test_reprocess_unknown_email_raises_without_touching_components() -> None:
    emails = AsyncMock()
    emails.find_by_id.return_value = None
    components = AsyncMock()
    ingest = AsyncMock()

    use_case = ReprocessEmailUseCase(
        emails=emails,
        components=components,
        extractions=AsyncMock(),
        ingest=ingest,
    )

    raised = False
    try:
        asyncio.run(use_case.execute(email_id="missing"))
    except ValueError:
        raised = True

    assert raised
    components.supersede_pending_regions.assert_not_called()
    ingest.execute.assert_not_called()


def test_supersede_pending_regions_filters_to_pending_regions_only() -> None:
    """The bulk update is scoped to source_type=region + status=pending, so
    accepted/confirmed/rejected regions and page components are never touched."""
    client = MagicMock()
    update_chain = client.table.return_value.update.return_value.eq.return_value.eq.return_value.eq.return_value
    update_chain.execute.return_value.data = [{"id": "r1"}, {"id": "r2"}]

    repo = SupabaseComponentRepository(client)
    count = asyncio.run(repo.supersede_pending_regions(EMAIL_ID))

    assert count == 2
    client.table.assert_called_with("email_components")
    client.table.return_value.update.assert_called_once_with({"extraction_status": "superseded"})
    # three eq() filters chained: email_id, source_type=region, extraction_status=pending
    first_eq = client.table.return_value.update.return_value.eq
    first_eq.assert_called_once_with("email_id", EMAIL_ID)
    second_eq = first_eq.return_value.eq
    second_eq.assert_called_once_with("source_type", "region")
    third_eq = second_eq.return_value.eq
    third_eq.assert_called_once_with("extraction_status", "pending")
