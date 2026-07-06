# Phase 25: Anticipatory Prompting (SPIKE) - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — user directed "go full auto, I'll look when I wake up"; scoping decisions auto-selected from R3 research + this project's spike/eval conventions, documented here for review.

<domain>
## Phase Boundary

A SCOPED SPIKE to determine whether a trigger/heuristic layer can safely propose proactive prompts
from chat+canvas state — gated hard enough that it never becomes trust-destroying. Covers ANTIC-01
(a trigger/heuristic layer over chat+canvas state proposes proactive prompts) and ANTIC-02
(proactive prompts gated by an appropriateness eval + a hard frequency cap, always requiring
explicit user acceptance).

**Exit criterion is a DOCUMENTED go/no-go recommendation**, not a shipped guarantee. The spike
builds a real but OFF-by-default, flag-gated pipeline exercised against fixture chat+canvas states,
and concludes in a SPIKE-FINDINGS doc. Nothing auto-fires; the feature is dark by default.

Out of scope: shipping anticipatory prompting as an on-by-default feature; ML/learned trigger
models; live-Bedrock eval runs (deferred to connected-env per project convention); any new
user-facing widget surface (reuses Phase 24's proposal-card explicit-accept mechanism).

</domain>

<decisions>
## Implementation Decisions

### Spike scope & deliverable (auto-selected)
- **D-01: Real but dark prototype.** Build the actual trigger → appropriateness-eval → frequency-cap
  → explicit-accept pipeline as working code behind a feature flag defaulting OFF — not a paper
  study. A spike proves feasibility by running; a flag keeps it reversible and non-trust-destroying.
- **D-02: Fixture-driven exercise.** Drive the pipeline against a small set of scripted chat+canvas
  state fixtures (idle-after-genui, completed-artifact, ambiguous-intent), asserting the full
  gate chain deterministically in tests. Live-Bedrock eval scoring deferred to human/connected-env
  (matches EVAL-LIFT / ISO-RUN deferral convention).
- **D-03: Deliverable = SPIKE-FINDINGS.md with an explicit go/no-go.** The phase's real output is a
  documented recommendation (ship / don't-ship / ship-with-conditions) grounded in what the
  prototype revealed (false-positive rate against fixtures, cost, intrusiveness), plus the seams a
  real feature would need. Code is the evidence; the decision is the deliverable.

### Trigger / heuristic layer (auto-selected — ANTIC-01)
- **D-04: 2–3 deterministic triggers, no ML.** Observe EXISTING state only: Phase-22 run events +
  Phase-23 canvas store + Phase-24 widget-interaction state. Starter triggers: (a) idle after an
  assistant genui turn settles (user inactive ≥ threshold), (b) a completed artifact/panel with an
  obvious next-best-action, (c) detected underspecified/ambiguous last user intent. Each emits a
  CANDIDATE proposal, never a fired prompt.
- **D-05: A candidate is a structured proposal, not free text.** A trigger produces a typed
  `AnticipatoryCandidate` (trigger id + proposed prompt text + rationale + source-state refs) so
  every downstream gate and the persistence layer operate on one shape.
- **D-06: Observation is read-only + side-effect-free.** The trigger layer never mutates chat/canvas
  state; it only reads and proposes. This keeps the spike safe to run alongside the live chat loop.

### Appropriateness eval (auto-selected — ANTIC-02, gate #1)
- **D-07: LLM-judge appropriateness score, conservative threshold.** Each candidate is scored 0–1 by
  an appropriateness rubric (helpful now? non-intrusive? relevant to current context? not
  redundant with what the user is already doing?). Below a conservative threshold → suppressed.
  Bias hard toward NOT prompting — false-positive prompting is the documented primary risk.
- **D-08: Eval is INDEPENDENT of the frequency cap.** Two separate checks; a candidate must pass
  BOTH. The eval judges "is this appropriate at all"; the cap judges "have we prompted too much".
  Neither substitutes for the other (ANTIC-02 requires independent checks).
- **D-09: Cost-conservative judge.** Use the cheapest capable Bedrock model (Haiku) for the judge,
  mirroring the code-island judge posture (GENUI_CODE_JUDGE=Haiku). In the spike, judge calls run
  against fixtures with a stubbed/fake provider by default; a live pass is a documented deferral.

### Frequency cap & explicit user control (auto-selected — ANTIC-02, gate #2)
- **D-10: Hard multi-window cap.** At most 1 proactive prompt per conversation per short window
  (e.g. N minutes) AND a per-conversation daily ceiling. Cap state persists per conversation and
  survives reload. A candidate that would exceed either window is suppressed (independent of eval).
- **D-11: Explicit acceptance only — reuse Phase 24.** A surviving candidate is surfaced as a
  Phase-24 proposal card (the existing explicit-action, never-auto-fire mechanism). Nothing
  executes without a real user click. Dismissal suppresses that trigger for a cooldown.
- **D-12: Global off switch, default OFF.** A single feature flag gates the whole pipeline; it is
  OFF by default for the spike. When OFF, zero triggers evaluate and zero candidates are produced.

### Persistence & measurement (auto-selected)
- **D-13: Record every candidate's lifecycle as run events.** proposed → {suppressed_by_eval |
  suppressed_by_cap | shown} → {accepted | dismissed}. This is the raw material for the go/no-go's
  false-positive-rate argument and for a later real-feature's monitoring. Reuse the Phase-22
  run-event schema (SEAM-04).
- **D-14: No new DB surface if avoidable.** Prefer expressing candidate lifecycle on the existing
  run-event / message-part substrate; add a table only if the cap state genuinely needs its own
  row. Planner decides; keep it minimal (it's a spike).

### Claude's Discretion
- Exact idle/threshold/cap numbers (tune for the fixtures; document chosen values).
- Whether cap state lives in a dedicated table vs a run-event projection (D-14).
- The precise appropriateness rubric wording and threshold (document the chosen value + rationale).
- How triggers subscribe to state (polling projection vs event hooks) — pick the least-invasive.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 24 proposal-card mechanism (`emit_proposal_cards`, InteractiveWidgetBoundary, explicit
  never-auto-fire submit round-trip) — the surfacing + explicit-accept path for D-11, unchanged.
- Phase 22 run events / chat orchestration loop (`run_chat_turn.py`) + run-event persistence
  (SEAM-04) — the observation source and the D-13 lifecycle log.
- Phase 23 canvas store (per-chat state) — a trigger observation source.
- Code-island multi-candidate + LLM judge (GenuiCodeJudgeAdapter, Haiku, cost-conservative
  defaults) — the pattern to mirror for the appropriateness judge (D-07/D-09).
- FastAPI settings.py env-flag pattern — the D-12 feature flag; structlog for D-13 events.

### Established Patterns
- Zod/Pydantic at boundaries; typed candidate shape (D-05). Immutable, named exports, explicit types.
- Cost guard / manual-trigger-only posture (Phase 21) — anticipatory eval must stay cheap + gated.
- Deferral convention: live-Bedrock/browser verification → human_needed, mechanism proven via
  fixtures/fakes in automated tests.

### Integration Points
- apps/email-listener chat loop (observation + candidate production; feature-flag gate).
- apps/web/src/app/chat (surface a surviving candidate via the Phase-24 proposal-card path).
- Bedrock transport (IAM role, no ANTHROPIC_API_KEY) for the appropriateness judge — stubbed in
  spike tests.

</code_context>

<specifics>
## Specific Ideas

- R3 research (V1.3-RESEARCH-SYNTHESIS.md): anticipatory prompting is "largely greenfield — no
  strong published product/protocol; closest is HCI mixed-initiative interaction + proactive-
  Copilot-suggestion patterns." Pragmatic approach = a trigger/heuristic layer over chat+canvas
  state, gated by an appropriateness eval, "false-positive prompting is the main risk. Treat as a
  SPIKE." This CONTEXT operationalizes exactly that.
- Builds R4 seams 4–5 (run/event schema + agent/run abstraction behind the chat loop).

</specifics>

<deferred>
## Deferred Ideas

- Shipping anticipatory prompting on-by-default as a real feature (this spike's go/no-go decides IF;
  a later phase/milestone would decide HOW).
- Learned/ML trigger models and personalization.
- Live-Bedrock appropriateness-eval measurement + a real false-positive-rate study on live traffic.
- Cross-conversation / global anticipatory context (north-star; out of a single-chat spike).

</deferred>
