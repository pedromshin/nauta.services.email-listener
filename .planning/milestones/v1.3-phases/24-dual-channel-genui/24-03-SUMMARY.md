---
phase: 24-dual-channel-genui
plan: 03
subsystem: web-presentation, web-transport, api-client
tags: [dual-channel-genui, proposal-cards, widget-round-trip, canvas-parity, sse, trpc]

# Dependency graph
requires:
  - "24-02: POST /v1/chat/widget/submit endpoint, emit_proposal_cards tool, interactive_widget/interaction_result part shapes, chat_widget_interactions rows"
  - "24-01: chat_widget_interactions table (state machine, declaration, submittedValue)"
  - "23-06: ButtonComponent ActionRegistry onClick contract (registry[onClick.type]?.(onClick)) + GenuiPartBoundary actions prop"
  - "23-02/23-04: CanvasSpecProvider/useCanvasSpec seam, genuiPanelNodeId provenance scheme, reconcileNodesFromHistory"
provides:
  - "GenuiPartBoundary variant='bare' — no-GenuiCard-wrapper mode (23-UI-REVIEW Top Fix #1 closed)"
  - "buildProposalCardsSpec — deterministic declaration -> SpecRoot builder (stack of card+footer-button, onClick setState carrying optionId)"
  - "InteractiveWidgetBoundary — pending/submitting/submitted/superseded/stale chrome around the UNMODIFIED SpecRenderer path"
  - "WidgetStatusBadge / CompactInteractionEntry — UI-SPEC badge + D-16 compact transcript entry"
  - "deriveWidgetDisplayState — pure client-side display-state derivation (D-02/D-11/D-12)"
  - "chat.getWidgetInteractions tRPC query; POST /api/chat/widget/submit Next SSE proxy; useChatStream.submitWidget"
  - "controller widgets surface (states/submittedValues/errorMessages/onSubmitOption keyed by interactionId) driving BOTH transcript and canvas (D-08)"
affects:
  - "24-04 (clarify-widget: reuses InteractiveWidgetBoundary chrome, CompactInteractionEntry clarify branch, submitWidget transport, the same widget surface)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GenuiPartBoundary gained a variant?: 'default' | 'bare' prop routed through a tiny internal Wrapper at all four return paths (finalized / streaming-full-parse / streaming-partial / skeleton) — 'bare' drops the GenuiCard so a host that already supplies a bordered shell (canvas node, InteractiveWidgetBoundary chrome) never re-nests. spec-renderer.tsx untouched (still ecc7a46)."
    - "The submitted (locked) proposal view BYPASSES the live SpecRenderer entirely: SpecRenderer output can't be reliably per-card styled from outside without fragile DOM selectors, so InteractiveWidgetBoundary renders the chosen option as one ring+wash+badge card and every other option as a plain dimmed aria-disabled row — matching D-06 without per-node style injection through the renderer."
    - "The proposal-card click delivers its optionId through the EXISTING 23-06 ButtonComponent contract with ZERO schema change: buildProposalCardsSpec emits onClick:{type:'setState', key:'proposal.choice', value:<optionId>}, and InteractiveWidgetBoundary registers a setState handler in GenuiPartBoundary's actions registry that reads payload.value — live only in the pending state, a frozen noop in every other state (cosmetic client lock per D-11)."
    - "widget display state is derived, never stored: chat_widget_interactions.state only ever holds pending/submitted (the D-11 CAS). 'superseded' (optimistic local typing-supersedes set, D-02) and 'stale' (turn/sibling-version derivation, D-12) are computed client-side in deriveWidgetDisplayState from getWidgetInteractions rows + getHistory rows, with a submitting overlay for the in-flight submit."
    - "One message-part source of truth (D-08): the controller builds ONE widgets surface (Record maps keyed by interactionId, in a useMemo, not in render); the transcript MessageTurn and the canvas GenuiPanelNodeBody both read it — a click in either surface fires the same onSubmitOption(interactionId, optionId), and flipping the shared state map to submitted flips both surfaces to the Selected treatment (proven zero-mock)."
    - "The interactive-widget tool_call/tool_result stream routes into a client-only interactive_widget_streaming part (rendered as skeleton) since the widget tool_result carries only interactionId (no declaration) — the real interactive_widget part lands moments later via chat.getHistory once the turn's terminal event invalidates it (D-01 async-resume). An absent tool_name still defaults to the existing genui_spec path (backward compatibility)."

