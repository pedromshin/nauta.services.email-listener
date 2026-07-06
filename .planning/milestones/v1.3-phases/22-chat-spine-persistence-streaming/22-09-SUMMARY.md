---
phase: 22-chat-spine-persistence-streaming
plan: 09
subsystem: chat-streaming-ui
tags: [nextjs, react, zod, genui, streaming, chat, sse]

# Dependency graph
requires:
  - phase: 22-06 (chat agent/run orchestration)
    provides: RunChatTurn.regenerate() — the versioned-sibling engine this
      plan's TurnActionRow/SiblingNav call into
  - phase: 22-07 (chat streaming transport + genui tool)
    provides: tool_call/tool_result SSE run events carrying emit_ui_spec's
      partial_json chunks and the finalized spec — this plan's progressive
      rendering payoff
  - phase: 22-08 (streamed chat core)
    provides: useChatStream hook, MessageList/MessageTurn/Composer, the
      genui_spec Card placeholder and unwired regenerate() this plan
      replaces/wires
provides:
  - "TurnActionRow + SiblingNav — always-visible copy/regenerate icon row
    with a ‹ N/M › sibling-version counter (D-16, CHAT-04)"
  - "InlineErrorCard + CostCapBlockedCard + TurnStatusBadge — the three
    terminal-status UI treatments (failed/pre-turn-blocked/stopped/
    cost-capped) reusing generation-state-chrome's alert-banner idiom
    (CHAT-05, D-15/D-19/D-21)"
  - "GenuiPartBoundary — progressive partial-tree genui rendering wrapping
    the UNMODIFIED SpecRenderer: attemptRepairJson (lenient JSON-prefix
    completion) + buildPartialNode (render-what's-valid + skeleton
    placeholders) + the SpecRootSchema.safeParse -> SAFE_FALLBACK_SPEC
    final gate (STREAM-02, D-17, FOUND-6)"
  - "use-chat-stream.ts's genui_spec_streaming MessagePart — accumulates
    tool_call partial_json chunks client-side (mirrors the Python
    _TurnState.pending_tool_json accumulator) so GenuiPartBoundary has
    something to progressively render"
  - "page.tsx's turn-grouping: chat.getHistory now folds ALL sibling
    versions per turn (not just isActive), with local (non-persisted)
    sibling-navigation overrides and a duplicate-turn suppression fix for
    the live streaming pseudo-turn"
