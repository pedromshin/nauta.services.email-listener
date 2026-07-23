"""Tests for ReprocessEmailUseCase: re-ingest-then-supersede, non-destructive.

Reprocess re-ingests FIRST, then bulk-supersedes ONLY the OLD pending
(auto-proposed) region pile — and only when re-ingest actually produced fresh
proposals. This makes reprocess non-destructive under failure (REG-3), idempotent
across repeated runs (no duplicate-region accumulation, REG-1), and preserves
human-touched regions (candidate/confirmed/rejected) and page components — the
latter enforced by the repository filter, covered by the SupabaseComponentRepository
tests below.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

from postgrest.base_request_builder import CountMethod

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


def _use_case(*, emails: AsyncMock, components: AsyncMock, ingest: AsyncMock) -> ReprocessEmailUseCase:
    return ReprocessEmailUseCase(
        emails=emails,
        components=components,
        extractions=AsyncMock(),
        ingest=ingest,
    )


def test_reprocess_reingests_then_supersedes_old_pending() -> None:
    """Happy path: re-ingest runs BEFORE supersede, and supersede targets only
    the OLD pile (created_before=cutoff) — never the freshly proposed regions."""
    emails = AsyncMock()
    emails.find_by_id.return_value = _email()

    components = AsyncMock()
    components.count_pending_regions_created_since.return_value = 20  # re-ingest made new boxes
    components.supersede_pending_regions.return_value = 984  # the old duplicate pile

    ingest = AsyncMock()

    # Attach both to one parent so we can assert ingest happened BEFORE supersede.
    manager = MagicMock()
    manager.attach_mock(ingest.execute, "ingest")
    manager.attach_mock(components.supersede_pending_regions, "supersede")

    result = asyncio.run(_use_case(emails=emails, components=components, ingest=ingest).execute(email_id=EMAIL_ID))

    ingest.execute.assert_awaited_once_with("ses-abc")
    # created_before cutoff keyword confines the supersede to the OLD pile.
    assert components.supersede_pending_regions.await_count == 1
    kwargs = components.supersede_pending_regions.await_args.kwargs
    assert components.supersede_pending_regions.await_args.args[0] == EMAIL_ID
    assert "created_before" in kwargs
    # Ordering: ingest must precede the supersede (non-destructive contract).
    assert [c[0] for c in manager.mock_calls] == ["ingest", "supersede"]
    assert result == {
        "email_id": EMAIL_ID,
        "superseded_components": 984,
        "new_regions": 20,
    }


def test_reprocess_skips_supersede_when_reingest_produces_no_regions() -> None:
    """REG-3: a Bedrock outage makes the segmenter return [] WITHOUT raising, so
    re-ingest completes but yields zero regions. Reprocess must NOT supersede the
    prior proposals — otherwise the overlay silently empties behind a 200."""
    emails = AsyncMock()
    emails.find_by_id.return_value = _email()

    components = AsyncMock()
    components.count_pending_regions_created_since.return_value = 0  # outage: nothing new
    ingest = AsyncMock()

    result = asyncio.run(_use_case(emails=emails, components=components, ingest=ingest).execute(email_id=EMAIL_ID))

    ingest.execute.assert_awaited_once_with("ses-abc")
    components.supersede_pending_regions.assert_not_called()  # prior proposals preserved
    assert result == {
        "email_id": EMAIL_ID,
        "superseded_components": 0,
        "new_regions": 0,
    }


def test_reprocess_never_supersedes_when_reingest_raises() -> None:
    """REG-3 / RPR-2: if re-ingest raises (raw S3 object lifecycle-deleted), the
    supersede is never reached — the prior proposals are left fully intact."""
    emails = AsyncMock()
    emails.find_by_id.return_value = _email()

    components = AsyncMock()
    ingest = AsyncMock()
    ingest.execute.side_effect = RuntimeError("NoSuchKey: raw object gone")

    raised = False
    try:
        asyncio.run(_use_case(emails=emails, components=components, ingest=ingest).execute(email_id=EMAIL_ID))
    except RuntimeError:
        raised = True

    assert raised
    components.supersede_pending_regions.assert_not_called()
    components.count_pending_regions_created_since.assert_not_called()


def test_reprocess_unknown_email_raises_without_touching_components() -> None:
    emails = AsyncMock()
    emails.find_by_id.return_value = None
    components = AsyncMock()
    ingest = AsyncMock()

    raised = False
    try:
        asyncio.run(_use_case(emails=emails, components=components, ingest=ingest).execute(email_id="missing"))
    except ValueError:
        raised = True

    assert raised
    components.supersede_pending_regions.assert_not_called()
    components.count_pending_regions_created_since.assert_not_called()
    ingest.execute.assert_not_called()


def test_supersede_pending_regions_filters_to_old_pending_regions_only() -> None:
    """The bulk update is scoped to source_type=region + status=pending +
    created_at < cutoff, so accepted/confirmed/rejected regions, page components,
    AND the freshly re-ingested proposals are never touched."""
    cutoff = datetime(2026, 6, 13, 12, 0, 0, tzinfo=UTC)
    client = MagicMock()
    update_chain = (
        client.table.return_value.update.return_value.eq.return_value.eq.return_value.eq.return_value.lt.return_value
    )
    update_chain.execute.return_value.data = [{"id": "r1"}, {"id": "r2"}]

    repo = SupabaseComponentRepository(client)
    count = asyncio.run(repo.supersede_pending_regions(EMAIL_ID, created_before=cutoff))

    assert count == 2
    client.table.assert_called_with("email_components")
    client.table.return_value.update.assert_called_once_with({"extraction_status": "superseded"})
    first_eq = client.table.return_value.update.return_value.eq
    first_eq.assert_called_once_with("email_id", EMAIL_ID)
    second_eq = first_eq.return_value.eq
    second_eq.assert_called_once_with("source_type", "region")
    third_eq = second_eq.return_value.eq
    third_eq.assert_called_once_with("extraction_status", "pending")
    third_eq.return_value.lt.assert_called_once_with("created_at", cutoff.isoformat())


def test_count_pending_regions_created_since_uses_exact_count() -> None:
    """Existence/size probe for fresh proposals uses count='exact' so it is not
    silently truncated by the PostgREST 1000-row SELECT cap."""
    cutoff = datetime(2026, 6, 13, 12, 0, 0, tzinfo=UTC)
    client = MagicMock()
    select_chain = (
        client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.gte.return_value
    )
    select_chain.execute.return_value.count = 7

    repo = SupabaseComponentRepository(client)
    count = asyncio.run(repo.count_pending_regions_created_since(EMAIL_ID, cutoff))

    assert count == 7
    client.table.return_value.select.assert_called_once_with("id", count=CountMethod.exact)
    gte = client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.gte
    gte.assert_called_once_with("created_at", cutoff.isoformat())
