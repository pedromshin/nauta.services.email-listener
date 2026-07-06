"""InMemoryAnticipatoryCapStore — the D-14 no-new-table spike frequency-cap adapter (D-10).

Implements the `AnticipatoryCapStore` port with a plain in-process dict — no
migration, no new DB table (D-14 planner decision — see 25-02-PLAN.md's
"Planner decision" block). A production adapter would project the same
"shown" state off the existing `chat_run_events` substrate (a run-event
projection, not a new table); this spike adapter is the minimal stand-in that
proves the port's shape is sufficient, with `seed()` letting fixture-driven
tests simulate a reloaded conversation's prior shown timestamps (D-10's
"persists / survives reload" seam) without a real reload.

This is the one deliberately stateful spike shim in Plan 25-02 — every other
new module (ports, judge, gate-chain use case) is otherwise side-effect-free
or delegates its one side effect (the Bedrock call) to an injected client.
"""

from __future__ import annotations

from app.domain.ports.anticipatory_ports import AnticipatoryCapStore


class InMemoryAnticipatoryCapStore(AnticipatoryCapStore):
    """In-process `AnticipatoryCapStore` — conversation_id -> shown timestamps (D-10/D-14)."""

    def __init__(self) -> None:
        self._shown_by_conversation: dict[str, list[float]] = {}

    def seed(self, conversation_id: str, timestamps: list[float]) -> None:
        """Pre-populate shown timestamps — simulates a reloaded conversation's prior prompts."""
        self._shown_by_conversation.setdefault(conversation_id, []).extend(timestamps)

    async def count_shown(self, *, conversation_id: str, since_epoch_s: float) -> int:
        timestamps = self._shown_by_conversation.get(conversation_id, [])
        return sum(1 for ts in timestamps if ts >= since_epoch_s)

    async def record_shown(self, *, conversation_id: str, at_epoch_s: float) -> None:
        self._shown_by_conversation.setdefault(conversation_id, []).append(at_epoch_s)


__all__ = ["InMemoryAnticipatoryCapStore"]
