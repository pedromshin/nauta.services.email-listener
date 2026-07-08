"""Monorepo-relative fixture path resolution for the EVAL-06/EVAL-07 bridge.

TEST-ONLY. Plan 35-02 (packages/genui/src/eval/) is the ONE committed source
of truth for the retrieval-golden-set.json / injection-fixtures.json
fixtures (35-CONTEXT.md: "one fixture source of truth, two runners"). This
module resolves that directory from THIS file's own path so the Python-side
tests in this package (tests/evals/) load the exact same JSON the TS eval
harness registered -- never a hand-copied duplicate.

Contrast with app/infrastructure/llm/genui_artifacts.py's production
GENUI_ARTIFACTS_DIR env-var-override pattern: that file is ALSO read inside
the deployed Docker image, which does not carry a full monorepo checkout, so
it needs an override. This module is test-only -- dev/CI always run from a
full monorepo checkout -- so no env-var-override branch is needed here.
"""

from __future__ import annotations

from pathlib import Path

_THIS_FILE = Path(__file__).resolve()


def eval_fixtures_dir() -> Path:
    """Resolve packages/genui/src/eval/ via a bounded monorepo-relative walk-up.

    This file lives at apps/email-listener/tests/evals/_paths.py -- depth 4
    to the repo root (tests/evals/, one shallower than
    app/infrastructure/llm/genui_artifacts.py's depth 5). Raises RuntimeError
    if the bound is exceeded or the resolved directory doesn't exist on disk.
    """
    parents = _THIS_FILE.parents
    if len(parents) > 4:
        candidate = parents[4] / "packages" / "genui" / "src" / "eval"
        if candidate.is_dir():
            return candidate
    raise RuntimeError(
        "Could not resolve packages/genui/src/eval from "
        f"{_THIS_FILE}. Expected apps/email-listener/tests/evals/_paths.py to sit "
        "at depth 4 below the monorepo root -- this resolver is test-only and "
        "assumes a full monorepo checkout (never runs inside the deployed container)."
    )
