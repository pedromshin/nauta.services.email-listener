"""AnthropicAutofiller -- LLM field extraction adapter using AWS Bedrock.

Security contract (D-14):
  - Region content lives ONLY in the user turn inside <document_content> delimiters.
  - The system prompt is constructed from entity type schema + KB text ONLY.
  - Prompt-injection in region text cannot escape into the system prompt.

Retry contract:
  - Up to _MAX_RETRIES attempts with _RETRY_DELAYS seconds between them.
  - On total failure returns AutofillResult({}, 0.0, None) (never raises).

Confidence formula (RESEARCH §5):
  - field_completeness = filled_fields / total_fields
  - mean_self_confidence = mean(per-field confidence values, default 0.5 when absent)
  - confidence_score = field_completeness * mean_self_confidence
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any, cast

import structlog

from app.domain.ports.autofill_protocol import AutofillResult

if TYPE_CHECKING:
    from anthropic import AsyncAnthropicBedrock
    from anthropic.types import ToolParam

    from app.domain.entities.entity_type import EntityType, EntityTypeField

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MAX_RETRIES = 3
_RETRY_DELAYS: tuple[float, float, float] = (2.0, 5.0, 15.0)

_EMPTY_RESULT = AutofillResult(extracted_fields={}, confidence_score=0.0, confidence_breakdown=None)

# extract_fields tool schema for structured output.
_EXTRACT_FIELDS_TOOL_DICT: dict[str, Any] = {
    "name": "extract_fields",
    "description": (
        "Extract structured field values from the document region. "
        "Return all known fields; use null for fields that cannot be determined."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "extracted_fields": {
                "type": "object",
                "description": "Map of field_slug -> extracted value (string, number, or null).",
                "additionalProperties": True,
            },
            "field_confidences": {
                "type": "object",
                "description": "Map of field_slug -> confidence score in [0, 1].",
                "additionalProperties": {"type": "number"},
            },
        },
        "required": ["extracted_fields", "field_confidences"],
    },
}

if TYPE_CHECKING:
    _EXTRACT_FIELDS_TOOL: ToolParam = cast("ToolParam", _EXTRACT_FIELDS_TOOL_DICT)
else:
    _EXTRACT_FIELDS_TOOL = _EXTRACT_FIELDS_TOOL_DICT


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------


def _render_field_schema(fields: tuple[EntityTypeField, ...]) -> str:
    """Render the field schema as a compact text block for the system prompt."""
    lines: list[str] = []
    for f in fields:
        required = "required" if f.is_required else "optional"
        identifier = ", identifier" if f.is_identifier else ""
        desc = f" — {f.description}" if f.description else ""
        lines.append(f"  - {f.slug} ({f.data_type}, {required}{identifier}){desc}")
    return "\n".join(lines)


def _build_system_prompt(
    *,
    entity_type: EntityType,
    knowledge_base_text: str,
) -> str:
    """Build the (constant per entity type + KB) system prompt.

    NEVER includes region/document content — that lives in the user turn only (D-14).
    """
    field_schema = _render_field_schema(entity_type.fields)
    description_block = f"\nEntity description: {entity_type.description}" if entity_type.description else ""
    kb_block = f"\nKnowledge base:\n{knowledge_base_text}" if knowledge_base_text.strip() else ""
    return (
        f"You are a structured field extraction assistant.\n"
        f"Extract fields from the document region for entity type '{entity_type.label}'."
        f"{description_block}\n\n"
        f"Field schema:\n{field_schema}"
        f"{kb_block}\n\n"
        f"Rules:\n"
        f"- Only extract fields defined in the schema above.\n"
        f"- Use null for fields that cannot be determined from the content.\n"
        f"- Provide a per-field confidence score in [0, 1].\n"
        f"- Output ONLY via the extract_fields tool — no prose.\n"
        f"Call extract_fields with your extraction result."
    )


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------


class AnthropicAutofiller:
    """Extracts structured fields via Claude on AWS Bedrock (D-13, D-14).

    Region content is ALWAYS placed in the user turn inside
    <document_content> delimiters (D-14 structural defense).

    Cold start (examples=()): no few-shot block is included.
    """

    def __init__(self, *, client: AsyncAnthropicBedrock, model_id: str) -> None:
        self._client = client
        self._model_id = model_id

    async def autofill(
        self,
        *,
        region_text: str,
        entity_type: EntityType,
        knowledge_base_text: str,
        examples: tuple[dict[str, object], ...] = (),
    ) -> AutofillResult:
        """Extract entity fields from region_text; returns empty result on error."""
        return await self._generate(
            region_text=region_text,
            entity_type=entity_type,
            knowledge_base_text=knowledge_base_text,
            examples=examples,
        )

    async def _generate(
        self,
        *,
        region_text: str,
        entity_type: EntityType,
        knowledge_base_text: str,
        examples: tuple[dict[str, object], ...],
    ) -> AutofillResult:
        """Call the model with retries; return empty AutofillResult on total failure."""
        # System prompt is built from schema + KB only — never from region content (D-14).
        system_prompt = _build_system_prompt(
            entity_type=entity_type,
            knowledge_base_text=knowledge_base_text,
        )

        # Region content is ONLY in the user turn, inside delimiters (D-14).
        user_content = f"<document_content>{region_text}</document_content>\n\nExtract the fields as JSON."

        # Cold start: examples=() → single user message only (no few-shot block).
        messages: list[dict[str, object]] = [{"role": "user", "content": user_content}]

        for attempt in range(_MAX_RETRIES):
            try:
                response = await self._client.messages.create(  # type: ignore[call-overload]
                    model=self._model_id,
                    max_tokens=2048,
                    system=system_prompt,
                    tools=[_EXTRACT_FIELDS_TOOL],
                    tool_choice={"type": "auto"},
                    messages=messages,
                )
                return self._parse_response(response, entity_type=entity_type)
            except Exception:
                delay = _RETRY_DELAYS[attempt] if attempt < len(_RETRY_DELAYS) else _RETRY_DELAYS[-1]
                logger.warning(
                    "autofill_attempt_failed",
                    attempt=attempt + 1,
                    max_retries=_MAX_RETRIES,
                    entity_type_slug=entity_type.slug,
                    exc_info=True,
                )
                if attempt < _MAX_RETRIES - 1:
                    await asyncio.sleep(delay)

        logger.error(
            "autofill_all_retries_exhausted",
            max_retries=_MAX_RETRIES,
            entity_type_slug=entity_type.slug,
        )
        return _EMPTY_RESULT

    def _parse_response(self, response: Any, *, entity_type: EntityType) -> AutofillResult:
        """Extract AutofillResult from the model response."""
        for block in response.content:
            if block.type != "tool_use":
                continue
            try:
                raw_fields: dict[str, object] = dict(block.input.get("extracted_fields", {}))
                raw_confidences: dict[str, object] = dict(block.input.get("field_confidences", {}))
                confidence_score = _compute_confidence(
                    fields=raw_fields,
                    confidences=raw_confidences,
                    total_fields=len(entity_type.fields),
                )
                return AutofillResult(
                    extracted_fields=raw_fields,
                    confidence_score=confidence_score,
                    confidence_breakdown=raw_confidences if raw_confidences else None,
                )
            except (KeyError, TypeError, ValueError):
                logger.warning(
                    "autofill_parse_failed",
                    entity_type_slug=entity_type.slug,
                    exc_info=True,
                )
                return _EMPTY_RESULT

        # No tool_use block — model returned text only
        logger.debug("autofill_no_tool_use_block", entity_type_slug=entity_type.slug)
        return _EMPTY_RESULT


# ---------------------------------------------------------------------------
# Confidence formula (RESEARCH §5)
# ---------------------------------------------------------------------------


def _compute_confidence(
    *,
    fields: dict[str, object],
    confidences: dict[str, object],
    total_fields: int,
) -> float:
    """Compute overall confidence: field_completeness x mean_self_confidence.

    field_completeness = non-null filled fields / total schema fields
    mean_self_confidence = mean of per-field confidence scores (default 0.5 when absent)
    """
    if total_fields == 0:
        return 0.0

    filled = sum(1 for v in fields.values() if v is not None)
    field_completeness = filled / total_fields

    if confidences:
        confidence_values: list[float] = []
        for v in confidences.values():
            try:
                confidence_values.append(float(v))  # type: ignore[arg-type]
            except (TypeError, ValueError):
                confidence_values.append(0.5)
        mean_confidence = sum(confidence_values) / len(confidence_values)
    else:
        mean_confidence = 0.5

    return field_completeness * mean_confidence
