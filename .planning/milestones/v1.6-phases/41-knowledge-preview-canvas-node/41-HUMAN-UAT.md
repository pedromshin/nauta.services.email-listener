---
status: complete
phase: 41-knowledge-preview-canvas-node
source: [41-VERIFICATION.md, 50-02-PLAN.md]
started: 2026-07-09T16:30:03Z
updated: 2026-07-11T06:20:00Z
---

## Current Test

None — all five scenarios closed.

## Tests

### 1. Two-ring ellipse visual quality
expected: Open `/chat` with a placed `knowledge-preview` node whose focus node has both 1-hop and 2-hop neighbours. The focus dot renders centered, 1-hop dots evenly spaced on an inner ellipse ring, 2-hop dots evenly spaced on an outer ellipse ring (grouped near their connecting 1-hop parent), SVG edge lines connecting them without visual overlap/crowding inside the fixed 280x140 box, tier-styled per 41-UI-SPEC.md (dashed=INFERRED, faint=AMBIGUOUS, solid=EXTRACTED).
result: passed — `apps/web/e2e/uat-41-knowledge-preview.spec.ts` (Phase 50 Plan 02) seeds a real tier-diverse `knowledge_nodes`/`knowledge_node_edges` fixture (1 focus + 1 one-hop EXTRACTED + 1 one-hop INFERRED + 1 two-hop AMBIGUOUS, `uat-chat-fixtures.ts`'s `seedKnowledgeGraphFixture`), places a live `knowledge-preview` canvas node against the local stack, and DOM-asserts all 3 tier-styled edges (1 dashed `stroke-dasharray="5 3"` for INFERRED, 1 faint `opacity="0.45"` for AMBIGUOUS, 1 solid full-opacity for EXTRACTED) and all 4 node dots (1 focus `size-5`, 2 one-hop `size-3`, 1 two-hop `size-2`) render correctly. Passed 4/4 consecutive live runs against the local stack.

### 2. Tooltip/hover behavior
expected: Hovering over a mini-graph node dot shows a Radix Tooltip after the ~300ms delay, displaying the node's full (non-truncated) label, positioned sensibly relative to the dot, dismissing cleanly on mouse-leave.
result: passed — the same spec's 41.2 test hovers a real one-hop dot, DOM-asserts the Radix tooltip becomes visible with the node's exact full label, then moves the pointer away and DOM-asserts the tooltip closes. Live run surfaced and fixed a real Radix Tooltip hoverable-content grace-area timing quirk (a single synthetic `mouse.move` away arrives before its own exit-polygon check can evaluate it — a second, tiny follow-up move supplies the `pointermove` the check needs); the underlying dismiss behavior itself works correctly once given a realistic two-step pointer exit.

### 3. Add-preview popover open/close feel
expected: Clicking the "Add knowledge preview" toolbar button opens a Popover anchored to the trigger with a smooth transition; the form is usable; it closes cleanly on Cancel, on a successful Add, or on outside-click, with no visual glitch or lingering portal content.
result: passed — the same spec's 41.3 test drives all three close paths against the live popover: invalid-id inline validation (stays open with error copy), successful Add (materializes a real new `knowledge-preview` node, closes), Cancel (discards the draft, node count unchanged, closes), and a genuine outside-click on the empty React Flow pane background (closes). No code-level issue found — only test-selector precision needed fixing (the popover's own toolbar panel occupies the coordinate the test originally clicked).

### 4. New-node placement near viewport center
expected: Adding a knowledge-preview node from the toolbar while the canvas is panned/zoomed to some arbitrary viewport places the new node — selected, cascaded away from any overlapping existing node — visibly near the CURRENT viewport center, not the canvas origin or an off-screen position.
result: passed — the same spec's 41.4 test pans the canvas via real mouse drag, reads `.react-flow__viewport`'s live CSS transform, computes the expected `screenToFlowPosition` result the same way `handleAddKnowledgePreview` does, adds a new knowledge-preview node, and DOM/math-verifies the added node lands within tolerance of that computed viewport-center flow position (and, as a robust floor, meaningfully away from the canvas origin). This scenario was deferred across v1.3-v1.6 specifically for lacking a live React Flow viewport — Phase 50 Plan 02 supplies one via a real Playwright browser.

### 5. Remove-then-reload persistence round-trip
expected: Clicking a knowledge-preview node's remove (X) button removes it immediately; after a full page reload against a running stack, the node stays gone (the debounced `chat.saveCanvasLayout` mutation persisted the removal to the DB, not just local React Flow state).
result: passed — the same spec's 41.5 test clicks Remove, DB-polls `chat_canvas_layouts.nodes` until the debounced save persists the removal, then does a full `page.reload()`, re-selects the conversation (the app's `selectedId` is in-memory React state, not URL/storage-backed, so a reload always requires re-selecting), and DB/DOM-verifies the node is still gone post-reload. Confirms the removal survived the full DB round-trip, not just local React Flow state.

## Deviations / issues found and fixed during burn-down

**1. [Rule 1 - Bug] `chat-canvas.tsx` reconcile-effect restore race (production bug, not test-only).**
`useCanvasPersistence`'s restore effect mutates `seededRef.current = true` synchronously immediately
after calling `setNodes(updaterFn)` — but React invokes a functional `setNodes` updater
asynchronously (deferred to the render phase), so the updater could observe the
ALREADY-flipped `seededRef.current === true` and fall back to `prev` (still `[]` on a fresh
mount) instead of `persistence.initialNodes`. This silently dropped every restored canvas node
beyond the synthesized default chat node on EVERY canvas restore whenever a saved layout
contained more than just the chat node (e.g., any `knowledge-preview` or `genui-panel` node).
Fixed by capturing `wasSeeded = seededRef.current` synchronously before the `setNodes` call and
using that captured snapshot inside the updater instead of a live ref read.
Files: `apps/web/src/app/chat/_canvas/chat-canvas.tsx`. Verified via 4 consecutive clean
5/5 test runs post-fix; all 21 pre-existing chat-canvas/use-canvas-persistence unit tests still
pass.

**2. Test-authoring bugs (Rule 1, test files only) — auto-fixed, no product code involved:**
- 41.1's SVG-line selector was unscoped (`svg line` also matched two lucide `Share2` icon svgs,
  each contributing 2 `<line>` elements) — scoped to the mini-graph's own `svg[width="280"]`.
- 41.1's "solid, full-opacity" edge-count assertion expected 2 but only 1 edge (EXTRACTED) can
  ever match that filter given only 3 total edges exist — corrected to 1.
- 41.1's dot-size-class selector was unscoped (`.size-3` also matched the focus dot's own nested
  Share2 icon, which independently carries a `size-3` class) — scoped to `a > span.size-3` (the
  direct-child dot wrapper only).
- 41.3's outside-click coordinate (pane-relative `{20, 20}`) landed inside the toolbar's
  top-right `Panel` (same one hosting the "Add knowledge preview" button) instead of empty pane
  background — moved to the pane's bottom-center via its live bounding box.
- 41.5 assumed a plain `page.reload()` alone would restore canvas view — `page.tsx`'s
  `selectedId` is in-memory React state only, so reload always requires re-selecting the
  conversation; added that step.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. All five scenarios closed with DB/DOM-verified live evidence (Phase 50 Plan 02,
`apps/web/e2e/uat-41-knowledge-preview.spec.ts`), including one genuine production bug found and
fixed along the way (`chat-canvas.tsx`'s restore-race, see Deviations above). No tracked-fix
needed — every scenario was tractable within budget.
