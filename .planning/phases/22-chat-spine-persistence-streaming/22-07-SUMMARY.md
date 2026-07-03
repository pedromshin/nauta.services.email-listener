---
phase: 22-chat-spine-persistence-streaming
plan: 07
subsystem: chat-streaming
tags: [chat, sse, fastapi, streaming, tool-use, genui, dishka]

# Dependency graph
requires:
  - phase: 22-06 (chat agent/run orchestration + persistence)
    provides: RunChatTurn.run()/.regenerate() async generators (no HTTP dependency),
      ChatRunEvent typed run events, cost-breaker turn control (D-15/D-19/D-21)
  - phase: 22-02 (multi-provider model system)
    provides: ChatProvider port (typed ToolCallDelta), CHAT_MODEL_REGISTRY with
      capabilities.genui capability flags (D-05)
provides:
  - EMIT_UI_SPEC_TOOL (chat_tools.py) — the emit_ui_spec tool definition,
    capability-gated (D-05) via DI injection into RunChatTurn
  - RunChatTurn now folds streamed deltas through an immutable _TurnState
    accumulator producing D-18 interleaved typed parts (text | genui_spec)
    plus progressive tool_call/tool_result run events
  - POST /v1/chat/stream + POST /v1/chat/regenerate — FastAPI SSE
    (text/event-stream) endpoints wrapping RunChatTurn, X-API-Key fail-closed,
    client-disconnect -> real task cancellation -> D-15/D-25 stopped-partial
