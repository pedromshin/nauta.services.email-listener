"""SearchEmailsExecutor -- thin ToolExecutor wrapper over find_similar_confirmed() (Phase 36, TOOL-02).

The SECOND real, production `ToolExecutor` (36-01 shipped the first,
`LookupEntityExecutor`). Zero new backend: this executor calls ONLY existing
repository methods -- `RetrievalPort.find_similar_confirmed`,
`EntityTypeRepository.list_active`, `ComponentRepository.find_by_id`, and
`EmailRepository.find_by_id` -- and never raises past the
`ToolExecutor.execute()` boundary (port contract).

Tier-2 quarantine rule (T-36-05, this tool's own requirement text): the
result envelope carries ONLY subject/sender/received-at metadata plus the
confirmed structured extracted fields belonging to the matching region --
never any raw source-text field from the matched region or the parent email.
`EmailSearchResult` has no such field at all, so this is structurally
unreachable to violate by omission, not enforced by a runtime check.

Tenant isolation (T-36-06, defense-in-depth): a resolved component or email
whose own `.importer_id` disagrees with the caller-supplied `importer_id` is
skipped entirely, even though `find_similar_confirmed`'s RPC is already
importer-scoped -- belt-and-suspenders against a future RPC regression.
"""

from __future__ import annotations

import dataclasses
import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import structlog

from app.application.use_cases.run_chat_turn_tool_loop import cap_tool_output
from app.domain.ports.tool_executor import ToolExecutionResult
from app.domain.services.key_terms import extract_key_terms
from app.infrastructure.tools.envelope import build_citation, citation_to_dict, truncate_field

if TYPE_CHECKING:
    from app.domain.ports.component_repository import ComponentRepository
    from app.domain.ports.email_repository import EmailRepository
    from app.domain.ports.embedding_protocol import EmbeddingProtocol
    from app.domain.ports.entity_type_repository import EntityTypeRepository
    from app.domain.ports.retrieval_port import RetrievalPort, RetrievedExample

logger = structlog.get_logger(__name__)

SEARCH_EMAILS_TOOL_NAME = "search_emails"

# top_n passed to find_similar_confirmed PER active entity type (there is no
# single "search across all entity types" RPC -- zero new backend means this
# executor loops, exactly like 36-01's LookupEntityExecutor name-search path).
_TOP_N_PER_ENTITY_TYPE = 5
# Final cap on distinct EMAILS returned, after merge + dedupe.
_TOP_N_EMAILS = 5

_EMPTY_QUERY_TEXT = "I need a search query to look for related emails -- please provide one."
_EXECUTION_ERROR_TEXT = "I couldn't search emails right now. Please try again."

_DESCRIPTION = (
    "Search this importer's own confirmed email data for emails related to a free-text query, and "
    "return grounded, cited results. Results contain only subject/sender/received-at metadata and the "
    "confirmed structured fields extracted from the matching region -- raw email message contents are "
    "never returned. Use this when the user asks to find, recall, or look up something previously "
    "received by email."
)

_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["query"],
    "additionalProperties": False,
    "properties": {
        "query": {
            "type": "string",
            "maxLength": 200,
            "description": "A free-text description of what to search for across this importer's confirmed emails.",
        },
    },
}


def build_search_emails_tool() -> dict[str, Any]:
    """Build the search_emails tool dict (Bedrock-valid: root type:object, additionalProperties:false).

    Mirrors chat_tools.py's schema conventions (maxLength defense-in-depth on
    free-text input, per 36-CONTEXT.md) and `build_lookup_entity_tool()`'s shape.
    """
    return {
        "name": SEARCH_EMAILS_TOOL_NAME,
        "description": _DESCRIPTION,
        "input_schema": _INPUT_SCHEMA,
    }


@dataclass(frozen=True)
class EmailSearchResult:
    """One email match surfaced by the search -- metadata + confirmed structured fields only.

    Deliberately has NO field carrying any raw source-text -- the Tier-2
    "never raw body" rule (T-36-05) is structurally unreachable to violate by
    omission here, mirroring the synthesis's "EXTRACTED-only enforced by
    field omission, not a boolean flag" principle applied to this tool.
    """

    email_id: str
    subject: str | None
    sender_name: str | None
    sender_address: str
    received_at: str
    extracted_fields: dict[str, object]
    score: float


