# Taste References — the interaction-taste layer for the surface builds

> Synthesized 2026-07-17 from six reference-mining reports (`.planning/night-run/reports/taste-*.md`).
> **Precedence:** this doc SERVES the locked identity. `58-IDENTITY.md` (D-58-01) and
> `brand-guide.md` §3 win over anything here. References below were mined for LAYOUT, DENSITY,
> HIERARCHY, and INTERACTION only — palette and typography are non-negotiable. Any reference
> pattern that fights the identity is adapted or rejected explicitly in place; none is imported as-is.

## 1. The taste thesis

Good generic shadcn gives you clean components. It does not give you a *stance*. Ours is:

**Provenance is the product, and the interface spends nothing it hasn't earned.**

- **Colour is earned** (law 1) — and so is *every click*. The same discipline that strips hue off
  chrome strips confirmation modals off reversible actions, permanent toolbars off list rows, and
  navigation off "I just want to look at this." A surface passes taste review when the most common
  action costs ≤1 click/keystroke and nothing on screen is decoration — chromatic or interactive.
- **Evidence is visibly different from chrome** (law 2) — serif for the user's own material, sans
  for ours; the provenance mark (solid=confirmed, dashed=suggested) is the one signature element,
  reused identically on every surface. New surfaces don't invent a second mark language.
- **What separates us from generic:** generic UIs make you *navigate to* things (open → read →
  back). Ours makes things *arrive under selection* (select → preview updates in place; arrow keys
  advance; Enter commits; undo trails). Generic UIs colour-code status. Ours states it in ink
  weight, glyph shape, and solid-vs-dashed — and the one time colour appears, it means exactly one
  thing.

The user's directive tonight — "minimize clicks … make it a little better by researching patterns"
— is the interaction half of law 1. Treat click-cost as a budget audited per surface, below.

## 2. The interaction-economy review checklist (run against EVERY surface)

Executors build against this; verifiers scan against it. Each item is testable from the rendered
surface, not the source. Sources: Linear, Raycast, Superhuman, Vercel Web Interface Guidelines,
Notion (full citations in `taste-interaction-economy.md`).

1. **Primary action ≤1 click or 1 keystroke from arrival.** From page load, the single most common
   action happens without a menu, a scroll, or a second surface opening first.
2. **Reversible actions never confirm — they fire and offer Undo** in a toast with a stated window.
   Confirmation modals only for destructive AND hard-to-reverse (this IS the madder rule as
   interaction: `--bad` and the confirm modal share exactly one scope — the irreversible).
