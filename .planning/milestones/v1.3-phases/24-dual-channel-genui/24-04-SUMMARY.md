---
phase: 24-dual-channel-genui
plan: 04
subsystem: python-application, python-infrastructure, web-presentation, genui-catalog
tags: [dual-channel-genui, clarify-widget, form-engine, widget-round-trip]

# Dependency graph
requires:
  - "24-03: InteractiveWidgetBoundary, CompactInteractionEntry, useChatStream.submitWidget, /api/chat/widget/submit proxy, deriveWidgetDisplayState, controller widgets surface (all generic over widgetKind)"
  - "24-02: emit_proposal_cards tool pattern, SubmitWidgetInteraction (validate/stale/CAS/resolve/continuation), POST /v1/chat/widget/submit endpoint"
  - "24-01: chat_widget_interactions table (state machine, declared_response_schema, staleness columns)"
  - "23-06: ButtonComponent ActionRegistry onClick contract (the precedent this plan's FormComponent enrichment mirrors)"
  - "Phase 19: FormComponent (UNMODIFIED layout/fields/chrome), validateForm, key-value-list catalog primitive"
provides:
  - "build_emit_clarify_widget_tool — hand-authored, Bedrock-valid emit_clarify_widget tool (chat_tools.py) with required non-empty submitLabel (minLength:1)"
  - "run_chat_turn_widgets.py clarify_widget branch — parses the tool call into an interactive_widget part, derives declared_response_schema from fields (enum/boolean/number/string, required[])"
  - "ChatWidgetInteractionRepository.supersede_pending — port + Supabase adapter; RunChatTurn.run() calls it right after inserting the user message (D-02 durable typing-supersedes)"
  - "SubmitWidgetInteraction._resolve_summary clarify_widget branch — {fields:[{label,value}]} resolved from the STORED declaration (D-16)"
  - "FormComponent handleSubmit values-through-registry enrichment (packages/genui) — {...onSubmit, values} reaches the ActionRegistry"
  - "buildClarifyWidgetSpec / buildClarifySubmittedSpec (apps/web) — declaration -> form node / declaration+values -> key-value-list node"
  - "InteractiveWidgetBoundary clarify_widget branch + onSubmitResult generalization (proposal_cards and clarify_widget share one signature)"
affects:
  - "Any future widget kind reusing InteractiveWidgetBoundary/SubmitWidgetInteraction/the interactive_widget_tools seam"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The clarify-widget's declared_response_schema is DERIVED server-side from the emitted fields (run_chat_turn_widgets.py::_derive_clarify_response_schema) — the model authors fields+submitLabel only, never the response schema itself (T-24-20 mitigation, mirrors proposal_cards' own enum-of-option-ids derivation)."
    - "supersede_pending mirrors try_submit's own CAS idiom: a conditional UPDATE with eq(conversation_id) + eq(state,'pending'), called by RunChatTurn.run() (typing) but never by regenerate()/continue_after_widget() (not typing) — D-02 durability now survives reload, not just the client's optimistic local set from 24-03."
    - "FormComponent's handleSubmit enrichment (registry[onSubmit.type]?.({ ...onSubmit, values })) is the exact same class of additive catalog-component wiring 23-06 applied to ButtonComponent — invisible to the wire schema (onSubmit's own ActionSchema shape is unchanged), non-breaking (regression-asserted: the built-in setState handler and panel-action-bridge's key/value-only narrowing both ignore the unknown `values` key)."
    - "InteractiveWidgetBoundary is now generic over widgetKind end-to-end: one onSubmitResult(result: Record<string,unknown>) signature carries {optionId} for proposal_cards and {values} for clarify_widget through the SAME WidgetSurface/MessageTurnWidgets plumbing (controller -> transcript -> canvas) — a future third widget kind needs no signature change, only its own live-spec builder + submitted-view branch."
    - "The clarify_widget submitted (locked) view reuses the SAME GenuiPartBoundary FOUND-6 gate as the live form — buildClarifySubmittedSpec emits a key-value-list node re-validated by SpecRootSchema.safeParse, rather than a hand-rolled <dl> (matches D-16's 'compact' requirement with zero new catalog primitives, per Design Decision 6)."

