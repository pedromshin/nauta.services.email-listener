"""Tests for user-scoped email endpoints (Phase 44-03 Task 2, TENA-03).

Proves: list_emails/get_email/download_attachment/reprocess_email require
X-User-Id (401 without it) and scope strictly to the caller's OWNED importer
ids, resolved via the Task-1 owned-importer resolver -- never a raw
client-supplied importer_id (T-44-03-01/02).
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from dishka import Provider, Scope, make_async_container
from fastapi.testclient import TestClient

from app.application.use_cases.reprocess_email import ReprocessEmailUseCase
from app.domain.entities.attachment import Attachment
from app.domain.entities.email import Email
from app.domain.ports.attachment_repository import AttachmentRepository
from app.domain.ports.attachment_storage import AttachmentStorage
from app.domain.ports.email_repository import EmailRepository
from app.domain.ports.importer_resolver import ImporterResolver
from app.main import create_app
from app.presentation.middleware.user_context import USER_ID_HEADER

_USER_A = "user-aaaa"
_USER_B = "user-bbbb"
_IMPORTER_A = "imp-aaaa"
_IMPORTER_B = "imp-bbbb"
_NOW = datetime(2026, 7, 9, 12, 0, 0, tzinfo=UTC)


def _email(email_id: str, importer_id: str) -> Email:
    return Email(
        id=email_id,
        importer_id=importer_id,
        message_id=f"<{email_id}@example.com>",
        in_reply_to=None,
        references_ids=(),
        received_at=_NOW,
        sender_address="sender@example.com",
        sender_name=None,
        to_addresses=("agent@magnitudetech.com.br",),
        cc_addresses=(),
        subject="Docs",
        body_html=None,
        body_text=None,
        raw_storage_key="inbound/local/ses-001",
        parse_status="received",
        parse_error=None,
        parsed_at=None,
        created_at=_NOW,
    )


_EMAIL_A = _email("email-a", _IMPORTER_A)

_ATTACHMENT_A = Attachment(
    id="att-a",
    email_id="email-a",
    importer_id=_IMPORTER_A,
    filename="bl.pdf",
    content_type="application/pdf",
    file_ext="pdf",
    size_bytes=13,
    storage_key=f"{_IMPORTER_A}/email-a/att-a/bl.pdf",
    parent_attachment_id=None,
    parse_status="pending",
)


@pytest.fixture
def mocks() -> dict[str, MagicMock]:
    email_repo = MagicMock()
    email_repo.list_by_importer = AsyncMock(return_value=[_EMAIL_A])
    email_repo.list_by_importer_ids = AsyncMock(return_value=[_EMAIL_A])
    email_repo.find_by_id = AsyncMock(return_value=_EMAIL_A)

    attachment_repo = MagicMock()
    attachment_repo.count_by_email_ids = AsyncMock(return_value={"email-a": 1})
    attachment_repo.find_by_email_id = AsyncMock(return_value=[_ATTACHMENT_A])

    attachment_storage = MagicMock()
    attachment_storage.fetch = AsyncMock(return_value=b"%PDF-1.4 fake")

    reprocess_use_case = MagicMock()
    reprocess_use_case.execute = AsyncMock(return_value={"email_id": "email-a", "superseded_components": 0})

    importer_repo = MagicMock()

    async def _owned(user_id: str) -> list[str]:
        return [_IMPORTER_A] if user_id == _USER_A else [_IMPORTER_B]

    importer_repo.list_importer_ids_for_user = AsyncMock(side_effect=_owned)

    return {
        "email_repo": email_repo,
        "attachment_repo": attachment_repo,
        "attachment_storage": attachment_storage,
        "reprocess_use_case": reprocess_use_case,
        "importer_repo": importer_repo,
    }


@pytest.fixture
def client(mocks: dict[str, MagicMock]) -> TestClient:
    provider = Provider(scope=Scope.APP)

    provider.provide(lambda: mocks["email_repo"], provides=EmailRepository)
    provider.provide(lambda: mocks["attachment_repo"], provides=AttachmentRepository)
    provider.provide(lambda: mocks["attachment_storage"], provides=AttachmentStorage)
    provider.provide(lambda: mocks["reprocess_use_case"], provides=ReprocessEmailUseCase)
    provider.provide(lambda: mocks["importer_repo"], provides=ImporterResolver)

    app = create_app()
    app.state.dishka_container = make_async_container(provider)
    return TestClient(app)


def _headers(user_id: str) -> dict[str, str]:
    return {USER_ID_HEADER: user_id}


# ---------------------------------------------------------------------------
# 401 without X-User-Id
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_list_emails_requires_x_user_id(client: TestClient) -> None:
    assert client.get("/v1/emails").status_code == 401


@pytest.mark.unit
def test_get_email_requires_x_user_id(client: TestClient) -> None:
    assert client.get("/v1/emails/email-a").status_code == 401


@pytest.mark.unit
def test_download_attachment_requires_x_user_id(client: TestClient) -> None:
    assert client.get("/v1/emails/email-a/attachments/att-a").status_code == 401


@pytest.mark.unit
def test_reprocess_requires_x_user_id(client: TestClient) -> None:
    assert client.post("/v1/emails/email-a/reprocess").status_code == 401


# ---------------------------------------------------------------------------
# list_emails scoping (T-44-03-01)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_list_emails_scopes_to_owned_importers_when_no_filter(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.get("/v1/emails", headers=_headers(_USER_A))

    assert resp.status_code == 200
    mocks["importer_repo"].list_importer_ids_for_user.assert_awaited_once_with(_USER_A)
    mocks["email_repo"].list_by_importer_ids.assert_awaited_once_with([_IMPORTER_A], limit=50, offset=0)
    mocks["email_repo"].list_by_importer.assert_not_awaited()


@pytest.mark.unit
def test_list_emails_honors_owned_importer_id_filter(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.get(f"/v1/emails?importer_id={_IMPORTER_A}", headers=_headers(_USER_A))

    assert resp.status_code == 200
    mocks["email_repo"].list_by_importer.assert_awaited_once_with(_IMPORTER_A, limit=50, offset=0)


@pytest.mark.unit
def test_list_emails_rejects_non_owned_importer_id_filter(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    """A user requesting another user's importer_id via the query param is rejected,
    never silently returns the other user's rows (T-44-03-01)."""
    resp = client.get(f"/v1/emails?importer_id={_IMPORTER_B}", headers=_headers(_USER_A))

    assert resp.status_code == 403
    mocks["email_repo"].list_by_importer.assert_not_awaited()


