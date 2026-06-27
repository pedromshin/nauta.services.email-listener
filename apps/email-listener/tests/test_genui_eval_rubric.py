"""Unit tests for scripts/genui_eval/rubric.py — pure deterministic rubric.

All tests are marked @pytest.mark.unit and operate on fixed in-memory specs.
No Bedrock, no Supabase, no filesystem dependencies.

RED phase: these tests are written before the implementation exists.
They must fail until rubric.py is created (GREEN phase).
"""

from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# Fixtures: in-memory spec shapes
# ---------------------------------------------------------------------------

GOOD_COMPOSED_SPEC = {
    "v": 1,
    "root": {
        "type": "stack",
        "children": [
            {
                "type": "card",
                "children": [
                    {"type": "text", "value": "Invoice #001"},
                    {"type": "badge", "label": "Paid"},
                    {"type": "button", "label": "Download", "aria-label": "Download invoice"},
                ],
            },
            {
                "type": "grid",
                "children": [
                    {
                        "type": "key-value-list",
                        "label": "Details",
                        "items": [{"key": "Amount", "value": "$100"}],
                    },
                    {
                        "type": "table",
                        "caption": "Line items",
                        "columns": ["Item", "Price"],
                        "rows": [["Widget", "$100"]],
                    },
                ],
            },
        ],
    },
}

# SAFE_FALLBACK_SPEC equivalent — alert with default fallback text
FALLBACK_SPEC = {
    "v": 1,
    "root": {
        "type": "alert",
        "title": "Unable to generate a view for this request",
    },
}

PLACEHOLDER_SPEC = {
    "v": 1,
    "root": {
        "type": "stack",
        "children": [
            {"type": "text", "value": "this is a placeholder"},
            {"type": "text", "value": "Real content goes here"},
        ],
    },
}

BUTTON_NO_ARIA_SPEC = {
    "v": 1,
    "root": {
        "type": "stack",
        "children": [
            {"type": "button", "label": "Submit"},  # missing aria-label
            {"type": "text", "value": "Hello"},
        ],
    },
}

SHALLOW_SPEC = {
    "v": 1,
    "root": {
        "type": "stack",
        "children": [
            {"type": "text", "value": "A"},
            {"type": "text", "value": "B"},
        ],
    },
}


# ---------------------------------------------------------------------------
# Import rubric — this will NameError/ImportError on RED run
# ---------------------------------------------------------------------------

from scripts.genui_eval.rubric import (  # noqa: E402
    CriterionResult,
    WEIGHTS,
    aggregate,
    a11y,
    composed_not_placeholder,
    valid_spec,
)


# ---------------------------------------------------------------------------
# CriterionResult — basic shape
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_criterion_result_is_frozen() -> None:
    """CriterionResult must be a frozen dataclass (immutable)."""
    result = CriterionResult(name="test", score=1.0, passed=True)
    with pytest.raises((AttributeError, TypeError)):
        result.score = 0.0  # type: ignore[misc]


@pytest.mark.unit
def test_criterion_result_fields() -> None:
    """CriterionResult must expose name, score, passed."""
    r = CriterionResult(name="valid-spec", score=1.0, passed=True)
    assert r.name == "valid-spec"
    assert r.score == 1.0
    assert r.passed is True


# ---------------------------------------------------------------------------
# WEIGHTS constant
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_weights_keys() -> None:
    """WEIGHTS must contain the 4 canonical criterion keys."""
    assert set(WEIGHTS.keys()) == {"valid-spec", "composed", "on-intent", "a11y"}


@pytest.mark.unit
def test_weights_sum_to_one() -> None:
    """WEIGHTS values must sum to exactly 1.0."""
    total = sum(WEIGHTS.values())
    assert abs(total - 1.0) < 1e-9


# ---------------------------------------------------------------------------
# valid_spec criterion
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_valid_spec_passes_for_good_spec() -> None:
    """A well-formed spec with v=1 and valid root node passes valid-spec."""
    result = valid_spec(GOOD_COMPOSED_SPEC, outcome="ok")
    assert result.passed is True
    assert result.score == 1.0


@pytest.mark.unit
def test_valid_spec_fails_for_fallback_spec() -> None:
    """SAFE_FALLBACK_SPEC is a valid spec shape but outcome=escalated or is_fallback
    should make valid-spec return score=0.0 to penalise the failure."""
    result = valid_spec(FALLBACK_SPEC, outcome="escalated")
    assert result.passed is False
    assert result.score == 0.0


@pytest.mark.unit
def test_valid_spec_fails_for_missing_v() -> None:
    """A spec without 'v' field fails schema validation."""
    bad = {"root": {"type": "text", "value": "hi"}}
    result = valid_spec(bad, outcome="ok")
    assert result.passed is False
    assert result.score == 0.0


@pytest.mark.unit
def test_valid_spec_passes_for_ok_outcome() -> None:
    """outcome='ok' + valid schema -> passes."""
    result = valid_spec(GOOD_COMPOSED_SPEC, outcome="ok")
    assert result.passed is True


