"""Tests for validate_result_against_schema (Phase 24-01, D-10).

Covers: a result satisfying the declared schema returns ok=True; missing-required,
wrong-type, and extra-key-under-additionalProperties:false results all return ok=False
with a generic reason (never a JSON-pointer/schema-path leak); a malformed declared
schema is rejected fail-closed (never raises).
"""

from __future__ import annotations

from typing import Any

import pytest

from app.domain.services.widget_result_validator import (
    ValidationOutcome,
    validate_result_against_schema,
)

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"choice": {"type": "string"}},
    "required": ["choice"],
    "additionalProperties": False,
}


@pytest.mark.unit
def test_valid_result_returns_ok() -> None:
    outcome = validate_result_against_schema({"choice": "a"}, _SCHEMA)

    assert outcome == ValidationOutcome(ok=True)


@pytest.mark.unit
def test_missing_required_key_returns_not_ok() -> None:
    outcome = validate_result_against_schema({}, _SCHEMA)

    assert outcome.ok is False
    assert outcome.reason


@pytest.mark.unit
def test_wrong_type_returns_not_ok() -> None:
    outcome = validate_result_against_schema({"choice": 123}, _SCHEMA)

    assert outcome.ok is False
    assert outcome.reason


@pytest.mark.unit
def test_extra_key_under_additional_properties_false_returns_not_ok() -> None:
    outcome = validate_result_against_schema({"choice": "a", "extra": "nope"}, _SCHEMA)

    assert outcome.ok is False
    assert outcome.reason


@pytest.mark.unit
def test_malformed_schema_is_rejected_fail_closed_never_raises() -> None:
    malformed_schema: dict[str, Any] = {"type": "obj"}

    outcome = validate_result_against_schema({"choice": "a"}, malformed_schema)

    assert outcome.ok is False
    assert outcome.reason


@pytest.mark.unit
def test_empty_declared_schema_is_rejected_fail_closed() -> None:
    outcome = validate_result_against_schema({"choice": "a"}, {})

    assert outcome.ok is False
    assert outcome.reason


@pytest.mark.unit
def test_reason_never_contains_schema_internals() -> None:
    outcome = validate_result_against_schema({}, _SCHEMA)

    assert "$" not in outcome.reason
    assert "properties" not in outcome.reason
    assert "choice" not in outcome.reason
