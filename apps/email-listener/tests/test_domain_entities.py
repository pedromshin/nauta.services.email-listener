"""Unit tests for domain entities — immutability, field types, nesting."""

from __future__ import annotations

import dataclasses
from datetime import UTC, datetime

import pytest

from app.domain.entities.attachment import Attachment
from app.domain.entities.component import Component
from app.domain.entities.email import Email
from app.domain.entities.entity_type import EntityType, EntityTypeField
from app.domain.entities.extraction_record import ExtractionRecord

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NOW = datetime(2026, 6, 11, 12, 0, 0, tzinfo=UTC)


def _make_email(**overrides: object) -> Email:
    defaults: dict[str, object] = {
        "id": "em-001",
        "importer_id": "imp-001",
        "message_id": "<test@example.com>",
        "in_reply_to": None,
        "references_ids": (),
        "received_at": _NOW,
        "sender_address": "sender@example.com",
        "sender_name": None,
        "to_addresses": ("to@example.com",),
        "cc_addresses": (),
        "subject": "Test",
        "body_html": None,
        "body_text": "Hello",
        "raw_storage_key": None,
        "parse_status": "pending",
        "parse_error": None,
        "parsed_at": None,
        "created_at": _NOW,
    }
    return Email(**{**defaults, **overrides})  # type: ignore[arg-type]


def _make_attachment(**overrides: object) -> Attachment:
    defaults: dict[str, object] = {
        "id": "att-001",
        "email_id": "em-001",
        "importer_id": "imp-001",
        "filename": "doc.pdf",
        "content_type": "application/pdf",
        "file_ext": "pdf",
        "size_bytes": 1024,
        "storage_key": "s3/key/doc.pdf",
        "parent_attachment_id": None,
        "parse_status": "pending",
    }
    return Attachment(**{**defaults, **overrides})  # type: ignore[arg-type]


def _make_component(**overrides: object) -> Component:
    defaults: dict[str, object] = {
        "id": "cmp-001",
        "email_id": "em-001",
        "importer_id": "imp-001",
        "attachment_id": None,
        "parent_component_id": None,
        "source_type": "body_text",
        "location": {"page_index": 0, "polygon": [[0, 0], [1, 0], [1, 1], [0, 1]], "text_anchor": None},
        "content_text": "Some text",
        "content_markdown": None,
        "content_raw": None,
        "embedding": None,
        "sequence_index": 0,
        "extraction_status": "pending",
    }
    return Component(**{**defaults, **overrides})  # type: ignore[arg-type]


def _make_entity_type(**overrides: object) -> EntityType:
    field = EntityTypeField(
        id="efield-001",
        slug="company",
        label="Company",
        data_type="string",
        is_identifier=True,
        is_required=True,
        description=None,
        sort_order=0,
    )
    defaults: dict[str, object] = {
        "id": "et-001",
        "importer_id": "imp-001",
        "slug": "invoice",
        "label": "Invoice",
        "description": None,
        "is_active": True,
        "embedding": None,
        "fields": (field,),
    }
    return EntityType(**{**defaults, **overrides})  # type: ignore[arg-type]


def _make_extraction_record(**overrides: object) -> ExtractionRecord:
    defaults: dict[str, object] = {
        "id": "er-001",
        "importer_id": "imp-001",
        "component_id": "cmp-001",
        "entity_type_id": "et-001",
        "extracted_fields": {"company": "Acme"},
        "confidence_score": 0.9,
        "confidence_breakdown": None,
        "routing_reason": None,
        "status": "active",
        "corrected_fields": None,
        "retrieval_context": None,
        "created_at": _NOW,
        "updated_at": _NOW,
    }
    return ExtractionRecord(**{**defaults, **overrides})  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Immutability tests
# ---------------------------------------------------------------------------


