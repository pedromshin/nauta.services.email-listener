"""GenUI eval runner — executes the golden-set against the production pipeline.

Usage:
    uv run python -m scripts.genui_eval.run_eval [OPTIONS]

Options:
    --out PATH          Directory to write JSON + MD reports (default: scripts/genui_eval/reports/)
    --limit N           Run only the first N prompts (default: all)
    --no-judge          Skip the LLM-as-judge step (on-intent score will be None)
    --label TEXT        Human-readable label for the report (default: 'eval')

Design contracts (D-05, D-11, D-12, D-13):
    - Drives the REAL GenerateUiSpecUseCase (same production pipeline)
    - Intent-only mode: raw_content="" (isolates intent->UI quality)
    - Concurrency cap: asyncio.Semaphore(3) (avoid hammering Bedrock quota)
    - Per-prompt try/except: one prompt failure does not abort the run
    - Coverage scope fence: scripts/ is outside --cov=app; no 80% gate impact
    - No eval/exec/compile (D-24)

This module is NOT imported by any app code. It is a standalone script.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Golden-set path resolution
# ---------------------------------------------------------------------------

# The golden-set lives in packages/genui/src/eval/golden-set.json, relative
# to the repo root.  We resolve from this file's location.
_REPO_ROOT = Path(__file__).parent.parent.parent.parent.parent  # apps/email-listener/scripts/genui_eval -> repo root
_GOLDEN_SET_PATH = _REPO_ROOT / "packages" / "genui" / "src" / "eval" / "golden-set.json"

# Concurrency cap: avoid hammering Bedrock quota
_CONCURRENCY = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load_golden_set(limit: int | None = None) -> list[dict[str, Any]]:
    """Load and return golden-set prompts, optionally limited to first N."""
    raw = json.loads(_GOLDEN_SET_PATH.read_text(encoding="utf-8"))
    items: list[dict[str, Any]] = raw if isinstance(raw, list) else []
    if limit is not None and limit > 0:
        items = items[:limit]
    return items


def _get_registry_version() -> str:
    """Read the registry version from genui-prompt.json (used for audit)."""
    from app.infrastructure.llm.genui_artifacts import load_prompt_payload  # noqa: PLC0415

    payload = load_prompt_payload()
    rv = payload.get("registryVersion", {})
    return str(rv.get("version", "unknown"))


# ---------------------------------------------------------------------------
# Per-prompt evaluation
# ---------------------------------------------------------------------------


async def _eval_prompt(
    *,
    entry: dict[str, Any],
    use_case: Any,
    judge: Any | None,
    semaphore: asyncio.Semaphore,
    registry_version: str,
) -> Any:
    """Evaluate a single golden-set prompt. Returns a PromptReport."""
    from scripts.genui_eval.report import PromptReport  # noqa: PLC0415
    from scripts.genui_eval.rubric import (  # noqa: PLC0415
        CriterionResult,
        a11y,
        aggregate,
        composed_not_placeholder,
        valid_spec,
    )

    prompt_id = str(entry.get("id", "?"))
    prompt = str(entry.get("prompt", ""))
    category = str(entry.get("category", ""))
    complexity = str(entry.get("complexity", ""))
    tier = str(entry.get("tier", ""))

    async with semaphore:
        try:
            result = await use_case.execute(
                intent=prompt,
                raw_content="",  # intent-only mode (D-05)
                registry_version=registry_version,
            )
            spec: dict[str, Any] = result.spec
            outcome = result.outcome

            # Deterministic criteria
            vs = valid_spec(spec, outcome=outcome)
            cp = composed_not_placeholder(spec)
            ay = a11y(spec)

            # Optional LLM-as-judge
            on_intent_score: float | None = None
            judge_rationale = ""
            if judge is not None:
                judge_result = await judge.score(intent=prompt, spec=spec)
                on_intent_score = judge_result.score
                judge_rationale = judge_result.rationale

            # Build sub_scores for aggregate
            sub_scores: list[CriterionResult] = [vs, cp, ay]
            if on_intent_score is not None:
                sub_scores.append(CriterionResult(name="on-intent", score=on_intent_score, passed=on_intent_score >= 0.5))

            overall = aggregate(sub_scores)

            return PromptReport(
                prompt_id=prompt_id,
                prompt=prompt,
                category=category,
                complexity=complexity,
                tier=tier,
                outcome=outcome,
                overall_score=overall,
                valid_spec_score=vs.score,
                composed_score=cp.score,
                on_intent_score=on_intent_score,
                a11y_score=ay.score,
                judge_rationale=judge_rationale,
                error=None,
            )

        except Exception as exc:
            logger.error("eval_prompt_failed", prompt_id=prompt_id, exc_info=True)
            return PromptReport(
                prompt_id=prompt_id,
                prompt=prompt,
                category=category,
                complexity=complexity,
                tier=tier,
                outcome="escalated",
                overall_score=0.0,
                valid_spec_score=0.0,
                composed_score=0.0,
                on_intent_score=None,
                a11y_score=0.0,
                judge_rationale="",
                error=str(exc),
            )


# ---------------------------------------------------------------------------
# Main async runner
# ---------------------------------------------------------------------------


async def run(
    *,
    limit: int | None = None,
    no_judge: bool = False,
    label: str = "eval",
    out_dir: Path | None = None,
) -> tuple[Path, Path]:
    """Execute the eval run and write reports.

    Args:
        limit: Max number of prompts to evaluate (None = all).
        no_judge: If True, skip the LLM-as-judge step.
        label: Human label for this report.
        out_dir: Output directory for reports (default: scripts/genui_eval/reports/).

    Returns:
        Tuple of (json_path, md_path) for the written report files.
    """
    from app.container import create_container  # noqa: PLC0415
    from app.settings import get_settings  # noqa: PLC0415
    from scripts.genui_eval.judge_adapter import JudgeAdapter  # noqa: PLC0415
    from scripts.genui_eval.report import build_report, write_report  # noqa: PLC0415

    settings = get_settings()
    golden_set = _load_golden_set(limit=limit)
    registry_version = _get_registry_version()

    container = create_container()
    try:
        from app.application.use_cases.generate_ui_spec import GenerateUiSpecUseCase  # noqa: PLC0415

        use_case = await container.get(GenerateUiSpecUseCase)

        # Judge: only create if not skipped
        judge: JudgeAdapter | None = None
        if not no_judge:
            from anthropic import AsyncAnthropicBedrock  # noqa: PLC0415, I001
            from app.infrastructure.llm.anthropic_client import get_anthropic_client  # noqa: PLC0415

            client: AsyncAnthropicBedrock = get_anthropic_client()
            judge = JudgeAdapter(
                client=client,
                model_id=settings.genui_escalation_model_id,
                timeout_seconds=settings.GENUI_TIMEOUT_SECONDS,
            )

        semaphore = asyncio.Semaphore(_CONCURRENCY)
        tasks = [
            _eval_prompt(
                entry=entry,
                use_case=use_case,
                judge=judge,
                semaphore=semaphore,
                registry_version=registry_version,
            )
            for entry in golden_set
        ]

        prompt_reports = await asyncio.gather(*tasks)

    finally:
        await container.close()

    report = build_report(
        label=label,
        model_id=settings.genui_model_id,
        prompt_reports=list(prompt_reports),
    )
    return write_report(report, out_dir=out_dir)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="GenUI eval runner")
    parser.add_argument("--out", type=Path, default=None, help="Output directory for reports")
    parser.add_argument("--limit", type=int, default=None, help="Max prompts to evaluate")
    parser.add_argument("--no-judge", action="store_true", help="Skip LLM-as-judge scoring")
    parser.add_argument("--label", type=str, default="eval", help="Label for this report")
    return parser.parse_args()


def main() -> None:
    """CLI entry point for the eval runner."""
    logging.basicConfig(level=logging.INFO)
    args = _parse_args()
    json_path, md_path = asyncio.run(
        run(
            limit=args.limit,
            no_judge=args.no_judge,
            label=args.label,
            out_dir=args.out,
        )
    )
    print(f"Report written:\n  JSON: {json_path}\n  MD:   {md_path}")


if __name__ == "__main__":
    main()
