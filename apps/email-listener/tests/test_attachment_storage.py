"""Tests for the Supabase Storage attachment adapter (client mocked, no network)."""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

from app.infrastructure.supabase.attachment_storage import SupabaseAttachmentStorage

BUCKET = "email-attachments"
KEY = "imp-abc/email-001/att-001/invoice.pdf"


def test_store_uploads_with_content_type_and_upsert() -> None:
    client = MagicMock()
    storage = SupabaseAttachmentStorage(client=client, bucket=BUCKET)

    asyncio.run(storage.store(KEY, b"pdf-bytes", "application/pdf"))

    client.storage.from_.assert_called_with(BUCKET)
    client.storage.from_.return_value.upload.assert_called_once_with(
        path=KEY,
        file=b"pdf-bytes",
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )


def test_store_creates_bucket_once_and_tolerates_existing() -> None:
    client = MagicMock()
    client.storage.create_bucket.side_effect = RuntimeError("Bucket already exists")
    storage = SupabaseAttachmentStorage(client=client, bucket=BUCKET)

    asyncio.run(storage.store(KEY, b"a", "application/pdf"))
    asyncio.run(storage.store(KEY, b"b", "application/pdf"))

    client.storage.create_bucket.assert_called_once()


def test_fetch_downloads_by_key() -> None:
    client = MagicMock()
    client.storage.from_.return_value.download.return_value = b"pdf-bytes"
    storage = SupabaseAttachmentStorage(client=client, bucket=BUCKET)

    data = asyncio.run(storage.fetch(KEY))

    assert data == b"pdf-bytes"
    client.storage.from_.assert_called_with(BUCKET)
    client.storage.from_.return_value.download.assert_called_once_with(KEY)