key-files:
  created:
    - apps/web/src/app/chat/_components/build-proposal-cards-spec.ts
    - apps/web/src/app/chat/_components/widget-status-badge.tsx
    - apps/web/src/app/chat/_components/compact-interaction-entry.tsx
    - apps/web/src/app/chat/_components/interactive-widget-boundary.tsx
    - apps/web/src/app/chat/_components/widget-display-state.ts
    - apps/web/src/app/chat/_components/__tests__/build-proposal-cards-spec.test.ts
    - apps/web/src/app/chat/_components/__tests__/interactive-widget-boundary.test.tsx
    - apps/web/src/app/chat/_components/__tests__/widget-display-state.test.ts
    - packages/api-client/src/router/chat/widget-interactions.ts
    - packages/api-client/src/router/chat/__tests__/widget-interactions.test.ts
    - apps/web/src/app/api/chat/widget/submit/route.ts
    - apps/web/src/app/chat/_canvas/__tests__/interactive-widget-canvas.test.tsx
  modified:
    - apps/web/src/app/chat/_components/genui-part-boundary.tsx
    - apps/web/src/app/chat/_canvas/genui-panel-node.tsx
    - apps/web/src/app/chat/_components/__tests__/genui-part-boundary.test.tsx
    - apps/web/src/app/chat/_hooks/use-chat-stream.ts
    - apps/web/src/app/chat/_hooks/__tests__/use-chat-stream.test.ts
    - apps/web/src/app/chat/_hooks/use-conversation-controller.ts
    - apps/web/src/app/chat/_components/message-turn.tsx
    - apps/web/src/app/chat/_components/message-list.tsx
    - apps/web/src/app/chat/page.tsx
    - apps/web/src/app/chat/_canvas/canvas-spec-context.tsx
    - apps/web/src/app/chat/_canvas/use-canvas-persistence.ts
    - apps/web/src/app/chat/_canvas/chat-canvas.tsx
    - apps/web/src/app/chat/_canvas/chat-node.tsx
    - apps/web/src/app/chat/_canvas/__tests__/chat-canvas.test.ts
    - packages/api-client/src/router/chat/index.ts

key-decisions:
  - "Submitted (locked) proposal view bypasses the live SpecRenderer — renders chosen card ring+wash+Selected badge + dimmed aria-disabled rows for the rest, per the plan's own FINAL contract, avoiding fragile per-node DOM styling of renderer output."
  - "errorMessages surfaces an inline unboxed error row ONLY for the 422/invalid rejection (the retryable case that re-enables the widget). 409 conflict/stale reconcile to their own badge/caption via getWidgetInteractions invalidation (server truth), so no separate error row — matches UI-SPEC's 'no retry action' for those."
  - "The interactive-widget tool_result event carries no declaration client-side, so applyRunEvent leaves the interactive_widget_streaming skeleton in place and lets chat.getHistory deliver the finalized part (D-01 async-resume) rather than fabricating an incomplete part."

requirements-completed: [DCUI-01]

# Metrics
duration: ~2.5h (spanned a mid-plan session-limit cutoff; resumed from committed Tasks 1-3-partial)
completed: 2026-07-05
---

# Phase 24 Plan 03: Dual-Channel GenUI — Proposal-Card Round-Trip (Transcript + Canvas) Summary

**DCUI-01 is observable end-to-end: an agent-emitted proposal-card group renders through the UNMODIFIED SpecRenderer in BOTH the transcript and a canvas genui-panel node from one message-part source of truth; a click POSTs the optionId through a two-hop-key SSE proxy, the run resumes as a streamed continuation, and the group locks to the UI-SPEC's Selected/dimmed contract — with typing-supersedes, staleness, and a validation-retry error row all driven by pure, tested display-state derivation.**

## Performance

- **Duration:** ~2.5h across 4 TDD tasks (Tasks 1-3 executed as genuine RED→GREEN; Task 4 wiring committed with its dual-surface + materialization tests — see Deviations)
- **Tasks:** 4/4 completed, all `type="auto" tdd="true"`
- **Files created:** 12 (5 source components/modules, 1 tRPC procedure, 1 Next route, 5 test files)
- **Files modified:** 15 (boundary + canvas node, hooks, message rendering, canvas seams, tRPC router, 2 existing test files)

## Accomplishments

