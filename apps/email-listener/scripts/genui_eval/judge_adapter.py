"""LLM-as-judge adapter for the GenUI eval harness.

Makes a single forced-tool-use Bedrock call at temperature=0 to score whether
a generated UI spec matches the original intent.

Security contracts (mirrors genui_quarantine_adapter.py pattern):
  - No user-supplied content in the system prompt
  - asyncio.timeout wraps every call (D-17)
  - temperature=0 for deterministic scoring
  - Never raises: returns None on any error/timeout
  - No eval/exec/compile (D-24)

Returns float in [0.0, 1.0] or None on failure/timeout.
None causes aggregate() to renormalize excluding the on-intent weight.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import structlog

if TYPE_CHECKING:
    from anthropic import AsyncAnthropicBedrock

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Judge tool definition (forced tool-use, temperature=0)
# ---------------------------------------------------------------------------

_JUDGE_TOOL_NAME = "score_intent_match"

_JUDGE_TOOL_DICT: dict[str, Any] = {
    "name": _JUDGE_TOOL_NAME,
    "description": (
        "Score how well the generated UI spec matches the original user intent. "
        "Return a score from 0.0 (no match) to 1.0 (perfect match) and a brief rationale."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "score": {
                "type": "number",
                "minimum": 0.0,
                "maximum": 1.0,
                "description": (
                    "A float in [0.0, 1.0] representing how well the spec addresses the intent. "
                    "1.0 = the spec directly and completely represents the intent. "
                    "0.0 = the spec is completely irrelevant or is a fallback/placeholder."
                ),
            },
            "rationale": {
                "type": "string",
                "maxLength": 300,
                "description": "One to two sentences explaining the score.",
            },
        },
        "required": ["score", "rationale"],
    },
}

# ---------------------------------------------------------------------------
# System prompt — static, trusted content only
# ---------------------------------------------------------------------------

_JUDGE_SYSTEM_PROMPT = (
    "You are an evaluator for a UI spec generator. "
    "You will be given a user intent and a generated UI spec (JSON). "
    "Your task is to score how well the spec fulfils the intent on a 0.0-1.0 scale.\n\n"
    "Scoring guide:\n"
    "  1.0 - spec directly and completely represents the intent with appropriate components\n"
    "  0.75 - spec is mostly correct but missing minor elements\n"
    "  0.5 - spec partially represents the intent or uses suboptimal components\n"
    "  0.25 - spec is tangentially related but mostly misses the intent\n"
    "  0.0 - spec is a fallback, placeholder, or completely off-topic\n\n"
    "Call score_intent_match with your score and a brief rationale. Output ONLY via the tool."
)

# ---------------------------------------------------------------------------
# Brand judge — custom-not-generic (D-17)
# ---------------------------------------------------------------------------

_BRAND_JUDGE_TOOL_NAME = "score_brand_alignment"

_BRAND_JUDGE_TOOL_DICT: dict[str, Any] = {
    "name": _BRAND_JUDGE_TOOL_NAME,
    "description": (
        "Score how well the generated UI spec reflects the visual brand identity "
        "of the specified style pack. Evaluate token usage appropriateness, "
        "visual hierarchy, and whether component choices feel coherent with the pack's "
        "design language. Return a score from 0.0 (no brand alignment) to "
        "1.0 (excellent brand expression) and a brief rationale."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "score": {
                "type": "number",
                "minimum": 0.0,
                "maximum": 1.0,
                "description": (
                    "A float in [0.0, 1.0] representing how well the spec expresses "
                    "the style pack's brand identity. "
                    "1.0 = token usage and component choices strongly reflect the pack. "
                    "0.0 = no token usage or completely misaligned choices."
                ),
            },
            "rationale": {
                "type": "string",
                "maxLength": 300,
                "description": "One to two sentences explaining the brand alignment score.",
            },
        },
        "required": ["score", "rationale"],
    },
}

# Static system prompt — trusted content only (T-17-31)
# User intent and spec go ONLY in the user turn; no f-string interpolation here.
_BRAND_JUDGE_SYSTEM_PROMPT = (
    "You are a brand-alignment evaluator for a design token system. "
    "You will be given a user intent, a style-pack identifier, and a generated UI spec (JSON). "
    "Your task is to score how well the spec expresses the visual brand identity "
    "of the given style pack on a 0.0-1.0 scale.\n\n"
    "Evaluation dimensions:\n"
    "  - Token coverage: does the spec reference tokens from the style pack?\n"
    "  - Visual coherence: do component choices feel consistent with the pack's design language?\n"
    "  - Intent alignment: does the brand expression enhance (not conflict with) the user intent?\n\n"
    "Scoring guide:\n"
    "  1.0 - spec uses pack tokens richly and components feel native to the brand\n"
    "  0.75 - good brand alignment with minor gaps in token usage\n"
    "  0.5 - partial brand expression; some tokens used but choices feel generic\n"
    "  0.25 - minimal brand signal; mostly generic components with no pack-specific tokens\n"
    "  0.0 - no token usage or completely misaligned with the style pack\n\n"
    "Call score_brand_alignment with your score and a brief rationale. "
    "Output ONLY via the tool. Do not include any other text."
)

# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class JudgeResult:
    """Immutable result from a single judge call."""

    score: float | None
    """Float in [0.0, 1.0], or None on error/timeout."""

    rationale: str
    """Brief explanation of the score (empty string on error)."""

    input_tokens: int = 0
    output_tokens: int = 0


_FAILED_RESULT = JudgeResult(score=None, rationale="")

# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------


class JudgeAdapter:
    """LLM-as-judge: single forced-tool-use Bedrock call at temperature=0.

    On any error or timeout: returns JudgeResult(score=None, rationale="").
    The caller (run_eval) treats None as "judge unavailable" and aggregate()
    renormalizes without the on-intent weight.
    """

    def __init__(
        self,
        *,
        client: AsyncAnthropicBedrock,
        model_id: str,
        timeout_seconds: float = 15.0,
        max_tokens: int = 512,
    ) -> None:
        self._client = client
        self._model_id = model_id
        self._timeout_seconds = timeout_seconds
        self._max_tokens = max_tokens

    async def score(
        self,
        *,
        intent: str,
        spec: dict[str, Any],
    ) -> JudgeResult:
        """Score how well spec matches intent.

        Args:
            intent: The original user prompt/intent string.
            spec: The generated SpecRoot dict to evaluate.

        Returns:
            JudgeResult with score in [0.0, 1.0], or score=None on failure.
        """
        try:
            return await self._call_model(intent=intent, spec=spec)
        except Exception:
            logger.warning(
                "genui_judge_failed",
                model_id=self._model_id,
                exc_info=True,
            )
            return _FAILED_RESULT

    async def _call_model(self, *, intent: str, spec: dict[str, Any]) -> JudgeResult:
        """Make the Bedrock call with timeout; parse and return the result."""
        spec_json = json.dumps(spec, separators=(",", ":"))
        user_content = (
            f"User intent: {intent}\n\n"
            f"Generated UI spec (JSON):\n{spec_json}\n\n"
            "Score how well the spec matches the intent. Call score_intent_match."
        )

        messages: list[dict[str, object]] = [{"role": "user", "content": user_content}]

        async with asyncio.timeout(self._timeout_seconds):
            response = await self._client.messages.create(  # type: ignore[call-overload]
                model=self._model_id,
                max_tokens=self._max_tokens,
                temperature=0,
                system=_JUDGE_SYSTEM_PROMPT,
                tools=[_JUDGE_TOOL_DICT],
                tool_choice={"type": "tool", "name": _JUDGE_TOOL_NAME},
                messages=messages,
            )

        return self._parse_response(response)

    async def score_brand(
        self,
        *,
        intent: str,
        spec: dict[str, Any],
        style_pack_id: str,
    ) -> JudgeResult:
        """Score how well spec reflects the brand identity of the given style pack.

        Custom-not-generic judge (D-17): separate forced tool_choice call at
        temperature=0 using the escalation model. Never raises — returns
        JudgeResult(score=None, ...) on any error or timeout.

        The result is ADDITIVE and NOT folded into the 4-criterion aggregate
        (D-15 baseline comparability). It is stored in PromptReport.brand_score.

        Args:
            intent: The original user prompt/intent string.
            spec: The generated SpecRoot dict to evaluate.
            style_pack_id: The style pack identifier (e.g. 'polytoken-teal').

        Returns:
            JudgeResult with score in [0.0, 1.0], or score=None on failure.
        """
        try:
            return await self._call_brand_model(
                intent=intent,
                spec=spec,
                style_pack_id=style_pack_id,
            )
        except Exception:
            logger.warning(
                "genui_brand_judge_failed",
                model_id=self._model_id,
                style_pack_id=style_pack_id,
                exc_info=True,
            )
            return _FAILED_RESULT

    async def _call_brand_model(
        self,
        *,
        intent: str,
        spec: dict[str, Any],
        style_pack_id: str,
    ) -> JudgeResult:
        """Make the brand-judge Bedrock call with timeout; parse and return result."""
        spec_json = json.dumps(spec, separators=(",", ":"))
        # Intent, spec, and pack go ONLY in the user turn (T-17-31)
        user_content = (
            f"Style pack: {style_pack_id}\n\n"
            f"User intent: {intent}\n\n"
            f"Generated UI spec (JSON):\n{spec_json}\n\n"
            "Score how well the spec expresses the brand identity of the style pack. "
            "Call score_brand_alignment."
        )

        messages: list[dict[str, object]] = [{"role": "user", "content": user_content}]

        async with asyncio.timeout(self._timeout_seconds):
            response = await self._client.messages.create(  # type: ignore[call-overload]
                model=self._model_id,
                max_tokens=self._max_tokens,
                temperature=0,
                system=_BRAND_JUDGE_SYSTEM_PROMPT,
                tools=[_BRAND_JUDGE_TOOL_DICT],
                tool_choice={"type": "tool", "name": _BRAND_JUDGE_TOOL_NAME},
                messages=messages,
            )

        return self._parse_brand_response(response)

    def _parse_brand_response(self, response: Any) -> JudgeResult:
        """Extract JudgeResult from a successful brand-judge Bedrock response."""
        input_tokens: int = getattr(getattr(response, "usage", None), "input_tokens", 0) or 0
        output_tokens: int = getattr(getattr(response, "usage", None), "output_tokens", 0) or 0

        for block in response.content:
            if block.type != "tool_use":
                continue
            try:
                raw_input: dict[str, Any] = dict(block.input)
                raw_score = raw_input.get("score")
                if raw_score is None:
                    return JudgeResult(score=None, rationale="", input_tokens=input_tokens, output_tokens=output_tokens)
                score = float(raw_score)
                # Clamp to [0.0, 1.0] (defence-in-depth)
                score = max(0.0, min(1.0, score))
                rationale = str(raw_input.get("rationale", ""))[:300]
                return JudgeResult(
                    score=score,
                    rationale=rationale,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
            except (KeyError, TypeError, ValueError):
                logger.warning("genui_brand_judge_parse_failed", exc_info=True)
                return JudgeResult(score=None, rationale="", input_tokens=input_tokens, output_tokens=output_tokens)

        logger.debug("genui_brand_judge_no_tool_use_block")
        return JudgeResult(score=None, rationale="", input_tokens=input_tokens, output_tokens=output_tokens)

    def _parse_response(self, response: Any) -> JudgeResult:
        """Extract JudgeResult from a successful Bedrock response."""
        input_tokens: int = getattr(getattr(response, "usage", None), "input_tokens", 0) or 0
        output_tokens: int = getattr(getattr(response, "usage", None), "output_tokens", 0) or 0

        for block in response.content:
            if block.type != "tool_use":
                continue
            try:
                raw_input: dict[str, Any] = dict(block.input)
                raw_score = raw_input.get("score")
                if raw_score is None:
                    return JudgeResult(score=None, rationale="", input_tokens=input_tokens, output_tokens=output_tokens)
                score = float(raw_score)
                # Clamp to [0.0, 1.0] (defence-in-depth)
                score = max(0.0, min(1.0, score))
                rationale = str(raw_input.get("rationale", ""))[:300]
                return JudgeResult(
                    score=score,
                    rationale=rationale,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
            except (KeyError, TypeError, ValueError):
                logger.warning("genui_judge_parse_failed", exc_info=True)
                return JudgeResult(score=None, rationale="", input_tokens=input_tokens, output_tokens=output_tokens)

        # No tool_use block
        logger.debug("genui_judge_no_tool_use_block")
        return JudgeResult(score=None, rationale="", input_tokens=input_tokens, output_tokens=output_tokens)