key-files:
  created:
    - apps/email-listener/app/application/use_cases/__tests__/test_run_chat_turn_clarify_widget.py
    - packages/genui/src/__tests__/form-submit-values.test.tsx
    - apps/web/src/app/chat/_components/build-clarify-widget-spec.ts
    - apps/web/src/app/chat/_components/__tests__/build-clarify-widget-spec.test.ts
    - apps/web/src/app/chat/_components/__tests__/clarify-widget-boundary.test.tsx
  modified:
    - apps/email-listener/app/infrastructure/llm/chat_tools.py
    - apps/email-listener/app/application/use_cases/run_chat_turn_widgets.py
    - apps/email-listener/app/application/use_cases/run_chat_turn.py
    - apps/email-listener/app/application/use_cases/submit_widget_interaction.py
    - apps/email-listener/app/domain/ports/chat_widget_interaction_repository.py
    - apps/email-listener/app/infrastructure/supabase/supabase_chat_widget_interaction_repository.py
    - apps/email-listener/app/container.py
    - apps/email-listener/app/application/use_cases/__tests__/test_run_chat_turn_interactive_widget.py
    - apps/email-listener/app/application/use_cases/__tests__/test_submit_widget_interaction.py
    - apps/email-listener/app/infrastructure/supabase/__tests__/test_supabase_chat_widget_interaction_repository.py
    - packages/genui/src/catalog/form-component.tsx
    - apps/web/src/app/chat/_components/interactive-widget-boundary.tsx
    - apps/web/src/app/chat/_components/compact-interaction-entry.tsx
    - apps/web/src/app/chat/_components/message-turn.tsx
    - apps/web/src/app/chat/_hooks/use-conversation-controller.ts
    - apps/web/src/app/chat/_canvas/genui-panel-node.tsx
    - apps/web/src/app/chat/_components/__tests__/interactive-widget-boundary.test.tsx
    - apps/web/src/app/chat/_canvas/__tests__/chat-canvas.test.ts
    - apps/web/src/app/chat/_canvas/__tests__/interactive-widget-canvas.test.tsx

key-decisions:
  - "onSubmitOption(optionId) generalized to onSubmitResult(result: Record<string,unknown>) across InteractiveWidgetBoundary, MessageTurnWidgets, WidgetSurface, and GenuiPanelNodeBody's call site -- one signature for both widget kinds (the 24-02 endpoint already takes the result body opaquely), rather than adding a second parallel callback."
  - "submittedValues in the controller's widget surface changed from a narrow {optionId: string}-only shape to the raw opaque per-kind payload (Readonly<Record<string,unknown>>) -- InteractiveWidgetBoundary reads whichever shape it expects based on part.widgetKind, so the surface itself stays generic."
  - "_resolve_summary's clarify_widget branch (submit_widget_interaction.py) was added even though the plan's Task 1 file list didn't name that file explicitly -- without it, a clarify_widget submit would raise ValueError (the function's existing else-branch) and the round-trip would 500. Documented as a Rule 2 deviation below."

requirements-completed: [DCUI-02]

# Metrics
duration: ~2h across 3 TDD tasks, each RED-confirmed before GREEN
completed: 2026-07-05
---

# Phase 24 Plan 04: Dual-Channel GenUI — Clarify-Widget Round-Trip Summary

**A new `emit_clarify_widget` tool (schema-enforced non-empty `submitLabel`, server-derived response schema) drives the UNMODIFIED Phase-19 form engine end-to-end: submitting returns structured field values through the existing 24-02/24-03 round-trip machinery, renders the compact submitted key-value-list + transcript entry, and typing now durably supersedes pending widgets server-side (D-02).**

## Performance

- **Duration:** ~2h across 3 tasks, each executed as a genuine TDD RED->GREEN cycle (a real failing test/import confirmed before every implementation)
- **Tasks:** 3/3 completed, all `type="auto" tdd="true"`
- **Files created:** 5 (1 Python test, 1 genui test, 1 web builder + its test, 1 web boundary test)
- **Files modified:** 19 (7 Python source/test, 1 genui source, 11 web source/test)

## Accomplishments

