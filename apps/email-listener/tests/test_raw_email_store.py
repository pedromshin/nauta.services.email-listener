"""Tests for the S3 raw email store adapter (boto3 mocked, no network)."""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

from app.infrastructure.s3.raw_email_store import S3RawEmailStore


def _make_store(s3_client: MagicMock) -> S3RawEmailStore:
    return S3RawEmailStore(
        bucket="nauta-services-ses-inbound-emails",
        prefix="inbound/local/",
        client=s3_client,
    )


def test_key_for_joins_prefix_and_message_id() -> None:
    store = _make_store(MagicMock())
    assert store.key_for("ses-msg-123") == "inbound/local/ses-msg-123"


def test_fetch_reads_object_body() -> None:
    s3 = MagicMock()
    body = MagicMock()
    body.read.return_value = b"raw mime bytes"
    s3.get_object.return_value = {"Body": body}

    store = _make_store(s3)
    raw = asyncio.run(store.fetch("ses-msg-123"))

    assert raw == b"raw mime bytes"
    s3.get_object.assert_called_once_with(
        Bucket="nauta-services-ses-inbound-emails",
        Key="inbound/local/ses-msg-123",
    )
