---
phase: 25-anticipatory-prompting-spike
verified: 2026-07-06T00:00:00Z
status: passed
score: 20/20 must-haves verified
overrides_applied: 0
---

# Phase 25: Anticipatory Prompting (SPIKE) Verification Report

**Phase Goal:** Determine, via a scoped spike, whether a trigger/heuristic layer can safely
propose proactive prompts from chat+canvas state — gated hard enough that it never becomes
trust-destroying.
**Verified:** 2026-07-06
**Status:** passed
**Re-verification:** No — initial verification

## Note on SPIKE posture

This phase's exit criterion (SC3 / D-03) is a **documented go/no-go decision** in
`25-SPIKE-FINDINGS.md`, not shipped/on-by-default production code. Per 25-CONTEXT.md
D-01/D-11/D-12, the pipeline is intentionally real-but-dark: `ANTICIPATORY_PROMPTING_ENABLED`
defaults to `False`, nothing auto-fires, and observation is fixture-driven, not live. This is
the CORRECT posture for a spike and is not treated as a gap anywhere in this report. The
in-memory cap store, stubbed judge, and absence of live web wiring are documented,
planner-approved seams (D-14, seams #1–5 in the findings doc), not unintentional stubs.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (SC1) A trigger/heuristic layer observing chat+canvas state can propose a candidate proactive prompt | VERIFIED | `app/domain/anticipatory/triggers.py` — 3 pure functions (`detect_idle_after_genui`, `detect_completed_artifact`, `detect_ambiguous_intent`) read an `AnticipatoryStateSnapshot` and return `AnticipatoryCandidate \| None`. `run_triggers()` collects non-None candidates. Verified by running `test_triggers.py` (11/11 passed) — each of the 3 fixtures fires exactly one matching trigger and no cross-firing occurs. |
| 2 | (SC2) Every candidate is filtered by an appropriateness eval AND a hard frequency cap (independent checks) before it reaches the user, nothing fires without explicit acceptance | VERIFIED | `evaluate_anticipatory_candidates.py`'s `EvaluateAnticipatoryCandidates.evaluate()` runs cap-check (gate #2) then judge-score (gate #1); both must pass for `shown`. Independently re-ran the harness's `test_build_spike_outcome_matrix_matches_expected_and_prints_evidence` myself — matrix output matched SPIKE-FINDINGS.md's evidence table verbatim (score=0.9+empty cap→shown; score=0.9+capped→suppressed_by_cap; score=0.3+empty cap→suppressed_by_eval; flag off→none, for all 3 fixtures). A `shown` candidate maps via `to_proposal_card_declaration()` to the unchanged Phase-24 `derive_declared_response_schema("proposal_cards", ...)` shape — verified this round-trips (schema `required=["optionId"]`, `additionalProperties=False`, single enum option). |
| 3 | (SC3) The SPIKE concludes with an explicit go/no-go recommendation (documented decision, not shipped guarantee) | VERIFIED | `.planning/phases/25-anticipatory-prompting-spike/25-SPIKE-FINDINGS.md` — `## Verdict` section states `ship-with-conditions`, followed by justification, an evidence table transcribing the actual harness output, a numbered list of 7 named seams, risks/open-questions with documented tuning rationale, and an honest "what this spike did NOT prove" section. No fenced code blocks (prose+tables only, per plan's structural acceptance criteria). |
| 4 | With `ANTICIPATORY_PROMPTING_ENABLED` OFF (default), the trigger layer produces zero candidates (D-12) | VERIFIED | `settings.py` line 161: `ANTICIPATORY_PROMPTING_ENABLED: bool = False`. `triggers.py`'s `run_triggers()`: `if not enabled: return []` is the first statement. Confirmed via grep + passing test. |
| 5 | Given the idle-after-genui snapshot, the idle trigger emits exactly one `AnticipatoryCandidate` | VERIFIED | `test_triggers.py` passing; independently re-read `detect_idle_after_genui` — fires on `completed` run_event with `emitted_part_type` in `{genui_spec, interactive_widget}` AND idle time ≥ threshold. |
| 6 | Given the completed-artifact snapshot, the trigger emits a next-best-action candidate | VERIFIED | `detect_completed_artifact` fires on a `settled` panel with `next_best_action`; harness matrix shows `completed_artifact` fixture → "Want me to export this table as a CSV?" candidate. |
| 7 | Given the ambiguous-intent snapshot, the trigger emits a clarifying candidate | VERIFIED | `detect_ambiguous_intent` fires on short/vague `last_user_text` (no LLM, deterministic frozen phrase set + token-count floor). Harness matrix confirms candidate text. |
| 8 | Triggers never mutate the input snapshot (read-only, D-06) | VERIFIED | `AnticipatoryStateSnapshot` is `@dataclass(frozen=True)` with every collection typed `tuple[...]`, never `list[...]` — confirmed by reading `candidate.py`. `test_triggers.py` asserts snapshot equality before/after `run_triggers`. |
| 9 | A candidate is SHOWN only if it passes BOTH the eval AND the cap — independent, neither substitutes (D-08) | VERIFIED | `evaluate()`: cap-check first (can only DENY, never approve on eval's behalf per `anticipatory_ports.py` docstring), then judge-score; both branches append a distinct suppression event and `continue`; only the fall-through path appends `shown`. Harness "independence" test (`test_gate_chain_matrix_outcome` parametrized across scenarios A/B/C) proves the SAME candidate resolves to all three outcomes purely as a function of (score, cap) — ran this myself, all green. |
| 10 | A candidate whose score would pass is still `suppressed_by_cap` when window/day limit exceeded (D-10) | VERIFIED | Harness scenario B (score=0.9, cap seeded at window limit) → `suppressed_by_cap` confirmed by my own harness run's printed matrix. `_check_cap()` enforces both `cap_per_window` and `cap_per_day` independently. |
| 11 | A candidate with cap room but below-threshold score is `suppressed_by_eval` (D-07) | VERIFIED | Harness scenario C (score=0.3 < 0.75 threshold, empty cap) → `suppressed_by_eval` confirmed by my own run. |
| 12 | A shown candidate maps to a Phase-24 proposal-card declaration requiring explicit acceptance — nothing auto-fires (D-11) | VERIFIED | `to_proposal_card_declaration()` produces `{"options": [{"id": "opt-0", ...}], "prompt": ...}`; round-trips through UNCHANGED `run_chat_turn_widgets.derive_declared_response_schema`. Confirmed: no phase-25 commit touched `run_chat_turn_widgets.py`, `apps/web`, or `packages/genui` (git log check). Phase-24 regression tests (`test_run_chat_turn_interactive_widget.py`, `test_submit_widget_interaction.py`) still 14/14 green. |
| 13 | Every candidate's lifecycle is recorded as ordered proposed → (suppressed_by_eval\|suppressed_by_cap\|shown) → (accepted\|dismissed) events (D-13) | VERIFIED | `evaluate()` appends a `proposed` event before every gate check, then exactly one of the three terminal events; `record_candidate_outcome()` appends `accepted`/`dismissed`. Confirmed via structlog output captured in my own harness run (`anticipatory_lifecycle` events printed for every candidate). |
| 14 | With flag OFF, the pipeline evaluates nothing, calls no judge, records nothing (D-12) | VERIFIED | `evaluate()`: `if not enabled: return _EMPTY_RESULT` before `run_triggers` is even called. Harness's own `_ExplodingJudge`/`_ExplodingCapStore` doubles (raise `AssertionError` if ever invoked) pass under scenario D for all 3 fixtures — proves "OFF means OFF" is enforced by the test, not just inspection. |
| 15 | The dark pipeline is DI-constructible: `create_app()` boots with it registered, flag OFF (D-01) | VERIFIED | `container.py` registers `AppropriatenessJudge`, `AnticipatoryCapStore`, `EvaluateAnticipatoryCandidates` providers (grep-confirmed). Ran `test_anticipatory_pipeline_resolves_and_flag_defaults_off` myself — 1/1 passed, asserting `get_settings().ANTICIPATORY_PROMPTING_ENABLED is False`. |
| 16 | The full pipeline runs deterministically over all 3 fixtures and produces a reproducible outcome matrix (D-02) | VERIFIED | Ran `test_build_spike_outcome_matrix_matches_expected_and_prints_evidence -s` myself; output matrix identical to the one transcribed in `25-SPIKE-FINDINGS.md`'s evidence table. |
| 17 | The matrix demonstrates every gate outcome: shown, suppressed_by_eval, suppressed_by_cap, flag-OFF-produces-nothing | VERIFIED | Confirmed in my own run's printed table — all 4 outcomes present across all 3 fixtures. |
| 18 | `25-SPIKE-FINDINGS.md` states one explicit go/no-go verdict grounded in evidence (D-03) | VERIFIED | `## Verdict` → `ship-with-conditions`, single token, grounded justification citing the mechanism's suppression bias and independence proof. |
| 19 | The findings enumerate the named seams a shippable feature would require | VERIFIED | `## Seams a shippable feature needs` — 7 numbered items (exceeds the plan's minimum of 5): live-Bedrock scoring, durable cap/lifecycle persistence, live observation adapter, live web wiring, dismissal-cooldown durability, cross-conversation context, learned/ML triggers. |
| 20 | The harness test asserts the fixture × scenario matrix deterministically with no live Bedrock call | VERIFIED | `test_anticipatory_spike_harness.py` imports only `app.application.*`, `app.domain.*` — no `anthropic`/`AsyncAnthropicBedrock`/`boto3` import anywhere in the file (grep-confirmed). `uv run lint-imports` reports 3 contracts kept, 0 broken. |

**Score:** 20/20 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/email-listener/app/domain/anticipatory/candidate.py` | Frozen contracts (D-05/D-06/D-13) | VERIFIED | 4 frozen dataclasses + 2 Literals, tuple-only collections, `__all__` present, zero infra imports. |
| `apps/email-listener/app/domain/anticipatory/triggers.py` | 3 deterministic triggers + flag-gated `run_triggers` | VERIFIED | `if not enabled` short-circuit present; 3 pure trigger functions; `TRIGGERS` tuple; domain-pure. |
| `apps/email-listener/app/domain/anticipatory/fixtures.py` | 3 scripted snapshot builders | VERIFIED | `idle_after_genui_snapshot`, `completed_artifact_snapshot`, `ambiguous_intent_snapshot` present and importable, used directly by the harness. |
| `apps/email-listener/app/settings.py` | Feature flag + 8 tunables | VERIFIED | `ANTICIPATORY_PROMPTING_ENABLED: bool = False` (1 match); 7 additional documented tunables. |
| `apps/email-listener/app/domain/ports/anticipatory_ports.py` | 2 independent gate Protocols | VERIFIED | `AppropriatenessJudge`, `AnticipatoryCapStore` Protocols + `AppropriatenessScore`/`CapDecision` frozen results. |
| `apps/email-listener/app/infrastructure/llm/anticipatory_judge_adapter.py` | Bedrock Haiku fail-toward-suppress judge | VERIFIED | `BedrockAppropriatenessJudgeAdapter` — bare `except Exception` returns `_SUPPRESS_ON_ERROR = AppropriatenessScore(score=0.0, ...)`; input_schema is Bedrock-valid (`type:object`, `additionalProperties:false`, no root `$ref`). |
| `apps/email-listener/app/infrastructure/anticipatory/in_memory_cap_store.py` | D-14 no-table cap adapter | VERIFIED | `InMemoryAnticipatoryCapStore` — dict-based, `count_shown`/`record_shown`/`seed` present. |
| `apps/email-listener/app/application/use_cases/evaluate_anticipatory_candidates.py` | Gate-chain use case | VERIFIED | `EvaluateAnticipatoryCandidates`, `to_proposal_card_declaration`, `record_candidate_outcome`, `AnticipatoryPipelineResult` all present and match documented D-08/D-10/D-11/D-13 behavior exactly. |
| `apps/email-listener/app/application/use_cases/__tests__/test_anticipatory_spike_harness.py` | Deterministic evidence-matrix harness | VERIFIED | `build_spike_outcome_matrix()` present; 16 tests, all passing when I ran them; no live Bedrock import. |
| `.planning/phases/25-anticipatory-prompting-spike/25-SPIKE-FINDINGS.md` | Go/no-go deliverable | VERIFIED | `## Verdict` = `ship-with-conditions`; evidence table matches harness output verbatim; 7 named seams. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `triggers.py` | `ANTICIPATORY_PROMPTING_ENABLED` | `run_triggers` short-circuits to `[]` when disabled | WIRED | `if not enabled: return []` confirmed as first statement. |
| `fixtures.py` | `triggers.py` | each fixture drives exactly one trigger | WIRED | Confirmed via passing `test_triggers.py` + harness matrix (one candidate per fixture). |
| `evaluate_anticipatory_candidates.py` | `anticipatory_ports.py` | depends on both `AppropriatenessJudge` and `AnticipatoryCapStore` (independent) | WIRED | Constructor takes both ports; gate-chain calls both; independence test passing. |
| `evaluate_anticipatory_candidates.py` | `run_chat_turn_widgets` declaration shape | `to_proposal_card_declaration` → `derive_declared_response_schema("proposal_cards", ...)` | WIRED | Confirmed round-trip in harness test — schema derivation succeeds unmodified. |
| `container.py` | `EvaluateAnticipatoryCandidates` | Dishka provider registers the pipeline; `create_app()` boots | WIRED | Grepped registrations; ran the boot-smoke test myself (1/1 passed). |
| `test_anticipatory_spike_harness.py` | `evaluate_anticipatory_candidates.py` | harness drives the REAL `EvaluateAnticipatoryCandidates` | WIRED | Confirmed via import + my own execution of the harness, producing the exact matrix cited in the findings doc. |
| `25-SPIKE-FINDINGS.md` | harness outcome matrix | verdict cites the exact per-fixture outcome counts | WIRED | My independent harness run reproduced the identical matrix transcribed in the findings doc. |

### Live Turn Loop (dark-by-design, confirmed NOT wired — this is correct per D-01/D-12)

Grepped `run_chat_turn.py` and `run_chat_turn_widgets.py` for any `Anticipatory`/`anticipatory` reference — none found. Confirmed via `git log` that no Phase-25 commit touched `apps/web/**` or `packages/genui/**`; the last commits to those paths are Phase-24 work. This is the intended spike posture (real pipeline, DI-registered, never invoked from the live loop) and is explicitly called out as Seam #4 ("live web wiring... is unbuilt") in the findings doc — not a gap.

### Behavioral Spot-Checks (independently executed by this verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All anticipatory-package tests pass | `uv run pytest app/domain/anticipatory app/application/use_cases/__tests__/test_evaluate_anticipatory_candidates.py app/application/use_cases/__tests__/test_anticipatory_spike_harness.py app/infrastructure/llm/__tests__/test_anticipatory_judge_adapter.py --no-cov -v` | 57 passed in 5.48s | PASS |
| Harness matrix reproduces exactly what SPIKE-FINDINGS.md claims | `pytest ...test_build_spike_outcome_matrix_matches_expected_and_prints_evidence -s` | Matrix: shown / suppressed_by_cap / suppressed_by_eval / none — identical across all 3 fixtures, matching the findings table verbatim | PASS |
| Import-linter contracts hold (no cross-layer violations) | `uv run lint-imports` | "Contracts: 3 kept, 0 broken" (213 files, 902 deps) | PASS |
| Ruff clean on all phase-25 files | `uv run ruff check <phase-25 files>` | "All checks passed!" | PASS |
| Phase-24 explicit-accept surface has zero regressions | `pytest test_run_chat_turn_interactive_widget.py test_submit_widget_interaction.py --no-cov` | 14 passed | PASS |
| DI boot-smoke test (flag OFF, pipeline resolvable) | `pytest test_anticipatory_pipeline_resolves_and_flag_defaults_off` | 1 passed | PASS |
| `spec-renderer.tsx` untouched throughout the phase | `git log -1 --format="%H" -- packages/genui/src/renderer/spec-renderer.tsx` | `ecc7a46c799f22d749d6c3bd11fc488a585b8c8a` (Phase 19, before Phase 25 started) | PASS — matches expected commit |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-25 files | `grep -rn` across all created/modified anticipatory files | No matches | PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` convention; the pytest harness itself serves as the deterministic probe and was executed directly above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|--------------|--------|----------|
| ANTIC-01 | 25-01-PLAN.md | Trigger/heuristic layer over chat+canvas state proposes proactive prompts | SATISFIED | `triggers.py` + `candidate.py` + `fixtures.py`; 20/20 fixture/trigger tests passing. |
| ANTIC-02 | 25-02-PLAN.md, 25-03-PLAN.md | Proactive prompts gated by an appropriateness eval + a hard frequency cap (independent), always requiring explicit user acceptance | SATISFIED | `evaluate_anticipatory_candidates.py` gate chain + `anticipatory_judge_adapter.py` + `in_memory_cap_store.py`; independence proven by harness; explicit-accept via unchanged Phase-24 proposal card. |

No orphaned requirements found — REQUIREMENTS.md lists only ANTIC-01/ANTIC-02 for Phase 25, both claimed by the plans and both satisfied.

### Anti-Patterns Found

None. Grepped all phase-25-created/modified files for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` — zero matches. The intentional "spike shims" (in-memory cap store, stub judge, no live observation adapter) are documented as named seams in `25-SPIKE-FINDINGS.md`, not silent stubs — this is the correct spike posture, not an anti-pattern.

### Human Verification Required

None required to reach a `passed` verdict. Per this phase's own design (D-02/D-09/EVAL-LIFT convention), a live-Bedrock appropriateness-scoring pass is an intentionally deferred seam (Seam #1 in `25-SPIKE-FINDINGS.md`) — it is not a must-have for this SPIKE's exit criterion, which is a documented go/no-go recommendation, not a shipped guarantee. If the project later wants a single live-Bedrock confirmation of `BedrockAppropriatenessJudgeAdapter`'s real scoring behavior (as opposed to its unit-tested schema/parsing/fail-toward-suppress contract, which IS verified), that would be a reasonable optional follow-up check before flipping the flag on for real traffic — but it does not gate this phase's verification.

### Gaps Summary

No gaps. All three ROADMAP success criteria are independently verified against running code and tests, not SUMMARY.md claims:

- SC1 (trigger layer proposes candidates): verified by reading `triggers.py`/`candidate.py` and independently running the trigger + fixture test suite.
- SC2 (independent appropriateness eval + frequency cap, explicit-accept only): verified by reading `evaluate_anticipatory_candidates.py`/`anticipatory_ports.py`/the judge adapter/the cap store, and by independently re-running the harness's evidence-matrix test, whose output matched `25-SPIKE-FINDINGS.md`'s evidence table verbatim.
- SC3 (documented go/no-go): verified by reading `25-SPIKE-FINDINGS.md` directly — contains exactly one verdict token (`ship-with-conditions`), a dated evidence table, 7 named seams, risks/open-questions with tuning rationale, and an honest "what this spike did NOT prove" section.

The dark-by-default posture (flag OFF, in-memory cap store, no live web wiring) was confirmed to be exactly what the phase intended (D-01/D-11/D-12) and is not counted as a gap.

---

*Verified: 2026-07-06*
*Verifier: Claude (gsd-verifier)*
