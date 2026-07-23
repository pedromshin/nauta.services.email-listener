"""Tests for POST /v1/emails/backfill (backfill transport, HMAC-signed).

Verifies:
- HMAC signature auth: 401 missing/invalid, 503 when no secret configured,
  200 with a correctly signed body
- payload validation: 422 on invalid base64, 422 on invalid backfill id
- DI wiring: BackfillInboundEmailUseCase invoked with decoded bytes + recipients
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.application.use_cases.backfill_inbound_email import (
    BackfillInboundEmailUseCase,
    InvalidBackfillIdError,
)
from app.domain.entities.email import Email
from app.presentation.api.v1.backfill_email import SIGNATURE_HEADER
from app.settings import get_settings

_SECRET = "sb_secret_test_value"  # noqa: S105 — test fixture, not a real credential

_RAW_MIME = b"From: a@example.com\r\nTo: u-tok@fwd.test\r\nSubject: hi\r\n\r\nbody\r\n"


def _make_email(**overrides: object) -> Email:
    base: dict = {
        "id": "email-1",
        "importer_id": "imp-1",
        "thread_id": "thread-1",
        "message_id": "bf-msg-1",
        "in_reply_to": None,
        "references_ids": (),
        "received_at": datetime(2026, 7, 23, tzinfo=UTC),
        "sender_address": "a@example.com",
        "sender_name": None,
        "to_addresses": ("u-tok@fwd.test",),
        "cc_addresses": (),
        "subject": "hi",
        "body_html": None,
        "body_text": "body",
        "raw_storage_key": "backfill/bf-msg-1",
        "parse_status": "parsed",
        "parse_error": None,
        "parsed_at": datetime(2026, 7, 23, tzinfo=UTC),
        "created_at": datetime(2026, 7, 23, tzinfo=UTC),
    }
    base.update(overrides)
    return Email(**base)


def _make_app(use_case: BackfillInboundEmailUseCase) -> FastAPI:
    from dishka import Provider, Scope, make_async_container
    from dishka.integrations.fastapi import setup_dishka

    from app.presentation.api.v1.backfill_email import router

    app = FastAPI()
    app.include_router(router)

    provider = Provider(scope=Scope.APP)
    provider.provide(lambda: use_case, provides=BackfillInboundEmailUseCase, scope=Scope.APP)
    container = make_async_container(provider)
    setup_dishka(container=container, app=app)
    return app


def _sign(body: bytes, secret: str = _SECRET) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _payload_bytes(
    backfill_id: str = "msg-1",
    raw: bytes = _RAW_MIME,
    recipients: list[str] | None = None,
) -> bytes:
    return json.dumps(
        {
            "backfill_id": backfill_id,
            "raw_mime_b64": base64.b64encode(raw).decode(),
            "recipients": recipients if recipients is not None else ["u-tok@fwd.test"],
        }
    ).encode()


@pytest.fixture
def mock_use_case() -> MagicMock:
    uc = MagicMock(spec=BackfillInboundEmailUseCase)
    uc.execute = AsyncMock(return_value=_make_email())
    return uc


@pytest.fixture
def client(mock_use_case: MagicMock, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("SUPABASE_SECRET_KEY", _SECRET)
    get_settings.cache_clear()
    try:
        yield TestClient(_make_app(mock_use_case), raise_server_exceptions=True)
    finally:
        get_settings.cache_clear()


def _post(client: TestClient, body: bytes, signature: str | None) -> object:
    headers = {"Content-Type": "application/json"}
    if signature is not None:
        headers[SIGNATURE_HEADER] = signature
    return client.post("/v1/emails/backfill", content=body, headers=headers)


@pytest.mark.unit
def test_valid_signature_returns_200_and_ack(client: TestClient, mock_use_case: MagicMock) -> None:
    body = _payload_bytes()
    resp = _post(client, body, _sign(body))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["email_id"] == "email-1"
    assert data["parse_status"] == "parsed"
    assert data["thread_id"] == "thread-1"

    mock_use_case.execute.assert_awaited_once()
    kwargs = mock_use_case.execute.await_args.kwargs
    assert kwargs["backfill_id"] == "msg-1"
    assert kwargs["raw_mime"] == _RAW_MIME
    assert list(kwargs["recipients"]) == ["u-tok@fwd.test"]


@pytest.mark.unit
def test_missing_signature_is_401(client: TestClient, mock_use_case: MagicMock) -> None:
    resp = _post(client, _payload_bytes(), signature=None)
    assert resp.status_code == 401
    mock_use_case.execute.assert_not_awaited()


@pytest.mark.unit
def test_wrong_signature_is_401(client: TestClient, mock_use_case: MagicMock) -> None:
    body = _payload_bytes()
    resp = _post(client, body, _sign(body, secret="sb_secret_other"))
    assert resp.status_code == 401
    mock_use_case.execute.assert_not_awaited()


@pytest.mark.unit
def test_signature_over_different_body_is_401(client: TestClient) -> None:
    resp = _post(client, _payload_bytes(backfill_id="msg-2"), _sign(_payload_bytes(backfill_id="msg-1")))
    assert resp.status_code == 401


@pytest.mark.unit
def test_no_secret_configured_fails_closed_503(
    mock_use_case: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    get_settings.cache_clear()
    try:
        test_client = TestClient(_make_app(mock_use_case), raise_server_exceptions=True)
        body = _payload_bytes()
        resp = _post(test_client, body, _sign(body))
        assert resp.status_code == 503
    finally:
        get_settings.cache_clear()


@pytest.mark.unit
def test_invalid_base64_is_422(client: TestClient) -> None:
    body = json.dumps(
        {"backfill_id": "msg-1", "raw_mime_b64": "!!!not-base64!!!", "recipients": []}
    ).encode()
    resp = _post(client, body, _sign(body))
    assert resp.status_code == 422


@pytest.mark.unit
def test_invalid_backfill_id_maps_to_422(client: TestClient, mock_use_case: MagicMock) -> None:
    mock_use_case.execute = AsyncMock(side_effect=InvalidBackfillIdError("bad id"))
    body = _payload_bytes(backfill_id="has space")
    resp = _post(client, body, _sign(body))
    assert resp.status_code == 422
