"""Pure tool-loop helpers for the bounded mid-turn round loop (Phase 34, LOOP-01).

Split out of run_chat_turn.py (mirrors run_chat_turn_widgets.py's pattern):
pure functions only, no I/O, no ports -- importing only `app.domain.*` +
stdlib keeps this module trivially unit-testable and free of the
import-linter's "Application does not import infrastructure" contract.

None of this is wired into `_execute_turn` yet -- Plan 34-03 consumes these
helpers to build the actual streaming round loop. This module only freezes
the contracts and pure logic: part builders for the two new message-part
types (`tool_invocation` / `tool_invocation_result` -- NOT reusing
`interactive_widget`, which carries pending-for-human semantics), the
synthetic native `tool_result` content block the Bedrock adapter accepts
verbatim, a three-way dispatch classifier, and an output-size cap.

"Never silent" is this phase's behavioral motto (LOOP-02/LOOP-03):
PARSE_FAILURE_TEXT and ROUND_CAP_EXHAUSTED_TEXT are the exact visible-text
constants the loop surfaces instead of a bare silent drop/stop.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.application.use_cases.run_chat_turn_widgets import INTERACTIVE_WIDGET_TOOL_NAMES
from app.domain.ports.tool_executor import MAX_TOOL_OUTPUT_CHARS

if TYPE_CHECKING:
    from collections.abc import Collection

    from app.domain.ports.tool_executor import ToolExecutionResult

# Mirrors app.infrastructure.llm.chat_tools.EMIT_UI_SPEC_TOOL_NAME -- defined
# locally (not imported) because the import-linter forbids
# app.application -> app.infrastructure.
EMIT_UI_SPEC_TOOL_NAME = "emit_ui_spec"

# Visible-surface text (LOOP-02/LOOP-03, "never silent" motto). Exact strings
# -- consumed verbatim by Plans 34-02/34-03.
PARSE_FAILURE_TEXT = (
    "I couldn't parse that lookup result, so I stopped before using it. Could you rephrase your request?"
)
ROUND_CAP_EXHAUSTED_TEXT = "I couldn't fully resolve that after several lookups. Here's what I have so far."


def build_tool_invocation_part(tool_name: str, tool_use_id: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Build the `tool_invocation` message part recording a dispatched server-tool call."""
    return {
        "type": "tool_invocation",
        "toolUseId": tool_use_id,
        "toolName": tool_name,
        "arguments": arguments,
    }


def build_tool_invocation_result_part(result: ToolExecutionResult, tool_name: str) -> dict[str, Any]:
    """Build the `tool_invocation_result` message part recording an executor's outcome."""
    return {
        "type": "tool_invocation_result",
        "toolUseId": result.tool_use_id,
        "toolName": tool_name,
        "content": result.content,
        "isError": result.is_error,
    }


def build_synthetic_tool_result_message(result: ToolExecutionResult) -> dict[str, Any]:
    """Build the native Bedrock `tool_result` user message for the next round.

    The Bedrock adapter accepts native `tool_result` content blocks verbatim
    -- preferred over string fencing so the model sees a first-class
    tool-result block rather than text pretending to be one.
    """
    return {
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": result.tool_use_id,
                "content": result.content,
                "is_error": result.is_error,
            }
        ],
    }


def classify_tool_dispatch(tool_name: str, server_tool_names: Collection[str]) -> str:
    """Classify a completed tool call into one of four dispatch branches.

    Precedence: server tools first (an executor mapping entry always wins
    even if a name were to collide with a widget/emit_ui_spec name), then
    the existing terminal widget tools, then emit_ui_spec, else "unknown".
    """
    if tool_name in server_tool_names:
        return "server"
    if tool_name in INTERACTIVE_WIDGET_TOOL_NAMES:
        return "widget"
    if tool_name == EMIT_UI_SPEC_TOOL_NAME:
        return "emit_ui_spec"
    return "unknown"


def cap_tool_output(text: str, limit: int = MAX_TOOL_OUTPUT_CHARS) -> str:
    """Truncate `text` to `limit` chars, appending a visible truncation marker when cut."""
    if len(text) <= limit:
        return text
    return text[:limit] + " …[truncated]"


__all__ = [
    "EMIT_UI_SPEC_TOOL_NAME",
    "PARSE_FAILURE_TEXT",
    "ROUND_CAP_EXHAUSTED_TEXT",
    "build_synthetic_tool_result_message",
    "build_tool_invocation_part",
    "build_tool_invocation_result_part",
    "cap_tool_output",
    "classify_tool_dispatch",
]