- **Task 1 — `emit_clarify_widget` tool + run-loop finalization + `supersede_pending` (D-02/D-09):** `build_emit_clarify_widget_tool()` (chat_tools.py) mirrors `build_emit_proposal_cards_tool`'s hand-authored, load-time-asserted, Bedrock-valid schema pattern — root `type:object`, `additionalProperties:false`, `fields` (1..12 items, each `name`/`label` required, `fieldType` enum, `options` for select/radio), and **`submitLabel` required with `minLength:1`** — the UI-SPEC's MANDATORY enforcement lives in the schema itself, never prompt guidance. `run_chat_turn_widgets.py` gained `_build_clarify_widget_part`/`_build_clarify_field` (fail-closed: a missing/empty `submitLabel` or empty `fields` drops the whole widget, mirroring `emit_ui_spec`'s existing parse-failure drop) and `_derive_clarify_response_schema` (select/radio -> enum of option values, checkbox -> boolean, number -> number, else string; `required:true` fields -> the schema's `required[]`). `ChatWidgetInteractionRepository` gained `supersede_pending(conversation_id) -> int` (port + Supabase adapter: a conditional `UPDATE ... WHERE conversation_id=? AND state='pending'`, mirroring `try_submit`'s own CAS idiom) — `RunChatTurn.run()` calls it immediately after inserting the new user message (typing durably supersedes, D-02), while `regenerate()`/`continue_after_widget()` never call it. `container.py` threads `build_emit_clarify_widget_tool()` into `interactive_widget_tools` alongside `emit_proposal_cards`. RED->GREEN (new `test_run_chat_turn_clarify_widget.py`, commit `28e5873`).

- **Task 2 — `FormComponent` values-through-registry (23-06 precedent):** `handleSubmit`'s `registry[onSubmit.type]?.(onSubmit)` became `registry[onSubmit.type]?.({ ...onSubmit, values })` — a single-expression, immutable-spread change. `spec-renderer.tsx` verified untouched (still `ecc7a46`) both before and after. Regression-asserted: the built-in `setState` handler (`action-handlers.ts`) and `panel-action-bridge`'s key/value-only narrowing both ignore the unknown `values` key. RED->GREEN (`e86c5ff` -> `982d0a0`).

- **Task 3 — clarify branch, submitted compact view, 422 retry, transcript parity (D-09/D-10/D-16):** `buildClarifyWidgetSpec`/`buildClarifySubmittedSpec` (new `build-clarify-widget-spec.ts`) are pure declaration->SpecRoot builders — the live form maps fields 1:1 onto `FormNodeSchema` and passes `submitLabel` verbatim (never a "Submit" fallback); the submitted view maps the declaration + submitted values onto a `key-value-list` node (boolean -> "Yes"/"No"). `InteractiveWidgetBoundary` now branches on `part.widgetKind`: the `clarify_widget` submitted state replaces the ENTIRE live form with a "Your response" heading + `Submitted` badge + the key-value-list (rendered through `GenuiPartBoundary`, the same FOUND-6 gate, not a hand-rolled `<dl>`); a 422 re-enables the live form with the unboxed error row (unchanged posture from 24-03). The submit callback was generalized from `onSubmitOption(optionId)` to `onSubmitResult(result: Record<string,unknown>)` across `InteractiveWidgetBoundary`, `MessageTurnWidgets`, `WidgetSurface` (`use-conversation-controller.ts`), and `GenuiPanelNodeBody`'s canvas call site — one signature, both widget kinds. `CompactInteractionEntry`'s `ClarifySummary` now reads the real `{fields:[{label,value}]}` shape from `submit_widget_interaction.py`'s resolver instead of the 24-03 flat-object stub. RED->GREEN (builder: `49ed732` -> `4e274dc`; boundary: `a6d6405` -> `6102f3d`).

## Task Commits

1. Task 1 RED — `28e5873` includes both RED test authoring and GREEN implementation in one commit (see Deviations — the Python test doubles and the source changes were developed together and verified RED via a live pytest run before the source edits, but committed as a single `feat` since this task's test file is net-new rather than modifying an existing passing suite).
2. Task 2 RED — `e86c5ff` (test: FormComponent values-through-registry); GREEN — `982d0a0` (feat)
3. Task 3 RED (builder) — `49ed732`; GREEN — `4e274dc`
4. Task 3 RED (boundary) — `a6d6405`; GREEN — `6102f3d`

## TDD Gate Compliance

Tasks 2 and 3 each have a genuine `test(24-04): ...` commit immediately preceding its `feat(24-04): ...` commit, with the RED failure confirmed via a real failing vitest run (Task 2: `values` key absent from the spy's received argument; Task 3 builder: `buildClarifySubmittedSpec is not a function`; Task 3 boundary: `Cannot read properties of undefined (reading 'map')` — the boundary treating a clarify declaration as a proposal-cards one) before the implementation was written. Task 1's Python test file was also RED-confirmed live (2 of 5 tests genuinely failed pre-implementation: the finalization test and the `supersede_pending`-call test) but is committed as a single `feat` commit alongside its test file rather than a separate `test:` commit, since the file is net-new (no prior GREEN state to preserve) and the Rule 3 fixes needed inside the same test file (the pre-existing `FakeChatWidgetInteractionRepository` in `test_run_chat_turn_interactive_widget.py` needed a `supersede_pending` no-op added to keep the 24-02 regression suite from crashing) were most honestly represented as one atomic change. Documented as a minor gate-sequence deviation rather than silently claiming a `test:` commit that doesn't exist.

## Deviations / Autonomous Decisions

### Auto-fixed Issues

**1. [Rule 2 - missing critical functionality] Extended `SubmitWidgetInteraction._resolve_summary` for `clarify_widget`**
- **Found during:** Task 1 implementation, reading the 24-04-PLAN.md `<interfaces>` block, which states the interaction_result summary shape for clarify (`{fields:[{label,value}]}`) as an established fact — but `submit_widget_interaction.py` (not in Task 1's or Task 3's `files` list) only had a `proposal_cards` branch and an unconditional `raise ValueError` fallback.
- **Issue:** Without this branch, a clarify-widget submit would reach `_resolve_summary`, hit the `else: raise ValueError(...)`, and the `/v1/chat/widget/submit` endpoint would 500 — DCUI-02 ("submitting it returns the structured field values to the agent and resumes the run") would be unreachable.
- **Fix:** Added a `clarify_widget` branch resolving `{label, value}` pairs from the STORED declaration's field labels (never trusting a client-supplied label), for every submitted field name present in `result`.
- **Files modified:** `apps/email-listener/app/application/use_cases/submit_widget_interaction.py`; test added to `test_submit_widget_interaction.py`.
- **Commit:** `28e5873`

**2. [Rule 3 - blocking issue] Added `supersede_pending` no-op to `FakeChatWidgetInteractionRepository` in `test_run_chat_turn_interactive_widget.py` (24-02's own test file)**
- **Found during:** Task 1, running the full `app/application/use_cases/__tests__/` suite after adding the `RunChatTurn.run()` -> `supersede_pending` call.
- **Issue:** 24-02's existing test double didn't implement the new port method; `run()` unconditionally calling it on any non-None injected repository would `AttributeError` on every 24-02 regression test that passes a widget-interactions fake.
- **Fix:** Added a trivial `async def supersede_pending(self, conversation_id: str) -> int: return 0` to the existing fake — no behavior change to any 24-02 assertion.
- **Files modified:** `test_run_chat_turn_interactive_widget.py`
- **Commit:** `28e5873`

**3. [Rule 3 - blocking issue] Updated 3 existing 24-03 test files for the `onSubmitOption` -> `onSubmitResult` rename**
- **Found during:** Task 3, generalizing `InteractiveWidgetBoundary`'s submit callback per the plan's own explicit instruction ("update 24-03 call sites in the controller threading accordingly").
- **Issue:** `interactive-widget-boundary.test.tsx`, `chat-canvas.test.ts`, and `interactive-widget-canvas.test.tsx` (all pre-existing 24-03 files, none in this plan's `files_modified` list) all referenced the old prop/callback name and would fail to compile/pass once the signature changed.
- **Fix:** Renamed the prop/callback consistently (`onSubmitOption` -> `onSubmitResult`) and updated the two assertions that previously expected a bare `"opt-0"` string to now expect `{ optionId: "opt-0" }` — a pure rename, zero behavioral change (all three files' tests still pass their original intent).
- **Files modified:** the three test files listed above.
- **Commit:** `6102f3d`

### Autonomous Decisions

**A. `submittedValues` widened from `{optionId: string}`-only to the raw opaque per-kind payload.** `use-conversation-controller.ts`'s widget-surface builder previously only recognized `{optionId: string}` and silently dropped anything else. Since clarify submits store `{values: {...}}`, the type-guard was replaced with a generic "is a non-null, non-array object" check — `InteractiveWidgetBoundary` itself decides which shape to read based on `part.widgetKind`, keeping the controller's surface truly generic (matches D-08's "one message-part source of truth" posture, now genuinely kind-agnostic rather than proposal-shaped).

**B. Clarify-widget's dimmed (superseded/stale) state has no `role="group"`.** Unlike proposal cards (which need a `role="group"`/`aria-label` for their multi-button set, 24-UI-SPEC.md Accessibility), a clarify-widget's own `<form>` element (Phase-19 `FormComponent`, unmodified) already carries `aria-label={title ?? "Form"}` — adding a second group wrapper would be redundant ARIA, so the boundary only applies `role="group"` for the proposal_cards branch.

## Known Stubs

None. Every code path in this plan is real: the tool is wired into the live model-offering path (`container.py`), the run-loop finalizer persists a real pending row with a server-derived schema, `SubmitWidgetInteraction` resolves and persists real clarify summaries, and the client renders the live form / submitted view / 422 retry through the same production `GenuiPartBoundary`/`SpecRenderer` path every other genui part uses.

## Threat Flags

None beyond the plan's own `<threat_model>`, which is satisfied as designed:
- **T-24-20 (model declares a permissive response schema):** `_derive_clarify_response_schema` computes the STORED schema server-side from the declared fields; the model's tool input_schema has no `declared_response_schema` field at all — there is no channel for the model to author it.
- **T-24-21 (typed field values reach model context):** values are re-validated (D-10, unchanged `SubmitWidgetInteraction` ordering) and attributed via the existing `interaction_result` text stand-in (`content_block_stand_in`, already generic over widgetKind — no change needed).
- **T-24-22 (values payload enrichment breaks existing handlers):** regression-asserted in Task 2 (`form-submit-values.test.tsx` Test 3) — the built-in `setState` handler and `panel-action-bridge`'s narrowing both ignore the unknown `values` key.
- **T-24-23 (client submits values for non-declared fields):** the derived schema's `additionalProperties:false` rejects them (422, `SubmitWidgetInteraction`'s existing D-10 re-validation step, unchanged).
- **T-24-24 (unbounded fields array):** `chat_tools.py`'s `input_schema` caps `fields` at `maxItems: 12`.
- **T-24-SC (supply chain):** no new package installed this plan.

## Gate Results

- `apps/email-listener`: 20/20 tests green across the affected files (`test_run_chat_turn_clarify_widget.py` 5, `test_run_chat_turn_interactive_widget.py` 3, `test_submit_widget_interaction.py` 9 incl. the new clarify summary test, `test_supabase_chat_widget_interaction_repository.py` 9, `test_chat_tools.py` 2 — some counted across files); full `app/application/use_cases/__tests__/` suite green; broader chat regression (`tests/application/test_run_chat_turn.py`, `test_emit_ui_spec_tool.py`, `app/presentation/api/v1/__tests__/test_chat_widget.py`) 29/29 green. `ruff check app` clean. `lint-imports`: 3/3 contracts kept. `mypy` on touched files: only the pre-existing, previously-documented `is_stale` gap (`deferred-items.md`, from 24-01) — zero new errors introduced.
- `packages/genui`: 475/475 vitest green (472 pre-existing + 3 new in `form-submit-values.test.tsx`). `tsc --noEmit` clean. `git diff --stat` on `form-component.tsx`: 1 file, 5 insertions/1 deletion (comment-inclusive; the behavioral diff is the single `handleSubmit` expression). `spec-renderer.tsx` confirmed untouched (`ecc7a46`, working tree clean).
- `apps/web`: `src/app/chat` vitest 140/140 green (126 pre-existing + 14 new across `build-clarify-widget-spec.test.ts` and `clarify-widget-boundary.test.tsx`). `tsc --noEmit` clean. `next build` green (`/api/chat/widget/submit` still registered, `/chat` 126 kB — unchanged bundle size class). No-eval grep on modified `_components`/`_canvas` files: 0 functional matches (one doc-comment mention only).

## Next Phase Readiness

DCUI-02 is now observably complete: the agent can emit a schema-enforced clarify-widget (non-empty, context-specific `submitLabel` structurally required), the unmodified Phase-19 form engine renders it, a submit resolves structured field values against a server-derived schema and resumes the run, the submitted state renders compactly in both transcript and canvas (via the same `InteractiveWidgetBoundary`/`WidgetSurface` plumbing 24-03 built), and typing durably supersedes a pending widget server-side. Phase 24's remaining scope (DCUI-04, canvas parity) was already satisfied generically by 24-03's `variant`-aware `InteractiveWidgetBoundary`/`GenuiPanelNodeBody` wiring — this plan's `onSubmitResult` generalization keeps that canvas parity intact for clarify-widgets with zero canvas-specific code.

---
*Phase: 24-dual-channel-genui*
*Completed: 2026-07-05*

## Self-Check: PASSED

All 17 created/modified files listed above confirmed present on disk. All 7 commits
(`28e5873`, `e86c5ff`, `982d0a0`, `49ed732`, `4e274dc`, `a6d6405`, `6102f3d`) confirmed
present in `git log --oneline --all`.
