"""RethemeResolverPort — domain seam for PANL-04's one-shot NL re-theme resolution.

Architecture contract (lint-imports):
  Imports ONLY stdlib and typing. No infrastructure imports permitted here —
  the domain layer must remain infra-free (mirrors retrieval_provider.py).

Implementation ships in app/infrastructure/llm/genui_retheme_adapter.py:
  GenuiRethemeAdapter — AsyncAnthropicBedrock forced tool-use, ONE call, no
  repair loop, no screenshot judging (locked, 52-05-PLAN.md / 52-CONTEXT.md).

ALLOWED_OVERRIDE_KEYS is the domain-level bound on what a re-theme resolution
may touch — a small, presentational, CSS-variable-name allow-list (mirrors
PanelThemeScope's applied vars, Plan 52-01). Both the application-layer use
case (key filtering) and the infrastructure-layer adapter (forced tool-use
input_schema) import this SAME tuple so the allow-list is defined exactly
once (T-52-05-02). The tRPC web boundary (packages/api-client/src/router/
genui/retheme.ts) defines its OWN copy for the TS side — the two are kept in
sync by review, mirroring the existing STYLE_PACK_IDS Python/TS parity
convention (genui_style_packs.py's own docstring).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

# ---------------------------------------------------------------------------
# ALLOWED_OVERRIDE_KEYS (T-52-05-02) — bounded, presentational CSS-var names.
# PanelThemeScope (Plan 52-01) applies each as an inline `--{key}` custom
# property; nothing outside this set may ever reach a rendered panel.
# ---------------------------------------------------------------------------

ALLOWED_OVERRIDE_KEYS: tuple[str, ...] = (
    "primary",
    "accent",
    "secondary",
    "radius",
    "spacing-density",
)


@dataclass(frozen=True)
class RethemeResolution:
    """Immutable {style_pack_id, token_overrides} envelope from ONE resolver call.

    style_pack_id: the resolver's chosen best-fit pack id. NOT guaranteed to
        be a known STYLE_PACK_IDS member — the resolver is an untrusted LLM
        output source; ResolveRethemeUseCase (application layer) is the belt
        that validates it (T-52-05-01). The tRPC web boundary is the
        AUTHORITATIVE gate (GEN-03/D-08).
    token_overrides: raw key/value pairs proposed by the resolver. NOT
        guaranteed to respect ALLOWED_OVERRIDE_KEYS or any value format — same
        untrusted-output caveat as style_pack_id.
    """

    style_pack_id: str
    token_overrides: dict[str, str]


@runtime_checkable
class RethemeResolverPort(Protocol):
    """Port for one-shot NL-instruction -> {style_pack_id, token_overrides} resolution.

    Contract (52-05-PLAN.md, locked): ONE forced-tool-use call, no repair
    loop, no screenshot judging. Implementations MAY raise on transport/
    timeout/malformed-output errors — ResolveRethemeUseCase (the sole caller)
    catches any exception and degrades to a fallback result carrying the
    unchanged current pack + empty overrides (never partial, never raises
    past the use case boundary).
    """

    async def resolve(
        self,
        *,
        instruction: str,
        current_style_pack_id: str | None,
    ) -> RethemeResolution:
        """Resolve a free-text re-theme instruction to a pack + bounded token nudges.

        Args:
            instruction: Free-text NL instruction (e.g. "make it more playful").
            current_style_pack_id: The panel's current active pack id, or None
                when the panel has never been re-packed (base spec default).

        Returns:
            RethemeResolution — see class docstring for the untrusted-output
            caveat on both fields.

        Raises:
            Exception: on any transport/timeout/malformed-output failure. The
                caller (ResolveRethemeUseCase) is solely responsible for
                catching and degrading to a fallback.
        """
        ...
