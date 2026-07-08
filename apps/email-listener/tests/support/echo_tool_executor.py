"""EchoToolExecutor -- test double implementing the ToolExecutor port (Phase 34, LOOP-01).

Proves the bounded mid-turn tool loop's mechanics against a stub before any
real knowledge tool exists (Phase 36/37). Registered in TESTS ONLY --
`container.py` wires an empty executor mapping in production, so even with
`max_tool_rounds=4` on the Bedrock entries, no server tool exists in prod
until Phase 36.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from app.application.use_cases.run_chat_turn_tool_loop import cap_tool_output
from app.domain.ports.tool_executor import ToolExecutionResult

_FORCED_ERROR_TEXT = "echo tool forced error (test-only __force_error__ flag)"


class EchoToolExecutor:
    """Echoes its arguments back as the tool result, capped and test-controllable.

    - `arguments["tool_use_id"]` (if present) becomes the result's tool_use_id,
      else "echo".
    - `arguments["__force_error__"]` truthy -> returns `is_error=True` with a
      fixed error string (drives the loop's error-handling path).
    - `arguments["__sleep__"]` (seconds) -> awaits `asyncio.sleep` first, so a
      caller can drive the per-tool timeout path (34-03).
    """

    async def execute(self, *, name: str, arguments: dict[str, Any], importer_id: str) -> ToolExecutionResult:
        del name, importer_id  # unused -- echo behavior is identical regardless of tool name/tenant
        tool_use_id = arguments.get("tool_use_id", "echo")

        sleep_seconds = arguments.get("__sleep__")
        if sleep_seconds is not None:
            await asyncio.sleep(sleep_seconds)

        if arguments.get("__force_error__"):
            return ToolExecutionResult(tool_use_id=tool_use_id, content=_FORCED_ERROR_TEXT, is_error=True)

        return ToolExecutionResult(
            tool_use_id=tool_use_id,
            content=cap_tool_output(json.dumps(arguments)),
            is_error=False,
        )