class TestImmutability:
    def test_email_is_frozen(self) -> None:
        email = _make_email()
        with pytest.raises(dataclasses.FrozenInstanceError):
            email.subject = "mutated"  # type: ignore[misc]

    def test_attachment_is_frozen(self) -> None:
        att = _make_attachment()
        with pytest.raises(dataclasses.FrozenInstanceError):
            att.filename = "mutated"  # type: ignore[misc]

    def test_component_is_frozen(self) -> None:
        cmp = _make_component()
        with pytest.raises(dataclasses.FrozenInstanceError):
            cmp.content_text = "mutated"  # type: ignore[misc]

    def test_entity_type_field_is_frozen(self) -> None:
        field = EntityTypeField(
            id="efield-001",
            slug="x",
            label="X",
            data_type="string",
            is_identifier=False,
            is_required=False,
            description=None,
            sort_order=0,
        )
        with pytest.raises(dataclasses.FrozenInstanceError):
            field.slug = "mutated"  # type: ignore[misc]

    def test_entity_type_is_frozen(self) -> None:
        et = _make_entity_type()
        with pytest.raises(dataclasses.FrozenInstanceError):
            et.slug = "mutated"  # type: ignore[misc]

    def test_extraction_record_is_frozen(self) -> None:
        er = _make_extraction_record()
        with pytest.raises(dataclasses.FrozenInstanceError):
            er.status = "mutated"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Tuple array fields
# ---------------------------------------------------------------------------


class TestTupleFields:
    def test_email_to_addresses_is_tuple(self) -> None:
        email = _make_email(to_addresses=("a@b.com", "c@d.com"))
        assert isinstance(email.to_addresses, tuple)

    def test_email_cc_addresses_is_tuple(self) -> None:
        email = _make_email(cc_addresses=("cc@b.com",))
        assert isinstance(email.cc_addresses, tuple)

    def test_email_references_ids_is_tuple(self) -> None:
        email = _make_email(references_ids=("<ref1>", "<ref2>"))
        assert isinstance(email.references_ids, tuple)

    def test_entity_type_fields_is_tuple(self) -> None:
        et = _make_entity_type()
        assert isinstance(et.fields, tuple)


# ---------------------------------------------------------------------------
# Component nesting (D-09)
# ---------------------------------------------------------------------------


class TestComponentNesting:
    def test_component_accepts_none_parent(self) -> None:
        cmp = _make_component(parent_component_id=None)
        assert cmp.parent_component_id is None

    def test_component_accepts_string_parent_id(self) -> None:
        parent = _make_component(id="parent-001")
        child = _make_component(id="child-001", parent_component_id=parent.id)
        assert child.parent_component_id == "parent-001"


# ---------------------------------------------------------------------------
# Component geometry (D-12)
# ---------------------------------------------------------------------------


class TestComponentGeometry:
    def test_component_location_with_geometry_keys(self) -> None:
        location = {
            "page_index": 1,
            "polygon": [[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.1, 0.8]],
            "text_anchor": "top-left",
        }
        cmp = _make_component(location=location)
        assert cmp.location["page_index"] == 1
        assert "polygon" in cmp.location
        assert cmp.location["text_anchor"] == "top-left"

    def test_component_location_text_anchor_nullable(self) -> None:
        location = {"page_index": 0, "polygon": [], "text_anchor": None}
        cmp = _make_component(location=location)
        assert cmp.location["text_anchor"] is None


# ---------------------------------------------------------------------------
# EntityType nesting
# ---------------------------------------------------------------------------


class TestEntityTypeNesting:
    def test_entity_type_has_nested_fields(self) -> None:
        et = _make_entity_type()
        assert len(et.fields) == 1
        assert et.fields[0].slug == "company"

    def test_entity_type_empty_fields(self) -> None:
        et = _make_entity_type(fields=())
        assert et.fields == ()


# ---------------------------------------------------------------------------
# Optional / nullable fields
# ---------------------------------------------------------------------------


class TestNullableFields:
    def test_email_nullable_fields_accept_none(self) -> None:
        email = _make_email(in_reply_to=None, sender_name=None, body_html=None, parse_error=None)
        assert email.in_reply_to is None
        assert email.sender_name is None

    def test_component_embedding_nullable(self) -> None:
        cmp = _make_component(embedding=None)
        assert cmp.embedding is None

    def test_component_embedding_accepts_tuple(self) -> None:
        embedding = (0.1, 0.2, 0.3)
        cmp = _make_component(embedding=embedding)
        assert cmp.embedding == (0.1, 0.2, 0.3)

    def test_entity_type_embedding_nullable(self) -> None:
        et = _make_entity_type(embedding=None)
        assert et.embedding is None
