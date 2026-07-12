"""ResolveRethemeUseCase — orchestrates PANL-04's one-shot NL re-theme resolution.

Architecture contract (lint-imports):
  Imports ONLY domain ports and standard library / structlog.
  No infrastructure imports permitted at module level OR under TYPE_CHECKING
  (mirrors generate_ui_spec.py's contract).
  The resolver is accepted as a constructor argument typed via the domain
  port Protocol (typed Any here, mirroring GenerateUiSpecUseCase's
  quarantine/generator params); `is_known_pack_id` + `default_pack_id` are
  accepted as plain primitives (a predicate callable + a str) rather than
  importing app.infrastructure.llm.genui_style_packs directly, so this module
  never crosses the application->infrastructure boundary (STYLE_PACK_IDS
  parity stays owned by genui_style_packs.py; container.py wires the real
  predicate at the composition root).

Pipeline (52-05-PLAN.md Task 1):
  1. resolver.resolve(instruction, current_style_pack_id) — ONE Bedrock
     forced-tool-use call (no repair loop, no screenshot judging, locked).
  2. Validate style_pack_id via the injected is_known_pack_id predicate
     (T-52-05-01): an unknown/hallucinated pack id coerces to the current
     pack (or default_pack_id when there is no current pack) and marks the
     outcome "fallback" — this Python-side check is a BELT, not the
     authoritative gate (the tRPC web boundary's z.enum(STYLE_PACK_IDS) is,
     GEN-03/D-08).
  3. Drop any token_overrides key not in ALLOWED_OVERRIDE_KEYS (T-52-05-02).
  4. Never raises: any resolver exception degrades to outcome "fallback"
     carrying the unchanged current pack + empty overrides (never partial).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

import structlog

from app.domain.ports.retheme_resolver import ALLOWED_OVERRIDE_KEYS

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class ResolveRethemeResult:
    """Immutable result of a ResolveRethemeUseCase.execute() call."""

    style_pack_id: str
    token_overrides: dict[str, str]
    outcome: Literal["ok", "fallback"] = "ok"


class ResolveRethemeUseCase:
    """Orchestrate the one-shot NL re-theme resolution + validate its output.

    Collaborators (accepted via constructor; resolver typed as Any to keep
    the module infra-free, mirroring GenerateUiSpecUseCase's
    quarantine/generator params):
        resolver: RethemeResolverPort — ONE Bedrock forced tool-use call.
        is_known_pack_id: Callable[[str], bool] — the T-17-04-style pack-id
            spoofing guard, injected rather than imported (see module
            docstring) so this module stays lint-imports-clean.
        default_pack_id: str — the baseline pack id to fall back to when the
            caller supplied no current_style_pack_id (mirrors DEFAULT_PACK_ID).

    Never raises (best-effort, mirrors GenerateUiSpecUseCase's contract).
    """

    def __init__(
        self,
        *,
        resolver: Any,
        is_known_pack_id: Callable[[str], bool],
        default_pack_id: str,
    ) -> None:
        self._resolver = resolver
        self._is_known_pack_id = is_known_pack_id
        self._default_pack_id = default_pack_id

    async def execute(
        self,
        *,
        instruction: str,
        current_style_pack_id: str | None,
    ) -> ResolveRethemeResult:
        """Resolve instruction -> a validated {style_pack_id, token_overrides, outcome}.

        Args:
            instruction: Free-text NL instruction. Length is bounded by the
                presentation-layer request model (1..280); this use case does
                not re-check length — it treats the string as opaque content.
            current_style_pack_id: The panel's current active pack id, used
                as both resolver context and the fallback target.

        Returns:
            ResolveRethemeResult. Never raises.
        """
        fallback_pack_id = current_style_pack_id or self._default_pack_id
        log = logger.bind(current_style_pack_id=current_style_pack_id)

        try:
            resolution = await self._resolver.resolve(
                instruction=instruction,
                current_style_pack_id=current_style_pack_id,
            )
        except Exception:
            log.warning("retheme_resolve_failed", exc_info=True)
            return ResolveRethemeResult(
                style_pack_id=fallback_pack_id,
                token_overrides={},
                outcome="fallback",
            )

        outcome: Literal["ok", "fallback"] = "ok"
        style_pack_id = resolution.style_pack_id
        if not self._is_known_pack_id(style_pack_id):
            log.warning("retheme_unknown_pack_id", resolved_pack_id=style_pack_id)
            style_pack_id = fallback_pack_id
            outcome = "fallback"

        token_overrides = {
            key: value for key, value in resolution.token_overrides.items() if key in ALLOWED_OVERRIDE_KEYS
        }
        if len(token_overrides) != len(resolution.token_overrides):
            log.info(
                "retheme_dropped_disallowed_override_keys",
                dropped_count=len(resolution.token_overrides) - len(token_overrides),
            )

        log.info("retheme_resolved", style_pack_id=style_pack_id, outcome=outcome)
        return ResolveRethemeResult(
            style_pack_id=style_pack_id,
            token_overrides=token_overrides,
            outcome=outcome,
        )
