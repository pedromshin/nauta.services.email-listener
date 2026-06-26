"""Domain entity for a raw inbound email. No external dependencies."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class AttachmentMeta:
    """Metadata describing a single email attachment (content not stored yet)."""

    filename: str
    content_type: str
    size_bytes: int


@dataclass(frozen=True)
class InboundEmail:
    """A raw inbound email as received, before any parsing or persistence."""

    sender: str
    recipients: tuple[str, ...]
    subject: str
    raw_body: str
    headers: dict[str, str] = field(default_factory=dict)
    attachments: tuple[AttachmentMeta, ...] = ()

    @property
    def attachment_count(self) -> int:
        return len(self.attachments)
