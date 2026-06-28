"""RetrievalProvider port — source-agnostic ranked-result retrieval seam.

Architecture contract (lint-imports):
  This module imports ONLY stdlib and typing.  No infrastructure imports are
  permitted here — the domain layer must remain infra-free.

Implementations ship in app/infrastructure/llm/:
  - LexicalRetrievalProvider (genui_retrieval_provider.py) — deterministic/lexical
    retrieval over catalog components + hand-authored exemplar specs + available
    ui_spec_templates rows.  Ships NOW (Plan 17-02).

  - EmbeddingRetrievalProvider (FLY-01, deferred) — semantic retrieval via Bedrock
    Titan V1 embeddings + pgvector + RRF(k=60).  Will implement the SAME Protocol
    method signature below with NO caller change (D-10).

The separation follows the Phase-11 inferred edge-provider seam pattern: ship the
simplest-correct implementation now behind a stable seam, so the deferred hard
implementation (FLY embedding/RRF) drops in with zero rework at the injection site.

D-10: The port returns a RANKED, SCORED result list (RetrievalResult.items sorted
by descending score) so the embedding adapter's different scoring is a drop-in
replacement with no protocol or caller changes.

D-14: RetrievalResult.retrieved_ids is the convenience tuple for audit logging
(log the retrieved ids per generation to prove retrieval is not inert — RAG-02).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol, runtime_checkable

# ---------------------------------------------------------------------------
# DTOs
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RetrievedItem:
    """A single item retrieved from the catalog, exemplar corpus, or templates.

    id: Stable identifier string for the item.
        - For catalog components: the component ``type`` (e.g. "grid", "card").
        - For exemplars: the exemplar id (e.g. "dashboard-saas").
        - For templates: the ui_spec_templates row UUID.
    kind: Source category of this item.
        - "component" — from the genui catalog (genui-prompt.json components).
        - "exemplar"  — from the hand-authored exemplar corpus (genui_exemplars.py).
        - "template"  — from the ui_spec_templates exact-cache/template store.
    score: Relevance score in (0, 1].  Higher is more relevant.
        The scoring formula is implementation-defined; the contract is that items
        in RetrievalResult.items are sorted by *descending* score (highest first).
    payload: A dict the prompt formatter consumes.  Structure is kind-specific:
        - "component" → {"type": str, "description": str, "acceptsChildren": bool, ...}
        - "exemplar"  → {"id": str, "category": str, "tags": [str,...], "spec": {...}}
        - "template"  → {"id": str, "intent_text": str, "spec_json": {...}}
    """

    id: str
    kind: Literal["component", "exemplar", "template"]
    score: float
    payload: dict[str, object]


@dataclass(frozen=True)
class RetrievalResult:
    """Ranked, scored result set from a RetrievalProvider.retrieve() call.

    items: Immutable tuple of RetrievedItem objects, sorted by *descending* score
        (highest relevance first).  Length is at most ``top_k`` as requested.

    retrieved_ids: Convenience property — a tuple of ``item.id`` values in the same
        order as ``items``.  Used for D-14 audit logging (log retrieved ids per
        generation to prove retrieval is not inert).

    Design notes:
        - Items are in a tuple (immutable, ordered, hashable) rather than a list
          so the result is suitable for use in frozen dataclasses or as dict keys.
        - The descending-score ordering is a PROVIDER CONTRACT, not enforced by this
          DTO.  Implementations must sort before constructing RetrievalResult.
        - Empty result (items=()) is valid for cold-start / no-match scenarios;
          callers must handle it gracefully.
    """

    items: tuple[RetrievedItem, ...]

    @property
    def retrieved_ids(self) -> tuple[str, ...]:
        """Return item ids in the same order as items (for D-14 logging)."""
        return tuple(item.id for item in self.items)


# ---------------------------------------------------------------------------
# Protocol (the seam)
# ---------------------------------------------------------------------------


@runtime_checkable
class RetrievalProvider(Protocol):
    """Source-agnostic retrieval port for assembly RAG.

    Implementations retrieve relevant items (catalog components, exemplar specs,
    template rows) given an intent string and return a RANKED, SCORED result list.

    Ships now:
        - LexicalRetrievalProvider — deterministic lexical/keyword retrieval
          (category/tag/keyword + lightweight structural similarity).
          Located at: app/infrastructure/llm/genui_retrieval_provider.py.

    Deferred (FLY-01):
        - EmbeddingRetrievalProvider — Bedrock Titan V1 + pgvector + RRF(k=60).
          Will implement this exact method signature; no caller change required.

    Protocol contract:
        - retrieve() is async — implementations may call async DB/Bedrock APIs.
        - result.items is sorted by descending score, length <= top_k.
        - Must never raise — failures are swallowed + logged at the adapter level.
        - style_pack_id is passed through to enable future pack-aware retrieval
          (e.g. retrieve exemplars filtered to the active style pack's personality).
          The current lexical adapter ignores it (acceptable per D-11).
    """

    async def retrieve(
        self,
        *,
        intent: str,
        top_k: int,
        style_pack_id: str | None = None,
    ) -> RetrievalResult:
        """Retrieve top-k relevant items for the given intent.

        Args:
            intent: The raw generation intent string (will be canonicalized
                internally by implementations).
            top_k: Maximum number of items to return.  The result may contain
                fewer items if the corpus is small or scores are all below
                relevance threshold.
            style_pack_id: Optional active style pack identifier (D-08).  The
                FLY embedding adapter will use this to filter/boost exemplars
                aligned with the pack's personality.  The lexical adapter
                ignores it (D-11 "lexical method, top-k+scoring is Claude's
                discretion").

        Returns:
            RetrievalResult with items sorted by descending score, len <= top_k.
            Never raises — returns empty RetrievalResult on any unhandled error.
        """
        ...
