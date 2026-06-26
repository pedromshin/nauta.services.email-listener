"""SES notification parser — extracts email metadata from the SNS Message field."""

from __future__ import annotations

import json
from typing import TypedDict

import structlog

logger = structlog.get_logger(__name__)


class EmailMeta(TypedDict):
    message_id: str
    sender: str
    recipients: list[str]
    subject: str


def parse_ses_notification(sns_message_str: str) -> EmailMeta:
    """Parse SES notification JSON from the SNS Message field."""
    data: dict[str, object] = json.loads(sns_message_str)
    mail: dict[str, object] = data.get("mail", {})  # type: ignore[assignment]
    headers: dict[str, object] = mail.get("commonHeaders", {})  # type: ignore[assignment]
    raw_dest = mail.get("destination", [])
    recipients: list[str] = list(raw_dest) if isinstance(raw_dest, list) else []
    return EmailMeta(
        message_id=str(mail.get("messageId", "unknown")),
        sender=str(mail.get("source", "unknown")),
        recipients=recipients,
        subject=str(headers.get("subject", "(no subject)")),
    )