@pytest.mark.unit
def test_list_emails_returns_empty_when_user_owns_no_importers(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    mocks["importer_repo"].list_importer_ids_for_user = AsyncMock(return_value=[])

    resp = client.get("/v1/emails", headers=_headers(_USER_A))

    assert resp.status_code == 200
    assert resp.json()["data"] == []
    mocks["email_repo"].list_by_importer_ids.assert_not_awaited()
    mocks["email_repo"].list_by_importer.assert_not_awaited()


# ---------------------------------------------------------------------------
# get_email / download_attachment / reprocess_email ownership (T-44-03-02)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_get_email_owned_by_caller_succeeds(client: TestClient) -> None:
    resp = client.get("/v1/emails/email-a", headers=_headers(_USER_A))
    assert resp.status_code == 200


@pytest.mark.unit
def test_get_email_under_non_owned_importer_returns_404(client: TestClient) -> None:
    """email-a belongs to imp-a; user B does not own imp-a -- 404, not 403 (no existence oracle)."""
    resp = client.get("/v1/emails/email-a", headers=_headers(_USER_B))
    assert resp.status_code == 404


@pytest.mark.unit
def test_download_attachment_under_non_owned_importer_returns_404(client: TestClient) -> None:
    resp = client.get("/v1/emails/email-a/attachments/att-a", headers=_headers(_USER_B))
    assert resp.status_code == 404


@pytest.mark.unit
def test_download_attachment_owned_by_caller_succeeds(client: TestClient) -> None:
    resp = client.get("/v1/emails/email-a/attachments/att-a", headers=_headers(_USER_A))
    assert resp.status_code == 200


@pytest.mark.unit
def test_reprocess_under_non_owned_importer_returns_404(client: TestClient) -> None:
    resp = client.post("/v1/emails/email-a/reprocess", headers=_headers(_USER_B))
    assert resp.status_code == 404


@pytest.mark.unit
def test_reprocess_owned_by_caller_succeeds(client: TestClient) -> None:
    resp = client.post("/v1/emails/email-a/reprocess", headers=_headers(_USER_A))
    assert resp.status_code == 200
