"""Tests for the stdlib MIME parser domain service (raw bytes -> ParsedEmail)."""

from __future__ import annotations

from datetime import UTC, datetime
from email.message import EmailMessage

from app.domain.services.mime_parser import ParsedEmail, parse_mime

PDF_BYTES = b"%PDF-1.4 fake pdf content"


def _build_full_message() -> bytes:
    msg = EmailMessage()
    msg["From"] = "Maria Souza <maria@exporter.com>"
    msg["To"] = "agent@magnitudetech.com.br, ops@magnitudetech.com.br"
    msg["Cc"] = "Carlos <carlos@exporter.com>"
    msg["Subject"] = "Shipment docs BL-12345"
    msg["Date"] = "Wed, 10 Jun 2026 14:30:00 +0000"
    msg["Message-ID"] = "<original-123@exporter.com>"
    msg["In-Reply-To"] = "<previous-456@magnitudetech.com.br>"
    msg["References"] = "<root-001@exporter.com> <previous-456@magnitudetech.com.br>"
    msg.set_content("Please find the BL attached.")
    msg.add_alternative("<p>Please find the BL attached.</p>", subtype="html")
    msg.add_attachment(
        PDF_BYTES,
        maintype="application",
        subtype="pdf",
        filename="bill-of-lading.pdf",
    )
    return bytes(msg)


def test_parses_addresses_and_subject() -> None:
    parsed = parse_mime(_build_full_message())
    assert isinstance(parsed, ParsedEmail)
    assert parsed.sender_address == "maria@exporter.com"
    assert parsed.sender_name == "Maria Souza"
    assert parsed.to_addresses == ("agent@magnitudetech.com.br", "ops@magnitudetech.com.br")
    assert parsed.cc_addresses == ("carlos@exporter.com",)
    assert parsed.subject == "Shipment docs BL-12345"


def test_parses_threading_headers() -> None:
    parsed = parse_mime(_build_full_message())
    assert parsed.message_id == "<original-123@exporter.com>"
    assert parsed.in_reply_to == "<previous-456@magnitudetech.com.br>"
    assert parsed.references_ids == (
        "<root-001@exporter.com>",
        "<previous-456@magnitudetech.com.br>",
    )


def test_parses_date_to_aware_datetime() -> None:
    parsed = parse_mime(_build_full_message())
    assert parsed.received_at == datetime(2026, 6, 10, 14, 30, 0, tzinfo=UTC)


def test_parses_both_bodies() -> None:
    parsed = parse_mime(_build_full_message())
    assert parsed.body_text is not None
    assert "Please find the BL attached." in parsed.body_text
    assert parsed.body_html is not None
    assert "<p>Please find the BL attached.</p>" in parsed.body_html


def test_parses_pdf_attachment_bytes() -> None:
    parsed = parse_mime(_build_full_message())
    assert len(parsed.attachments) == 1
    att = parsed.attachments[0]
    assert att.filename == "bill-of-lading.pdf"
    assert att.content_type == "application/pdf"
    assert att.data == PDF_BYTES


def test_plain_only_email_has_no_html_and_no_attachments() -> None:
    msg = EmailMessage()
    msg["From"] = "noreply@example.com"
    msg["To"] = "agent@magnitudetech.com.br"
    msg["Subject"] = "plain"
    msg.set_content("just text")
    parsed = parse_mime(bytes(msg))
    assert parsed.body_html is None
    assert "just text" in (parsed.body_text or "")
    assert parsed.attachments == ()
    assert parsed.sender_name is None


def test_missing_optional_headers_are_none() -> None:
    msg = EmailMessage()
    msg["From"] = "a@b.com"
    msg["To"] = "agent@magnitudetech.com.br"
    msg.set_content("x")
    parsed = parse_mime(bytes(msg))
    assert parsed.message_id is None
    assert parsed.in_reply_to is None
    assert parsed.references_ids == ()
    assert parsed.received_at is None
    assert parsed.subject is None or parsed.subject == ""


def test_text_attachment_is_encoded_to_bytes() -> None:
    msg = EmailMessage()
    msg["From"] = "a@b.com"
    msg["To"] = "agent@magnitudetech.com.br"
    msg["Subject"] = "csv"
    msg.set_content("body")
    msg.add_attachment("col1,col2\n1,2\n", filename="data.csv", subtype="csv")
    parsed = parse_mime(bytes(msg))
    assert len(parsed.attachments) == 1
    att = parsed.attachments[0]
    assert att.filename == "data.csv"
    assert isinstance(att.data, bytes)
    assert b"col1,col2" in att.data
