"""Read API for ingested emails — list, detail, attachment download, reprocess.

Auth via X-API-Key (require_api_key) — the installation-wide service
boundary. Tenancy (Phase 44, TENA-03, replaces D-18): every endpoint ALSO
requires X-User-Id (require_user_id) and scopes to the caller's OWNED
importer ids, resolved via ImporterResolver.list_importer_ids_for_user —
never trusts a client-supplied importer_id for scoping. list_emails ignores
an explicit importer_id query param unless it is in the caller's owned set
(403); detail/download/reprocess resolve by id then assert ownership of the
resolved email's importer_id (404 when not owned — fail-closed, no existence
oracle).
"""

from datetime import datetime

from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from app.application.use_cases.reprocess_email import ReprocessEmailUseCase
from app.domain.entities.attachment import Attachment
from app.domain.entities.email import Email
from app.domain.ports.attachment_repository import AttachmentRepository
from app.domain.ports.attachment_storage import AttachmentStorage
from app.domain.ports.email_repository import EmailRepository
from app.domain.ports.importer_resolver import ImporterResolver
from app.presentation.api.response import ApiResponse
from app.presentation.middleware.auth import require_api_key
from app.presentation.middleware.user_context import require_user_id

router = APIRouter(prefix="/v1/emails", tags=["emails"], dependencies=[Depends(require_api_key)])


class EmailSummary(BaseModel):
    id: str
    importer_id: str
    sender_address: str
    sender_name: str | None
    subject: str | None
    received_at: datetime
    parse_status: str
    attachment_count: int


class AttachmentOut(BaseModel):
    id: str
    filename: str | None
    content_type: str
    file_ext: str | None
    size_bytes: int | None
    parse_status: str


class EmailDetail(BaseModel):
    id: str
    importer_id: str
    message_id: str
    in_reply_to: str | None
    sender_address: str
    sender_name: str | None
    to_addresses: list[str]
    cc_addresses: list[str]
    subject: str | None
    body_html: str | None
    body_text: str | None
    received_at: datetime
    parse_status: str
    attachments: list[AttachmentOut]


class ReprocessAck(BaseModel):
    email_id: str
    superseded_components: int


def _summary(email: Email, attachment_count: int) -> EmailSummary:
    return EmailSummary(
        id=email.id,
        importer_id=email.importer_id,
        sender_address=email.sender_address,
        sender_name=email.sender_name,
        subject=email.subject,
        received_at=email.received_at,
        parse_status=email.parse_status,
        attachment_count=attachment_count,
    )


def _attachment_out(attachment: Attachment) -> AttachmentOut:
    return AttachmentOut(
        id=attachment.id,
        filename=attachment.filename,
        content_type=attachment.content_type,
        file_ext=attachment.file_ext,
        size_bytes=attachment.size_bytes,
        parse_status=attachment.parse_status,
    )


async def _get_email(email_repo: EmailRepository, email_id: str) -> Email:
    """Resolve an email by id; 404 when absent.

    Ownership (which importer's email this is allowed to be) is asserted
    separately by `_assert_importer_owned` at each call site — this helper
    only resolves existence.
    """
    email = await email_repo.find_by_id(email_id)
    if email is None:
        raise HTTPException(status_code=404, detail="Email not found")
    return email


async def _assert_importer_owned(importer_repo: ImporterResolver, user_id: str, importer_id: str) -> None:
    """Fail-closed ownership assertion (Phase 44, TENA-03, replaces D-18).

    404 (never 403) so a non-owned email's existence is never disclosed —
    the caller sees the identical response whether the email doesn't exist
    or belongs to another user's importer.
    """
    owned_importer_ids = await importer_repo.list_importer_ids_for_user(user_id)
    if importer_id not in owned_importer_ids:
        raise HTTPException(status_code=404, detail="Email not found")


