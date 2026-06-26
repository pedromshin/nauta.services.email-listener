"""Tests for read-API repository additions: email listing + attachment counts."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from unittest.mock import MagicMock

from app.infrastructure.supabase.attachment_repository import SupabaseAttachmentRepository
from app.infrastructure.supabase.email_repository import SupabaseEmailRepository

NOW = datetime(2026, 6, 10, 12, 0, 0, tzinfo=UTC)

EMAIL_ROW = {
    "id": "email-001",
    "importer_id": "imp-abc",
    "message_id": "<msg-001@example.com>",
    "in_reply_to": None,
    "references_ids": [],
    "received_at": NOW.isoformat(),
    "sender_address": "sender@example.com",
    "sender_name": None,
    "to_addresses": ["to@example.com"],
    "cc_addresses": [],
    "subject": "Test",
    "body_html": None,
    "body_text": "hello",
    "raw_storage_key": "inbound/local/ses-001",
    "parse_status": "received",
    "parse_error": None,
    "parsed_at": None,
    "created_at": NOW.isoformat(),
}


def test_list_by_importer_filters_orders_and_paginates() -> None:
    client = MagicMock()
    query = client.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value
    query.execute.return_value.data = [EMAIL_ROW]

    repo = SupabaseEmailRepository(client)
    emails = asyncio.run(repo.list_by_importer("imp-abc", limit=20, offset=40))

    assert len(emails) == 1
    assert emails[0].id == "email-001"
    client.table.assert_called_once_with("emails")
    client.table.return_value.select.return_value.eq.assert_called_once_with("importer_id", "imp-abc")
    client.table.return_value.select.return_value.eq.return_value.order.assert_called_once_with(
        "received_at", desc=True
    )
    client.table.return_value.select.return_value.eq.return_value.order.return_value.range.assert_called_once_with(
        40, 59
    )


def test_list_by_importer_none_lists_across_all_importers() -> None:
    """D-18: importer_id=None skips the eq filter — installation-wide listing."""
    client = MagicMock()
    query = client.table.return_value.select.return_value.order.return_value.range.return_value
    query.execute.return_value.data = [EMAIL_ROW]

    repo = SupabaseEmailRepository(client)
    emails = asyncio.run(repo.list_by_importer(None, limit=20, offset=0))

    assert len(emails) == 1
    assert emails[0].importer_id == "imp-abc"
    client.table.return_value.select.return_value.eq.assert_not_called()
    client.table.return_value.select.return_value.order.assert_called_once_with("received_at", desc=True)
    client.table.return_value.select.return_value.order.return_value.range.assert_called_once_with(0, 19)


def test_count_by_email_ids_groups_counts() -> None:
    client = MagicMock()
    query = client.table.return_value.select.return_value.in_.return_value
    query.execute.return_value.data = [
        {"email_id": "email-001"},
        {"email_id": "email-001"},
        {"email_id": "email-002"},
    ]

    repo = SupabaseAttachmentRepository(client)
    counts = asyncio.run(repo.count_by_email_ids(["email-001", "email-002", "email-003"]))

    assert counts == {"email-001": 2, "email-002": 1}
    client.table.assert_called_once_with("email_attachments")
    client.table.return_value.select.assert_called_once_with("email_id")
    client.table.return_value.select.return_value.in_.assert_called_once_with(
        "email_id", ["email-001", "email-002", "email-003"]
    )


def test_count_by_email_ids_empty_input_skips_query() -> None:
    client = MagicMock()
    repo = SupabaseAttachmentRepository(client)

    counts = asyncio.run(repo.count_by_email_ids([]))

    assert counts == {}
    client.table.assert_not_called()
