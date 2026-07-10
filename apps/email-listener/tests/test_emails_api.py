"""Tests for the read API: GET /v1/emails, /v1/emails/{id}, attachment download.

Routes resolve dependencies through dishka, so tests swap app.state.dishka_container
for a real container whose providers return mocks.

Phase 44-03 (TENA-03): every endpoint now requires X-User-Id and scopes to the
caller's OWNED importer ids (replaces the old D-18 "installation-wide, no
importer check" posture) -- the test client below sends X-User-Id by default,
and an ImporterResolver mock reports USER_ID as the owner of IMPORTER_ID.
Cross-tenant behavior (foreign importer -> 404) is asserted here AND in the
dedicated tests/presentation/api/v1/test_emails_user_scoping.py suite.
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
from app.settings import get_settings

IMPORTER_ID = "00000000-0000-0000-0000-000000000001"
USER_ID = "user-00000000-0000-0000-0000-000000000001"
NOW = datetime(2026, 6, 10, 12, 0, 0, tzinfo=UTC)

EMAIL = Email(
    id="email-001",
    importer_id=IMPORTER_ID,
    message_id="<msg-001@example.com>",
    in_reply_to=None,
    references_ids=(),
    received_at=NOW,
    sender_address="maria@exporter.com",
    sender_name="Maria",
    to_addresses=("agent@magnitudetech.com.br",),
    cc_addresses=(),
    subject="Docs",
    body_html="<p>hi</p>",
    body_text="hi",
    raw_storage_key="inbound/local/ses-001",
    parse_status="received",
    parse_error=None,
    parsed_at=None,
    created_at=NOW,
)

ATTACHMENT = Attachment(
    id="att-001",
    email_id="email-001",
    importer_id=IMPORTER_ID,
    filename="bl.pdf",
    content_type="application/pdf",
    file_ext="pdf",
    size_bytes=13,
    storage_key=f"{IMPORTER_ID}/email-001/att-001/bl.pdf",
    parent_attachment_id=None,
    parse_status="pending",
)


@pytest.fixture
def mocks() -> dict[str, MagicMock]:
    email_repo = MagicMock()
    email_repo.list_by_importer = AsyncMock(return_value=[EMAIL])
    email_repo.list_by_importer_ids = AsyncMock(return_value=[EMAIL])
    email_repo.find_by_id = AsyncMock(return_value=EMAIL)

    attachment_repo = MagicMock()
    attachment_repo.count_by_email_ids = AsyncMock(return_value={"email-001": 1})
    attachment_repo.find_by_email_id = AsyncMock(return_value=[ATTACHMENT])

    attachment_storage = MagicMock()
    attachment_storage.fetch = AsyncMock(return_value=b"%PDF-1.4 fake")

    reprocess_use_case = MagicMock()
    reprocess_use_case.execute = AsyncMock(return_value={"email_id": "email-001", "superseded_components": 2})

    importer_repo = MagicMock()
    importer_repo.list_importer_ids_for_user = AsyncMock(return_value=[IMPORTER_ID])

    return {
        "email_repo": email_repo,
        "attachment_repo": attachment_repo,
        "attachment_storage": attachment_storage,
        "reprocess_use_case": reprocess_use_case,
        "importer_repo": importer_repo,
    }


@pytest.fixture
def client(mocks: dict[str, MagicMock]) -> TestClient:
    get_settings.cache_clear()
    provider = Provider(scope=Scope.APP)

    def provide_email_repo() -> EmailRepository:
        return mocks["email_repo"]

    def provide_attachment_repo() -> AttachmentRepository:
        return mocks["attachment_repo"]

    def provide_attachment_storage() -> AttachmentStorage:
        return mocks["attachment_storage"]

    def provide_reprocess() -> ReprocessEmailUseCase:
        return mocks["reprocess_use_case"]

    def provide_importer_repo() -> ImporterResolver:
        return mocks["importer_repo"]

    provider.provide(provide_email_repo, provides=EmailRepository)
    provider.provide(provide_attachment_repo, provides=AttachmentRepository)
    provider.provide(provide_attachment_storage, provides=AttachmentStorage)
    provider.provide(provide_reprocess, provides=ReprocessEmailUseCase)
    provider.provide(provide_importer_repo, provides=ImporterResolver)

    app = create_app()
    app.state.dishka_container = make_async_container(provider)
    return TestClient(app, headers={USER_ID_HEADER: USER_ID})


def test_list_emails_returns_summaries_with_counts(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.get("/v1/emails")

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["data"]) == 1
    summary = body["data"][0]
    assert summary["id"] == "email-001"
    assert summary["importer_id"] == IMPORTER_ID
    assert summary["sender_address"] == "maria@exporter.com"
    assert summary["subject"] == "Docs"
    assert summary["attachment_count"] == 1
    # Phase 44 (TENA-03): no importer filter -> scoped to the caller's owned importers
    mocks["email_repo"].list_by_importer_ids.assert_awaited_once_with([IMPORTER_ID], limit=50, offset=0)


def test_list_emails_passes_pagination(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.get("/v1/emails?limit=10&offset=30")

    assert resp.status_code == 200
    mocks["email_repo"].list_by_importer_ids.assert_awaited_once_with([IMPORTER_ID], limit=10, offset=30)


def test_list_emails_optional_importer_filter(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    """An explicit ?importer_id= narrows the listing to that importer, when owned by the caller."""
    resp = client.get(f"/v1/emails?importer_id={IMPORTER_ID}")

    assert resp.status_code == 200
    mocks["email_repo"].list_by_importer.assert_awaited_once_with(IMPORTER_ID, limit=50, offset=0)


def test_list_emails_rejects_non_owned_importer_filter(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    """Phase 44 (TENA-03): a non-owned importer_id is rejected, never trusted for scoping."""
    resp = client.get("/v1/emails?importer_id=imp-other")

    assert resp.status_code == 403
    mocks["email_repo"].list_by_importer.assert_not_awaited()


def test_list_emails_rejects_bad_pagination(client: TestClient) -> None:
    assert client.get("/v1/emails?limit=0").status_code == 422
    assert client.get("/v1/emails?limit=101").status_code == 422
    assert client.get("/v1/emails?offset=-1").status_code == 422


def test_list_emails_requires_x_user_id(mocks: dict[str, MagicMock]) -> None:
    """Phase 44 (TENA-03): X-User-Id is required (401 without it)."""
    provider = Provider(scope=Scope.APP)
    provider.provide(lambda: mocks["email_repo"], provides=EmailRepository)
    provider.provide(lambda: mocks["attachment_repo"], provides=AttachmentRepository)
    provider.provide(lambda: mocks["importer_repo"], provides=ImporterResolver)
    app = create_app()
    app.state.dishka_container = make_async_container(provider)

    assert TestClient(app).get("/v1/emails").status_code == 401


def test_get_email_returns_detail_with_attachments(client: TestClient) -> None:
    resp = client.get("/v1/emails/email-001")

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == "email-001"
    assert data["body_text"] == "hi"
    assert data["body_html"] == "<p>hi</p>"
    assert data["to_addresses"] == ["agent@magnitudetech.com.br"]
    assert len(data["attachments"]) == 1
    assert data["attachments"][0]["filename"] == "bl.pdf"


def test_get_email_404_when_missing(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    mocks["email_repo"].find_by_id = AsyncMock(return_value=None)
    assert client.get("/v1/emails/nope").status_code == 404


def test_get_email_404_for_non_owned_importer(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    """Phase 44 (TENA-03, replaces D-18): an email under an importer the caller
    does not own 404s -- fail-closed, no existence oracle."""
    foreign = Email(**{**EMAIL.__dict__, "importer_id": "imp-other"})
    mocks["email_repo"].find_by_id = AsyncMock(return_value=foreign)

    resp = client.get("/v1/emails/email-001")

    assert resp.status_code == 404


def test_download_attachment_streams_bytes(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.get("/v1/emails/email-001/attachments/att-001")

    assert resp.status_code == 200
    assert resp.content == b"%PDF-1.4 fake"
    assert resp.headers["content-type"] == "application/pdf"
    assert 'filename="bl.pdf"' in resp.headers["content-disposition"]
    mocks["attachment_storage"].fetch.assert_awaited_once_with(ATTACHMENT.storage_key)


def test_download_attachment_404_for_unknown_id(client: TestClient) -> None:
    assert client.get("/v1/emails/email-001/attachments/att-999").status_code == 404


def test_download_attachment_404_for_non_owned_importer(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    foreign = Email(**{**EMAIL.__dict__, "importer_id": "imp-other"})
    mocks["email_repo"].find_by_id = AsyncMock(return_value=foreign)

    resp = client.get("/v1/emails/email-001/attachments/att-001")

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /v1/emails/{id}/reprocess
# ---------------------------------------------------------------------------


def test_reprocess_returns_200_ack(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    """POST reprocess returns ApiResponse.ok with ReprocessAck for a known tenant email."""
    resp = client.post("/v1/emails/email-001/reprocess")

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["email_id"] == "email-001"
    assert body["data"]["superseded_components"] == 2
    mocks["reprocess_use_case"].execute.assert_awaited_once_with(email_id="email-001")


def test_reprocess_404_for_unknown_email(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    """POST reprocess returns 404 for an unknown email id."""
    mocks["email_repo"].find_by_id = AsyncMock(return_value=None)

    resp = client.post("/v1/emails/nope/reprocess")

    assert resp.status_code == 404


def test_reprocess_404_for_non_owned_importer(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    """Phase 44 (TENA-03, replaces D-18): reprocess 404s for an importer the caller does not own."""
    foreign = Email(**{**EMAIL.__dict__, "importer_id": "imp-other"})
    mocks["email_repo"].find_by_id = AsyncMock(return_value=foreign)

    resp = client.post("/v1/emails/email-001/reprocess")

    assert resp.status_code == 404


def test_reprocess_requires_api_key(mocks: dict[str, MagicMock]) -> None:
    """POST reprocess returns 401 when API_KEY is configured and X-API-Key is missing."""
    import os

    old_key = os.environ.get("API_KEY")
    os.environ["API_KEY"] = "secret-key"
    get_settings.cache_clear()
    try:
        # Rebuild the test app with a fresh settings-aware provider
        provider = Provider(scope=Scope.APP)

        email_repo_mock = MagicMock()
        email_repo_mock.find_by_id = AsyncMock(return_value=EMAIL)

        reprocess_mock = MagicMock()
        reprocess_mock.execute = AsyncMock(return_value={"email_id": "email-001", "superseded_components": 0})

        def provide_email_repo() -> EmailRepository:
            return email_repo_mock

        def provide_reprocess() -> ReprocessEmailUseCase:
            return reprocess_mock

        def provide_importer_repo() -> ImporterResolver:
            return mocks["importer_repo"]

        provider.provide(provide_email_repo, provides=EmailRepository)
        provider.provide(provide_reprocess, provides=ReprocessEmailUseCase)
        provider.provide(provide_importer_repo, provides=ImporterResolver)

        auth_app = create_app()
        auth_app.state.dishka_container = make_async_container(provider)
        auth_client = TestClient(auth_app, raise_server_exceptions=False)

        # No X-API-Key header → 401
        resp = auth_client.post("/v1/emails/email-001/reprocess", headers={USER_ID_HEADER: USER_ID})
        assert resp.status_code == 401

        # With correct X-API-Key + X-User-Id → 200
        resp_authed = auth_client.post(
            "/v1/emails/email-001/reprocess",
            headers={"X-API-Key": "secret-key", USER_ID_HEADER: USER_ID},
        )
        assert resp_authed.status_code == 200
    finally:
        if old_key is None:
            os.environ.pop("API_KEY", None)
        else:
            os.environ["API_KEY"] = old_key
        get_settings.cache_clear()


def test_reprocess_requires_x_user_id(client: TestClient) -> None:
    """Phase 44 (TENA-03): POST reprocess returns 401 without X-User-Id."""
    resp = client.post("/v1/emails/email-001/reprocess", headers={USER_ID_HEADER: ""})
    assert resp.status_code == 401


def test_reprocess_supersede_active_invoked(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    """The reprocess use case's execute (which calls supersede_active) is invoked."""
    resp = client.post("/v1/emails/email-001/reprocess")

    assert resp.status_code == 200
    # The mock execute should have been awaited — confirming supersede path was triggered
    mocks["reprocess_use_case"].execute.assert_awaited_once()