@pytest.mark.unit
def test_valid_spec_fails_for_fallback_outcome() -> None:
    """outcome='fallback' should mark valid-spec as failed regardless of spec shape."""
    result = valid_spec(FALLBACK_SPEC, outcome="fallback")
    assert result.passed is False
    assert result.score == 0.0


# ---------------------------------------------------------------------------
# composed_not_placeholder criterion
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_composed_passes_for_good_spec() -> None:
    """A rich spec (many nodes, varied types, nested layout) passes composed."""
    result = composed_not_placeholder(GOOD_COMPOSED_SPEC)
    assert result.passed is True
    assert result.score == 1.0


@pytest.mark.unit
def test_composed_fails_for_placeholder_text() -> None:
    """A spec containing a no-placeholder phrase scores 0.0 on composed."""
    result = composed_not_placeholder(PLACEHOLDER_SPEC)
    assert result.passed is False
    assert result.score == 0.0


@pytest.mark.unit
def test_composed_fails_for_shallow_spec() -> None:
    """A flat spec (only 3 nodes, 1 type variation, depth 1) fails composed."""
    result = composed_not_placeholder(SHALLOW_SPEC)
    assert result.passed is False


@pytest.mark.unit
def test_composed_fails_for_fallback_spec() -> None:
    """SAFE_FALLBACK_SPEC is a single-node spec; it must fail composed."""
    result = composed_not_placeholder(FALLBACK_SPEC)
    assert result.passed is False
    assert result.score == 0.0


# ---------------------------------------------------------------------------
# a11y criterion
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_a11y_passes_for_good_spec() -> None:
    """GOOD_COMPOSED_SPEC has aria-labels on buttons, captions on tables, labels on kv-lists."""
    result = a11y(GOOD_COMPOSED_SPEC)
    assert result.passed is True
    assert result.score == 1.0


@pytest.mark.unit
def test_a11y_fails_for_button_without_aria_label() -> None:
    """A button missing aria-label fails a11y with score < 1.0."""
    result = a11y(BUTTON_NO_ARIA_SPEC)
    assert result.passed is False
    assert result.score < 1.0


@pytest.mark.unit
def test_a11y_passes_for_no_interactive_nodes() -> None:
    """A spec with no buttons/alerts/tables/kv-lists has nothing to check; score=1.0."""
    simple_spec = {
        "v": 1,
        "root": {"type": "text", "value": "Hello"},
    }
    result = a11y(simple_spec)
    assert result.passed is True
    assert result.score == 1.0


# ---------------------------------------------------------------------------
# aggregate function
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_aggregate_with_all_scores() -> None:
    """aggregate() returns weighted mean of all 4 criteria."""
    sub_scores = [
        CriterionResult(name="valid-spec", score=1.0, passed=True),
        CriterionResult(name="composed", score=1.0, passed=True),
        CriterionResult(name="on-intent", score=0.8, passed=True),
        CriterionResult(name="a11y", score=1.0, passed=True),
    ]
    score = aggregate(sub_scores)
    # 1.0*0.30 + 1.0*0.30 + 0.8*0.25 + 1.0*0.15 = 0.95
    assert abs(score - 0.95) < 1e-6


@pytest.mark.unit
def test_aggregate_renormalizes_without_on_intent() -> None:
    """When on-intent score is None (omitted), aggregate renormalizes remaining weights."""
    sub_scores = [
        CriterionResult(name="valid-spec", score=1.0, passed=True),
        CriterionResult(name="composed", score=0.0, passed=False),
        CriterionResult(name="a11y", score=1.0, passed=True),
    ]
    score = aggregate(sub_scores)
    # Remaining weights: valid-spec=0.30, composed=0.30, a11y=0.15 (sum=0.75)
    # Renormalized: valid-spec=0.30/0.75=0.4, composed=0/0.75=0, a11y=0.15/0.75=0.2
    # score = 1.0*0.4 + 0.0*0.4 + 1.0*0.2 = 0.6
    assert 0.0 <= score <= 1.0


@pytest.mark.unit
def test_aggregate_returns_zero_for_all_fail() -> None:
    """aggregate() returns 0.0 when all criteria score 0.0."""
    sub_scores = [
        CriterionResult(name="valid-spec", score=0.0, passed=False),
        CriterionResult(name="composed", score=0.0, passed=False),
        CriterionResult(name="on-intent", score=0.0, passed=False),
        CriterionResult(name="a11y", score=0.0, passed=False),
    ]
    score = aggregate(sub_scores)
    assert score == 0.0


@pytest.mark.unit
def test_aggregate_returns_one_for_all_pass() -> None:
    """aggregate() returns 1.0 when all criteria score 1.0."""
    sub_scores = [
        CriterionResult(name="valid-spec", score=1.0, passed=True),
        CriterionResult(name="composed", score=1.0, passed=True),
        CriterionResult(name="on-intent", score=1.0, passed=True),
        CriterionResult(name="a11y", score=1.0, passed=True),
    ]
    score = aggregate(sub_scores)
    assert abs(score - 1.0) < 1e-6
