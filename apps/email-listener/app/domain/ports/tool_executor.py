"""ToolExecutor port -- domain abstraction over mid-turn server tool execution (Phase 34, LOOP-01).

Backs the bounded in-stream tool-round loop (`_execute_turn`, Phase 34-03):
when the model calls a server tool (dispatch classified via
`run_chat_turn_tool_loop.classify_tool_dispatch`), the loop looks up the tool
name in the `tool_executors: Mapping[str, ToolExecutor]` seam and awaits
`execute(...)`, feeding the typed result back into the conversation as a
native `tool_result` content block. Concrete executors are wired in
`container.py` (never imported here -- the domain layer has no external
deps, verified by lint-imports).

Quarantine obligation (Fork 3 x 4 conflict resolution): Executors return
tier-filtered / quarantined typed payloads, never raw retrieved text -- only
EXTRACTED-tier text may enter model context (enforcement lands in Phase 38 /
QUAR-01; the obligation is stated here so a future executor built against
this port alone cannot ship raw body).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

# Executors cap their own `content` at this boundary -- history trimming
# (D-26) does not cover in-round tool_result messages, so an uncapped
# executor output could blow the turn's token budget mid-round.
MAX_TOOL_OUTPUT_CHARS = 2000


@dataclass(frozen=True)
class ToolExecutionResult:
    """The outcome of one server-tool execution, fed back as a tool_result.

    Field names mirror `ToolResultDelta` (chat_provider.py) 1:1 so the loop
    can map a `ToolExecutionResult` straight onto the delta shape without a
    translation layer.
    """

    tool_use_id: str
    content: str
    is_error: bool = False


class ToolExecutor(Protocol):
    """Port for one server-side tool the mid-turn loop can dispatch to.

    Quarantine obligation (Fork 3 x 4 conflict resolution, stated here so it
    cannot be missed by an executor built against this port alone):
    Executors return tier-filtered / quarantined typed payloads, never raw
    retrieved text -- only EXTRACTED-tier text may enter model context
    (enforcement lands in Phase 38 / QUAR-01).
    """

    async def execute(self, *, name: str, arguments: dict[str, Any]) -> ToolExecutionResult:
        """Execute the named tool with the given arguments and return its result.

        Implementations must never raise past this boundary in the loop's
        happy path -- the caller wraps this in `asyncio.wait_for` with a
        per-tool timeout (~10s) and treats both the timeout and any raised
        exception as `ToolExecutionResult(is_error=True)`.
        """
        ...
