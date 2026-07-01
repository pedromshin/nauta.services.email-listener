"""GenerateCodeIslandUseCase — orchestrates the code-island generation pipeline.

This is a PARALLEL use case to GenerateUiSpecUseCase. It emits arbitrary JavaScript
island code rather than a declarative SpecRoot dict. The declarative spec use case is
untouched by this module.

Architecture contract (lint-imports):
  Imports ONLY domain ports and standard library / structlog.
  No infrastructure imports permitted at module level OR under TYPE_CHECKING.
  Adapters are accepted as constructor arguments typed via Any (mirrors
  GenerateUiSpecUseCase) so the application layer stays infrastructure-free.

Pipeline (D-09, SAFE-01/SAFE-02):
  1. Call A: quarantine.extract(intent, raw_content)
             → QuarantineExtraction (enum-constrained, raw prose quarantined)
  2. Call B: code_generator.generate(extraction, importer_id)
             → CodeGeneratorResult (arbitrary JS, or SAFE_FALLBACK_CODE on failure)
  3. Audit:  GenerationAuditRepository.record(GenerationEvent) — best-effort (T-13-10)

No cache: code is non-deterministic, so there is no exact-match cache step.

Security:
  - intent_hash is SHA-256 of raw intent prose — NEVER the raw string (D-19)
  - Raw prose never crosses to the generator; only the structured extraction does (SAFE-02)
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Any, Literal

import structlog

from app.domain.ports.generation_audit_repository import GenerationAuditRepository, GenerationEvent

logger = structlog.get_logger(__name__)

# Registry version marker for code-island audit rows (generic; not a spec catalog).
_REGISTRY_VERSION = "code-island-v1"


@dataclass(frozen=True)
class GenerateCodeIslandResult:
    """Immutable result of a GenerateCodeIslandUseCase.execute() call."""

    code: str
    language: str
    outcome: Literal["ok", "fallback", "escalated"] = "ok"
    attempts: int = 1


class GenerateCodeIslandUseCase:
    """Orchestrate the quarantine → code-generate → audit pipeline (code-island path).

    Collaborators (accepted via constructor; typed as Any to keep module infra-free):
        quarantine: GenuiQuarantineAdapter — Call A (enum-constrained extraction, reused)
        code_generator: GenuiCodeGeneratorAdapter — Call B (emit_code_island forced tool-use)
        audit: GenerationAuditRepository — best-effort event persistence (D-19, reused)

    No cache collaborator — code output is non-deterministic.
    """

    def __init__(
        self,
        *,
        quarantine: Any,
        code_generator: Any,
        audit: GenerationAuditRepository,
    ) -> None:
        self._quarantine = quarantine
        self._code_generator = code_generator
        self._audit = audit

    async def execute(
        self,
        *,
        intent: str,
        raw_content: str = "",
        importer_id: str | None = None,
    ) -> GenerateCodeIslandResult:
        """Run the quarantine → code-generate → audit pipeline and return the island code.

        Args:
            intent: Trusted user intent string (what to build).
            raw_content: Untrusted document content — quarantined in Call A (SAFE-01).
            importer_id: Optional importer context for audit rows (D-19).

        Returns:
            GenerateCodeIslandResult wrapping the emitted JavaScript. On total failure
            the result carries SAFE_FALLBACK_CODE with outcome='fallback' — this method
            itself never raises (best-effort contract mirrors the adapters).
        """
        start_ms = int(time.monotonic() * 1000)
        intent_hash = hashlib.sha256(intent.encode()).hexdigest()

        log = logger.bind(
            intent_hash=intent_hash,
            registry_version=_REGISTRY_VERSION,
            importer_id=importer_id,
        )
        log.info("genui_code_island_start")

        # ── Call A: quarantine (SAFE-01, D-09) ──────────────────────────────────
        # raw_content is placed ONLY in the user turn of Call A inside delimiters.
        # The adapter's extract() never raises — returns empty extraction on error.
        extraction = await self._quarantine.extract(
            intent=intent,
            raw_content=raw_content,
        )
        log.info(
            "genui_code_island_quarantine_done",
            entity_type=extraction.entity_type,
            confidence=extraction.confidence,
        )

        # ── Call B: code-generate (SAFE-02, D-02/D-05/D-07) ─────────────────────
        # Only the structured QuarantineExtraction crosses to the generator.
        # generate() never raises — returns CodeGeneratorResult with SAFE_FALLBACK_CODE
        # on total failure.
        gen_result = await self._code_generator.generate(
            extraction=extraction,
            importer_id=importer_id,
        )
        log.info(
            "genui_code_island_generate_done",
            language=gen_result.language,
            attempts=gen_result.attempts,
            escalated=gen_result.escalated,
            is_fallback=gen_result.is_fallback,
        )

        # ── Determine outcome (priority: fallback > escalated > ok) ──────────────
        outcome = _determine_outcome(escalated=gen_result.escalated, is_fallback=gen_result.is_fallback)

        latency_ms = int(time.monotonic() * 1000) - start_ms

        # ── Audit (GEN-05, D-19, T-13-10) — reuse the existing repository ────────
        # Best-effort: audit failure is swallowed + logged, never propagated.
        # Spec-specific fields are set to neutral defaults (no spec is produced on
        # this path) rather than creating a new table/migration.
        event = GenerationEvent(
            intent_hash=intent_hash,
            model_id=_resolve_model_id(escalated=gen_result.escalated),
            input_tokens=getattr(extraction, "input_tokens", 0),
            output_tokens=getattr(extraction, "output_tokens", 0),
            attempts=gen_result.attempts,
            outcome=outcome,
            spec_validation_passed=(outcome != "fallback"),
            registry_version=_REGISTRY_VERSION,
            spec_node_count=None,
            spec_depth=None,
            latency_ms=latency_ms,
            importer_id=importer_id,
            style_pack_id=None,
            retrieved_ids=(),
            retrieved_overlap_count=0,
        )
        try:
            await self._audit.record(event)
        except Exception:
            log.warning("genui_code_island_audit_failed", exc_info=True)

        return GenerateCodeIslandResult(
            code=gen_result.code,
            language=gen_result.language,
            outcome=outcome,
            attempts=gen_result.attempts,
        )


def _determine_outcome(
    *,
    escalated: bool,
    is_fallback: bool,
) -> Literal["ok", "fallback", "escalated"]:
    """Derive the Literal['ok','fallback','escalated'] outcome from the structural flags.

    Priority order (mirrors the declarative use case):
      1. "fallback" — generator set is_fallback=True (SAFE_FALLBACK_CODE returned).
      2. "escalated" — Sonnet escalation produced valid code (not fallback).
      3. "ok" — Haiku produced valid code on attempt 1 or 2.
    """
    if is_fallback:
        return "fallback"
    if escalated:
        return "escalated"
    return "ok"


def _resolve_model_id(*, escalated: bool) -> str:
    """Return the model ID used for the final generation attempt (audit accuracy).

    Imported lazily inside the function: settings is from app.settings (not
    infrastructure), but keeping it function-scoped avoids any circular import edge
    cases and keeps the module's top-level imports infrastructure-free (mirrors
    _resolve_model_id in generate_ui_spec).
    """
    from app.settings import get_settings  # noqa: PLC0415

    settings = get_settings()
    if escalated:
        return settings.genui_escalation_model_id
    return settings.genui_model_id
