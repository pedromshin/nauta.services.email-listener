"""Tests for validate_tool_envelope (Phase 38, QUAR-01).

13 behaviors, mirroring test_widget_result_validator.py's structure:
  1.  minimal valid envelope -> ok=True
  2.  malformed JSON -> ok=False, fixed generic reason, content never echoed
  3.  top-level JSON array (not object) -> ok=False
  4.  forbidden field name at the TOP level -> ok=False
  5.  forbidden field name NESTED inside a list item -> ok=False (proves the
      walk covers any depth, not just top-level keys)
  6.  the remaining 2 canonical forbidden names (body_text/raw_storage_key)
      individually rejected, parametrized
  7.  a non-EXTRACTED tier with a "label" key present (any value, including
      None) -> ok=False (presence-gated, not value-gated), parametrized
  8.  a non-EXTRACTED tier with NO "label" key at all -> ok=True (proper
      field omission)
  9.  an EXTRACTED tier WITH a "label" key -> ok=True (legitimate,
      human-confirmed text is allowed through)
  10. a well-formed citations[] entry -> ok=True
  11. a citations[] entry with a route that doesn't match its kind's
      template -> ok=False
  12. a citations[] entry with an unrecognized kind -> ok=False
  13. on any failure, reason is always one of exactly 2 fixed generic
      strings -- never the forbidden field name, tier value, or citation
      route (mirrors widget_result_validator.py's D-10 guardrail)
"""

from __future__ import annotations

import json

import pytest

from app.domain.services.tool_envelope_gate import EnvelopeGateOutcome, validate_tool_envelope


@pytest.mark.unit
def test_minimal_valid_envelope_is_ok() -> None:
    content = json.dumps({"results": [], "citations": []})

    outcome = validate_tool_envelope(content)

    assert outcome == EnvelopeGateOutcome(ok=True)


@pytest.mark.unit
def test_malformed_json_returns_generic_reason_never_echoes_content() -> None:
    content = "not valid json at all {{{"

    outcome = validate_tool_envelope(content)

    assert outcome.ok is False
    assert outcome.reason == "tool result was not valid structured data"
    assert "not valid json" not in outcome.reason


@pytest.mark.unit
def test_top_level_array_is_rejected() -> None:
    content = json.dumps([{"results": []}])

    outcome = validate_tool_envelope(content)

    assert outcome.ok is False


@pytest.mark.unit
def test_forbidden_field_at_top_level_is_rejected() -> None:
    content = json.dumps({"content_text": "LEAKED-RAW-BODY", "results": [], "citations": []})

    outcome = validate_tool_envelope(content)

    assert outcome.ok is False


@pytest.mark.unit
def test_forbidden_field_nested_in_list_item_is_rejected() -> None:
    content = json.dumps({"results": [{"body_html": "<p>LEAKED-RAW-BODY</p>"}], "citations": []})

    outcome = validate_tool_envelope(content)

    assert outcome.ok is False


@pytest.mark.unit
@pytest.mark.parametrize("forbidden_name", ["body_text", "raw_storage_key"])
def test_remaining_canonical_forbidden_names_individually_rejected(forbidden_name: str) -> None:
    content = json.dumps({"results": [], "citations": [], forbidden_name: "LEAKED-RAW-BODY"})

    outcome = validate_tool_envelope(content)

    assert outcome.ok is False


@pytest.mark.unit
@pytest.mark.parametrize("label_value", ["Some Label", None])
def test_label_present_for_non_extracted_tier_is_rejected(label_value: str | None) -> None:
    content = json.dumps({"results": [{"tier": "AMBIGUOUS", "label": label_value}], "citations": []})

    outcome = validate_tool_envelope(content)

    assert outcome.ok is False


@pytest.mark.unit
def test_label_omitted_for_non_extracted_tier_is_ok() -> None:
    content = json.dumps({"results": [{"tier": "INFERRED"}], "citations": []})

    outcome = validate_tool_envelope(content)

    assert outcome.ok is True


@pytest.mark.unit
def test_label_present_for_extracted_tier_is_ok() -> None:
    content = json.dumps({"results": [{"tier": "EXTRACTED", "label": "Confirmed knowledge"}], "citations": []})

    outcome = validate_tool_envelope(content)

    assert outcome.ok is True


@pytest.mark.unit
def test_valid_citation_entry_is_ok() -> None:
    content = json.dumps({"results": [], "citations": [{"kind": "entity", "id": "e1", "route": "/entities/e1"}]})

    outcome = validate_tool_envelope(content)

    assert outcome.ok is True


@pytest.mark.unit
def test_citation_route_mismatch_is_rejected() -> None:
    content = json.dumps({"results": [], "citations": [{"kind": "entity", "id": "e1", "route": "/emails/e1"}]})

    outcome = validate_tool_envelope(content)

    assert outcome.ok is False


@pytest.mark.unit
def test_citation_unrecognized_kind_is_rejected() -> None:
    content = json.dumps({"results": [], "citations": [{"kind": "admin", "id": "e1", "route": "/admin/e1"}]})

    outcome = validate_tool_envelope(content)

    assert outcome.ok is False


@pytest.mark.unit
def test_reason_never_leaks_field_name_tier_value_or_citation_route() -> None:
    content = json.dumps(
        {
            "content_text": "SECRET-RAW-LEAK",
            "results": [{"tier": "AMBIGUOUS", "label": "SECRET-SUGGESTION-LABEL"}],
            "citations": [{"kind": "entity", "id": "e1", "route": "/spoofed/e1"}],
        }
    )

    outcome = validate_tool_envelope(content)

    assert outcome.ok is False
    assert outcome.reason in {
        "tool result was not valid structured data",
        "tool result failed an envelope safety check",
    }
    assert "content_text" not in outcome.reason
    assert "SECRET-RAW-LEAK" not in outcome.reason
    assert "AMBIGUOUS" not in outcome.reason
    assert "SECRET-SUGGESTION-LABEL" not in outcome.reason
    assert "/spoofed/e1" not in outcome.reason
