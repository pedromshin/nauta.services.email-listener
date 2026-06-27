"""Tests for the GenUI artifact loader (genui_artifacts).

Focus (BUG-B): the committed spec.schema.json — consumed as the Bedrock forced-tool
``emit_ui_spec`` ``input_schema`` — MUST have a top-level ``"type": "object"``.

A zod-to-json-schema wrapper root of the form
``{"$ref": "#/definitions/SpecRoot", "definitions": {...}}`` has NO root ``type`` and
causes EVERY live generation to fail with
``tools.0.custom.input_schema.type: Field required`` (HTTP 400), after which the
repair loop returns SAFE_FALLBACK. These tests guard against that regression both at
the artifact level and at the loader-guard level.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import jsonschema
import pytest

from app.infrastructure.llm.genui_artifacts import (
    _assert_bedrock_input_schema,
    load_spec_schema,
)


@pytest.fixture
def spec_schema() -> dict[str, Any]:
    # Bust the lru_cache so each test sees a fresh load of the committed artifact.
    load_spec_schema.cache_clear()
    return load_spec_schema()


def _valid_spec() -> dict[str, Any]:
    return {"v": 1, "root": {"type": "alert", "title": "Hello"}}


def _invalid_spec() -> dict[str, Any]:
    # Missing required "v" and uses an unregistered component type.
    return {"root": {"type": "not-a-real-component", "title": "Nope"}}


# ---------------------------------------------------------------------------
# Root-shape contract (BUG-B)
# ---------------------------------------------------------------------------


def test_spec_schema_root_is_object_type(spec_schema: dict[str, Any]) -> None:
    """Root must be a self-contained object schema (Bedrock input_schema.type)."""
    assert spec_schema["type"] == "object"
    assert "$ref" not in spec_schema
    assert spec_schema["required"] == ["v", "root"]


def test_valid_spec_validates_against_schema(spec_schema: dict[str, Any]) -> None:
    """A known-valid SpecRoot passes the Draft7 validator using the loaded schema."""
    validator = jsonschema.Draft7Validator(spec_schema)
    assert list(validator.iter_errors(_valid_spec())) == []


def test_invalid_spec_fails_against_schema(spec_schema: dict[str, Any]) -> None:
    """A known-invalid SpecRoot is rejected by the Draft7 validator."""
    validator = jsonschema.Draft7Validator(spec_schema)
    assert list(validator.iter_errors(_invalid_spec())) != []


# ---------------------------------------------------------------------------
# Loader guard
# ---------------------------------------------------------------------------


def test_guard_rejects_ref_wrapper_root() -> None:
    """The guard raises a clear error for the broken {$ref, definitions} root."""
    broken = {
        "$ref": "#/definitions/SpecRoot",
        "definitions": {"SpecRoot": {"type": "object"}},
    }
    with pytest.raises(RuntimeError, match=r"type.*object"):
        _assert_bedrock_input_schema(broken, Path("spec.schema.json"))


def test_guard_accepts_object_root() -> None:
    """The guard passes for a proper object-typed root."""
    ok = {"type": "object", "properties": {}, "required": []}
    _assert_bedrock_input_schema(ok, Path("spec.schema.json"))


def test_guard_rejects_non_dict_schema() -> None:
    """The guard rejects a non-object JSON top-level value."""
    with pytest.raises(RuntimeError, match=r"must be a JSON object"):
        _assert_bedrock_input_schema([1, 2, 3], Path("spec.schema.json"))
