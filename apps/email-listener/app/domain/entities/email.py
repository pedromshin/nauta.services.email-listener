"""Domain entity for a persisted email row. No external dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Email:
    """A persisted email row, mirroring the emails table 1:1."""

    id: str
    importer_id: str
    message_id: str
    in_reply_to: str | None
    references_ids: tuple[str, ...]
    received_at: datetime
    sender_address: str
    sender_name: str | None
    to_addresses: tuple[str, ...]
    cc_addresses: tuple[str, ...]
    subject: str | None
    body_html: str | None
    body_text: str | None
    raw_storage_key: str | None
    parse_status: str
    parse_error: str | None
    parsed_at: datetime | None
    created_at: datetime
