"""Pure stdlib MIME parser — raw RFC 5322 bytes to a ParsedEmail value object.

No external dependencies (domain layer). Uses the modern ``email`` policy API
so bodies and attachments are decoded transparently.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from email import message_from_bytes, policy
from email.message import EmailMessage
from email.utils import getaddresses, parseaddr, parsedate_to_datetime


@dataclass(frozen=True)
class ParsedAttachment:
    """A single decoded attachment extracted from a MIME message."""

    filename: str | None
    content_type: str
    data: bytes


@dataclass(frozen=True)
class ParsedEmail:
    """Decoded email fields ready to map onto the Email entity."""

    message_id: str | None
    in_reply_to: str | None
    references_ids: tuple[str, ...]
    sender_address: str
    sender_name: str | None
    to_addresses: tuple[str, ...]
    cc_addresses: tuple[str, ...]
    subject: str | None
    body_text: str | None
    body_html: str | None
    received_at: datetime | None
    attachments: tuple[ParsedAttachment, ...]


def _header(msg: EmailMessage, name: str) -> str | None:
    value = msg.get(name)
    if value is None:
        return None
    stripped = str(value).strip()
    return stripped or None


def _addresses(msg: EmailMessage, name: str) -> tuple[str, ...]:
    raw = msg.get_all(name, [])
    return tuple(addr for _name, addr in getaddresses([str(v) for v in raw]) if addr)


def _parse_date(msg: EmailMessage) -> datetime | None:
    raw = _header(msg, "Date")
    if raw is None:
        return None
    try:
        return parsedate_to_datetime(raw)
    except ValueError:
        return None


def _body(msg: EmailMessage, subtype: str) -> str | None:
    part = msg.get_body(preferencelist=(subtype,))
    if part is None:
        return None
    content = part.get_content()
    return content if isinstance(content, str) else None


def _attachment_bytes(part: EmailMessage) -> bytes:
    content = part.get_content()
    if isinstance(content, bytes):
        return content
    if isinstance(content, str):
        return content.encode("utf-8")
    decoded = part.get_payload(decode=True)
    return decoded if isinstance(decoded, bytes) else b""


def _attachments(msg: EmailMessage) -> tuple[ParsedAttachment, ...]:
    return tuple(
        ParsedAttachment(
            filename=part.get_filename(),
            content_type=part.get_content_type(),
            data=_attachment_bytes(part),
        )
        for part in msg.iter_attachments()
    )


def parse_mime(raw: bytes) -> ParsedEmail:
    """Parse raw MIME bytes into a ParsedEmail with decoded bodies and attachments."""
    msg = message_from_bytes(raw, policy=policy.default)
    # Typing narrow only: message_from_bytes with policy.default always returns
    # an EmailMessage (policy.default.message_factory) — never fails at runtime.
    assert isinstance(msg, EmailMessage)  # nosec B101 — mypy narrowing, not a runtime guard

    sender_name, sender_address = parseaddr(str(msg.get("From", "")))
    references = _header(msg, "References")

    return ParsedEmail(
        message_id=_header(msg, "Message-ID"),
        in_reply_to=_header(msg, "In-Reply-To"),
        references_ids=tuple(references.split()) if references else (),
        sender_address=sender_address,
        sender_name=sender_name or None,
        to_addresses=_addresses(msg, "To"),
        cc_addresses=_addresses(msg, "Cc"),
        subject=_header(msg, "Subject"),
        body_text=_body(msg, "plain"),
        body_html=_body(msg, "html"),
        received_at=_parse_date(msg),
        attachments=_attachments(msg),
    )
