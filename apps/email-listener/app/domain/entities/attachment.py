"""Domain entity for a persisted attachment row. No external dependencies."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Attachment:
    """A persisted attachment row, mirroring the attachments table 1:1."""

    id: str
    email_id: str
    importer_id: str
    filename: str | None
    content_type: str
    file_ext: str | None
    size_bytes: int | None
    storage_key: str
    parent_attachment_id: str | None
    parse_status: str
