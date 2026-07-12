# Phase 52 — UI Review

**Audited:** 2026-07-12
**Baseline:** `.planning/phases/52-editable-genui-panels-studio-on-canvas/52-UI-SPEC.md` (draft, unapproved — Checker Sign-Off block still shows all dimensions unchecked, `Approval: pending`)
**Screenshots:** not captured — CODE-LEVEL AUDIT ONLY per explicit task context (local stack down; overnight run). No dev-server detection was attempted, per instruction not to launch the stack. This mirrors `52-VERIFICATION.md`'s own `human_needed` status (17/17 truths verified at code level, live-canvas confirmation deferred to `MORNING-CHECKLIST.md` §G).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every string in every new file matches the Copywriting Contract table verbatim (toasts, banners, CTAs, tooltips, empty state) — no generic labels found |
| 2. Visuals | 3/4 | Compliant hierarchy/hover/tooltip discipline, but two stacked header rows (h-9 + h-8 = 68px chrome) over a 204px content viewport is unverified in a real browser — genuine visual-density risk the deferred live-canvas gate exists specifically to catch |
| 3. Color | 4/4 | Zero raw hex/rgb in touched files; `--primary` usage confirmed limited to the 2 spec'd CTA buttons + `GeneratingRing`, nothing else |
| 4. Typography | 3/4 | Labels/headings correctly `text-xs`, but Input/Textarea/enum-Select field VALUES inherit the base components' `text-sm` (14px) with no override — a 3rd, unacknowledged type size inside popovers the contract claims are "all text-xs" |
| 5. Spacing | 4/4 | Every class matches the SPEC's literal authored values; the one arbitrary value (`min-h-[272px]`) is an explicitly documented, math-justified exception |
| 6. Experience Design | 3/4 | Strong state coverage overall, but the promised per-action "revert + toast.error" for Pack Switch and Restore Version is unreachable against a real async persistence failure — self-documented in code as a test seam, not modeled production behavior |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Silent failure on real persistence errors for Pack Switch (PANL-01) and Restore Version (PANL-03)** — User impact: if `chat.saveCanvasLayout` genuinely fails over the network mid-switch or mid-restore, the user sees no revert and no error toast — the UI looks like it succeeded while the change was never durably saved (only a global, easy-to-miss `SaveStatusIndicator` flips to "error" elsewhere on screen). Concrete fix: thread `use-canvas-persistence.ts`'s `saveMutation.onError` back to the originating panel/action (e.g. have `scheduleSave` accept an `onError` callback, or expose `saveStatus` through `usePanelOverlay` so `pack-switcher.tsx`/`version-history-control.tsx` can react to a REAL failure, not just their own synchronous-throw test seam at `pack-switcher.tsx:71-86` / `version-history-control.tsx:137-154`).

   **Status: FIXED** (2026-07-12) — `scheduleSave` now accepts an optional `onError` callback (accumulated per debounce cycle, invoked only when that cycle's real `chat.saveCanvasLayout` mutation genuinely fails — never on success, never synchronously); `usePanelOverlay`'s `writeOverlay(next, onSaveError?)` forwards it. `PackSwitcher`/`VersionHistoryControl` pass a `revertAndToast` callback as `onSaveError` — the SAME handler the pre-existing synchronous-throw test seam already used, now also wired to the real failure signal. See `.planning/phases/52-editable-genui-panels-studio-on-canvas/52-UI-REVIEW-FIXES.md`. Commits: `bff7377` (RED test), `df69453` (scheduleSave/writeOverlay plumbing), `ad6d002` (pack-switcher/version-history-control revert wiring), `473a20e` (genuine-async-failure test coverage).

2. **Form-control values render one size larger than their labels inside every popover** — User impact: in the Parameter Editor popover, a field's `Label` ("Title", "Columns", etc.) renders at 12px (`text-xs`) while the `Input`/`Textarea`/`Select` the user actually types into renders at 14px (`text-sm`, the un-overridden shadcn base default) — an unintentional visual size mismatch inside a single form row, and a 3rd font size the SPEC's own Typography table explicitly says shouldn't exist ("all content is form controls or list rows at text-xs"). Concrete fix: add `className="text-xs"` (or `h-8 text-xs`) to the `Input`/`Textarea`/`SelectTrigger` instances in `edit-params-control.tsx`'s `EditParamField` (lines 183–223), or formally amend the UI-SPEC to accept the inherited `text-sm` register if that's the intended visual weight.

   **Status: FIXED** (2026-07-12) — `className="text-xs"` added to the string/text/number `Input`+`Textarea` and the enum `SelectTrigger` in `edit-params-control.tsx`'s `EditParamField`, plus `RethemeControl`'s instruction `Textarea` (same un-overridden `text-sm` inheritance, not previously flagged by name but the identical pattern). No height changes. Commit: `832c98e`.

3. **Two-row toolbar chrome density never confirmed live** — User impact: the new `h-8` toolbar row stacked directly under the existing `h-9` drag-handle row adds 32px of secondary chrome to an already-compact `min-h-[272px]`/`min-w-[320px]` panel (chrome is now ~25% of the shell's minimum height) — a legitimate crowding risk for the smallest/tightest panels that the deferred live-canvas screenshot-diff (`52-VERIFICATION.md`'s `human_needed` gate) exists precisely to catch. Concrete fix: when the stack comes back up, run the deferred `MORNING-CHECKLIST.md` §G item 5 live-canvas pass BEFORE calling this phase visually done, with specific attention to a `grid`/`card` panel at the 320×272 floor.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Every copy string in the 5 new surfaces was diffed character-for-character against 52-UI-SPEC.md's Copywriting Contract table:

- Toolbar tooltips: "Edit parameters" (`edit-params-control.tsx:341`), "Regenerate" (`regenerate-control.tsx:152`), "Re-theme" (`retheme-control.tsx:138`), "Version history" (`version-history-control.tsx:171`) — all exact matches, no generic "Edit"/"Undo"/"History" shortenings.
- Disabled-edit tooltip: "This panel has no editable parameters" (`edit-params-control.tsx:318`) — exact.
- Param editor: heading "Edit panel parameters" (`:344`), primary CTA "Save changes"/"Saving…" (`:366-382`), secondary CTA "Discard changes" (`:365`, correctly NOT "Cancel" per the contract's explicit callout), server-error banner "Couldn't save these changes — check the highlighted fields." (`:350`) — all exact, including the em-dash.
- Re-theme: heading "Describe a new look" (`retheme-control.tsx:141`), placeholder `e.g. "Make it feel more playful and colorful"` (`:155`), primary CTA "Apply look"/"Re-theming…" (`:167-187`), secondary CTA "Discard" (deliberately shorter than the param editor's, per contract) (`:164`), inline error (`:147`), success toast "Panel re-themed" (`:112`) — all exact.
- Version history: heading "Version history" (`:175`), empty state "No earlier versions yet — changes will appear here." (`:53,199`), "Current" label used identically in both the row text and the `Badge` (`:182,185`), verbs "Regenerated"/"Re-themed"/"Edited" (`:58-61`), "Restore version" busy-collapses-to-spinner-only (`:117-121`), success/error toasts (`:52-53`) — all exact.
- Retry action label "Retry" used identically across all 3 error-toast call sites (`pack-switcher.tsx:82`, `regenerate-control.tsx:127`, `version-history-control.tsx:151`) via the same `{ action: { label, onClick } }` shape the contract mandates reusing from `confirm-deny-controls.tsx`.

No `Submit`/`Click Here`/`OK`/generic `Cancel` found anywhere in the 5 new files (grepped). This is close to a textbook-perfect copy transcription from contract to code.

### Pillar 2: Visuals (3/4)

- Hierarchy is correctly deferential: the toolbar is `text-muted-foreground`-only with no fills (`panel-actions-toolbar.tsx:86`), so it never competes with the rendered spec content — matches the contract's explicit "intentionally secondary and low-contrast" instruction.
- Every icon-only button has both an `aria-label` and a paired `Tooltip`/`TooltipContent` (`panel-action-button-class.ts` consumers in all 4 controls) — no unlabeled icon buttons found.
- Icon-in-button sizing (`size-3.5` inside `size-6`) is reused verbatim from `KnowledgePreviewNode`'s precedent, not reinvented — consistent visual language.
- **Finding:** the shell now stacks TWO header rows — the existing `h-9` `.node-drag-handle` (`genui-panel-node.tsx:138`) plus the new `h-8` `PanelActionsToolbar` (`panel-actions-toolbar.tsx:83-87`) — directly on top of a `min-h-[272px]`/`min-w-[320px]` shell (`genui-panel-node.tsx:224`). That's 68px of non-content chrome (~25%) against a panel whose floor is barely 272px tall. This is architecturally sound (Judgment Call #2 does the arithmetic correctly, preserving the original 204px content viewport) but the actual PERCEIVED density — whether a `grid`/`card` panel at its minimum footprint feels cramped with 5 interactive controls crammed into a 32px-tall row — has never been rendered in a real browser. `52-VERIFICATION.md` itself flags this exact gap (`human_needed`, live-canvas screenshot-diff deferred to `MORNING-CHECKLIST.md` §G). Docked one point for this unverified structural risk, not for anything demonstrably wrong in the code.

### Pillar 3: Color (4/4)

- Grepped `text-primary|bg-primary|border-primary|ring-primary` across the entire `_canvas` directory: the only hits inside the 5 NEW files are zero — `--primary` only enters via the shared `Button variant="default"` component (the 2 spec'd CTAs: "Save changes", "Apply look") and `<GeneratingRing>`, exactly as the contract's Accent(10%) reservation table allows and nothing more. The toolbar icon buttons, pack switcher, and history rows all stay neutral (`text-muted-foreground`) at rest, per contract.
- Grepped `#[0-9a-fA-F]{3,8}|rgb\(|rgba\(` across the same directory: zero matches. The committed palette-ban gate (`palette-ban.test.ts`, cited as re-run green in `52-VERIFICATION.md`) has no raw-hex surface to catch here.
- Destructive token usage (`border-destructive/30 bg-destructive/5 text-destructive`) is confined to the two inline validation banners (`edit-params-control.tsx:348`, `retheme-control.tsx:145`) — never a button fill, matching the contract's "no destructive action exists here" note.

### Pillar 4: Typography (3/4)

- Headings/labels/helper/error text are correctly `text-xs` (12px) throughout: `edit-params-control.tsx:179,225,228,232,344`, `retheme-control.tsx:141,145,159`, `version-history-control.tsx:102,113,175,179,198`. The one `text-[10px]` micro-chip usage (`version-history-control.tsx:184`, the "Current" `Badge`) matches the contract's stated precedent exactly.
- **Finding:** the contract's own Typography table states "none of this phase's popovers need `text-sm` body prose — all content is form controls or list rows at `text-xs`" (52-UI-SPEC.md lines 76-78). In practice, the `Input`/`Textarea`/`SelectTrigger` primitives each hardcode `text-sm` in their base class (`packages/ui/src/input.tsx:13`, `packages/ui/src/textarea.tsx:12`, `packages/ui/src/select.tsx:27`), and `edit-params-control.tsx`'s `EditParamField` (lines 182-223) never overrides that with `text-xs` on any of the three control types it renders. The net effect: a field's `Label` is 12px but the value the user actually reads/types is 14px — the SPEC's stated "text-xs everywhere" typography register is not what actually renders. This is a pre-existing pattern also present in the unrelated `add-knowledge-preview-popover.tsx` precedent (so it's not a NEW mistake this phase invented), but 52-UI-SPEC.md explicitly claims a stricter contract than what any popover in this codebase — including this phase's own — actually delivers.

  **Status: FIXED** (2026-07-12, commit `832c98e`) — `edit-params-control.tsx`'s `EditParamField` now passes `className="text-xs"` on all three control types (string/number `Input`, `text` `Textarea`, enum `SelectTrigger`); `retheme-control.tsx`'s instruction `Textarea` gets the same treatment. `add-knowledge-preview-popover.tsx`'s identical pre-existing pattern is intentionally left untouched — out of this phase's scope.

### Pillar 5: Spacing (4/4)

- Every spacing class in the 5 new files (`h-8`, `h-6`, `size-6`, `size-3.5`, `gap-1`, `px-2`, `px-1.5`, `w-80`, `w-72`, `w-28`, `space-y-3`, `space-y-1`, `p-2`, `pt-1`) is a literal, character-exact match to the SPEC's own authored code blocks — this phase didn't paraphrase or approximate the contract's spacing, it reproduced it.
- The single arbitrary-bracket value in scope, `min-h-[272px]` (`genui-panel-node.tsx:224`, up from `min-h-[240px]`), is explicitly called out and arithmetically justified in the SPEC's own Spacing Scale exceptions section and Judgment Call #2 — not an unsanctioned deviation.
- No other `\[.*px\]`/`\[.*rem\]` arbitrary values found in the 5 new control files (grepped) beyond the badge's `text-[10px]`, itself an inherited/sanctioned precedent.

### Pillar 6: Experience Design (3/4)

- Loading: `Loader2` spinner + label swap on Save/Apply/Restore, `motion-safe:animate-spin` + `aria-label` swap on Regenerate, `aria-busy` on the pack `Select` — comprehensive and matches the Interactive-State Contract table row-for-row on the HAPPY path.
- Error (reachable path): `edit-params-control.tsx`, `regenerate-control.tsx`, and `retheme-control.tsx` all route through REAL tRPC `useMutation`/`useQuery(enabled:false)+refetch()` calls whose `onError`/non-`ok` branches are genuinely reachable in production — these three actions' error UX is real, not simulated.
- Empty state: "No earlier versions yet — changes will appear here." renders correctly when `priorVersions.length === 0` (`version-history-control.tsx:197-201`).
- Mutual exclusion: `panel-actions-toolbar.tsx`'s `isLockedFor` correctly locks every OTHER control while one is busy, and force-locks all of them while `isStreaming` — matches the contract precisely.
- **Finding:** two of the five actions — Pack Switch (PANL-01) and Restore Version (PANL-03) — do NOT go through a real network call from the component's own perspective. Both write through `usePanelOverlay`'s `writeOverlay`, which synchronously calls the zustand store's `mutate()` and then calls `scheduleSave()` — a debounced, fire-and-forget timer (`use-canvas-persistence.ts:439-472`) whose real `chat.saveCanvasLayout` mutation failure only ever updates a page-level `saveStatus` (feeding the ambient `SaveStatusIndicator`), with no path back to the calling control. `pack-switcher.tsx`'s own module doc admits this directly: "the REVERT-ON-FAILURE path is modeled through `writeOverlay` itself throwing synchronously — the injectable/spyable test seam" (`pack-switcher.tsx:14-18`) — i.e., the revert+toast the Interactive-State Contract promises for a pack-switch or restore failure is verified only against a synthetic throw, not against how a real save failure actually surfaces. `version-history-control.tsx:137-154` repeats the identical pattern for Restore. Net effect: a genuine network hiccup during a pack switch or version restore will look like a silent success to the user — no revert, no toast — with the only signal being an easy-to-miss ambient status elsewhere in the canvas chrome.

  **Status: FIXED** (2026-07-12) — `scheduleSave`/`writeOverlay` now carry an optional `onError`/`onSaveError` callback fired only when that write's real debounced `chat.saveCanvasLayout` mutation genuinely fails; `pack-switcher.tsx` and `version-history-control.tsx` both pass their existing `revertAndToast` handler through this new real-failure path, alongside (not replacing) the original synchronous-throw test seam. Commits: `bff7377`, `df69453`, `ad6d002`, `473a20e`. Full detail in `.planning/phases/52-editable-genui-panels-studio-on-canvas/52-UI-REVIEW-FIXES.md`.
- **Minor/latent gap (not scored down further):** the field-type mapping table's Boolean → `Switch` row (52-UI-SPEC.md's Component 2 table) has zero implementation surface — `PanelEditFieldKind` (`panel-edit-schema.ts:67`) is a closed `"string" | "text" | "enum" | "number"` union with no `"boolean"` member, and `EditParamField` (`edit-params-control.tsx:173-235`) has no Switch-rendering branch. This is not a violation today (no root type in `PANEL_EDIT_FIELDS` needs a boolean field, so the path is simply never exercised — the SPEC itself frames the field-type table as binding "for whatever fields the planner selects"), but it means the contract's Switch recipe is entirely unbuilt and untested should a future root type add a boolean attribute.

---

## Files Audited

- `.planning/phases/52-editable-genui-panels-studio-on-canvas/52-UI-SPEC.md` (design contract)
- `.planning/phases/52-editable-genui-panels-studio-on-canvas/52-01-SUMMARY.md` through `52-06-SUMMARY.md`
- `.planning/phases/52-editable-genui-panels-studio-on-canvas/52-VERIFICATION.md`
- `apps/web/src/app/chat/_canvas/genui-panel-node.tsx`
- `apps/web/src/app/chat/_canvas/panel-actions-toolbar.tsx`
- `apps/web/src/app/chat/_canvas/panel-theme-scope.tsx`
- `apps/web/src/app/chat/_canvas/panel-overlay-context.tsx`
- `apps/web/src/app/chat/_canvas/use-canvas-persistence.ts`
- `apps/web/src/app/chat/_canvas/format-relative-time.ts`
- `apps/web/src/app/chat/_canvas/add-knowledge-preview-popover.tsx` (precedent comparison)
- `apps/web/src/app/chat/_canvas/controls/panel-action-button-class.ts`
- `apps/web/src/app/chat/_canvas/controls/pack-switcher.tsx`
- `apps/web/src/app/chat/_canvas/controls/edit-params-control.tsx`
- `apps/web/src/app/chat/_canvas/controls/regenerate-control.tsx`
- `apps/web/src/app/chat/_canvas/controls/version-history-control.tsx`
- `apps/web/src/app/chat/_canvas/controls/retheme-control.tsx`
- `packages/api-client/src/router/genui/panel-edit-schema.ts`
- `packages/ui/src/input.tsx`, `packages/ui/src/textarea.tsx`, `packages/ui/src/select.tsx`, `packages/ui/src/button.tsx` (base component defaults)
- `.claude/skills/polytoken-design-system/SKILL.md` (conventions)

**Registry audit:** `packages/ui/components.json` exists but 52-UI-SPEC.md's own Registry Safety table lists zero third-party blocks used this phase ("none" for shadcn official / kibo-ui / coss / magicui / tweakcn) — confirmed by direct file read (no new `shadcn add`/vendor payload found in any of the 19 phase-touched files). Registry audit: 0 third-party blocks checked, no flags.
