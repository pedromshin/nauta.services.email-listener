---
phase: 6
phase_name: "Region edit operations on the document preview"
status: draft
created: "2026-06-12"
delta_on: "05-UI-SPEC.md"
sources:
  - 06-CONTEXT.md (authoritative — all decisions locked)
  - 05-UI-SPEC.md (base contract — inherited in full)
  - apps/web/src/app/emails/[id]/_components/*.tsx (current implementation)
  - apps/web/src/app/globals.css (token values)
  - packages/ui/src/*.tsx (component inventory — sonner confirmed present)
---

# UI-SPEC — Phase 6: Region Edit Operations (Delta)

## 1. Inherited Contract

All decisions in `05-UI-SPEC.md` remain locked and in force without modification:
tokens (§2), typography (§3), spacing scale (§4), layout shell (§5.1–5.5),
`RegionOverlayBox` base styles (§5.6), `EntitiesList` base behavior (§5.7),
component inventory (§6), state management pattern (§8), data access contract (§9),
loading skeletons (§10), existing copywriting (§11), existing accessibility
contracts (§12), and file structure (§13).

This document specifies only the delta: new surfaces, new state transitions,
new copy, and new accessibility obligations introduced by Phase 6.

---

## 2. New Color Contracts (delta overlays only)

No new CSS custom properties. All new states use existing tokens.

| State | Box border | Box fill | Label chip | Notes |
|-------|-----------|----------|-----------|-------|
| Selected (single) | `border-primary ring-2 ring-primary/50` | `bg-primary/25` | unchanged | replaces hover/active from Phase 5 |
| Selected (multi) | `border-primary ring-2 ring-primary/50` | `bg-primary/25` | unchanged | same visual as single-selected |
| Drawing rect (live preview) | `border-primary border-dashed` | `bg-primary/15` | none | animated dashed border |
| Candidate (human/accepted) | `border-primary/80` | `bg-primary/10` | `bg-primary text-primary-foreground` | same as Phase 5 default — no visual change |
| Pending (proposed, unactioned) | `border-primary/50 border-dashed` | `bg-primary/8` | `bg-secondary text-secondary-foreground` | dashed border signals "not yet confirmed" |
| Rejected / Superseded | hidden by default; history toggle reveals: `border-border/40 border-dashed` | `bg-muted/50` | `bg-muted text-muted-foreground line-through` | opacity-40 on whole box |
| Mutation in-flight (optimistic) | `border-primary/40 animate-pulse` | `bg-primary/5` | unchanged | pulse on border only, 1s duration |

**Decision: pending boxes use dashed border to signal "awaiting human action".** This matches the D-09 intent that human regions are source of truth — proposed/pending boxes look provisional.

---

## 3. New Interaction Contracts

### 3.1 Region Selection State

**Trigger:** Click on a `RegionOverlayBox` OR click/Enter on an `EntitiesList` row.

**Effect:** Sets `selectedComponentId: string | null` (new state variable, separate from `activeComponentId` which remains hover-only). A selected component also becomes the active/hovered component.

**Deselect:** Click outside any box on the PDF canvas (click on the overlay layer's background), press Escape, or select a different component.

**Selection vs. hover distinction:**
- `activeComponentId` — hover/focus highlight (Phase 5, unchanged). Bidirectional sync between list and overlay.
- `selectedComponentId` — click-to-select; shows the floating action toolbar. Hover still works independently.

```
Phase 5 overlay box state machine (hover):
  idle ──mouseEnter──> hover ──mouseLeave──> idle

Phase 6 overlay box state machine (click):
  idle ──click──> selected ──(Esc / bg click / other click)──> idle
  selected ──Delete key──> [confirm reject dialog opens] ──confirm──> idle
```

### 3.2 Floating Action Toolbar

Appears when `selectedComponentId` is non-null. Positioned at the top of the PDF preview pane's content area (below the existing pane toolbar row), as a sticky bar that pins to the top of the `.overflow-auto` scroll container. Not absolutely positioned on the PDF canvas itself — this avoids z-index collisions with the overlay boxes.

Focal hierarchy: the Accept Region button (primary variant, enabled for `pending` regions) is the primary focal point of the toolbar; the context label ("Selected: …") is secondary. All other actions use outline/ghost variants so Accept reads first.

```
┌──────────────────────────────────────────────────────────────┐
│  ← filename.pdf    Page 1/3   − +   Show regions [x]   [✕]  │  ← existing pane toolbar (§5.5)
├──────────────────────────────────────────────────────────────┤
│  [✓ Accept]  [✗ Reject]  [↩ Redraw]  [÷ Split]  [⊕ Merge]  │  ← action toolbar (NEW)
│              [⤵ Nest into…]                                   │
│              Selected: {entityTypeLabel} · Page {n}          │  ← context label (text-xs muted)
└──────────────────────────────────────────────────────────────┘
```

**Toolbar layout:** `flex flex-wrap items-center gap-2 border-b px-4 py-2 bg-card`.

**Toolbar visibility:** `selectedComponentId !== null`. When null: toolbar `hidden` (CSS display none — not unmounted). Transition: none (instant show/hide).

**Button specifications:**

| Button | Variant | Size | Icon (Unicode) | aria-label | Enabled condition |
|--------|---------|------|----------------|-----------|-------------------|
| Accept | `default` | `sm` | ✓ | "Accept region" | status is `pending` |
| Reject | `destructive` | `sm` | ✗ | "Reject region" | status is `pending` or `candidate` |
| Redraw | `outline` | `sm` | ↩ | "Redraw region" | any status except `rejected`/`superseded` |
| Split | `outline` | `sm` | ÷ | "Split region" | any status except `rejected`/`superseded` |
| Merge | `outline` | `sm` | ⊕ | "Merge selected regions" | `selectedComponentIds.length >= 2` (multi-select mode) |
| Nest into… | `outline` | `sm` | ⤵ | "Nest into parent region" | same-page candidate/pending regions exist besides selected |

**Context label:** `text-xs text-muted-foreground` — "Selected: {entityTypeLabel ?? extractionStatus} · Page {pageIndex + 1}"

**Keyboard shortcuts (global when PDF pane is focused):**
- `Escape` — deselect; if in draw mode, cancel draw mode
- `Delete` — open reject confirmation dialog (same as clicking Reject button)
- `A` — accept (only when a single region is selected and status is pending)

**Tooltip on each button** (via `<Tooltip>` from `@nauta/ui/tooltip`): display keyboard shortcut in parentheses where applicable. Accept: "Accept region (A)"; Reject: "Reject region (Del)"; Redraw: "Redraw region"; Split: "Split into sub-regions"; Merge: "Merge selected"; Nest: "Nest into parent".

### 3.3 Draw Mode (Redraw / Split / Add Region)

**Entry points:**
1. Click "Redraw" in action toolbar — enters draw mode to replace the selected region (one draw).
2. Click "Split" in action toolbar — enters draw mode to draw N sub-rects; user confirms when ≥2 are drawn.
3. Click "Add region" button (page-level, visible even with zero regions — see §3.7).

**Visual changes on draw mode entry:**
- Overlay layer: `pointer-events: auto` (was `pointer-events-none`). Draw-mode cursor on the canvas area: `cursor-crosshair`.
- All existing overlay boxes: dimmed to `opacity-40` to signal draw focus. Dimmed boxes are temporarily inert: `pointer-events-none` and `aria-hidden="true"` for the duration of draw mode (they are not interactive targets while drawing).
- A `DrawModeBar` banner appears between the pane toolbar and the action toolbar:

```
┌──────────────────────────────────────────────────────────────┐
│  [ Draw Mode: Redraw ]   Draw a rectangle over the page.     │
│  [Cancel Draw (Esc)]                                              │
└──────────────────────────────────────────────────────────────┘
```

`DrawModeBar` layout: `flex items-center gap-3 border-b px-4 py-2 bg-muted text-sm`.
- Left: `text-sm font-semibold` — "Draw Mode: {Redraw|Split|Add region}"
- Center: `text-sm text-muted-foreground` — instruction string (see Copywriting §6)
- Right: `<Button variant="ghost" size="sm">Cancel Draw (Esc)</Button>`

**Draw mechanics (pointer events on the overlay `<div>`):**
- `onPointerDown` → record start point `(x, y)` normalized to `[0,1]` using inverse of `polygonToRect` math.
- `onPointerMove` → update live preview rect (a separate absolutely-positioned `<div>` with dashed border style from §2).
- `onPointerUp` → finalize rect. Clamp all coordinates to `[0,1]`.

**Normalization helper** (unit-tested, added to `packages/api-client/src/geometry.ts`):

```typescript
// clientXYToNormalized: converts pointer event coordinates to 0-1 normalized
// given the overlay div's bounding rect and the rendered page pixel size.
export function clientXYToNormalized(
  clientX: number,
  clientY: number,
  overlayBounds: DOMRect,
): readonly [number, number] {
  const x = Math.max(0, Math.min(1, (clientX - overlayBounds.left) / overlayBounds.width));
  const y = Math.max(0, Math.min(1, (clientY - overlayBounds.top) / overlayBounds.height));
  return [x, y] as const;
}

// normalizedRectToPolygon: converts top-left + bottom-right normalized coords
// to the 4-corner polygon format the API expects.
export function normalizedRectToPolygon(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): ReadonlyArray<readonly [number, number]> {
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const right = Math.max(x0, x1);
  const bottom = Math.max(y0, y1);
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ] as const;
}
```

**Minimum draw size:** 0.01 × 0.01 normalized (1% of page in each dimension). Smaller draws are discarded with an inline warning (see Copywriting §6.4).

**Draw mode state machine:**

```
idle
  └──(enter redraw/split/add)──> draw_mode_idle
        └──(pointerDown)──> drawing
              └──(pointerUp, rect >= min)──> rect_drawn
              └──(pointerUp, rect < min)──> draw_mode_idle  [show inline warning]
        └──(Esc / Cancel)──> idle

draw_mode_idle (split variant only: can draw multiple)
rect_drawn
  └──(split: "Draw another" or confirm ≥2)
  └──(redraw/add: auto-confirm → submit mutation → idle)

confirming_split
  └──(Confirm split)──> [submit mutation] ──> idle
  └──(Esc / Cancel)──> idle
```

**Redraw and Add Region:** after a valid rect is drawn, immediately submit the mutation (no extra confirm step). Show optimistic state.

**Split:** after each rect drawn, the `DrawModeBar` changes to show drawn count + "Draw another" + "Confirm split (N rects)" button. Confirm is only enabled when count ≥ 2.

```
┌──────────────────────────────────────────────────────────────┐
│  [ Draw Mode: Split ]    {N} regions drawn.                  │
│  [Draw another]  [Confirm split ({N})]  [Cancel Draw (Esc)]       │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 Multi-Select for Merge

**Activation:** Hold `Shift` and click a second overlay box, OR check the checkbox that appears on each `EntitiesList` row in merge-selection mode.

**Merge-selection mode entry:** Click the "Merge" button when only one region is selected (this is the "start merge" gesture — clicking Merge with one selected opens multi-select mode, not submits).

**Visual changes in multi-select mode:**
- Each overlay box gains a small checkbox indicator at its top-right corner (`16×16px`, `bg-background border border-border rounded-sm`).
- Checked boxes use `bg-primary` fill with a white checkmark glyph.
- `EntitiesList` rows gain a `<Checkbox>` (`@nauta/ui/checkbox`) as leading element.
- A secondary context label on the action toolbar updates: "2 regions selected" / "3 regions selected".

**Multi-select state variable:** `selectedComponentIds: readonly string[]` (replaces `selectedComponentId: string | null` when count > 1). The existing single-selection uses `selectedComponentIds` of length 1.

**Merge enabled:** `selectedComponentIds.length >= 2`. The Merge button in the action toolbar becomes `variant="default"` (primary fill) when enabled.

**Exit multi-select:** press Escape, click background, or click Merge to submit.

### 3.5 Nest Picker

**Trigger:** Click "Nest into…" in the action toolbar (single region selected).

**Component:** `<Popover>` from `@nauta/ui/popover`. Anchor: the "Nest into…" button.

**Popover content:**

```
┌──────────────────────────────────────┐
│  Nest into parent region             │  ← text-sm font-semibold, pb-2
│  ──────────────────────────────────  │
│  [label]  page {n}  [candidate]      │  ← button rows, one per eligible region
│  [label]  page {n}  [candidate]      │
│  ──────────────────────────────────  │
│  [Remove parent (un-nest)]           │  ← only shown if component already has parent
└──────────────────────────────────────┘
```

**Eligible regions:** same page (`page_index` matches), not the currently selected component, not `rejected`/`superseded`.

**Empty state in popover:** `text-sm text-muted-foreground py-2` — "No other regions on this page to nest into."

**Un-nest option:** `<Button variant="ghost" size="sm" className="text-muted-foreground w-full justify-start">` — "Remove parent (un-nest)" — only rendered when the selected component has a non-null `parentComponentId`.

**Popover width:** `w-64`.

**On select:** submit `nest` mutation with `{ parent_component_id: selectedId }`. Close popover. Optimistic update.

### 3.6 Status-Differentiated Overlay Rendering

**Default view (history hidden):**
- Render: `pending` and `candidate` boxes.
- Hidden: `rejected` and `superseded` boxes (`display: none` on `RegionOverlayBox`, not unmounted).

**History toggle:** `<Switch>` labelled "Show history" in the PDF pane toolbar (new, positioned after "Show regions" toggle). Default: OFF.

**When history ON:** `rejected` and `superseded` boxes render with the ghost style from §2 (opacity-40, dashed border, muted label with line-through).

**History toggle state variable:** `showHistory: boolean`, default `false`, local to `PdfPreviewPane`.

**EntitiesList filtering:** same logic — `rejected`/`superseded` components hidden by default; shown (with visual distinction) when history mode is on. The status `<Badge>` for rejected uses `variant="outline"` with `className="line-through"`. The status `<Badge>` for superseded uses `variant="secondary"` with `className="opacity-60"`.

### 3.7 "Add Region" Button

**Location:** `EntitiesList` card header (right-aligned, inline with the "Detected Regions" `<CardTitle>`).

**Appearance:** `<Button variant="outline" size="sm">+ Add region</Button>`.

**Always visible** even when zero regions (bridges the zero-proposals reality per 06-CONTEXT).

**Behavior:** Click → enter draw mode scoped to the current page of the active attachment. If no attachment is open, the button is disabled with tooltip "Open a PDF to draw regions."

**Empty state update (delta on §11.4 of 05-UI-SPEC):** When regions count is zero and an attachment is open, retain the Phase 5 empty copy PLUS add:

```
<div className="pt-2">
  <Button variant="outline" size="sm" ...>+ Add region</Button>
</div>
```

Below the "Document segmentation is pending…" text. The button in the card header is still present; this is an inline affordance.

### 3.8 Optimistic Mutations + Error Toasts

**Toast system:** `sonner` via `@nauta/ui/sonner` (`<Toaster>` in the layout root). Use the `toast` function from the `sonner` package directly.

**Optimistic pattern:** on mutation start, immediately update the local query data via `trpc.useUtils().emails.detail.setData(...)` with the expected post-mutation state. On mutation success: `invalidate emails.detail` to get fresh server data. On mutation error: revert optimistic data and show an error toast.

**Toast specifications:**

| Mutation | Success toast | Error toast |
|----------|--------------|-------------|
| Accept | `toast.success("Region accepted")` | `toast.error("Could not accept region. Try again.")` |
| Reject | `toast.success("Region rejected")` | `toast.error("Could not reject region. Try again.")` |
| Redraw | `toast.success("Region redrawn")` | `toast.error("Could not redraw region. Try again.")` |
| Split | `toast.success("Region split into {N} parts")` | `toast.error("Could not split region. Try again.")` |
| Merge | `toast.success("Regions merged")` | `toast.error("Could not merge regions. Try again.")` |
| Nest | `toast.success("Region nested")` | `toast.error("Could not nest region. Try again.")` |
| Add region | `toast.success("Region added")` | `toast.error("Could not add region. Try again.")` |

**Toast duration:** default (4000ms for success, 5000ms for error).

**No inline alerts** for mutation errors — toasts only. The overlay box or list item returns to its pre-mutation appearance on revert.

### 3.9 Reject Confirmation Dialog

**Approach: `AlertDialog`** from `@nauta/ui/alert-dialog`. Chosen over undo-toast because reject is a status write (immediately affects server state) and undo would require a separate revert endpoint that does not exist in the Phase 6 API surface.

**Trigger:** Click "Reject" button in the action toolbar, OR press `Delete` key when a region is selected.

**Dialog content:**

```
AlertDialogTitle:  "Reject this region?"
AlertDialogDescription:
  "The region will be marked as rejected and hidden from the default view.
   You can show it again using the 'Show history' toggle."
AlertDialogCancel:  "Keep region"
AlertDialogAction (destructive):  "Reject region"
```

**`AlertDialogAction` styling:** `buttonVariants({ variant: "destructive" })`.

**On confirm:** fire the reject mutation. On cancel: no-op; dialog closes; selection retained.

---

## 4. Component Inventory Delta

All from `@nauta/ui` (already in the package — no new installs required).

| Component | Import path | Phase 6 usage |
|-----------|------------|---------------|
| `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogTrigger` | `@nauta/ui/alert-dialog` | Reject confirmation dialog |
| `Popover`, `PopoverContent`, `PopoverTrigger` | `@nauta/ui/popover` | Nest picker |
| `Checkbox` | `@nauta/ui/checkbox` | Multi-select checkboxes in EntitiesList rows |
| `Toaster` | `@nauta/ui/sonner` | Toast container — add to root layout if not present |
| `toast` (function) | `sonner` (direct, not @nauta/ui) | Fire toasts from mutation callbacks |

**No new packages required beyond what Phase 5 installed.** `sonner` is a transitive dependency of `@nauta/ui/sonner`.

New files (additions to Phase 5 file structure):

```
apps/web/src/app/emails/[id]/_components/
  action-toolbar.tsx         ← floating action toolbar (Accept/Reject/Redraw/Split/Merge/Nest)
  draw-mode-bar.tsx          ← draw mode banner + cancel + split confirm controls
  draw-overlay.tsx           ← live preview rect + pointer event handlers
  nest-picker.tsx            ← Popover with eligible regions list
  reject-dialog.tsx          ← AlertDialog confirmation wrapper
packages/api-client/src/
  geometry.ts                ← extend with clientXYToNormalized + normalizedRectToPolygon
  geometry.test.ts           ← extend with tests for both new helpers
packages/api-client/src/router/emails/
  mutations.ts               ← tRPC mutations for accept/reject/redraw/split/merge/nest/create
```

---

## 5. State Machine (Full Phase 6 Selection/Draw/Multi-Select)

New state variables added to `email-detail.tsx` (or a dedicated `useRegionEdit` hook):

| Variable | Type | Initial | Notes |
|----------|------|---------|-------|
| `selectedComponentIds` | `readonly string[]` | `[]` | Length 0 = nothing selected; 1 = single; 2+ = multi |
| `drawMode` | `"redraw" \| "split" \| "add" \| null` | `null` | Null = not drawing |
| `drawnRects` | `ReadonlyArray<ReadonlyArray<readonly [number, number]>>` | `[]` | Accumulated split rects |
| `liveRect` | `{ x0: number; y0: number; x1: number; y1: number } \| null` | `null` | In-progress pointer drag |
| `showHistory` | `boolean` | `false` | History overlay toggle |
| `rejectDialogOpen` | `boolean` | `false` | Controls AlertDialog |
| `nestPickerOpen` | `boolean` | `false` | Controls Popover |

**State transitions:**

```
IDLE
  ├─ click region box / list row ──────────────────> SINGLE_SELECTED
  └─ click "Add region" (attachment open) ─────────> DRAW_MODE(add)

SINGLE_SELECTED
  ├─ click "Accept" ───────────────────────────────> [fire accept mutation] → IDLE
  ├─ click "Reject" / Delete key ──────────────────> REJECT_CONFIRM_OPEN
  ├─ click "Redraw" ───────────────────────────────> DRAW_MODE(redraw)
  ├─ click "Split" ────────────────────────────────> DRAW_MODE(split)
  ├─ click "Merge" (1 selected) ───────────────────> MULTI_SELECT (selectedComponentIds unchanged, UI shows checkboxes)
  ├─ click "Nest into…" ───────────────────────────> NEST_PICKER_OPEN
  ├─ shift-click another box ──────────────────────> MULTI_SELECT
  ├─ click background / Esc ───────────────────────> IDLE
  └─ click different box ──────────────────────────> SINGLE_SELECTED (new id)

MULTI_SELECT
  ├─ shift-click or checkbox toggle ───────────────> MULTI_SELECT (update ids)
  ├─ click "Merge" (≥2 selected) ──────────────────> [fire merge mutation] → IDLE
  ├─ Esc / click background ───────────────────────> IDLE
  └─ deselect all ─────────────────────────────────> IDLE

REJECT_CONFIRM_OPEN
  ├─ Confirm ──────────────────────────────────────> [fire reject mutation] → IDLE
  └─ Cancel / Esc ─────────────────────────────────> SINGLE_SELECTED (restored)

NEST_PICKER_OPEN
  ├─ select parent region ─────────────────────────> [fire nest mutation] → IDLE
  ├─ "Remove parent" ──────────────────────────────> [fire nest(null) mutation] → IDLE
  └─ close popover / Esc ──────────────────────────> SINGLE_SELECTED (restored)

DRAW_MODE(mode)     [mode ∈ {redraw, split, add}]
  ├─ pointerDown ──────────────────────────────────> DRAWING
  └─ Esc / Cancel ─────────────────────────────────> previous state (IDLE or SINGLE_SELECTED)

DRAWING
  ├─ pointerMove ──────────────────────────────────> DRAWING (update liveRect)
  └─ pointerUp, rect ≥ min ────────────────────────> RECT_DRAWN(mode)
  └─ pointerUp, rect < min ────────────────────────> DRAW_MODE(mode) + show warning toast

RECT_DRAWN(redraw)  ──────────────────────────────> [fire redraw mutation] → IDLE
RECT_DRAWN(add)     ──────────────────────────────> [fire create mutation] → IDLE
RECT_DRAWN(split)   ──────────────────────────────> DRAW_MODE(split) [drawnRects += 1]
  split: if ≥2 drawn, "Confirm split (N)" enabled
  ├─ Confirm split ────────────────────────────────> [fire split mutation] → IDLE
  └─ Draw another ─────────────────────────────────> DRAW_MODE(split) [draw next rect]
```

---

## 6. Copywriting Contract (new strings only)

All strings exact. Append to 05-UI-SPEC §11 — do not replace existing strings.

### 6.1 Action Toolbar

| Element | Text |
|---------|------|
| Accept button | "Accept Region" |
| Reject button | "Reject Region" |
| Redraw button | "Redraw Region" |
| Split button | "Split Region" |
| Merge button | "Merge Regions" |
| Nest button | "Nest into…" |
| Context label (single) | "Selected: {label} · Page {n}" |
| Context label (multi) | "{n} regions selected" |

### 6.2 Draw Mode Bar

| Mode | Heading | Instruction |
|------|---------|-------------|
| Redraw | "Draw Mode: Redraw" | "Draw a rectangle to replace the region." |
| Split | "Draw Mode: Split" | "Draw rectangles to define sub-regions." |
| Add region | "Draw Mode: Add Region" | "Draw a rectangle to define a new region." |
| Cancel button (all modes) | "Cancel Draw (Esc)" | — |
| Split confirm button | "Confirm split ({n})" | — |
| Draw another button (split) | "Draw another" | — |

### 6.3 Reject Confirmation Dialog

| Element | Text |
|---------|------|
| Title | "Reject this region?" |
| Description | "The region will be marked as rejected and hidden from the default view. You can show it again using the 'Show history' toggle." |
| Cancel | "Cancel" |
| Confirm (destructive) | "Reject region" |

### 6.4 Warnings and Empty States

| Context | Text |
|---------|------|
| Draw too small (toast.warning) | "Rectangle too small. Draw a larger area." |
| Nest picker — no eligible regions | "No other regions on this page to nest into." |
| Nest picker — un-nest option | "Remove parent (un-nest)" |
| "Add region" button (toolbar) | "+ Add region" |
| "Add region" disabled tooltip | "Open a PDF to draw regions." |
| History toggle label | "Show history" |
| Split confirm bar: N drawn | "{n} region drawn" (n=1) / "{n} regions drawn" (n≥2) |

### 6.5 Toast Messages

Per table in §3.8 — not repeated here.

### 6.6 Status Badge Text (EntitiesList, delta)

These are the `extractionStatus` values rendered as `<Badge>` text. No changes to existing strings; rejected and superseded history items render as:

| Status | Badge variant | Additional class |
|--------|--------------|-----------------|
| `pending` | `secondary` | — |
| `candidate` | `default` | — |
| `rejected` | `outline` | `line-through` |
| `superseded` | `secondary` | `opacity-60` |

---

## 7. Accessibility Contracts (delta)

Append to 05-UI-SPEC §12.

| Element | Contract |
|---------|----------|
| Action toolbar container | `role="toolbar"` `aria-label="Region actions"` `aria-controls="region-overlay-layer"` |
| Accept button | `aria-label="Accept region"` `aria-keyshortcuts="a"` |
| Reject button | `aria-label="Reject region"` `aria-keyshortcuts="Delete"` |
| Redraw button | `aria-label="Redraw region"` |
| Split button | `aria-label="Split region"` |
| Merge button | `aria-label="Merge selected regions"` |
| Nest button | `aria-label="Nest into parent region"` — when popover open: `aria-expanded="true"` |
| Draw mode overlay div | `aria-label="Drawing canvas"` `role="application"` `aria-description="Draw a rectangle. Press Escape to cancel."` |
| Draw mode bar | `role="status"` `aria-live="polite"` — content updates as rects are drawn |
| Live preview rect | `aria-hidden="true"` (purely visual) |
| Selected overlay box | `aria-pressed="true"` `aria-selected="true"` (both, for toolbar context) |
| Multi-select checkbox (overlay) | `aria-label="Select {label} for merge"` `role="checkbox"` `aria-checked={selected}` |
| Multi-select checkbox (list) | `<Checkbox aria-label="Select {label} for merge" />` |
| Reject dialog | Standard AlertDialog ARIA (provided by Radix — no additions needed) |
| Nest picker popover | `aria-label="Select parent region"` on `PopoverContent` |
| History toggle Switch | `aria-label="Show history — rejected and superseded regions"` |
| Mutation pending (optimistic) | Add `aria-busy="true"` to the overlay box during in-flight mutation |

**Focus management (new):**
- Enter draw mode: move focus to the Draw Mode Bar "Cancel" button so keyboard users can escape.
- Exit draw mode (Esc or cancel): return focus to the element that triggered draw mode (either the "Redraw"/"Split" toolbar button, or the "Add region" button).
- Open reject dialog: focus lands on "Cancel" button (AlertDialog default via Radix).
- Close reject dialog (cancel): return focus to "Reject" toolbar button.
- Open nest picker: focus lands on first eligible region row in the popover.
- Close nest picker: return focus to "Nest into…" toolbar button.

**Keyboard navigation within action toolbar:** `role="toolbar"` enables arrow-key navigation between buttons (left/right arrows). Tab exits the toolbar to the next focusable element.

---

## 8. Out of Scope (Phase 6)

Per 06-CONTEXT.md `<deferred>` section and Phase 6 boundary — do NOT implement or stub:

- Click-to-autofill + confirm flows — Phase 7.
- key_terms extraction — Phase 8.
- Undo/redo stack — deferred.
- Multi-page region spanning — deferred.
- Non-rectangular (polygon) drawing — deferred.
- Realtime multi-user editing — deferred.
- Field-level autofill UI — Phase 7.
- Any disabled/ghost placeholder action buttons for Phase 7 operations (explicitly forbidden — omit entirely, same rule as Phase 5).