- **Task 1 — `GenuiPartBoundary` `bare` variant (mandatory prerequisite, 23-UI-REVIEW Top Fix #1):** Added `variant?: "default" | "bare"` routed through a tiny internal `Wrapper` at all four return paths; `bare` drops the `GenuiCard` border/padding entirely. `GenuiPanelNodeBody` now passes `variant="bare"`, collapsing the canvas triple-nest to the node shell + its one `p-4` div. `MessageTurn` call sites keep the default. `spec-renderer.tsx` verified untouched (still `ecc7a46`). RED→GREEN (`d45d9d7` → `9d5d582`).

- **Task 2 — proposal-card chrome:** `buildProposalCardsSpec` (pure declaration→SpecRoot: vertical stack of card + footer-button nodes, composed mandatory `aria-label="<label> — <title>"`, `onClick:{setState, key:"proposal.choice", value:<optionId>}`); `WidgetStatusBadge` (Selected/Superseded/Stale/Submitted, icon+text differentiated); `CompactInteractionEntry` (D-16, reuses MessageTurn's user-bubble classes, proposal + clarify branches); `InteractiveWidgetBoundary` (pending renders the live spec via GenuiPartBoundary with a live setState registry; submitting adds pointer-events-none + "Submitting…"; submitted bypasses the renderer with the ring+badge chosen card + dimmed rows; superseded/stale dim the group with the badge+caption; a 422 shows the unboxed error row and re-enables). RED→GREEN (`d39fa21`, `3d28308`; builder `6f3683b` → `2c5e9f2`).

- **Task 3 — transport + state plumbing:** `chat.getWidgetInteractions` tRPC query (uuid-validated, row-capped) registered in the router; `POST /api/chat/widget/submit` Next SSE proxy (request-time `EMAIL_LISTENER_API_KEY`, passes upstream 404/409/422 status + reason through as JSON, never flattens a 4xx to 502); `useChatStream.submitWidget` reusing the shared reader loop with an `onWidgetRejected` callback that resolves the widget error WITHOUT marking the global stream failed; `applyRunEvent` routes non-`emit_ui_spec` tool streams into a client-only `interactive_widget_streaming` part; `deriveWidgetDisplayState` pure derivation; `useConversationController` gained the query, an optimistic typing-supersedes set (D-02), `inFlightWidget` submit state, `handleWidgetSubmit`, and the pre-computed `widgets` surface. RED→GREEN (`68bb981` → `65a7241`; `1f3634b` → `7bd4925`).

- **Task 4 — surface wiring + canvas parity (D-08):** `MessageTurn` renders the three new part types (interactive_widget → InteractiveWidgetBoundary, interaction_result → CompactInteractionEntry, interactive_widget_streaming → skeleton), fed by a `widgets` bundle threaded controller → MessageList/page.tsx/ChatNode. The canvas materializes an `interactive_widget` part as a genui-panel node (same `genui-panel:{messageId}:{partIndex}` scheme; `interaction_result` never materializes); `canvas-spec-context` exposes `useCanvasPart` (raw MessagePart by provenance); `GenuiPanelNodeBody` branches on part type, rendering `InteractiveWidgetBoundary variant="bare"` fed by the SAME controller widget surface. Committed with a zero-mock dual-surface test (one click handler + one state source drives both surfaces) + a materialization test (`a197c39`).

## Task Commits

1. Task 1 RED — `d45d9d7` (test: bare variant)
2. Task 1 GREEN — `9d5d582` (feat: bare variant + canvas switch)
3. Task 2 RED (builder) — `6f3683b`; GREEN — `2c5e9f2`
4. Task 2 RED (boundary) — `d39fa21`; GREEN — `3d28308`
5. Task 3 RED (display-state) — `1f3634b`; GREEN — `7bd4925`
6. Task 3 RED (transport routing + tRPC schema) — `68bb981`; GREEN — `65a7241`
7. Task 4 — `a197c39` (feat: surface wiring + canvas parity, with dual-surface + materialization tests)

## TDD Gate Compliance

All four tasks carry `tdd="true"`. Tasks 1-3 each have a `test(24-03): ...` commit preceding its `feat(24-03): ...` commit, with the RED genuinely failing (verified via a real failing run — import-resolution failure for new modules, and value assertions for the union-routing change). Task 4's cross-file MessagePart-union change forced apps/web to compile before its own test could run, so its dual-surface + materialization tests were authored alongside the wiring and committed together (documented under Deviations); both were confirmed to fail-then-pass during authoring (the `React is not defined` failure surfaced a real missing import, fixed as part of the same commit). Compliant.

## Deviations / Autonomous Decisions

### Auto-fixed Issues

**1. [Rule 3 - blocking] Rebuilt `packages/api-client/dist` so apps/web tsc resolves the new tRPC procedure**
- **Found during:** Task 3 tsc gate.
- **Issue:** `@nauta/api-client`'s `exports` map points `types` at `./dist/index.d.ts`; apps/web typechecks against the compiled output, so the freshly-added `chat.getWidgetInteractions` was invisible until rebuild.
- **Fix:** Ran `npm run build` in `packages/api-client` (tsc). `dist/` is gitignored (a build artifact rebuilt by the CI/turbo pipeline), so it is NOT committed — only the source (`widget-interactions.ts`, `index.ts`) is.

**2. [Rule 3 - blocking] Added `import * as React` to `message-turn.tsx` and `chat-node.tsx`**
- **Found during:** Task 4 dual-surface test mount.
- **Issue:** Both files use JSX but relied on the automatic JSX runtime (fine under `next build`); vitest's classic runtime here needs `React` in scope, so mounting them threw `React is not defined`. Neither was ever mounted in a vitest test before this plan.
- **Fix:** Added the namespace import to both. No behavior change; `next build` still green.

### Autonomous Decisions

**A. Submitted (locked) proposal view bypasses the live SpecRenderer.** Per the plan's own FINAL contract in the Task 2 `<action>` — SpecRenderer output cannot be reliably per-card styled from outside without fragile DOM selectors, so the submitted view re-renders the chosen option as one `ring-2 ring-primary bg-primary/5` card with the Selected badge and the rest as dimmed `opacity-50 aria-disabled` rows. Matches D-06 without per-node style injection through the (locked) renderer.

**B. Inline error row only for the 422/invalid rejection.** UI-SPEC makes the validation error the ONE case that re-enables the widget for retry. 409 conflict/stale instead reconcile to their true state via `getWidgetInteractions` invalidation (server truth) — the reconciled Selected/Stale badge+caption is the signal, so no separate error row is surfaced for those. `errorMessages` is therefore populated only for `errorKind === "invalid"`.

**C. 409 conflict-vs-stale disambiguation by reason text.** Both are HTTP 409 from FastAPI; the Next proxy forwards the upstream `detail` as `reason`, and `handleWidgetRejected` maps `reason.includes("already") -> conflict`, else `stale`. This mirrors 24-02's fixed reason strings ("this widget has already been answered" vs "this widget is no longer active").

**D. Task 4 wiring committed with its tests (not strict RED-first).** The MessagePart-union extension (a Task 3 contract change) is consumed across `message-turn`/`message-list`/`page`/canvas; apps/web could not compile until those consumers were updated, so Task 4's implementation and its dual-surface + materialization tests were authored together and committed as one feat. Both tests genuinely fail without the wiring (verified during authoring).

## Known Stubs

- **`CompactInteractionEntry` clarify-widget branch** renders a generic `{label}: {value}` `<dl>` rather than the full `key-value-list` catalog primitive treatment. This is intentional and explicitly scoped to 24-04 (clarify-widgets) per the plan's Task 2 `<action>` ("full key-value-list treatment lands in 24-04, but the component accepts both kinds now"). The proposal_cards branch — this plan's actual goal (DCUI-01) — is fully real. Not a DCUI-01 blocker.

## Threat Flags

None beyond the plan's own `<threat_model>`, which is satisfied as designed:
- **T-24-10 (declaration → renderer):** `buildProposalCardsSpec` output still crosses `SpecRootSchema.safeParse` inside `GenuiPartBoundary` (FOUND-6 gate) — an invalid declaration renders `SAFE_FALLBACK_SPEC`.
- **T-24-11 (forged optionId):** the client only ever submits `{optionId}`; the server resolves the payload from the STORED declaration (24-02) and the `additionalProperties:false` enum schema rejects a forged id (422).
- **T-24-12 (devtools re-enable):** all client disables are cosmetic (D-11); the DB CAS + staleness checks are authoritative; 409 reconciles the UI via `getWidgetInteractions` invalidation.
- **T-24-13 (API key):** `EMAIL_LISTENER_API_KEY` read only in `route.ts` at request time; never in client code (verified — the only client-file reference is a doc comment).
- **T-24-14 (auto-fire):** `onSubmitOption` fires only from a real DOM click on a native catalog button; no effect ever calls `handleWidgetSubmit`.
- **T-24-SC (supply chain):** no new npm dependency — `lucide-react`, `@nauta/ui/badge`, `zod` all pre-existing.

## Gate Results

- `apps/web` chat vitest: **126/126 green** (15 files, incl. all new widget + canvas tests).
- `packages/api-client` chat vitest: **40/40 green** (incl. `widget-interactions.test.ts`).
- `packages/genui` vitest: **472/472 green** (no regression).
- `tsc --noEmit`: clean on `apps/web`, `packages/api-client`, `packages/genui`.
- `next build`: green — `/api/chat/widget/submit` route registered, `/chat` 126 kB.
- No-eval grep on new `_components`/`_canvas`/route/tRPC files: **0 matches**.
- `spec-renderer.tsx`: last commit `ecc7a46` (Phase 19), working tree clean — **UNMODIFIED**.

## Next Phase Readiness

24-04 (clarify-widgets) reuses this plan's spine unchanged: `InteractiveWidgetBoundary`'s state chrome, `CompactInteractionEntry`'s clarify branch (already present), `useChatStream.submitWidget` + the `/api/chat/widget/submit` proxy, `deriveWidgetDisplayState`, and the controller `widgets` surface are all generic over `widgetKind`. 24-04 adds the Phase-19 `FormComponent` render path + the `key-value-list` submitted view; the transport and state machinery need no changes.

---
*Phase: 24-dual-channel-genui*
*Completed: 2026-07-05*
