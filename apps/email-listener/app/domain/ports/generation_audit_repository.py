"""GenerationAuditRepository port — domain abstraction for generation event audit writes.

Phase 13-02, GEN-05: Every generation event (intent-hash, model, tokens, outcome,
validation, bounds, registry-version) must be recordable.

D-19 constraints enforced here:
- intent stored as a canonical hash only (never raw prose)
- outcome typed as Literal['ok', 'fallback', 'escalated'] (T-13-11 tamper guard)
- GenerationEvent is frozen (immutable, CLAUDE.md)
- T-13-10: adapter never raises (best-effort audit) — that contract lives in the adapter
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol


@dataclass(frozen=True)
class GenerationEvent:
    """Immutable record of a single generation pipeline invocation (D-19, GEN-05).

    intent_hash: SHA-256 (or equivalent canonical hash) of the raw intent prose.
    outcome: one of 'ok' | 'fallback' | 'escalated' (T-13-11 CHECK constraint).
    spec_node_count / spec_depth: None when escalated before spec was produced.
    importer_id: None for system-level generations (no importer context).
    """

    intent_hash: str
    model_id: str
    input_tokens: int
    output_tokens: int
    attempts: int
    outcome: Literal["ok", "fallback", "escalated"]
    spec_validation_passed: bool
    registry_version: str
    spec_node_count: int | None = None
    spec_depth: int | None = None
    latency_ms: int | None = None
    importer_id: str | None = None
    # Phase 17-04: pack-aware generation + RAG audit fields (D-08/RAG-02)
    style_pack_id: str | None = None
    retrieved_ids: tuple[str, ...] = ()
    retrieved_overlap_count: int = 0


class GenerationAuditRepository(Protocol):
    """Port for writing generation audit events (GEN-05, D-19).

    Implementations must be best-effort (T-13-10): failures are logged
    server-side and swallowed — the caller never receives an exception from
    this method.
    """

    async def record(self, event: GenerationEvent) -> None:
        """Persist a single generation event row.

        Must not raise under any circumstance — the adapter absorbs all errors
        and logs them server-side (D-19, T-13-10 best-effort audit).
        """
        ...
