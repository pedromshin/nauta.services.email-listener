from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.settings import get_settings

VALID_PAYLOAD = {
    "sender": "supplier@example.com",
    "recipients": ["agent@magnitudetech.com.br"],
    "subject": "Invoice INV-001",
    "raw_body": "Please find attached the invoice for order PO-123.",
    "headers": {"Message-ID": "<abc@example.com>"},
    "attachments": [
        {"filename": "invoice.pdf", "content_type": "application/pdf", "size_bytes": 12345},
    ],
}


def test_inbound_email_accepted(client: TestClient) -> None:
    response = client.post("/v1/emails/inbound", json=VALID_PAYLOAD)
    assert response.status_code == 202
    body = response.json()
    assert body["success"] is True
    assert body["data"] == {"received": True, "attachment_count": 1}


def test_inbound_email_without_attachments(client: TestClient) -> None:
    payload = {**VALID_PAYLOAD, "attachments": []}
    response = client.post("/v1/emails/inbound", json=payload)
    assert response.status_code == 202
    assert response.json()["data"]["attachment_count"] == 0


def test_inbound_email_missing_sender_rejected(client: TestClient) -> None:
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "sender"}
    response = client.post("/v1/emails/inbound", json=payload)
    assert response.status_code == 422


def test_inbound_email_empty_recipients_rejected(client: TestClient) -> None:
    payload = {**VALID_PAYLOAD, "recipients": []}
    response = client.post("/v1/emails/inbound", json=payload)
    assert response.status_code == 422


def test_inbound_email_requires_api_key_when_configured(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_KEY", "test-key")
    get_settings.cache_clear()

    response = client.post("/v1/emails/inbound", json=VALID_PAYLOAD)
    assert response.status_code == 401

    response = client.post("/v1/emails/inbound", json=VALID_PAYLOAD, headers={"X-API-Key": "test-key"})
    assert response.status_code == 202

    response = client.post("/v1/emails/inbound", json=VALID_PAYLOAD, headers={"X-API-Key": "wrong"})
    assert response.status_code == 401
