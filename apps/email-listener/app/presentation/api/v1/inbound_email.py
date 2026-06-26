"""POST /v1/emails/inbound — receive a raw inbound email and log it.

Provider-agnostic webhook. The payload models a generic forwarded email;
SES/SNS-specific wiring arrives in a later stage.
"""

from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.application.use_cases.receive_inbound_email import ReceiveInboundEmailUseCase
from app.domain.entities.inbound_email import AttachmentMeta, InboundEmail
from app.presentation.api.response import ApiResponse
from app.presentation.middleware.auth import require_api_key

router = APIRouter(prefix="/v1/emails", tags=["emails"], dependencies=[Depends(require_api_key)])

MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MiB — raw MIME bodies can be large


class AttachmentMetaIn(BaseModel):
    filename: str = Field(min_length=1, max_length=1024)
    content_type: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(ge=0)


class InboundEmailIn(BaseModel):
    """Validated inbound email payload — system boundary."""

    sender: str = Field(min_length=1, max_length=998)
    recipients: list[str] = Field(min_length=1)
    subject: str = Field(default="", max_length=998)
    raw_body: str = Field(default="", max_length=MAX_BODY_BYTES)
    headers: dict[str, str] = Field(default_factory=dict)
    attachments: list[AttachmentMetaIn] = Field(default_factory=list)

    def to_entity(self) -> InboundEmail:
        return InboundEmail(
            sender=self.sender,
            recipients=tuple(self.recipients),
            subject=self.subject,
            raw_body=self.raw_body,
            headers=dict(self.headers),
            attachments=tuple(
                AttachmentMeta(
                    filename=a.filename,
                    content_type=a.content_type,
                    size_bytes=a.size_bytes,
                )
                for a in self.attachments
            ),
        )


class InboundEmailAck(BaseModel):
    received: bool
    attachment_count: int


@router.post("/inbound", status_code=202)
@inject
async def receive_inbound_email(
    payload: InboundEmailIn,
    use_case: FromDishka[ReceiveInboundEmailUseCase],
) -> ApiResponse[InboundEmailAck]:
    """Accept a raw inbound email, log it, and acknowledge receipt."""
    email = payload.to_entity()
    await use_case.execute(email)
    return ApiResponse.ok(InboundEmailAck(received=True, attachment_count=email.attachment_count))