affects: [22-08 (Next.js proxy injecting X-API-Key server-side + message list UI
  consuming the SSE stream), 22-09 (web-side safeParse/SAFE_FALLBACK_SPEC gate
  on genui_spec parts, FOUND-6), Phase 24 (tool_use/tool_result history replay
  round-trip — deferred here, see key-decisions)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composition-root DI injection to satisfy import-linter layering: RunChatTurn
      (application) accepts emit_ui_spec_tool as a plain dict constructor parameter
      instead of importing chat_tools.py (infrastructure) directly — container.py
      (exempt from the 'Application does not import infrastructure' contract) wires
      the concrete tool dict in. Generalizable pattern for any future
      infrastructure-owned constant an application-layer class needs."
    - "Immutable _TurnState accumulator (frozen dataclass + dataclasses.replace)
      folds ChatDelta -> (new_state, events[]) purely, no I/O — mirrors 22-06's
      _apply_delta/_terminal_status_for pure-helper split, extended to return
      MULTIPLE run events per delta (a TextDelta arriving mid-tool-call both
      finalizes the pending tool AND checkpoints new text)."
    - "SSE disconnect -> real asyncio.Task cancellation (not generator .aclose()):
      stream_run_events() consumes the agent generator via a background Task so a
      detected disconnect can task.cancel() it, raising CancelledError INSIDE the
      agent's current await point — the only way to trigger RunChatTurn's own
      `except asyncio.CancelledError` stopped-partial handler. aclose() would
      raise GeneratorExit instead, which that handler does not catch."

key-files:
  created:
    - apps/email-listener/app/infrastructure/llm/chat_tools.py
    - apps/email-listener/app/presentation/api/v1/chat_stream.py
    - apps/email-listener/tests/application/test_emit_ui_spec_tool.py
    - apps/email-listener/tests/presentation/test_chat_stream.py
  modified:
    - apps/email-listener/app/application/use_cases/run_chat_turn.py
    - apps/email-listener/app/container.py
    - apps/email-listener/app/main.py
    - apps/email-listener/tests/application/test_run_chat_turn.py

key-decisions:
  - "emit_ui_spec_tool is injected into RunChatTurn's constructor as a plain
    dict[str, Any] rather than imported from chat_tools.py inside
    run_chat_turn.py — the plan's literal file placement
    (app/infrastructure/llm/chat_tools.py) would otherwise make the application
    layer import infrastructure, breaking the 'Application does not import
    infrastructure' import-linter contract (verified: lint-imports was RED
    before this fix, KEPT after). container.py (the composition root) imports
    EMIT_UI_SPEC_TOOL and threads it in — the plan's stated file path for
    chat_tools.py is preserved unchanged."
  - "_TurnState accumulator tracks parts/text_buffer/pending_tool_*
    (frozen dataclass, dataclasses.replace) instead of a flat accumulated_text
    string — required for D-18 interleaved [text, genui_spec, text] parts.
    _apply_delta now returns a LIST of (event_type, data) tuples per delta
    (not a single Optional pair) since a TextDelta arriving while a tool call
    is in flight must both finalize the pending tool (-> tool_result) AND
    checkpoint the new text (-> text_delta_checkpoint) from one delta."
  - "A tool call whose accumulated JSON fails to parse (e.g. cut off mid-stream
    by a cancellation/cost-cap abort) is DROPPED rather than persisted as
    invalid JSON in a genui_spec part — logged as
    emit_ui_spec_tool_call_parse_failed. Not specified by the plan; a Rule 1
    defensive choice to keep the canonical typed-parts invariant (every
    genui_spec part's spec is valid JSON) intact under abnormal termination."
  - "_build_provider_messages now converts a genui_spec part to a compact text
    stand-in ('[emitted UI spec: {json}]') when replaying history back to the
    provider, instead of passing it through as a bare (invalid) Anthropic
    content block. Full tool_use/tool_result history replay is explicitly
    DEFERRED to the Phase 24 round-trip seam (ToolResultDelta is already
    reserved for it, per 22-02) — this is a Rule 2 fix scoped to preventing
    a persisted genui_spec part from corrupting a LATER turn's provider call,
    not an attempt at full round-trip fidelity."
  - "Test files placed at tests/application/test_emit_ui_spec_tool.py and
    tests/presentation/test_chat_stream.py (not the plan's literal
    tests/unit/ path) — repeats the 22-02/22-06/22-06 precedent: no
    tests/unit/ directory exists anywhere in this codebase."
  - "test_run_chat_turn.py's pre-existing test_happy_path_calls_provider_with_no_tools
    (asserting tools==() for a genui=True test model) was renamed/repointed to
    a new genui=False _TEXT_ONLY_MODEL fixture — 22-07 intentionally supersedes
    the 22-06-era 'no tools ever' invariant for genui-capable models (D-05),
    so the old assertion needed to test the case it actually still covers
    (a non-genui model never sees ANY tool, D-03)."

requirements-completed: [STREAM-01, STREAM-02, CHAT-03, CHAT-04]

# Metrics
duration: ~30min
completed: 2026-07-03
---

# Phase 22 Plan 07: Chat Streaming Transport + GenUI Tool Summary

**FastAPI SSE (`POST /v1/chat/stream` + `/regenerate`) wrapping the 22-06 chat agent, plus a capability-gated `emit_ui_spec` tool whose partial-JSON tool-call streams into a D-18-interleaved `genui_spec` message part.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-03 (session start after reading 22-06/22-02 summaries + plan)
- **Completed:** 2026-07-03
- **Tasks:** 2/2 completed
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- **EMIT_UI_SPEC_TOOL** (`chat_tools.py`): a provider-agnostic tool dict
  (name/description/input_schema, mirroring `genui_code_generator_adapter.py`'s
  hand-written shape) whose `spec` input accepts a genui SpecRoot object.
  Offered to `provider.stream(tools=...)` ONLY when the picked model's registry
  entry has `capabilities.genui = True` (D-05); a text-only model's `tools`
  stays `()` (D-03).
- **D-18 interleaved parts**: `RunChatTurn` now folds every streamed delta
  through an immutable `_TurnState` accumulator (`parts`, `text_buffer`,
  `pending_tool_*`, `input_tokens`, `output_tokens`). A `ToolCallDelta`'s
  partial JSON accumulates across chunks sharing the same `id`, streaming a
  `tool_call` run event per chunk; when a different delta (new text, a
  different tool id, or the turn's terminal finalize) arrives, the pending
  tool call parses into a `genui_spec` part (stored **verbatim** — no
  server-side `safeParse`/fallback, FOUND-6) plus one `tool_result` event. A
  fake text→tool-call→text stream produces `parts == [text, genui_spec,
  text]` in order, verified in `test_emit_ui_spec_tool.py`.
- **Layering fix (Rule 1)**: the plan's literal file split — `chat_tools.py`
  under `app/infrastructure/llm/` but consumed by `run_chat_turn.py` under
  `app/application/` — would violate the `lint-imports` "Application does not
  import infrastructure" contract. Resolved by injecting the tool dict into
  `RunChatTurn`'s constructor (`emit_ui_spec_tool: dict[str, Any]`); only
  `container.py` (the composition root) imports `chat_tools.py`. Verified:
  `uv run lint-imports` reports all 3 contracts KEPT.
- **SSE transport** (`chat_stream.py`): `POST /v1/chat/stream` and
  `POST /v1/chat/regenerate`, both `APIRouter(prefix="/v1/chat",
  dependencies=[Depends(require_api_key)])`, returning
  `StreamingResponse(media_type="text/event-stream")` with `Cache-Control:
  no-cache` + `X-Accel-Buffering: no` headers. `stream_run_events()`
  serializes each `ChatRunEvent` as one `data: {json}\n\n` frame. Request
  bodies (`ChatStreamRequest`/`ChatRegenerateRequest`) validate
  `conversation_id`/`assistant_message_id` as UUIDs and bound `user_text` to
  8,000 chars.
- **Disconnect → real cancellation (T-22-27)**: `stream_run_events()` consumes
  the agent's async generator via a background `asyncio.Task`, polling
  `request.is_disconnected()` every 0.1s while the task is pending. A detected
  disconnect calls `task.cancel()`, which raises `CancelledError` **inside**
  the agent's current await point — the only mechanism that correctly
  triggers `RunChatTurn._execute_turn`'s own `except asyncio.CancelledError`
  handler and its D-15/D-25 stopped-partial persist path. (Closing the
  generator via `.aclose()` instead would raise `GeneratorExit`, which that
  handler does not catch.) Verified directly against `stream_run_events()`
  with a hanging fake agent — `agent.cancelled is True` after a simulated
  disconnect.
- **Registration**: `chat_stream_router` registered in `main.py` alongside
  the existing `chat_models_router`.

## Task Commits

Each task was committed atomically:

1. **Task 1: emit_ui_spec tool + capability-gated offering + D-18 interleaved parts** - `a2c5490` (feat)
2. **Task 2: FastAPI SSE stream + regenerate endpoints + disconnect cancellation** - `3023ba7` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `apps/email-listener/app/infrastructure/llm/chat_tools.py` - `EMIT_UI_SPEC_TOOL`/`EMIT_UI_SPEC_TOOL_NAME` (D-02); documents the composition-root DI layering split
- `apps/email-listener/app/application/use_cases/run_chat_turn.py` - `_TurnState` accumulator, `_apply_delta`/`_finalize_pending_tool`/`_flush_text_buffer`/`_finalize_state` pure helpers, capability-gated `tools` in `_execute_turn`, `_provider_content_blocks` history-replay safety
- `apps/email-listener/app/container.py` - imports `EMIT_UI_SPEC_TOOL`, threads it into `_provide_run_chat_turn`
- `apps/email-listener/app/presentation/api/v1/chat_stream.py` - `ChatStreamRequest`/`ChatRegenerateRequest`, `stream_run_events()`, `POST /stream` + `POST /regenerate`
- `apps/email-listener/app/main.py` - registers `chat_stream_router`
- `apps/email-listener/tests/application/test_emit_ui_spec_tool.py` - 4 tests (capability gating x2, D-18 interleaving + verbatim spec, gating-independent delta finalization)
- `apps/email-listener/tests/application/test_run_chat_turn.py` - added `_TEXT_ONLY_MODEL` fixture + `emit_ui_spec_tool` threading in `_make_use_case`; repointed the old "no tools ever" test to the non-genui model
- `apps/email-listener/tests/presentation/test_chat_stream.py` - 7 tests (SSE framing, regenerate, request validation x3, 401 fail-closed, disconnect→cancellation)

## Decisions Made

See `key-decisions` in frontmatter for the full list. Highlights:
- Resolved a real import-linter layering violation the plan's literal file split would have caused, via composition-root DI injection (no scope/architecture change — `chat_tools.py` still lives exactly where the plan specified).
- Extended `_apply_delta`'s return shape to a list of events (not a single Optional pair) to correctly emit both a `tool_result` (finalizing a pending tool) and a `text_delta_checkpoint` (the new text) from one delta when text arrives immediately after a tool call.
- A malformed/incomplete tool-call JSON (mid-turn abort) is dropped rather than persisted, keeping the genui_spec part's `spec` field always valid JSON.
- History replay converts genui_spec parts to a text stand-in rather than sending an invalid bare tool_use block to the provider on a later turn — explicitly scoped as a stopgap pending the Phase 24 round-trip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Architectural/layering bug] emit_ui_spec_tool injected via constructor, not imported by run_chat_turn.py**
- **Found during:** Task 1, before writing any code (re-reading the plan's file split against the existing `pyproject.toml` import-linter contracts)
- **Issue:** The plan's frontmatter lists `app/infrastructure/llm/chat_tools.py` (new) and `app/application/use_cases/run_chat_turn.py` (modified) as Task 1's files, with the action text saying "In run_chat_turn.py, offer the tool...". A direct `from app.infrastructure.llm.chat_tools import EMIT_UI_SPEC_TOOL` inside `run_chat_turn.py` would violate the "Application does not import infrastructure" `lint-imports` contract (`source_modules = ["app.application"]`, `forbidden_modules = ["app.infrastructure", ...]`), which the plan's own `<verification>` block requires to stay clean.
- **Fix:** `RunChatTurn.__init__` accepts `emit_ui_spec_tool: dict[str, Any]` as a plain constructor parameter. `container.py` (the composition root, exempt from the contract since its module path is `app.container`, not `app.application.*`) imports `EMIT_UI_SPEC_TOOL` from `chat_tools.py` and passes it into the `RunChatTurn` factory — identical to how `default_importer_id`/`max_output_tokens` already come from settings inside that same factory rather than as injected params.
- **Files modified:** `run_chat_turn.py`, `container.py` (chat_tools.py's file path is unchanged from the plan).
- **Verification:** `uv run lint-imports` — all 3 contracts KEPT (0 broken). Confirmed the violation would have fired by tracing the exact import path before implementing the fix.
- **Committed in:** `a2c5490` (Task 1 commit).

**2. [Rule 2 - Missing critical functionality] History replay guards against invalid genui_spec content blocks**
- **Found during:** Task 1, while implementing D-18 interleaving
- **Issue:** Once a `genui_spec` part type exists in persisted `chat_messages.parts`, `_build_provider_messages`'s prior behavior (`list(message.parts)` passed straight through as Anthropic content) would send `{"type": "genui_spec", "spec": {...}}` — not a valid Anthropic content block — to the provider on any LATER turn in the same conversation, breaking that turn's API call. This is a bug newly introduced by this plan's own Task 1 change (no prior plan had non-text parts), not a pre-existing issue.
- **Fix:** Added `_provider_content_blocks()`: a `genui_spec` part is replayed as a compact text stand-in (`[emitted UI spec: {json}]`); plain `text` parts pass through unchanged. Full tool_use/tool_result replay fidelity is explicitly deferred to the Phase 24 round-trip seam (documented in the function's docstring and this summary's key-decisions).
- **Files modified:** `run_chat_turn.py`.
- **Verification:** Existing `test_history_excludes_inactive_siblings`/`test_history_trimmed_to_context_budget` tests (all-text-part fixtures) still pass unchanged, confirming no behavior change for the pre-22-07 text-only case.
- **Committed in:** `a2c5490` (Task 1 commit).

**3. [Rule 1 - Bug] Pre-existing test_run_chat_turn.py assertion updated for the new capability-gated tools invariant**
- **Found during:** Task 1, first test run after the `emit_ui_spec_tool` constructor change
- **Issue:** `test_happy_path_calls_provider_with_no_tools` used `_SERVER_MODEL` (`capabilities.genui=True`) and asserted `tools == ()` — a 22-06-era invariant ("no data tools at all, D-03") that 22-07 intentionally supersedes for genui-capable models. Left unchanged, this test would fail against correct new behavior.
- **Fix:** Added a `_TEXT_ONLY_MODEL` fixture (`capabilities.genui=False`) and repointed the (renamed) test to it, preserving its original intent — a model NOT flagged genui-capable never sees any tool — while removing the now-incorrect blanket assertion.
- **Files modified:** `tests/application/test_run_chat_turn.py`.
- **Verification:** All 13 tests in the file pass (`uv run pytest tests/application/test_run_chat_turn.py`).
- **Committed in:** `a2c5490` (Task 1 commit).

---

**Total deviations:** 3 auto-fixed (1 architectural/layering correctness fix, 1 missing-critical-functionality guard, 1 test-suite regression fix). No scope creep — every fix was required to make the plan's own acceptance criteria (lint-imports clean, D-18 interleaving, existing test suite green) literally true.
**Impact on plan:** All deviations were necessary corrections uncovered while implementing the plan's own stated behavior; no product-facing scope change. `chat_tools.py`'s file path matches the plan exactly.

## Issues Encountered

None beyond the three items above. Full local test suite (`uv run pytest -q --no-cov`) shows the same 10 pre-existing failures in `tests/test_genui_retrieval_provider.py` already documented in `22-02-SUMMARY.md` (`asyncio.get_event_loop()` incompatible with Python 3.13's "no current event loop in a fresh thread" behavior) — confirmed pre-existing (zero diff to that file or its adapter in this plan), out of scope per the executor's Scope Boundary rule. `uv run mypy app/` surfaces the same 6 pre-existing errors in `genui_generator_adapter.py`/`genui_code_generator_adapter.py`/`supabase_ui_spec_template_repository.py` already documented in `22-02-SUMMARY.md`/`22-06-SUMMARY.md` — confirmed pre-existing, out of scope.

## User Setup Required

None — no external service configuration required. All work is unit-tested against fakes/test-doubles (no live Bedrock/OpenRouter/Supabase calls, no live SSE network round-trip), consistent with this milestone's offline-testable autonomous-session pattern.

## Threat Flags

None beyond what the plan's `<threat_model>` already enumerated (T-22-24 through T-22-28) — all implemented exactly as dispositioned:
- T-22-24: `require_api_key` dependency on the `chat_stream.py` router; fail-closed 401 verified via `test_stream_requires_api_key_when_configured` (staging + `API_KEY` set → 401, no stream body, agent never invoked).
- T-22-25: the emit_ui_spec spec is stored/streamed verbatim; no server-side execution or validation anywhere in this plan's files (safeParse/SAFE_FALLBACK_SPEC remains a 22-09 web-boundary concern, FOUND-6).
- T-22-26: cost breaker (22-04/06) still gates every turn pre- and mid-stream; SSE responses carry `Cache-Control: no-cache` + `X-Accel-Buffering: no`; a disconnected stream is now actively cancelled (not left running) via `stream_run_events()`'s task-cancellation mechanism.
- T-22-27: disconnect → `RunChatTurn`'s existing `CancelledError` handler persists the partial as `stopped` — verified end-to-end in spirit (22-06's `test_cancellation_persists_partial_stopped_and_reraises` covers the agent side; this plan's `test_disconnect_cancels_the_agent_task` covers the SSE-layer cancellation trigger).
- T-22-28: `emit_ui_spec` is the ONLY tool ever offered, and only to registry-flagged genui-capable models (`test_genui_capable_model_offers_emit_ui_spec_tool` / `test_text_only_model_offers_no_tools`).

## Next Phase Readiness

- `POST /v1/chat/stream` + `POST /v1/chat/regenerate` are live, DI-resolvable, X-API-Key-gated SSE endpoints ready for 22-08's Next.js server-side proxy (which injects the key so it is never `NEXT_PUBLIC_`) and message-list UI to consume.
- `ChatRunEvent` frames (`started`/`text_delta_checkpoint`/`tool_call`/`tool_result`/`usage`/`completed`/`stopped`/`failed`/`cost_capped`) are serialized 1:1 as SSE `data:` JSON — the client can build a partial-tree renderer directly off `tool_call` deltas and swap to the finalized `genui_spec` part on `tool_result`/`completed`.
- The persisted `genui_spec` part (`{"type": "genui_spec", "spec": {...}}`) is the exact shape 22-09's web-side `safeParse`/`SAFE_FALLBACK_SPEC` gate needs to validate against (FOUND-6) — no further backend shape change expected.
- Known, explicitly-deferred gap: `_build_provider_messages`'s text-stand-in conversion for `genui_spec` history replay is a stopgap, not a full round-trip. Phase 24 (tool_use/tool_result widget round-trip) is the intended place to replace it with proper Anthropic tool_use/tool_result block reconstruction — `ToolResultDelta` is already reserved in the `ChatDelta` union (22-02) for exactly this.

---
*Phase: 22-chat-spine-persistence-streaming*
*Completed: 2026-07-03*

## Self-Check: PASSED

All 4 created files confirmed present on disk (`chat_tools.py`, `chat_stream.py`, `test_emit_ui_spec_tool.py`, `test_chat_stream.py`); both task commits (`a2c5490`, `3023ba7`) confirmed present in `git log --oneline --all`.
