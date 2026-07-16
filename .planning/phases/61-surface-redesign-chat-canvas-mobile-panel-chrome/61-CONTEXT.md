# Phase 61: Surface Redesign — Chat, Canvas & Mobile Panel Chrome — Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** Auto-generated — the design contract, a rendered reference, AND Phase 60's realized
patterns all already exist. This phase inherits; it does not re-derive.

<domain>
## Phase Boundary

Redesign `/chat` and its canvas ON the locked identity — composer, message stream, tool-round rows,
genui panel chrome, canvas chrome (controls, minimap, background, node shells, edges) — and close
backlog **999.17**: editable-panel chrome reachable on mobile, and the docked/mobile transcript
honoring panel overlays made on the canvas side.

**Requirements:** SURF-02, SURF-07. Nothing else.

**OUT (Phase 62's):** `/knowledge`, `/studio`, `/settings/*`, `/login`. Do not sweep them.
`globals.css`'s `.react-flow__*` block is shared with `/knowledge` — improving it is in scope
*because it is the system*, but `/knowledge`'s own node chrome, filter rail, legend and detail pane
are NOT.

**OUT (Phase 63's):** research-canvas source nodes, canon curation, edges-as-context visuals. This
phase builds the vocabulary those will consume; it does not build them.
</domain>

<decisions>
## Implementation Decisions

**The identity is locked. The design decisions are made. There are no taste calls left here.**

THE CONTRACT: `.planning/phases/58-visual-identity-sketch-pick-human-gate/58-IDENTITY.md`
(D-58-01, LOCKED by the user 2026-07-15). Three laws, non-negotiable:

1. **Colour is earned, never decorative.** Chrome is monochrome/ink. Verdigris = Confirmed,
   pencil-amber = Suggested, madder = **irreversible actions only** ("Never errors, never
   warnings"). Buttons, links, nav, selection, focus rings are INK.
2. **Chrome speaks sans, evidence speaks serif.** Anything from the user's own mail/content is
   serif. No exceptions.
3. **Entity type is shape, never hue.**

THE RENDERED REFERENCE: `sketches/direction-final.html` **already contains a designed Chat & Canvas
screen** (`<section id="chat">`, lines 992–1096; CSS lines 391–494), both themes. This is the visual
target for this phase. Read its markup/CSS for the intended layout, hierarchy and density. It is a
SKETCH — realize its design in the real React surfaces, do not copy its DOM.

**INHERIT Phase 60's realized patterns — do NOT re-derive them.** Read
`docs/design/brand-guide.md` §3 "Realized surface patterns" and
`.claude/skills/polytoken-design-system/SKILL.md` first. The load-bearing carry-forwards:

- **`region-vocabulary.ts` owns the tier/role orthogonality rule.** *Tier owns colour +
  solid-vs-dashed; role owns weight/style/geometry, never hue.* Phases 61–63 need this for canvas
  **nodes and edges**. **Grow the vocabulary; never improvise a local class map** — a local map is
  exactly how the `graph-*` debt accumulated.
- **`pmark`/`chip` IMPLIES `font-serif`.** Using it on chrome smuggles serif past the law-2 gates,
  which read class strings and cannot see that one class implies another. Use `badge`/`swatch` for
  chrome; `chip`/`pmark` for real document-derived evidence.
- **`data-evidence` ⟺ `font-serif`** must mutually imply each other.
- **`role-hue-ban.test.ts` exports `SCOPED_DIRS` as a RATCHET.** It scopes `_components` and
  `emails/[id]` today. **Phase 61 MUST append its own surface roots** (`chat/`, including
  `_canvas/`) as it sweeps. `graph-*` is still legitimately used on canvas/knowledge — that is
  precisely what 61 is sweeping.
- **The madder rule's gate is a PROXY, not a proof.** `variant="destructive"`/`bg-destructive`
  allowed (irreversible controls); `text-destructive`/`border-destructive` banned (states). 60-06
  found `pdf-preview-pane` rendering `<Badge variant="destructive">Preview failed</Badge>` — a
  status in madder that PASSED the gate. Plan for a human/read check, not just the gate.

Claude's discretion: which components restructure vs. restyle, and exact layout mechanics — but
density/hierarchy must be a deliberate designed choice traceable to the reference, never an
inherited default.
</decisions>

<code_context>
## Existing Code Insights

**The chat surface** (`apps/web/src/app/chat/`, ~12.6k lines):
- `page.tsx` — the two-state layout; `ConversationView` owns the `h-11` top bar + the
  Chat/Canvas branch. `effectiveViewMode = isMobile ? "chat" : viewMode` — **the canvas never
  mounts below `md`. That is 999.17's root cause.**
- `_components/` — `composer.tsx`, `message-list.tsx`, `message-turn.tsx`, `conversation-rail.tsx`,
  `conversation-row.tsx`, `markdown-renderer.tsx`, `tool-round-activity-row.tsx`,
  `tool-invocation-result-row.tsx`, `genui-part-boundary.tsx`.
- `_canvas/` — `chat-canvas.tsx` (834 lines, the host), `chat-node.tsx`, `genui-panel-node.tsx`,
  `email-thread-node.tsx`, `knowledge-preview-node.tsx`, `data-edge.tsx`,
  `panel-actions-toolbar.tsx` + `controls/*`, `panel-overlay.ts` + `panel-overlay-context.tsx`,
  `canvas-store-context.tsx`, `use-canvas-persistence.ts`.

**Stock React Flow styling that is still live** (criterion 2's actual target):
- `import "@xyflow/react/dist/style.css"` at `chat-canvas.tsx:51` (and `knowledge-graph.tsx:53`).
- `<Handle type="target" position={Position.Left} />` on every node with **no className** → stock
  `.react-flow__handle` (dark navy dot, white border). This is stock default styling on every node
  shell, on both surfaces.
- `.react-flow__controls` / `-button` / `__minimap` / `__attribution` are partially overridden in
  `globals.css` `@layer components` (lines 709–736) — a Phase-26 re-token, not a redesign.
- `<Background gap={16} size={1} color="var(--border)" />` — the sketch's board is a **22px dot
  grid in `var(--grid)`**, with an explicit ban-#12 exception ("this surface IS a canvas, so a grid
  is the working surface, not decoration").
- `DataEdge` uses `className="!stroke-primary"`; the sketch's edges are `--edge` neutral, with
  `--conf-line` solid / `--sugg-line` dashed reserved for tier.

**Tokens the sketch's canvas needs — all already DECLARED in `globals.css` (both themes), none
registered in `@theme`:** `--edge`, `--grid`, `--rule-hi`, `--ink-05`. So `bg-grid`/`stroke-edge`
utilities do NOT exist; either register them or consume `var(--edge)` at the call site (React Flow's
`Background color=` prop already takes a raw CSS value).

**999.17's shape, precisely:**
- `usePanelOverlay(panelId)` needs BOTH `CanvasStoreProvider` and `CanvasPersistenceProvider` —
  **only `chat-canvas.tsx` provides them**, so the docked transcript can never see an overlay.
- `MessageTurn` renders `genui_spec` parts as `<GenuiPartBoundary specJson={JSON.stringify(part.spec)} />`
  — raw base spec, no `resolveActivePanel`, no `PanelThemeScope`. That IS criterion 4's gap.
- The two pure functions that make the fix cheap already exist: `genuiPanelNodeId(messageId,
  partIndex)` (`use-canvas-persistence.ts:89`) and `resolveActivePanel(overlay, specJson,
  isStreaming)` (`panel-overlay.ts:160`). `chat.getCanvasLayout` is a plain tRPC query — the
  transcript can read the same persisted `sharedState` without mounting React Flow.
- `MessageList` is rendered in BOTH `page.tsx` (docked) and `chat-node.tsx` (on canvas). Any
  overlay read from `MessageTurn` MUST be non-throwing/optional or the canvas's own ChatNode
  breaks.

**Environment facts — bake into every verification block:**
- **npm workspaces, NOT pnpm.**
- **NEVER a bare `npx playwright test`.** The default config spawns a second `next dev` sharing
  `apps/web/.next` and corrupts it. Use `npm run screenshot:review` (`reuseExistingServer: true` on
  port 3000) or a dedicated config with **no `webServer` block**.
- `npm run build:local` is now safe (`7df5ad2` — targets `.next-verify` via `NEXT_DIST_DIR`). Never
  `npm run build -w @polytoken/web` (fails on missing env — pre-existing).
- A dev server is live on port 3000; the Supabase stack is up.

**Known harness defects — plan around them:**
- **999.23** — no theme axis. Dark mode has NEVER been captured, despite the user's pick requiring
  light AND dark. Probe-proven approach: `emulateMedia({colorScheme})` + `localStorage.theme` +
  toggling `.dark` on `<html>` (next-themes, `attribute="class"`, `defaultTheme="system"`).
- **999.24** — screenshots fire BEFORE async data lands, so entity chips are missing from every
  capture. Nearly produced a false "the redesign has no tier chips" verdict.
- **999.25** — the fixture seeds zero entities/extractions, so pencil-amber `--sugg` has never
  rendered. Valuable if reachable; **do not block on it.**
- The "N" badge over "Sign out" is the Next.js dev indicator. Not a bug.
- **999.21** (sidebar pointer-events) — pre-existing, opportunistic only.

**Baseline:** 72 test files / 806 passing (60-07). 44 chat suites / 363 tests.
</code_context>

<specifics>
## Specific Ideas

**A rendered-geometry gate is MANDATORY (criterion 2 and beyond).** Four layout/runtime bugs
shipped through green suites tonight, every one invisible to the tests:

- The sidebar shipped at **half width** through Phase 55's 4/4 verification + 730 green tests
  (`w-[--sidebar-width]` is v3; v4 needs `w-(--sidebar-width)`). The user found it by opening the app.
- **`/chat`'s conversation rail broke its height chain** (`e2a2abf`, fixed just now): Radix
  `<Collapsible>` renders a bare `<div>` with no class of its own and was given no className, so it
  grew to content — the document scrolled to **11,296px at a 900px viewport** and the main pane read
  as empty. All 44 chat suites (363 tests) passed before AND after. **jsdom does no layout, so no
  unit test can ever see this.**

The highest-value single assertion: **no surface scrolls its document unexpectedly**
(`documentElement.scrollHeight <= innerHeight + ε`), plus scroll-containment for the rail/transcript
(their own `[data-radix-scroll-area-viewport]` scrolls internally). That catches the entire class.
It must be a real browser check driven against the ALREADY-RUNNING dev server. Include a negative
proof (remove `h-full` from the `Collapsible` → gate goes RED).

**Criterion 2 says zero stock React Flow default styling remaining** — a concrete, checkable claim.
Gate it, don't assert it in prose.

**Criteria 3 and 4 are about real mobile reachability**, not a media query.

**Do NOT touch load-bearing chat logic while restyling:** the conversation controller, WebLLM engine
threading (D-08 — a single top-level `useWebllmEngine()` threaded down so switching conversations
never re-downloads the engine), canvas persistence/save-status, and D-54's sharedState stance.

**D-54 clarification (an executor WILL trip on this):** D-54 says canvas `sharedState` is NOT the
semantic *linkage* store — that is Phase 56's `chat_context_edges` table. **Panel overlays
legitimately live in `shared.panelOverlays.{panelId}`** and always have (52-01). Reading them from
the transcript does not touch D-54.
</specifics>

<deferred>
## Deferred Ideas

- `/knowledge`, `/studio`, `/settings/*`, `/login` → Phase 62.
- Research-canvas source nodes / canon curation / edges-as-context visuals → Phase 63. This phase
  leaves them a vocabulary, not a component.
- **999.25** (fixture seeds no entities/extractions, so `--sugg` has never rendered) — valuable,
  explicitly not a blocker.
- **999.21** sidebar pointer-events — opportunistic only.
- D-58-03 (entity-type-as-shape) remains the one user-unblessed law. If realizing it on canvas nodes
  makes a concrete cost visible, document it — do not silently reverse it.
</deferred>