affects: [22-11 (whatever remaining chat-spine polish plan follows), Phase 23
  (canvas genui panels can reuse GenuiPartBoundary's partial-render
  primitives), Phase 24 (dual-channel widget round-trips build on this
  plan's genui_spec_streaming/genui_spec part lifecycle)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lenient streaming-JSON-prefix repair (attemptRepairJson): a small
      hand-rolled tokenizer tracks open string/object/array frames and the
      LAST point the buffer was structurally complete (a fully-closed
      value, not mid-string/mid-key/mid-token), truncates to that point,
      and closes every still-open container. Turns a truncated JSON PREFIX
      (guaranteed by how tool-call streaming works — never arbitrary
      garbage) into syntactically valid JSON without ever eval'ing or
      regex-hacking the content."
    - "buildPartialNode — a generic 'render what validates, skeleton what
      doesn't' recursive walker that reuses spec-schema.ts's own
      child-bearing-field enumeration (children/header/footer/
      itemTemplate/emptyState/then) instead of hardcoding per-node-type
      semantics, so it stays correct across every current and future
      container type without duplicating the schema's own structure
      knowledge. Depth-bounded at MAX_SPEC_DEPTH (T-22-35 DoS guard)."
    - "Regenerate/retry unification: TurnActionRow's regenerate button and
      InlineErrorCard's Retry button both resolve to the exact same
      onRegenerate(assistantMessageId) operation — there is only one
      're-run this turn as a new sibling version' code path, never two
      diverging retry mechanisms."
    - "History-row-count snapshot instead of a parts-length check to decide
      when the live streaming pseudo-turn has been superseded by its own
      persisted chat.getHistory row — parts.length>0 doesn't distinguish
      'still streaming' from 'settled, but history hasn't refetched yet',
      so it can't tell you when to drop the transient turn without
      double-rendering."

key-files:
  created:
    - apps/web/src/app/chat/_components/turn-action-row.tsx
    - apps/web/src/app/chat/_components/sibling-nav.tsx
    - apps/web/src/app/chat/_components/inline-error-card.tsx
    - apps/web/src/app/chat/_components/cost-cap-blocked-card.tsx
    - apps/web/src/app/chat/_components/turn-status-badge.tsx
    - apps/web/src/app/chat/_components/genui-part-boundary.tsx
    - apps/web/src/app/chat/_components/__tests__/genui-part-boundary.test.tsx
  modified:
    - apps/web/src/app/chat/_components/message-turn.tsx
    - apps/web/src/app/chat/_components/message-list.tsx
    - apps/web/src/app/chat/_hooks/use-chat-stream.ts
    - apps/web/src/app/chat/_hooks/__tests__/use-chat-stream.test.ts
    - apps/web/src/app/chat/page.tsx

key-decisions:
  - "Extended use-chat-stream.ts/page.tsx beyond the plan's literal
    files_modified list (which named only message-turn.tsx as modified,
    plus the six new component files) — the plan's own must-have truth
    ('Declarative genui specs render progressively during generation') is
    unreachable without it: applyRunEvent previously DROPPED every
    tool_call delta entirely (no part was ever created or updated for it),
    so GenuiPartBoundary would only ever have received a fully-finalized
    spec, never a genuine partial buffer. Rule 2 (missing critical
    functionality) — the plan's stated payoff literally cannot exist
    without this hook change."
  - "chat.getHistory's ConversationView consumer now folds ALL sibling
    rows per turn (previously filtered to isActive only, a 22-08
    placeholder explicitly flagged as 'deferred to 22-09' in that plan's
    own Known Stubs) — SiblingNav has nothing to navigate otherwise. Local
    (non-persisted) sibling-selection state swaps the rendered version
    without re-fetching or touching the server's active-context sibling,
    per the UI-SPEC's 'navigation swaps only the rendered content' rule."
  - "Regenerate is only offered on a turn once its REAL (server-assigned)
    message id is knowable. A brand-new turn's live pseudo-turn uses a
    client-only STREAMING_TURN_ID sentinel; regenerate on that sentinel
    falls back to re-sending the same user text UNLESS the live turn is a
    known in-flight regenerate (its target id is already known). The one
    excluded case is a 'completed' live turn with no known id yet — its
    regenerate button is deliberately withheld until chat.getHistory
    catches up (moments later) to avoid resending the prompt as a new turn
    instead of regenerating the reply that was actually produced."
  - "GenuiPartBoundary always converts a finalized genui_spec part's
    already-parsed `spec` object back to a JSON string (JSON.stringify)
    before handing it to the same specJson/isStreaming prop contract used
    for the streaming case — one parse/validate code path for both,
    instead of a second finalized-only prop shape."
  - "attemptRepairJson tracks 'the last point a VALUE (not a key) fully
    closed' rather than naively closing brackets at end-of-buffer — a key
    string that just closed is NOT a safe truncation point (': value'
    hasn't arrived yet), so the tokenizer explicitly distinguishes
    key-position strings from value-position strings inside object frames."

requirements-completed: [CHAT-04, CHAT-05, STREAM-02]

# Metrics
duration: ~40min
completed: 2026-07-03
---

# Phase 22 Plan 09: Rich Chat Mechanics + Progressive GenUI Summary

**Regenerate-as-versioned-siblings with a `‹ N/M ›` navigator, inline retryable error recovery that never touches the composer draft, a distinct no-retry cost-cap-blocked card, neutral stopped/cost-capped marker badges, and GenuiPartBoundary — progressive partial-tree genui rendering (render-what's-valid + skeleton placeholders) wrapping the unmodified SpecRenderer behind a hand-rolled lenient JSON-prefix repair + Zod safeParse gate.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-03
- **Tasks:** 3/3 completed (Task 3 as a TDD RED/GREEN pair)
- **Files:** 7 created, 5 modified

## Accomplishments

- **TurnActionRow + SiblingNav** (CHAT-04, D-16): an always-visible (not
  hover-only, per the UI-SPEC's accessibility contract) copy + regenerate
  icon row under every settled assistant turn, with a `‹ N/M ›` counter
  that appears only once a turn has more than one sibling version.
  Regenerate always targets the server's currently-active sibling id and
  reuses the exact same operation as InlineErrorCard's Retry — there is
  only one "re-run this turn" code path in the whole plan.
- **InlineErrorCard / CostCapBlockedCard / TurnStatusBadge** (CHAT-05,
  D-15/D-19/D-21): a failed turn's content is fully replaced by a
  role="alert" retryable card (generation-state-chrome's banner treatment
  reused verbatim) whose Retry button never references the composer draft
  — draft and turn state are provably decoupled (Composer owns its own
  local state; nothing in the retry path touches it). A pre-turn
  fail-closed cost block gets its own no-retry card, distinguished from a
  mid-stream cost-cap breach by zero parts ever having streamed.
  Stopped/cost-capped partials carry one mutually-exclusive neutral
  `Badge variant="secondary"`.
- **GenuiPartBoundary** (STREAM-02, D-17, FOUND-6) — the phase's payoff.
  Wraps the completely unmodified `SpecRenderer`. `attemptRepairJson` is a
  small hand-rolled tokenizer that completes a truncated JSON prefix (the
  streamed `emit_ui_spec` tool call's accumulated text is, by construction,
  always a well-formed-JSON prefix, never arbitrary garbage) by closing
  every string/object/array open at the last point a real VALUE (not a
  bare key) finished. `buildPartialNode` then recursively keeps the
  contiguous prefix of a container's already-schema-valid children,
  rendering them live via the unmodified renderer, with a generic 3-bar
  Skeleton block for whatever hasn't arrived — generalized over every
  container type by reusing spec-schema.ts's own child-bearing-field
  enumeration rather than hardcoding per-widget logic, and depth-bounded
  at `MAX_SPEC_DEPTH` (T-22-35 DoS guard). Once streaming ends, the ONLY
  path to the renderer is `SpecRootSchema.safeParse` → `SAFE_FALLBACK_SPEC`
  on failure, unchanged from the existing web-boundary pattern. Zero
  eval/Function on this path (grep gate confirmed: 0).
- **use-chat-stream.ts's missing link**: `applyRunEvent` previously
  dropped every `tool_call` delta outright, so the client never actually
  had a partial buffer to progressively render — extended it to accumulate
  `tool_call` chunks into a new `genui_spec_streaming` part (mirroring the
  Python `_TurnState.pending_tool_json` accumulator), replaced by the
  finalized `genui_spec` part on `tool_result`. Without this the plan's
  own "renders progressively during generation" must-have would be
  unreachable from the live app.
- **page.tsx sibling-group wiring + a duplicate-turn bug fix**:
  `chat.getHistory` now folds every sibling version per turn (previously
  filtered to `isActive` only — 22-08's own explicitly-flagged deferred
  stub) so `SiblingNav` has real versions to navigate, with purely local
  (non-persisted) navigation state. Discovered and fixed a latent
  duplicate-render bug along the way: the live streaming pseudo-turn had
  been kept visible by a `parts.length > 0` check that never actually
  turns false once a turn settles, so every completed/failed/stopped turn
  would render twice (once from the live accumulator, once from the
  freshly-refetched persisted row) — replaced with a history-row-count
  snapshot that correctly detects "the persisted row has landed."

## Task Commits

Each task was committed atomically (Task 3 as its own TDD RED/GREEN pair), plus three additional fix commits for issues discovered while wiring the tasks together:

1. **Task 1: TurnActionRow + SiblingNav (regenerate → versioned siblings)** - `0173de1` (feat)
2. **Task 2: Inline error recovery + cost-cap-blocked card + status badges** - `3e891c4` (feat)
3. **Task 3 RED: failing GenuiPartBoundary tests** - `573092d` (test)
4. **Task 3 GREEN: GenuiPartBoundary + use-chat-stream.ts genui_spec_streaming** - `f228935` (feat)
5. **Fix: stop the live turn duplicating its own persisted row** - `033e7b7` (fix)
6. **Fix: withhold regenerate on a completed live turn's transient id** - `943e80b` (fix)
7. **Fix: bound buildPartialNode recursion depth (T-22-35)** - `4305e29` (fix)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `apps/web/src/app/chat/_components/turn-action-row.tsx` - always-visible copy/regenerate row, hosts SiblingNav
- `apps/web/src/app/chat/_components/sibling-nav.tsx` - `‹ N/M ›` counter, guarded to `siblings.length > 1`
- `apps/web/src/app/chat/_components/inline-error-card.tsx` - role="alert" retryable failed-turn card
- `apps/web/src/app/chat/_components/cost-cap-blocked-card.tsx` - same family, no-retry pre-turn-block card
- `apps/web/src/app/chat/_components/turn-status-badge.tsx` - single neutral stopped/cost-capped marker
- `apps/web/src/app/chat/_components/genui-part-boundary.tsx` - `attemptRepairJson`/`buildPartialNode`/`GenuiPartBoundary`
- `apps/web/src/app/chat/_components/__tests__/genui-part-boundary.test.tsx` - 3 tests (full valid / partial+skeleton / fallback)
- `apps/web/src/app/chat/_components/message-turn.tsx` - status-routed rendering (failed/cost-cap-block/normal), TurnActionRow/badge wiring, genui parts through GenuiPartBoundary
- `apps/web/src/app/chat/_components/message-list.tsx` - `MessageListItem` gains status/siblings/regenerateTargetId; threads regenerate/navigate callbacks
- `apps/web/src/app/chat/_hooks/use-chat-stream.ts` - `genui_spec_streaming` MessagePart + `applyRunEvent` tool_call accumulation/tool_result replacement
- `apps/web/src/app/chat/_hooks/__tests__/use-chat-stream.test.ts` - 3 new tests for the streaming-part accumulation/replacement/defensive-replace behavior
- `apps/web/src/app/chat/page.tsx` - `groupTurnsFromHistory` (all-siblings fold), regenerate/retry/navigate handlers, live-turn duplicate-suppression fix

## Decisions Made

See `key-decisions` in frontmatter for full rationale. Highlights: extending `use-chat-stream.ts`/`page.tsx` beyond the plan's literal file list (required to make the plan's own progressive-rendering and sibling-nav must-haves actually true); folding ALL sibling rows in `chat.getHistory`'s consumer instead of the 22-08-era `isActive`-only filter; unifying regenerate and retry into one operation; and withholding regenerate on the live pseudo-turn's transient sentinel id specifically for the "completed" case to avoid a resend-instead-of-regenerate misfire.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] use-chat-stream.ts extended with genui_spec_streaming accumulation**
- **Found during:** Task 3, before writing GenuiPartBoundary
- **Issue:** `applyRunEvent` silently dropped every `tool_call` event (`// started | tool_call | usage — streaming continues, parts unchanged`) — the client never accumulated any partial genui JSON at all, so GenuiPartBoundary would only ever see a fully-finalized spec once `tool_result` fired. The plan's own must-have ("Declarative genui specs render progressively during generation") is unreachable without this.
- **Fix:** Added a `genui_spec_streaming` `MessagePart` variant; `tool_call` events accumulate `partial_json` chunks (by `toolId`) into it, replaced by the finalized `genui_spec` part on `tool_result` — mirrors the Python `_TurnState.pending_tool_json` accumulator exactly.
- **Files modified:** `use-chat-stream.ts`, `use-chat-stream.test.ts`.
- **Verification:** 3 new unit tests (accumulate/replace/defensive-replace-on-id-change) plus the pre-existing D-18 interleaving test still passes unchanged (verified the final-state assertions are identical before and after the change).
- **Committed in:** `f228935` (Task 3 GREEN commit).

**2. [Rule 2 - Missing critical functionality] chat.getHistory consumer folds ALL sibling rows, not just isActive**
- **Found during:** Task 1, before wiring SiblingNav
- **Issue:** 22-08's `ConversationView` filtered `historyRows` to `.filter(row => row.isActive)` — its own SUMMARY explicitly flagged this as a defensive placeholder "deferred to 22-09." Without every sibling version, `SiblingNav` would have nothing to navigate and the `‹ N/M ›` counter could never appear.
- **Fix:** `groupTurnsFromHistory` groups by `turnIndex`, collects every assistant sibling row for that turn (sorted by `version`), and exposes the full `siblings[]` id list plus a local (non-persisted) override for which one is currently displayed.
- **Files modified:** `page.tsx`, `message-list.tsx`, `message-turn.tsx`.
- **Verification:** `tsc --noEmit` clean; manual trace of the grouping function against the `chat_messages` schema's sibling-group/version/isActive columns.
- **Committed in:** `0173de1` (Task 1 commit).

**3. [Rule 1 - Bug] Live streaming pseudo-turn duplicated its own persisted row**
- **Found during:** wiring Task 2's status-based cards into `page.tsx`, while reasoning through what the live turn would show after a `failed`/`cost_capped` terminal state
- **Issue:** The live pseudo-turn was kept in `turns` by `chatStream.state !== 'idle' && chatStream.parts.length > 0` — but `chatStream.state` stays at its terminal value indefinitely (nothing resets it to `idle`), so once `chat.getHistory` refetched and the persisted row appeared in `historyTurns`, EVERY settled turn would render twice. This directly undermines this plan's own InlineErrorCard/CostCapBlockedCard/TurnStatusBadge must-haves (they'd show doubled).
- **Fix:** Track the `chat.getHistory` row count at the moment each turn's stream starts; once the refetched count grows past that snapshot, the persisted row has landed and the transient live turn is dropped. A pre-turn cost block (which never inserts any row) is exempted and stays visible until the next action.
- **Files modified:** `page.tsx`.
- **Verification:** `tsc --noEmit` clean; `next build` succeeds; traced the state machine by hand across send/regenerate/pre-turn-block paths.
- **Committed in:** `033e7b7`.

**4. [Rule 1 - Bug] Regenerate on a "completed" live turn could misfire as a resend**
- **Found during:** the same wiring pass, reasoning through `handleLiveRetry`'s no-id fallback
- **Issue:** The live pseudo-turn uses a client-only `STREAMING_TURN_ID` sentinel (its real message id isn't known until `chat.getHistory` catches up). `handleLiveRetry` falls back to re-sending the user's text when no id is known — correct for failed/cost-capped/stopped (nothing meaningful exists to regenerate yet either way), but wrong for a `completed` turn: clicking Regenerate in the brief window before history refetches would resend the prompt as a brand-new turn instead of regenerating the reply that was actually produced.
- **Fix:** Withhold `regenerateTargetId` for the live turn specifically when its status is `completed`; the button reappears (correctly wired to the real id) the moment `chat.getHistory` refetches, moments later.
- **Files modified:** `page.tsx`.
- **Verification:** `tsc --noEmit` clean; traced the one excluded branch explicitly.
- **Committed in:** `943e80b`.

**5. [Rule 2 - Missing critical functionality] buildPartialNode recursion depth bound (T-22-35)**
- **Found during:** final review against the plan's own threat register
- **Issue:** T-22-35's disposition requires the partial parse to stay "a bounded best-effort attempt" — `buildPartialNode` recurses into the untrusted model-authored partial buffer BEFORE the finalized `SpecRootSchema`'s own `MAX_SPEC_DEPTH` refinement ever runs (that gate only applies once streaming ends), so a pathologically deep partial buffer had no depth guard on this one path.
- **Fix:** Capped recursion at `MAX_SPEC_DEPTH` (the same bound the final schema gate already enforces, so nothing legitimately renderable is lost).
- **Files modified:** `genui-part-boundary.tsx`.
- **Verification:** `vitest run` (all 3 tests still pass); `tsc --noEmit` clean.
- **Committed in:** `4305e29`.

---

**Total deviations:** 5 auto-fixed (2 missing-critical-functionality additions required to make the plan's own must-haves reachable, 2 bug fixes discovered while wiring the pieces together, 1 threat-register-driven DoS bound). No architectural/Rule-4 escalations — every fix stayed within the plan's stated component boundaries and the unmodified-SpecRenderer contract.
**Impact on plan:** All deviations were necessary for the plan's own acceptance criteria and must-haves to be literally true in the running app, not scope creep — the file list additions were things the plan's own tasks implicitly required to function together in `page.tsx`'s single call site.

## Issues Encountered

None beyond the five items above. All three tasks' machine gates passed: `pnpm tsc --noEmit` clean after every commit, `pnpm vitest run src/app/chat` (20/20 tests passing across `use-chat-stream.test.ts`, `markdown-renderer.test.tsx`, and the new `genui-part-boundary.test.tsx`), the no-eval grep gate on `genui-part-boundary.tsx` returns 0, and a full `pnpm next build` compiles successfully with `/chat` prerendering as static content (confirming the direct `SpecRenderer` import inside an already-`"use client"` component tree needs no `dynamic(ssr:false)` wrapper — that pattern in `apps/studio` exists specifically to satisfy Next's Server-Component restriction, which doesn't apply here since `page.tsx` is already a Client Component).

Manual browser verification (regenerate → `‹ 1/2 ›` navigates; a forced failure shows Retry with the draft intact; a genui spec renders progressively) is **deferred** per the standing overnight autonomous-session directive — machine gates only for this session.

## User Setup Required

None — no external service configuration required. All work is machine-gated (tsc/vitest/next build) against the existing FastAPI SSE contract from 22-06/22-07; no new environment variables or dependencies introduced.

## Threat Flags

None beyond what the plan's own `<threat_model>` already enumerated (T-22-33 through T-22-36) — all implemented exactly as dispositioned:
- T-22-33: every partial and final spec crosses `SpecRootSchema.safeParse`/`SpecNodeSchema.safeParse` before reaching `SpecRenderer`; invalid → `SAFE_FALLBACK_SPEC`.
- T-22-34: `grep -Ec "eval\(|new Function" genui-part-boundary.tsx` returns 0; the renderer stays the unmodified declarative `SpecRenderer`.
- T-22-35: `attemptRepairJson` is a single bounded pass per render (no retry loop); `buildPartialNode` is now depth-capped at `MAX_SPEC_DEPTH` (added as a Rule 2 fix, see Deviations #5).
- T-22-36: the composer draft lives entirely in `Composer`'s own local state; the retry/regenerate path never references it — verified by inspection (no shared state, no prop threading the draft into the error-recovery call chain).

## Next Phase Readiness

- Regenerate-as-sibling, inline error recovery, and progressive genui rendering are all live end-to-end from the FastAPI SSE contract through to the rendered DOM — Phase 23 (canvas) can reuse `GenuiPartBoundary`'s partial-render primitives (`attemptRepairJson`/`buildPartialNode`) for any panel that streams genui content the same way.
- The `genui_spec_streaming` → `genui_spec` part lifecycle established here is the exact seam Phase 24 (dual-channel widget round-trips) will need for streamed proposal-card/clarify-widget content.
- 22-11 (the phase's remaining plan) is unaffected by anything in this plan's scope — no shared files.

---
*Phase: 22-chat-spine-persistence-streaming*
*Completed: 2026-07-03*

## Self-Check: PASSED

All 12 created/modified files confirmed present on disk; all 7 task/fix commits (`0173de1`, `3e891c4`, `573092d`, `f228935`, `033e7b7`, `943e80b`, `4305e29`) confirmed present in `git log --oneline --all`.
