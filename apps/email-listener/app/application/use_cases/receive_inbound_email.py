"""Use case: receive a raw inbound email and log it. No parsing, no persistence yet."""

from __future__ import annotations

import structlog

from app.domain.entities.inbound_email import InboundEmail

logger = structlog.get_logger(__name__)


class ReceiveInboundEmailUseCase:
    """Logs the raw inbound email. Future stages add parsing, persistence, storage."""

    async def execute(self, email: InboundEmail) -> None:
        logger.info(
            "inbound_email_received",
            sender=email.sender,
            recipients=list(email.recipients),
            subject=email.subject,
            body_size_bytes=len(email.raw_body.encode("utf-8")),
            attachment_count=email.attachment_count,
            attachments=[
                {
                    "filename": a.filename,
                    "content_type": a.content_type,
                    "size_bytes": a.size_bytes,
                }
                for a in email.attachments
            ],
            headers=email.headers,
        )
