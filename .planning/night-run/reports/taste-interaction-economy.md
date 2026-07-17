# Interaction Economy — the click-economy canon, distilled for polytoken

**Assigned name:** taste-interaction-economy
**Scope:** interaction/layout/density/hierarchy patterns only. Palette and typography are LOCKED
by D-58-01 (`.planning/phases/58-visual-identity-sketch-pick-human-gate/58-IDENTITY.md`) and are
NOT touched or reconsidered here. Nothing below proposes a new colour, a new hue-bearing chrome
element, or a typography change — law 1 ("colour is earned, never decorative") and law 2 ("chrome
speaks sans, evidence speaks serif") govern any visual expression of these interaction patterns.

## Research basis (web, 2026-07-17)

- **Linear** — keyboard-first is the design philosophy, not a feature. Single letters edit the
  focused object, two-letter combos navigate, modifiers act globally. The command palette (⌘K)
  searches the app's own in-memory object graph (not a server round-trip) — the entire app is one
  keystroke away from anywhere. Shortcuts are taught by being *visible* (hover any action to see
  its key), not by a manual. [Linear: how we redesigned the UI](https://linear.app/now/how-we-redesigned-the-linear-ui), [gunpowderlabs — Linear's delightful patterns](https://gunpowderlabs.com/2024/12/22/linear-delightful-patterns)
- **Raycast** — Enter always fires the *primary* action without opening the panel; every other
  action is one level down in the same list, never a separate surface. [Raycast Action Panel](https://manual.raycast.com/action-panel)
- **Superhuman** — "speed as the product": ~50ms response budget, keyboard-first navigation,
  passive shortcut learning (the palette shows the key every time it's used, so muscle memory
  forms without being taught). [Superhuman: Speed as the Product](https://blakecrosley.com/guides/design/superhuman)
- **Vercel Web Interface Guidelines** (the most directly citable spec here) —
  *"Update the UI immediately when success is likely; reconcile on server response. On failure,
  show an error & roll back or provide Undo."* and *"Require confirmation or provide Undo with a
  safe window"* — explicitly framed as alternatives, not "always confirm." Also: ephemeral UI
  state (filters, tabs, expanded panels) should be URL-addressable, not trapped in `useState`.
  [vercel.com/design/guidelines](https://vercel.com/design/guidelines)
- **Notion** — the slash menu is a single universal insertion verb reachable from any empty line;
  progressive disclosure is used for page depth (click through), not for hiding primary actions.
  [Notion slash commands](https://www.notion.com/help/guides/using-slash-commands)
- Cross-cutting notes: bulk/irreversible actions are the one place confirm-over-undo is
  industry-standard even for products that are otherwise undo-first — which is exactly our madder
  rule already (D-58-01 law 1: madder reserved for genuinely irreversible actions).

## The ranked checklist (10 items, each a testable rule)

1. **Primary action of any surface reachable in ≤1 click or 1 keystroke from arrival.** Test: from
   page load, can the single most common thing a user does here happen without a menu, a scroll,
   or a second surface opening first?
2. **A reversible action never blocks on a confirmation modal — it fires immediately and offers
   Undo in a toast with a stated window.** Test: does undoing require re-doing the whole action, or
   one click/keystroke on the toast? Confirmation modals are reserved for actions that are
   destructive AND hard/impossible to reverse (aligns with our madder rule, D-58-01 law 1).
3. **Every mouse-only primary/secondary action in a dense action surface (toolbars, list rows,
   region editors) has a declared keyboard equivalent, not just some of them.** Partial coverage
   (2 of 7 buttons wired) is worse than none — it teaches users shortcuts don't reliably exist here.
4. **One universal command surface (⌘K-class) exists app-wide and can reach every named action and
   every navigable object** — not a different local popover pattern per surface (model picker,
   entity-type picker, nest picker are three separate small command surfaces today; none is the
   universal one).
5. **Secondary/destructive-lite actions on a list row or card are hover-revealed, not
   permanently-on chrome** — but the same actions must also be reachable via a persistent
   affordance (focus, long-press, or a "more" trigger) for keyboard/touch, never hover-only.
6. **State changes update the UI optimistically before the network round-trip resolves,** with a
   defined rollback + error path — never a spinner-then-content pattern for actions the user
   initiated themselves (as opposed to first-load data fetches).
7. **Every ephemeral view state a user can arrive at by clicking (filter, tab, open panel, selected
   row) is URL-addressable,** so back/forward and sharing a link reproduces it — state is not
   trapped in component `useState`.
8. **Zero-state screens teach the next action by making it the only prominent control** (not a
   paragraph of instructions) — the empty state IS the onboarding, not a separate tour.
9. **Settings/configuration surfaces default to progressive disclosure** — the common 80% case is
   visible with zero extra clicks; the remaining 20% sits one expand/"advanced" click away, never
   both crammed into one flat list.
10. **Inline edit beats modal for single-field changes on an already-open object.** A modal is
    justified only when the edit needs context the parent surface can't show, or is a genuinely
    multi-field/multi-step form.

## Where our existing surfaces violate this worst (grounded in code, not memory)

Checked: `apps/web/src/app/emails/[id]/_components/{action-toolbar,confirm-deny-controls,
reject-dialog}.tsx`, `apps/web/src/app/_components/inbox-three-pane.tsx`,
`apps/web/src/app/chat/page.tsx`. Grepped the whole `apps/web/src` tree for
`aria-keyshortcuts|useHotkeys|onKeyDown.*key ===|addEventListener("keydown"` and for
`cmdk|command palette|CommandDialog`.

**Worst violation — item 2 (undo vs confirm), and it's internally inconsistent, not just absent.**
The email-detail surface has TWO "reject a thing the machine produced" affordances that behave
oppositely:
- `confirm-deny-controls.tsx` (candidate FIELD, ✗ Deny) fires immediately and — for auto-detected
  boxes — shows `toast.info("Field value cleared.", { action: { label: "Undo" }, duration: 3000 })`.
  This is exactly the pattern the checklist wants.
- `action-toolbar.tsx` → `reject-dialog.tsx` (candidate REGION, ✗ Reject Region) opens a full
  `AlertDialog` ("Reject this region? ... You can show it again using the 'Show history' toggle")
  requiring a second click on "Reject region" before anything happens — for an action its own copy
  admits is reversible ("hidden from the default view," not deleted). Two conceptually identical
  reversible-reject actions, one click-and-done-with-undo, one gate-then-commit, on the same page.
  This is the single clearest, cheapest fix: collapse reject-region onto the same
  optimistic-fire + undo-toast pattern deny-field already uses; delete the AlertDialog for this
  case (item 2, item 10).

**Second-worst — item 3/4 (keyboard coverage + command surface), and it's the widest gap.**
`action-toolbar.tsx` declares `aria-keyshortcuts` for exactly 2 of its ~7 actions (Accept = "a",
Reject = "Delete"); Redraw, Split, Merge, Nest, and Autofill Fields are mouse-only despite being on
the same toolbar, in the same tooltip-driven UI, doing the same class of rapid-triage work. The
repo-wide grep found keyboard handling in only 4 files, ALL inside the email-detail canvas
sub-surface — inbox (`inbox-three-pane.tsx`, `FiltersRail`) and chat (`chat/page.tsx`, rail
collapse toggle, new-chat, filter switching) have zero keyboard affordances beyond native
tab/Enter, and there is no `cmdk`/command-palette pattern anywhere in `apps/web/src` (only three
unrelated local `Popover` pickers — model picker, entity-type picker, nest picker — each a
separate, surface-local command micro-surface, never a universal one). For a product whose stated
goal tonight is "minimize clicks," this is the highest-leverage gap: a single ⌘K surface reaching
"go to conversation X," "open email Y," "accept/reject the selected region," "switch model" would
collapse most of today's multi-click navigation into one pattern used everywhere, mirroring
Linear's "the palette IS the product" model.

**Third — item 7 (URL-addressable state).** `InboxThreePane`'s filter (`all` / `unread` /
`with-entities`) is local `useState` (`FiltersRail`, confirmed by reading the component), not a
query param — refresh or share-link loses the filter, contrary to the Vercel guideline's explicit
rule that "filters, tabs, pagination, expanded panels" belong in the URL.

## Recommendation for downstream phases

Do not action any palette/hue/type changes from this report — those are outside scope by D-58-01.
The concrete, cheap next step is collapsing `reject-dialog.tsx`'s AlertDialog into the
optimistic-fire + undo-toast pattern already proven by `confirm-deny-controls.tsx` on the same
page; the command-palette gap (item 4) is the larger, phase-worthy investment.