3. **Keyboard coverage on a dense action surface is total, not partial.** 2 of 7 toolbar actions
   wired (today's `action-toolbar.tsx`) is worse than 0 — it teaches shortcuts don't reliably exist.
   Every wired action declares `aria-keyshortcuts` and shows its key in the tooltip.
4. **One universal ⌘K command surface app-wide** reaching every named action and navigable object.
   `packages/ui/src/command.tsx` (cmdk) already exists; wire it, don't build per-surface pickers
   (we already have three siloed ones: model/entity-type/nest — those fold in, not multiply).
5. **Secondary actions on rows/cards are hover-revealed, not permanent chrome** — with a
   keyboard/touch-reachable equivalent (focus reveal, "more" trigger). Never hover-only.
6. **Optimistic UI for user-initiated actions:** update immediately, reconcile on response, roll
   back with an error path. Spinner-then-content is for first loads only.
7. **Ephemeral view state is URL-addressable** — filters, tabs, open panels, selected rows. Not
   trapped in `useState` (today's `InboxThreePane` filter is the standing violation).
8. **Empty states teach by making the next action the only prominent control** — not a paragraph.
   The empty state IS the onboarding. (Phase 62 criterion 3 is graded against this.)
9. **Settings default to progressive disclosure:** the 80% case visible at zero clicks, the rest
   one "advanced" expand away. Never one flat list of everything.
10. **Inline edit beats modal for single-field changes** on an already-open object.

**Known open violations to fix on contact** (evidence in `taste-interaction-economy.md`):
`reject-dialog.tsx` gates a reversible reject behind an AlertDialog while `confirm-deny-controls.tsx`
on the SAME page fires optimistically with undo — collapse Reject Region onto the undo pattern
(item 2). Keyboard handling exists in only 4 files, all inside email-detail (item 3). No cmdk
palette anywhere (item 4). Inbox filter not in URL (item 7).

## 3. Per-surface prescriptions

### /files vault (Lane D) — source: `taste-files-vault.md`

**Adopt (click-counted):**
1. **Preview pane, never navigate-away** (Gmail/Outlook reading pane): selecting a row updates a
   persistent preview in place. Kills the open→back cycle: inspecting N files goes from 2N clicks
   to N selections — and with (2), to 0 clicks.
2. **Arrow-key traversal with live preview** — ↑/↓ moves selection, preview follows. 0 clicks to
   scan a whole vault.
3. **Space-bar Quick Look** — one key opens a full overlay for the selected item, same key closes.
   Skin: "held-up paper" — `--bright` sheet, `--rule` border — never a dark frosted modal.
4. **Drag-anywhere upload:** the entire content pane is the drop target (hover state =
   heavier ink border / `--shade` fill, NO new hue), click-to-browse fallback stays.
   `packages/ui/src/dropzone.tsx` already exists — verify its drag-active state is ink, not accent.
5. **Standard multi-select** (shift-range, ctrl-toggle, ctrl-A) + a toolbar that appears at ≥2
   selected, mirrored by right-click. Selecting 20 contiguous files = 2 clicks, not 20.

**Empty state teaches:** the whole pane is the drop zone — "Drop your first document anywhere," one
browse button, nothing else prominent.

**Do NOT:** impose a folder-tree/Miller-columns sidebar unless the vault has *real* folder depth.
This vault is flat-with-metadata → faceted filters (type/date/entity/source), not a tree. And no
colour-coded file-type icons — type is shape/ink-weight per law 3; colour stays with tier.

### /sessions terminal (Lane E) — source: `taste-terminal.md`

**Adopt (click-counted):**
1. **Block-based turn grouping, not raw scrollback** (Warp): each command/tool-call + output is one
   bounded unit — `--hair` rule between, `--leaf`→`--bright` step on focus. Jump-to-block replaces
   scroll-and-hunt on a 10,000-line session.
2. **Completed blocks collapse to a one-line summary** (command + duration + state glyph); the
   active block stays open. 0 clicks to see "which session needs me" across N sessions.
3. **Fuzzy-filterable session list with state glyph per row** (sesh/sessionx): label + repo/branch +
   glyph, type-ahead filter, arrow-to-attach. Plus **preview-before-attach** — highlighting a row
   shows its last lines, so switching is a confirm, not a blind jump.
4. **Status is glyph + ink weight, never hue:** running = open triangle, waiting-on-input = filled
   dot, idle/done = hollow ring (law 3's shape language), pulsing *opacity* for streaming. Exit
   state is a `--rule`-bordered chip with the words "exit 1" — never a red fill. `--bad` appears
   only on kill/force-terminate.
5. **Sunken input well** (`--shade`, `--rule` top border) distinct from the block stream; and a
   **"N new lines · jump to now" pill** (`--bright`/`--rule`/`--ink`) when the user scrolls up —
   auto-scroll never fights the reader.

**The ANSI ruling (working rule tonight):** the raw pty stream is CONTENT, not chrome — the same
scoped exception law 2 grants serif. Genuine ANSI colour may pass through *inside the pty viewport
only*; every surrounding element (block header, glyphs, session list, pills) is strictly
monochrome. The xterm.js `ITheme` mapping in `taste-terminal.md` is canonical: `background`→
`--bright` (never literal black), `foreground`/`cursor`→`--ink`, `selectionBackground`→`--shade`,
blue/magenta/cyan→ink-weight neutrals. Widening colour beyond the pty viewport requires a D-58-01
amendment — don't.

**Empty state teaches:** one "Start a session" action, nothing else.

**Do NOT:** ship a black rectangle punched into a card. Blocks get internal padding (~12–16px x,
1.4–1.6 line-height) so the terminal reads as part of the paper. No default multi-pane grid —
single-session focus, split as opt-in.

### In-chat research + report reading (Lane B) — source: `taste-research-email.md`

**Adopt:**
1. **3-tier citation disclosure** (Perplexity/ChatGPT): the provenance mark IS tier 1 (the
   solid/dashed underline on the cited span — reuse `pmark`, build nothing new); hover = popover
   with source excerpt + tier (0 clicks); full sources panel = 1 click, opt-in.
2. **Live multi-step progress trace, collapsible after completion** (OpenAI Deep Research): stream
   steps while running ("reading X", "N sources"); collapse to a one-line summary when done, 1 click
   to re-expand. Collapse-after-done is the detail everyone misses.
3. **Editorial measure on serif evidence body: 45–75ch max.** Report body is the user's own
   material — never full-bleed, even in a wide panel.
4. **Source list with quality hierarchy, not flat bullets:** title + one-line relevance + domain,
   primary vs supporting grouping. Saves speculative opens.
5. **Mid-stream refinement without restart** — a follow-up injected while the job runs saves an
   entire re-run cycle.

**Empty state teaches:** the composer is the only prominent control ("Ask me anything" — existing
brand-guide copy stands).

**Do NOT:** invent a footnote-number system or install a citation component. `pmark` already
encodes confirmed/suggested more precisely than any `[n]` chip; a second mark language is the one
unforgivable move here.

### Email rules review (Lane B) — source: `taste-research-email.md`

**Adopt — model this as HEY's Screener, never Gmail's Filters:**
1. **Proposals surface in-context during triage** — a collapsed "3 rule suggestions" chip near the
   inbox, not a nav destination. Gmail filters die of discoverability, not click count.
2. **Decide once about the sender/pattern, forever:** accept/decline is one keystroke, no form.
   Fires optimistically with undo (checklist item 2) — never a confirm modal.
3. **Flat reversible audit list one click from the decision point** (HEY's "screened out"): every
   past decision flips in one tap. Settings becomes the audit trail, never the workflow.
4. **Retroactive scope is an explicit visible toggle at accept-time** — Gmail's hidden
   "apply to matching" checkbox is the top documented filter failure; make it a stated choice.

Suggested rules render with the dashed `--sugg` mark; a rule the user accepted is confirmed —
solid `--conf`. The tier ladder maps 1:1; no new vocabulary.

**Empty state teaches:** "polytoken proposes rules as it watches your corrections — nothing to
review yet," with the inbox as the pointed-to next action.

**Do NOT:** build a Rules settings page as the primary surface. If the review flow's center of
gravity is under `/settings`, the design has already failed.

### Phase 62 surfaces — /knowledge, /studio, /settings, /login

- **/knowledge:** inherits Phase 61's canvas language wholesale (`canvas-node-shell-class.ts`,
  `canvas-vocabulary.ts` — flat `.card`, zero shadow, ink outline selection, tier-owns-colour,
  kind-owns-weight). Filter rail is the legitimate home for law-3 type shapes (no room for words).
  Detail pane follows /files' pattern: select-updates-pane, never navigate away; filters
  URL-addressable (item 7). D-61-04's tier-axis question (EXTRACTED/INFERRED/AMBIGUOUS vs
  confirmed/suggested) is Phase 62's to DECIDE, not this doc's — but whatever it decides, one axis
  owns colour and it must be the same axis app-wide. **Empty state teaches:** "Confirm your first
  extraction in the inbox — it lands here," one link. **Do NOT** colour node types (law 3) or add a
  minimap/zoom-chrome ensemble the graph's size doesn't earn.
- **/studio:** one prominent create action; recent work as a plain registry list (rows, not a
  masonry of shadowed cards). **Empty state teaches:** the create action alone. **Do NOT** ship a
  template-gallery grid of decorative thumbnails.
- **/settings:** progressive disclosure (checklist item 9) — the 80% visible flat, the rest behind
  one "Advanced" expand; inline edit per field with optimistic save + undo, no Save-button forms,
  no modals (item 10). Section nav as a quiet left rail in ink. **Do NOT** cram every option into
  one scroll or gate each field behind an edit-pencil modal.
- **/login:** one action — "sign in with Google" (brand-guide §2 copy stands: "Welcome back to your
  workspace"). `BrandMark` glyph, ink button on `--leaf`. **Do NOT** center a shadowed card in dead
  space with a divider-split "or" stack of dead auth options — the classic default-shadcn login.

### Phase 63 research canvas

1. **Sources arrive as nodes without ceremony** (RCNV-02): auto-collected, dashed `--sugg` mark —
   they're suggestions until curated. No per-turn confirm widget, ever (the requirement says so;
   the taste layer agrees: arrival is free, promotion is deliberate).
2. **Canon curation is canvas-native multi-select** — /files' selection grammar (shift/ctrl,
   marquee) + one explicit "add to canon" action on the selection toolbar. Promotion through the
   existing suggest-only gate flips the mark solid (`--conf`). 1 gesture + 1 click for N sources.
3. **Canon vs non-canon is tier, not a new visual system:** solid vs dashed, ink-weight for
   emphasis. Edges follow `canvas-vocabulary.ts` (tier owns colour+dash; kind owns weight; data
   wires neutral).
4. **Presentation-panel generation grounded in selection:** with a canon selection active, generate
   is 1 click; the trace pattern from research reading (collapsible progress) applies while it runs.

**Empty state teaches:** "Start a research conversation — sources land here as you work," one
new-chat action. **Do NOT:** chat widgets for curation (banned by RCNV-03), or stock React Flow
styling leaking through (remember the unlayered-CSS trap — wire it and LOOK at it, per brand-guide
§3's Phase 61 notes).

## 4. Component-pack picks (shopping list)

From `taste-component-packs.md`. Workflow is STCK-04: from `packages/ui/`, run the dry-run, copy
the payload into `packages/ui/src/<name>.tsx` — **never plain `add`** (broken write path). Every
pack piece gets the mandatory re-skin pass: strip literal colour classes onto the oklch ladder,
no non-earned hue survives (law 1). Approved registries only: `@shadcn`, `@kibo-ui`, `@coss`,
`@magicui`, `@tweakcn`.

| Component | Source | Install | Adaptation |
|---|---|---|---|
| Empty state | `@shadcn/empty` | `npx shadcn@latest add empty --dry-run --view` → copy-in | Low. Structural (media/title/description/action slots), no baked colour. Media slot in `--faded`/`--pencil`; action through existing `Button`; `p-panel` spacing. |
| File/folder tree | `@kibo-ui/tree` | `npx shadcn@latest add @kibo-ui/tree --dry-run --view` → copy-in | Low — but install ONLY where real hierarchy exists (sessions-by-repo, nested captures). Do not bolt onto the flat /files vault (§3). Selection → ink outline; no type colours. |
| Terminal frame | `@magicui/terminal` | `npx shadcn@latest add @magicui/terminal --dry-run --view` → copy-in | Low-medium. Keep window-dot furniture; re-skin ALL output colours (green/red → ink or earned tier hues only if semantically true); background `--bright`, never black. `motion` already a dep. |
| Command palette | local `packages/ui/src/command.tsx` (cmdk) | none — exists | Zero install; the work is WIRING it app-wide (checklist item 4). |
| Upload dropzone | local `packages/ui/src/dropzone.tsx` | none — exists | Verify drag-active state is ink/rule, not a stock accent. |
| Citation/footnote | **hand-roll on `pmark`** (`entity-chips.tsx`) | none | The provenance mark beats every pack. `@kibo-ui/glimpse` only if a URL hover-preview mechanic is needed. |
| File preview | **hand-roll** | none | Compose `code-block.tsx` (shiki) + `image-zoom` + iframe-for-PDF in a `--rule`-bordered `p-panel` frame. App-shell composition, nothing to fight. |
| Long-form report layout | **hand-roll** | none | Pure layout on `Separator`/`ScrollArea` + type scale. Any pack here fights law 2 immediately — adaptation cost exceeds hand-rolling. FLAGGED. |
| Rules/filter builder | **hand-roll** simple row (Select + Select + Input + Badge) | none | `react-querybuilder`/ReUI are unvetted registries — adaptation + supply-chain cost exceeds hand-rolling a single filter row. FLAGGED; real query-builder = backlog vet, not tonight. |
| AI-chat elements | — | — | **Out of scope:** Vercel `@ai-elements` is not on the approved list. Do not pull tonight. |

## 5. The user's own references (cited, curated)

Honest finding (`taste-local-refs.md`): **no first-person design-taste document by the user exists.**
`0 - nauta_design_case.pdf` is the Nauta take-home business/architecture brief — zero visual
content, out of scope for taste. `links.md` is a raw Instagram-caption scrape, not commentary. The
only authoritative taste document is, and remains, **58-IDENTITY.md (D-58-01)** — the user's own
locked pick, in their own words ("liked a best but also liked c color concept … using colors
meaningfully datafully").

What the scrape does signal, distilled:

- **Endorsed (via the one design-substantive save, a reel on avoiding "generic vibe-coded" UI):**
  Mobbin and Screenlane — real-production-app pattern mining for LAYOUT and DENSITY (list↔detail,
  inbox, card patterns). This is exactly the method this doc and its six source reports used.
  Awwwards / 21st.dev / Uiverse: interaction micro-patterns only (hover reveal, transition timing) —
  high clash risk with the locked identity; never for colour or type.
- **SSGOI** (ssgoi.dev): the *idea* of shared-element page-transition continuity only — a candidate
  for select→preview and list→detail moments. The library and its visual style: not imported.
- **Explicitly anti-pattern given the lock:** ColorFlow, Vibe UI, ShaderGradient, liquid-logo,
  liquid-glass-js, shaders.com — decorative gradient/shader/glass tooling, directly opposed to
  "colour earned never decorative" and the glassmorphism ban. If any of these surfaces in future
  reference mining, reject on sight.
- **Method precedent:** `.planning/research/v1.8-design/DESIGN-PATTERN-DOSSIER.md` (AI-authored,
  not user curation) is the right *shape* for future mining — real apps, pattern tables, filtered
  through the lock.

## 6. The anti-generic checklist (screenshot-scannable tells)

A surface showing 2+ of these fails taste review regardless of green gates:

1. **Centered-card-with-shadow syndrome** — a lone shadowed card floating in dead space (the
   default-shadcn login/empty silhouette). Our elevation is the ground ladder
   (`--shelf`→`--leaf`→`--bright`), not drop shadows; canvas cards are flat with rule-change hover.
2. **Status or type carried by hue** — red error text, green success banner, colour-coded file
   types or node kinds, stock ANSI palette. Tier owns colour; everything else is ink weight, glyph,
   solid-vs-dashed. (The gate can't catch a `variant="destructive"` badge on a *state* — a human
   scanning for this tell can.)
3. **Modal-for-everything** — a confirm dialog on a reversible action, or a modal edit for a single
   field. Confirm modals and `--bad` share one scope: the irreversible.
4. **Icon-button rows with no labels, no tooltips, no declared keys** — chrome that tests the
   user's memory instead of teaching (Linear teaches keys in tooltips; so do we).
5. **The everything-at-once dashboard silhouette** — tree + toolbar + breadcrumb + list + preview +
   metadata rail all permanently visible. Two panes carry the work; the rest is contextual.
6. **A black rectangle punched into a card** — an unpadded `<pre>`/xterm mount with literal-black
   background. Terminals read as part of the paper.
7. **Navigate-away to inspect** — clicking a list item replaces the whole view for something the
   user only wanted to glance at. Select-updates-preview is the house grammar.
8. **Empty state as grey paragraph + stock illustration** — instead of one prominent teaching
   action.
9. **Spinner-then-content on a user-initiated action** — no optimistic update, no undo trail.
10. **Full-bleed evidence text** — serif body running edge-to-edge past ~75ch, or serif leaking
    into chrome / sans swallowing quoted evidence (law 2's tell: ask where the words came from).

---

*Sources: `.planning/night-run/reports/taste-{interaction-economy,files-vault,terminal,research-email,component-packs,local-refs}.md` · governed by D-58-01 (`58-IDENTITY.md`) and `docs/design/brand-guide.md` §3.*