@router.get("")
@inject
async def list_emails(
    email_repo: FromDishka[EmailRepository],
    attachment_repo: FromDishka[AttachmentRepository],
    importer_repo: FromDishka[ImporterResolver],
    user_id: str = Depends(require_user_id),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    importer_id: str | None = Query(default=None),
) -> ApiResponse[list[EmailSummary]]:
    """List ingested emails newest first, scoped to the caller's OWNED importers (Phase 44, TENA-03).

    An explicit `importer_id` query param is honored ONLY when it is in the
    caller's owned set (403 otherwise) — it is never trusted alone for
    scoping. Omitting it lists across every importer the caller owns (empty
    result if the caller owns none — never "all importers").
    """
    owned_importer_ids = await importer_repo.list_importer_ids_for_user(user_id)
    if importer_id is not None:
        if importer_id not in owned_importer_ids:
            raise HTTPException(status_code=403, detail="Importer not owned by caller")
        emails = await email_repo.list_by_importer(importer_id, limit=limit, offset=offset)
    elif not owned_importer_ids:
        emails = []
    else:
        emails = await email_repo.list_by_importer_ids(owned_importer_ids, limit=limit, offset=offset)
    counts = await attachment_repo.count_by_email_ids([email.id for email in emails])
    return ApiResponse.ok([_summary(email, counts.get(email.id, 0)) for email in emails])


@router.get("/{email_id}")
@inject
async def get_email(
    email_id: str,
    email_repo: FromDishka[EmailRepository],
    attachment_repo: FromDishka[AttachmentRepository],
    importer_repo: FromDishka[ImporterResolver],
    user_id: str = Depends(require_user_id),
) -> ApiResponse[EmailDetail]:
    """Return one email with bodies and attachment metadata; 404 unless the caller owns its importer."""
    email = await _get_email(email_repo, email_id)
    await _assert_importer_owned(importer_repo, user_id, email.importer_id)
    attachments = await attachment_repo.find_by_email_id(email.id)
    detail = EmailDetail(
        id=email.id,
        importer_id=email.importer_id,
        message_id=email.message_id,
        in_reply_to=email.in_reply_to,
        sender_address=email.sender_address,
        sender_name=email.sender_name,
        to_addresses=list(email.to_addresses),
        cc_addresses=list(email.cc_addresses),
        subject=email.subject,
        body_html=email.body_html,
        body_text=email.body_text,
        received_at=email.received_at,
        parse_status=email.parse_status,
        attachments=[_attachment_out(a) for a in attachments],
    )
    return ApiResponse.ok(detail)


@router.get("/{email_id}/attachments/{attachment_id}")
@inject
async def download_attachment(
    email_id: str,
    attachment_id: str,
    email_repo: FromDishka[EmailRepository],
    attachment_repo: FromDishka[AttachmentRepository],
    attachment_storage: FromDishka[AttachmentStorage],
    importer_repo: FromDishka[ImporterResolver],
    user_id: str = Depends(require_user_id),
) -> Response:
    """Stream the attachment bytes with its original content type; 404 unless the caller owns its importer."""
    email = await _get_email(email_repo, email_id)
    await _assert_importer_owned(importer_repo, user_id, email.importer_id)
    attachments = await attachment_repo.find_by_email_id(email.id)
    attachment = next((a for a in attachments if a.id == attachment_id), None)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    data = await attachment_storage.fetch(attachment.storage_key)
    filename = attachment.filename or attachment.id
    return Response(
        content=data,
        media_type=attachment.content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{email_id}/reprocess")
@inject
async def reprocess_email(
    email_id: str,
    email_repo: FromDishka[EmailRepository],
    reprocess: FromDishka[ReprocessEmailUseCase],
    importer_repo: FromDishka[ImporterResolver],
    user_id: str = Depends(require_user_id),
) -> ApiResponse[ReprocessAck]:
    """Re-run ingestion for an existing email, superseding prior active extractions (D-16).

    Resolves the email by id (404 when absent), then asserts the caller owns
    its importer (Phase 44, TENA-03 — replaces the D-18 no-equality-check
    posture). Supersede order: extraction records are superseded BEFORE
    re-ingest (never overwrites).
    """
    email = await _get_email(email_repo, email_id)
    await _assert_importer_owned(importer_repo, user_id, email.importer_id)
    ack = await reprocess.execute(email_id=email_id)
    return ApiResponse.ok(
        ReprocessAck(
            email_id=str(ack["email_id"]),
            superseded_components=int(ack["superseded_components"]),  # type: ignore[call-overload]
        )
    )