class SearchEmailsExecutor:
    """ToolExecutor implementation for `search_emails` -- thin wrapper, zero new backend.

    Collaborators (all existing ports, zero new repository methods):
        retrieval: RetrievalPort -- the BlendedRAG find_similar_confirmed() call
            this executor loops over per active entity type.
        entity_types: EntityTypeRepository -- drives the per-entity-type loop
            (there is no single cross-entity-type retrieval RPC).
        components: ComponentRepository -- resolves a matched region back to
            its parent email id.
        emails: EmailRepository -- resolves the final email metadata surfaced
            in the result envelope.
        embedder: EmbeddingProtocol -- embeds the raw query text.
    """

    def __init__(
        self,
        *,
        retrieval: RetrievalPort,
        entity_types: EntityTypeRepository,
        components: ComponentRepository,
        emails: EmailRepository,
        embedder: EmbeddingProtocol,
    ) -> None:
        self._retrieval = retrieval
        self._entity_types = entity_types
        self._components = components
        self._emails = emails
        self._embedder = embedder

    async def execute(self, *, name: str, arguments: dict[str, Any], importer_id: str) -> ToolExecutionResult:
        """Execute `search_emails` -- never raises past this boundary (port contract)."""
        del name  # unused -- this class serves exactly one tool

        query = arguments.get("query")
        if not isinstance(query, str) or not query.strip():
            return ToolExecutionResult(tool_use_id="", content=_EMPTY_QUERY_TEXT, is_error=True)

        try:
            results = await self._gather_candidates(query=query, importer_id=importer_id)
        except Exception as exc:  # an executor MUST NEVER raise out of the loop (port contract)
            logger.warning("search_emails_execution_failed", query=query, error=str(exc))
            return ToolExecutionResult(tool_use_id="", content=_EXECUTION_ERROR_TEXT, is_error=True)

        envelope = {
            "results": [dataclasses.asdict(result) for result in results],
            "citations": [citation_to_dict(build_citation("email", result.email_id)) for result in results],
        }
        content = cap_tool_output(json.dumps(envelope, separators=(",", ":")))
        return ToolExecutionResult(tool_use_id="", content=content, is_error=False)

    async def _gather_candidates(self, *, query: str, importer_id: str) -> list[EmailSearchResult]:
        """Embed + retrieve across every active entity type, resolve to emails, dedupe, rank, cap.

        Never raises on an empty active-entity-type list or an all-empty
        merged result set (D-13 cold-start-safe convention) -- returns [].
        """
        embedding = await self._embedder.embed(text=query)
        key_terms = extract_key_terms(query)
        entity_types = await self._entity_types.list_active(importer_id)

        examples: list[RetrievedExample] = []
        for entity_type in entity_types:
            examples.extend(
                await self._retrieval.find_similar_confirmed(
                    component_embedding=embedding,
                    entity_type_id=entity_type.id,
                    importer_id=importer_id,
                    key_terms=key_terms,
                    top_n=_TOP_N_PER_ENTITY_TYPE,
                )
            )

        merged: dict[str, EmailSearchResult] = {}
        for example in examples:
            result = await self._resolve_to_email_result(example=example, importer_id=importer_id)
            if result is None:
                continue
            existing = merged.get(result.email_id)
            if existing is not None and existing.score >= result.score:
                continue
            merged[result.email_id] = result

        ranked = sorted(merged.values(), key=lambda result: result.score, reverse=True)
        return ranked[:_TOP_N_EMAILS]

    async def _resolve_to_email_result(
        self, *, example: RetrievedExample, importer_id: str
    ) -> EmailSearchResult | None:
        """Resolve one retrieved example to a tenant-verified `EmailSearchResult`, or None to skip.

        T-36-06 defense-in-depth: a component or email whose OWN importer_id
        disagrees with the caller's importer_id is skipped entirely, even
        though `find_similar_confirmed`'s RPC is already importer-scoped.
        """
        component = await self._components.find_by_id(example.component_id)
        if component is None or component.importer_id != importer_id:
            return None

        email = await self._emails.find_by_id(component.email_id)
        if email is None or email.importer_id != importer_id:
            return None

        return EmailSearchResult(
            email_id=email.id,
            subject=truncate_field(email.subject) if email.subject else email.subject,
            sender_name=email.sender_name,
            sender_address=email.sender_address,
            received_at=email.received_at.isoformat(),
            extracted_fields=_truncate_string_values(example.extracted_fields),
            score=example.score,
        )


def _truncate_string_values(fields: dict[str, object]) -> dict[str, object]:
    """Truncate every string VALUE in `fields` via `truncate_field`; non-strings pass through."""
    return {key: (truncate_field(value) if isinstance(value, str) else value) for key, value in fields.items()}


__all__ = [
    "SEARCH_EMAILS_TOOL_NAME",
    "EmailSearchResult",
    "SearchEmailsExecutor",
    "build_search_emails_tool",
]
