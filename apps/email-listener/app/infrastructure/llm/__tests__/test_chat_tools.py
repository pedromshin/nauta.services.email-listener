"""Tests for build_emit_proposal_cards_tool (Phase 24-02 Task 1, D-01/D-03/D-04/D-05).

Infra testing infra (no cross-layer import), unlike
test_run_chat_turn_interactive_widget.py which must stay decoupled from
app.infrastructure per the import-linter contract.
"""

from __future__ import annotations

from app.infrastructure.llm.chat_tools import EMIT_PROPOSAL_CARDS_TOOL_NAME, build_emit_proposal_cards_tool


def test_build_emit_proposal_cards_tool_root_is_bedrock_valid_object_schema() -> None:
    tool = build_emit_proposal_cards_tool()

    assert tool["name"] == EMIT_PROPOSAL_CARDS_TOOL_NAME
    schema = tool["input_schema"]
    assert schema["type"] == "object"
    assert schema["additionalProperties"] is False
    assert schema["required"] == ["options"]
    assert "$ref" not in schema


def test_proposal_cards_options_schema_bounds_are_present() -> None:
    tool = build_emit_proposal_cards_tool()
    options_schema = tool["input_schema"]["properties"]["options"]

    assert options_schema["type"] == "array"
    assert options_schema["minItems"] == 1
    assert options_schema["maxItems"] == 8
    item_schema = options_schema["items"]
    assert item_schema["required"] == ["title", "value"]
    assert item_schema["additionalProperties"] is False
