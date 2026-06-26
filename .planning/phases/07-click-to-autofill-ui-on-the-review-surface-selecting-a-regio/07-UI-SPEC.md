---
phase: 7
phase_name: "Click-to-autofill UI — autofill fields flow, confirm-with-corrections flow, reprocess controls"
status: draft
created: "2026-06-12"
delta_on: "05-UI-SPEC.md + 06-UI-SPEC.md"
sources:
  - 07-CONTEXT.md (authoritative — all decisions locked)
  - 05-UI-SPEC.md (base contract — inherited in full)
  - 06-UI-SPEC.md (Phase 6 delta — inherited in full)
  - apps/web/src/app/emails/[id]/_components/entities-list.tsx (current)
  - apps/web/src/app/emails/[id]/_components/action-toolbar.tsx (current)
  - apps/web/src/app/emails/[id]/_components/email-detail.tsx (current)
  - apps/email-listener/app/presentation/api/v1/components.py (response shapes)
---

# UI-SPEC — Phase 7: Click-to-autofill UI (Delta)

## 1. Inherited Contract

All decisions from `05-UI-SPEC.md` remain locked without modification:
tokens (§2), typography (§3), spacing scale (§4), layout shell (§5.1–5.5),
`RegionOverlayBox` base styles (§5.6), `EntitiesList` base behavior (§5.7),
component inventory (§6), state management pattern (§8), data access contract (§9),
loading skeletons (§10), copywriting (§11), accessibility (§12), file structure (§13).

All decisions from `06-UI-SPEC.md` remain locked without modification:
new color contracts for status-differentiated overlays (§2), selection state machine (§3.1),
floating action toolbar (§3.2), draw mode (§3.3), multi-select (§3.4), nest picker (§3.5),
history toggle (§3.6), add-region button (§3.7), optimistic mutations + toast system (§3.8),
reject dialog (§3.9), component inventory delta (§4), full state machine (§5),
copywriting delta (§6), accessibility delta (§7).

This document specifies only the Phase 7 delta: new surfaces (autofill button + entity-type
picker + fields panel + loading/failure/confirmed states + reprocess control), new state
transitions, new copy, and new accessibility obligations.

No disabled/ghost placeholder buttons for future phases. Omit entirely.

---

## 2. New Color Contracts (delta — no new CSS custom properties)

All new states use existing tokens from `globals.css :root`.

| Surface | Token | Value | Notes |
|---------|-------|-------|-------|
| Fields panel card background | `bg-card` | hsl(0 0% 100%) | Same as all cards |
| Fields panel header | `bg-muted` | hsl(0 0% 96.1%) | Subtle distinction from card body |
| Per-field confidence badge (normal, ≥0.5) | `text-muted-foreground` | hsl(0 0% 45.1%) | text-xs, no background |
| Per-field confidence badge (low, <0.5) | `text-destructive` | hsl(0 84.2% 60.2%) | text-xs, no background |
| Confirmed state badge | `bg-primary text-primary-foreground` | dark teal-green | same token as overlay label chip |
| Extracting spinner | `text-primary` | hsl(164 39% 22%) | Lucide `Loader2` with animate-spin |
| Entity-type picker popover | `bg-popover` | system default | Radix Popover inherits this |
| Reprocess button | `border-border` | outline variant | `<Button variant="outline">` |

**Confirmed badge:** reuses `bg-primary text-primary-foreground px-2 py-0.5 rounded-sm text-xs font-semibold` — identical to overlay label chip token (05-UI-SPEC §5.6). No new token.

---

## 3. New Interaction Contracts

### 3.1 "Autofill Fields" Action in the Action Toolbar

**Location:** Added to `ActionToolbar` (`action-toolbar.tsx`) after the existing Nest button.

**Enabled condition:** exactly one region selected AND `extractionStatus === "candidate"`.

**Disabled condition (tooltip shown):**
- Nothing selected: button absent (no single selection → full toolbar rules).
- Single selection with status `pending`: `disabled` attribute + tooltip text "Accept the region first".
- Single selection with status `rejected` or `superseded`: `disabled` attribute + tooltip text "Region is not active".
- Single selection with status `confirmed`: button absent (region already confirmed; read-only fields panel renders instead).

**Button specification:**

| Property | Value |
|----------|-------|
| Label | "Autofill Fields" |
| Variant | `outline` |
| Size | `sm` |
| Icon (Unicode prefix) | ✦ |
| `aria-label` | "Autofill Fields" |
| Position in toolbar | After "Nest into…"; before context label span |

**Click behavior:** opens entity-type picker (§3.2) anchored to this button.

**Toolbar layout update** (full button sequence when `candidate` region selected):

```
[✓ Accept Region]  [✗ Reject Region]  [↩ Redraw Region]  [÷ Split Region]
[⊕ Merge Regions]  [⤵ Nest into…]  [✦ Autofill Fields]
Selected: {label} · Page {n}
```

### 3.2 Entity-Type Picker

**Component:** `<Popover>` from `@nauta/ui/popover`. Anchor: the "Autofill Fields" button in the action toolbar.

**Data source:** `entityTypes.list` tRPC query (new — reads `entity_types` table, `is_active=true`; returns `{ slug, label, description, fields: Array<{ key, label, dataType, isRequired }> }`).

**Popover dimensions:** `w-72`.

**Popover layout:**

```
┌────────────────────────────────────────────┐
│  Select entity type                        │  ← text-sm font-semibold, pb-2
│  ──────────────────────────────────────    │
│  [label]                                   │  ← button row
│  [description text-xs text-muted-foreground] │
│  ──────────────────────────────────────    │
│  [label]                                   │
│  [description text-xs text-muted-foreground] │
└────────────────────────────────────────────┘
```

**Each row:** `<button>` element, full-width, `text-left`, `w-full`, `px-3 py-2`, `hover:bg-muted`, `rounded-sm`. Label: `text-sm font-medium`. Description: `text-xs text-muted-foreground mt-1`.

**Empty state in picker:** `text-sm text-muted-foreground py-3 px-3` — "No entity types configured."

**Loading state in picker:** single `<Skeleton className="h-20 w-full rounded" />` while `entityTypes.list` query is loading.

**On row click:** close popover; fire `autofillComponent` tRPC mutation with `{ componentId, entityTypeSlug: row.slug }`; transition region to EXTRACTING state (§4).

**Keyboard navigation:** standard Popover tab-trap; first row receives focus on open. Arrow keys navigate between rows. Enter/Space selects. Escape closes and returns focus to the "Autofill Fields" button.

### 3.3 Fields Panel

**Location:** inline expanding card that opens below the selected region's row inside `EntitiesList`. It is NOT a Sheet or modal. It renders as a nested `<div>` immediately after the selected `<li>` row in the regions list.

**Focal hierarchy:** the primary visual anchor in the fields panel is the "Confirm Fields" button (`variant="default"`); the field inputs are the working area; confidence badges and the panel header are secondary. No other element in the panel uses the primary token.

**Trigger:** visible when the selected region has an extraction record (`extractedFields` is non-null). This covers both the post-autofill REVIEWING state and the CONFIRMED state.

**Panel structure (ASCII wireframe):**

```
┌────────────────────────────────────────────────────────┐
│  INVOICE_NUMBER                    [89% overall]       │  ← header row
│                                    [candidate badge]   │
├────────────────────────────────────────────────────────┤
│  Invoice Number *                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  INV-2024-0042                                   │  │  ← <Input>
│  └──────────────────────────────────────────────────┘  │
│  92%                                                   │  ← per-field confidence
│                                                        │
│  Issue Date *                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  2024-03-15                                      │  │
│  └──────────────────────────────────────────────────┘  │
│  43%  (rendered in text-destructive)                   │  ← low confidence
│                                                        │
│  Vendor Name                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Acme Corp Ltd                                   │  │
│  └──────────────────────────────────────────────────┘  │
│  78%                                                   │
│                                                        │
│  [Confirm Fields]   [Discard]                          │  ← action row
└────────────────────────────────────────────────────────┘
```

**Header row:** `flex items-center justify-between px-4 py-2 bg-muted border-b`
- Left: `text-sm font-semibold text-foreground` — entity type label (e.g. "INVOICE_NUMBER").
- Right: overall confidence badge + extraction status badge.
  - Overall confidence: `text-xs text-muted-foreground` — "{n}% overall" (multiply `confidence_score` by 100, round to integer).
  - Extraction status badge: `<Badge>` using same `getStatusBadge()` logic as `EntitiesList`.

**Field rows (in REVIEWING state — editable):**
- Field label: `text-sm font-medium` + `*` suffix if `isRequired === true`. Required marker: `text-destructive text-xs ml-0.5`.
- Input: `<Input>` from `@nauta/ui/input`. `size="sm"` equivalent via `className="h-8 text-sm"`. `defaultValue={extractedFields[field.key] ?? ""}`. Input value is controlled in local state for the corrections flow.
- Per-field confidence: `text-xs` immediately below the input. Color: `text-muted-foreground` when `confidence_breakdown[field.key] >= 0.5`; `text-destructive` when `< 0.5`. Format: `{Math.round(score * 100)}%`. Hidden if `confidence_breakdown` is null for that key.
- Vertical spacing between field rows: `space-y-3` (`12px`).

**Field rows (in CONFIRMED state — read-only):**
- Field label: same `text-sm font-medium`.
- Value: `<p className="text-sm text-foreground mt-1">{value}</p>`. No `<Input>`. No edit affordance.
- Per-field confidence: still shown (same color logic), but now reflects the confirmed record.
- Overall header shows `<Badge className="bg-primary text-primary-foreground text-xs">Confirmed</Badge>` in place of extraction status badge.
- Action row: absent. No "Confirm Fields" or "Discard Fields" buttons in confirmed state.

**Action row (REVIEWING only):** `flex items-center gap-2 pt-3 border-t mt-3`
- "Confirm Fields": `<Button variant="default" size="sm">Confirm Fields</Button>`. Fires `confirmComponent` mutation with `{ componentId, correctedFields: currentFormValues }`.
- "Discard Fields": `<Button variant="ghost" size="sm">Discard Fields</Button>`. Clears local extraction state (does NOT call any API); returns region to its pre-autofill visual state in the list. The server extraction record is NOT deleted (D-16 — supersede, never delete). Discard means: close the fields panel and clear the local autofill result from UI state only.

**Panel scroll:** the `EntitiesList` `<ScrollArea className="h-64">` contains the panel inline. No separate scroll. If the panel causes overflow, the ScrollArea handles it naturally.

**Panel open/close animation:** none. Instant DOM insertion/removal (consistent with toolbar show/hide idiom from 06-UI-SPEC §3.2).

### 3.4 Loading State During Autofill (EXTRACTING)

**Trigger:** from picker selection to API response receipt (seconds-scale LLM call).

**What is disabled during extraction:**
- All action toolbar buttons (`disabled` attribute on entire toolbar: pass `disabled={true}` to `ActionToolbar`).
- "Autofill Fields" button itself (already in toolbar).
- The selected region's `EntitiesList` row `<button>` (add `disabled` or `aria-disabled="true"` and `pointer-events-none`).

**Visual changes during extraction:**
- The fields panel area (inline in the list under the selected row) shows:

```
┌────────────────────────────────────────────┐
│  [spinner icon]  Extracting fields…        │
└────────────────────────────────────────────┘
```

Where `[spinner icon]` is `<Loader2 className="h-4 w-4 animate-spin text-primary" />` from `lucide-react`.
Layout: `flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground`.

**ARIA during extraction:** `aria-busy="true"` on the fields panel container div. The container also gets `aria-label="Extracting fields…"` so screen readers announce the loading status.

**The region overlay box:** add `aria-busy="true"` (mirrors the mutation in-flight pattern from 06-UI-SPEC §7).

### 3.5 Failure State (FAILED — First-Class)

**Context:** AWS Bedrock model access is pending. Every live autofill call returns 500/502 from the proxy. This is the expected state until access is granted.

**Failure toast:** fired via `toast.error(...)` from the `sonner` library directly. Exact copy:

```
"AI autofill is unavailable — model access is pending."
```

Duration: 6000ms (longer than default 5000ms because this is a systemic, not transient, failure).

**Region behavior on failure:** the region returns to its pre-EXTRACTING state unchanged. No fields panel. No partial data. The extraction status badge in `EntitiesList` does NOT change. The overlay box is NOT modified.

**No inline error card.** No secondary UI. Toast only — consistent with 06-UI-SPEC §3.8 rule ("No inline alerts for mutation errors — toasts only").

**Other failure conditions (non-Bedrock):**
- 404 from autofill endpoint (component not found): `toast.error("Could not autofill region. Component not found.")` — same region-unchanged behavior.
- Network error: `toast.error("Could not reach the server. Check your connection and try again.")` — same behavior.

### 3.6 Confirmed State

**Trigger:** `confirmComponent` mutation succeeds. Backend updates extraction record status to `confirmed`.

**Visual changes:**
- `EntitiesList` row: extraction status badge changes to `variant="default"` (same as candidate but the confirmed badge reads "confirmed"). The label still shows the entity type label.
- Fields panel: transitions to read-only view (§3.3 CONFIRMED state). "Confirm Fields" and "Discard Fields" buttons are removed. A `<Badge className="bg-primary text-primary-foreground text-xs">Confirmed</Badge>` appears in the header.
- Action toolbar: "Autofill Fields" button is absent for confirmed regions (confirmed → not actionable for re-autofill in Phase 7; Phase 8 re-processing is out of scope).
- Overlay box: label chip retains `bg-primary text-primary-foreground` (no visual change to the box itself — confirmed regions look the same as candidate).

**Confirmed status badge text:** "confirmed" (lowercase, matches `extractionStatus` string).

**Confirmed badge in fields panel header:** `<Badge className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-sm">Confirmed</Badge>` (Title case in the panel header only; status chip in the list remains lowercase to match the data string).

**Post-confirm data freshness:** invalidate `emails.detail` tRPC query via `utils.emails.detail.invalidate({ id: emailId })` inside `onSuccess` callback. No optimistic update for confirm (server state is source of truth for confirmed fields).

### 3.7 Reprocess Control

**Location:** in the email detail page header row (`email-detail.tsx` `<header>` element), right-aligned alongside the existing `parseStatus` badge. Placed after the badge.

**Button specification:**

| Property | Value |
|----------|-------|
| Label | "Reprocess Email" |
| Variant | `outline` |
| Size | `sm` |
| `aria-label` | "Reprocess this email" |
| Always visible | Yes — shown regardless of parse status |

**Updated header wireframe:**

```
← Back to inbox    {subject h1}    [parseStatus badge]  [Reprocess Email]
```

**Click behavior:** opens `AlertDialog` (`ReprocessDialog` — new component). Does NOT fire the mutation immediately.

**Reprocess AlertDialog content:**

```
AlertDialogTitle:   "Reprocess this email?"
AlertDialogDescription:
  "All existing region extractions will be superseded and new ones generated.
   Your confirmed regions and their field data are never deleted — they remain
   accessible via the history view."
AlertDialogCancel:  "Keep current data"
AlertDialogAction:  "Reprocess Email"
```

`AlertDialogAction` styling: `buttonVariants({ variant: "default" })` — NOT destructive. Reprocessing is additive (D-16: supersede, never delete); using destructive variant would mislead.

**On confirm:** fire `reprocessEmail` tRPC mutation with `{ emailId }`. On success: `toast.success("Email sent for reprocessing")` + `utils.emails.detail.invalidate({ id: emailId })`. On error: `toast.error("Could not reprocess email. Try again.")`.

**No optimistic update** for reprocess (server-side work is async; the UI reflects state after `invalidate` resolves).

---

## 4. Component Inventory Delta

All from existing installed packages — no new installs required.

| Component | Import path | Phase 7 usage |
|-----------|------------|---------------|
| `Input` | `@nauta/ui/input` | Editable field values in fields panel |
| `Loader2` | `lucide-react` | Spinner icon during extraction (already used in project) |
| `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` | `@nauta/ui/alert-dialog` | ReprocessDialog (same set as Phase 6 RejectDialog — already imported) |
| `Popover`, `PopoverContent`, `PopoverTrigger` | `@nauta/ui/popover` | Entity-type picker (already imported for NestPicker) |
| `Skeleton` | `@nauta/ui/skeleton` | Loading state inside entity-type picker |
| `Badge` | `@nauta/ui/badge` | Confirmed state badge in fields panel header |
| `Button` | `@nauta/ui/button` | "Autofill Fields", "Confirm Fields", "Discard Fields", "Reprocess Email" |

**New files (additions to Phase 6 file structure):**

```
apps/web/src/app/emails/[id]/_components/
  entity-type-picker.tsx       ← Popover with entity type rows; fires onSelect(slug)
  fields-panel.tsx             ← inline expanding card; REVIEWING + CONFIRMED states
  reprocess-dialog.tsx         ← AlertDialog for reprocess confirmation
packages/api-client/src/router/emails/
  mutations.ts                 ← extend: add autofillComponent, confirmComponent, reprocessEmail
packages/api-client/src/router/
  entity-types.ts              ← new tRPC router: entityTypes.list (Drizzle read)
```

**Extend existing files (no new files):**
- `action-toolbar.tsx` — add "Autofill Fields" button + `onAutofill` prop.
- `entities-list.tsx` — add inline fields panel rendering below selected row; add `autofillState` + `onDiscard` props.
- `email-detail.tsx` — add `ReprocessDialog`, reprocess button in header, wire autofill/confirm mutations, manage `autofillState` per component.

---

## 5. State Machine (Full Phase 7 Autofill)

New state variables added to `email-detail.tsx` (or extracted to a `useAutofill` hook):

| Variable | Type | Initial | Notes |
|----------|------|---------|-------|
| `autofillState` | `Record<string, AutofillPhase>` | `{}` | Keyed by componentId |
| `extractionResults` | `Record<string, ExtractionResult>` | `{}` | Keyed by componentId; holds extracted_fields, confidence_score, confidence_breakdown |
| `fieldValues` | `Record<string, Record<string, string>>` | `{}` | Keyed by componentId then fieldKey; local corrections |
| `pickerOpen` | `boolean` | `false` | Controls entity-type picker Popover |
| `reprocessDialogOpen` | `boolean` | `false` | Controls reprocess AlertDialog |

```typescript
type AutofillPhase =
  | "idle"          // no extraction attempted
  | "picking"       // entity-type picker open
  | "extracting"    // mutation in flight
  | "reviewing"     // results shown; fields editable
  | "confirming"    // confirm mutation in flight
  | "confirmed"     // confirmed; read-only
  | "failed";       // extraction failed; panel not shown
```

**Full autofill state machine for a single region:**

```
idle
  └─ click "Autofill Fields" (status=candidate) ──────> picking

picking
  ├─ select entity type row ──────────────────────────> extracting
  │   [fire autofillComponent mutation]
  └─ close picker (Esc / click outside) ─────────────> idle

extracting
  ├─ mutation success ─────────────────────────────────> reviewing
  │   [store result in extractionResults; set fieldValues from extracted_fields]
  └─ mutation error ───────────────────────────────────> failed
      [toast.error("AI autofill is unavailable — model access is pending.")]
      [clear autofillState → idle]

reviewing
  ├─ user edits Input fields ──────────────────────────> reviewing (fieldValues updated)
  ├─ click "Confirm Fields" ───────────────────────────> confirming
  │   [fire confirmComponent mutation with correctedFields = fieldValues diff]
  └─ click "Discard Fields" ──────────────────────────────────> idle
      [clear extractionResults + fieldValues for this componentId]
      [NO API call; server record untouched]

confirming
  ├─ mutation success ─────────────────────────────────> confirmed
  │   [invalidate emails.detail; toast.success("Fields confirmed")]
  └─ mutation error ───────────────────────────────────> reviewing (restored)
      [toast.error("Could not confirm fields. Try again.")]

confirmed
  (terminal for Phase 7 — no re-autofill affordance)

failed
  └─ (auto-transitions to idle after toast; user may retry)
```

**Corrected fields logic:** only send fields where `fieldValues[componentId][key] !== extractedFields[key]`. If no corrections were made, send `correctedFields: null` (matches `ConfirmRequest.corrected_fields: dict | null` in backend).

---

## 6. Copywriting Contract (new strings only)

All strings are exact. Append to 05-UI-SPEC §11 and 06-UI-SPEC §6 — do not replace existing strings.

### 6.1 Action Toolbar (new button)

| Element | Text |
|---------|------|
| Autofill Fields button | "✦ Autofill Fields" |
| Tooltip (candidate, enabled) | "Extract field values using AI" |
| Tooltip (pending status) | "Accept the region first" |
| Tooltip (rejected/superseded) | "Region is not active" |

### 6.2 Entity-Type Picker

| Element | Text |
|---------|------|
| Picker heading | "Select entity type" |
| Empty state | "No entity types configured." |
| Loading state | (Skeleton — no text) |

### 6.3 Fields Panel Header

| Element | Text |
|---------|------|
| Overall confidence | "{n}% overall" (e.g. "89% overall") |
| Confirmed badge (panel header only) | "Confirmed" |

### 6.4 Fields Panel Action Row

| Element | Text |
|---------|------|
| Primary CTA | "Confirm Fields" |
| Secondary / dismiss | "Discard Fields" |

### 6.5 Fields Panel States

| State | Copy |
|-------|------|
| Extracting (spinner label) | "Extracting fields…" |
| Required field asterisk aria-label | "{field label} (required)" — on the label `<span>` |

### 6.6 Toast Messages

| Action | Success | Error |
|--------|---------|-------|
| Autofill (Bedrock pending) | — | "AI autofill is unavailable — model access is pending." |
| Autofill (component not found) | — | "Could not autofill region. Component not found." |
| Autofill (network error) | — | "Could not reach the server. Check your connection and try again." |
| Confirm Fields | "Fields confirmed" | "Could not confirm fields. Try again." |
| Reprocess Email | "Email sent for reprocessing" | "Could not reprocess email. Try again." |

### 6.7 Reprocess AlertDialog

| Element | Text |
|---------|------|
| Title | "Reprocess this email?" |
| Description | "All existing region extractions will be superseded and new ones generated. Your confirmed regions and their field data are never deleted — they remain accessible via the history view." |
| Cancel | "Keep current data" |
| Confirm | "Reprocess Email" |

### 6.8 Reprocess Button (page header)

| Element | Text |
|---------|------|
| Button label | "Reprocess Email" |

### 6.9 Status Badge Text (delta — confirmed state)

| Status | Badge variant | Badge text |
|--------|--------------|------------|
| `confirmed` | `default` | "confirmed" |

All other status badge text strings are unchanged from 06-UI-SPEC §6.6.

---

## 7. Accessibility Contracts (delta)

Append to 05-UI-SPEC §12 and 06-UI-SPEC §7.

| Element | Contract |
|---------|----------|
| "Autofill Fields" toolbar button | `aria-label="Autofill Fields"` |
| "Autofill Fields" button (disabled, pending status) | `aria-disabled="true"` `aria-describedby="autofill-tooltip-{componentId}"` + Tooltip text "Accept the region first" |
| Entity-type picker Popover | `aria-label="Select entity type"` on `PopoverContent`; `role="listbox"` on the options container |
| Entity type rows in picker | `role="option"` `aria-selected="false"` (single-select, selection closes picker) |
| Fields panel container | `role="region"` `aria-label="Extracted fields for {entityTypeLabel}"` |
| Fields panel during extraction | `aria-busy="true"` `aria-label="Extracting fields…"` |
| Extracting spinner | `aria-hidden="true"` (decorative; the container `aria-label` communicates status) |
| Per-field `<Input>` | `aria-label="{fieldLabel}"` or associated via `<label for>`. Required fields: `aria-required="true"` |
| Per-field confidence (low, <0.5) | `aria-label="{fieldLabel} confidence: {n}%, low confidence"` (announced to screen readers) |
| "Confirm Fields" button | `aria-label="Confirm Fields"` |
| "Discard Fields" button | `aria-label="Discard extraction results"` |
| Confirmed badge in panel header | `aria-label="Status: Confirmed"` |
| "Reprocess Email" header button | `aria-label="Reprocess this email"` |
| Reprocess AlertDialog | Standard Radix AlertDialog ARIA — no additions needed |

**Focus management (new):**
- Open entity-type picker: focus moves to first entity type row in the popover.
- Close picker (Esc / outside click): return focus to the "Autofill Fields" button.
- Picker selection → extraction starts: focus remains on the "Autofill Fields" button position (it is now disabled; focus shifts to next focusable element in the toolbar — "Keep" or context label).
- Extraction success → fields panel appears: move focus to the first `<Input>` in the fields panel (the first editable field). This satisfies the "focus into first field on results" requirement.
- Click "Discard Fields": return focus to the "Autofill Fields" button (now re-enabled).
- Click "Confirm Fields" → confirming → confirmed: focus moves to the "Reprocess Email" button in the page header (nearest actionable element after the fields panel collapses to read-only).
- Open reprocess dialog: focus lands on "Keep current data" (AlertDialog default via Radix — cancel-first focus is the safer default for a non-destructive action).
- Close reprocess dialog (cancel): return focus to "Reprocess Email" button.

**Keyboard navigation within fields panel:**
- Standard Tab order through `<Input>` fields, then "Confirm Fields", then "Discard Fields".
- Shift+Tab reverses.
- No arrow-key navigation needed (linear form, not a grid).
- Escape within the fields panel: closes the panel (same as "Discard Fields") and returns focus to the "Autofill Fields" button. This matches the Popover/Dialog Escape convention.

---

## 8. Wire Diagrams (ASCII)

### 8.1 Entity-Type Picker (anchored to "Autofill Fields" button in toolbar)

```
Action toolbar row:
┌────────────────────────────────────────────────────────────────┐
│ [✓ Accept] [✗ Reject] [↩ Redraw] [÷ Split] [⊕ Merge] [⤵ Nest]│
│ [✦ Autofill Fields ▾]   Selected: Invoice · Page 2            │
└────────────────────┬───────────────────────────────────────────┘
                     │ (Popover drops down from button)
                     ▼
         ┌────────────────────────────┐
         │  Select entity type        │  text-sm font-semibold
         │  ──────────────────────    │
         │  Invoice                   │  text-sm font-medium
         │  Financial invoice document│  text-xs text-muted-foreground
         │  ──────────────────────    │
         │  Purchase Order            │
         │  Procurement PO document   │
         │  ──────────────────────    │
         │  Bill of Lading            │
         │  Shipping document         │
         └────────────────────────────┘
```

### 8.2 Fields Panel (inline in EntitiesList, below selected row)

```
EntitiesList ScrollArea:
┌──────────────────────────────────────────────────────────┐
│  [Invoice] [candidate]                                   │  ← normal list row
│  Attachment: invoice.pdf · Page 2                        │
├──────────────────────────────────────────────────────────┤
│  ▼ FIELDS PANEL (inline, no border gap)                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Invoice                    [89% overall] [cand.]  │  │  ← header bg-muted
│  ├────────────────────────────────────────────────────┤  │
│  │  Invoice Number *                                  │  │
│  │  ┌────────────────────────────────────────────┐   │  │
│  │  │  INV-2024-0042                             │   │  │  ← <Input>
│  │  └────────────────────────────────────────────┘   │  │
│  │  92%  (text-muted-foreground)                      │  │  ← confidence
│  │                                                    │  │
│  │  Issue Date *                                      │  │
│  │  ┌────────────────────────────────────────────┐   │  │
│  │  │  2024-03-15                                │   │  │
│  │  └────────────────────────────────────────────┘   │  │
│  │  43%  (text-destructive — below 0.5 threshold)    │  │
│  │                                                    │  │
│  │  ────────────────────────────────────────────      │  │  ← border-t divider
│  │  [Confirm Fields]   [Discard]                      │  │
│  └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  [Purchase Order] [pending]                              │  ← next list row
│  Attachment: invoice.pdf · Page 3                        │
└──────────────────────────────────────────────────────────┘
```

### 8.3 Loading State During Extraction (inline in EntitiesList)

```
├──────────────────────────────────────────────────────────┤
│  ▼ FIELDS PANEL (extracting)                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  [⟳ spinner]  Extracting fields…                  │  │  ← py-6 px-4 text-sm text-muted
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
```

### 8.4 Confirmed State Fields Panel

```
│  ┌────────────────────────────────────────────────────┐  │
│  │  Invoice                       [Confirmed badge]   │  │  ← bg-primary text-primary-foreground badge
│  ├────────────────────────────────────────────────────┤  │
│  │  Invoice Number *                                  │  │
│  │  INV-2024-0042                                     │  │  ← plain <p>, no Input
│  │  92%                                               │  │
│  │                                                    │  │
│  │  Issue Date *                                      │  │
│  │  2024-03-15                                        │  │
│  │  43%  (text-destructive)                           │  │
│  └────────────────────────────────────────────────────┘  │
```

### 8.5 Reprocess Button in Page Header

```
← Back to inbox    Invoice #2024-0042    [parsed]  [Reprocess Email]
                   ↑ h1 text-2xl         ↑ Badge   ↑ Button variant="outline" size="sm"
```

---

## 9. Data Contract Extensions

### 9.1 emails.detail — required fields (verify/extend existing query)

The following fields must be present in each component in the `emails.detail` response. Add to the Drizzle select if missing:

| Field | Source table | Notes |
|-------|-------------|-------|
| `extractedFields` | `extraction_records.extracted_fields` | Active extraction record only (CR-03 superseded filter applies) |
| `correctedFields` | `extraction_records.corrected_fields` | May be null |
| `confidenceScore` | `extraction_records.confidence_score` | May be null |
| `confidenceBreakdown` | `extraction_records.confidence_breakdown` | May be null |
| `extractionRecordStatus` | `extraction_records.status` | `"candidate" | "confirmed" | "superseded"` |
| `entityTypeSlug` | `entity_types.slug` | Via component → entity_type join |
| `entityTypeLabel` | `entity_types.label` | Already present from Phase 5 |

### 9.2 New tRPC Mutations

**`components.autofillComponent`**

```typescript
// Input
{ componentId: string; entityTypeSlug: string }

// Output
{
  extractedFields: Record<string, unknown>;
  confidenceScore: number;
  confidenceBreakdown: Record<string, unknown> | null;
}
```

Proxy pattern: `POST {EMAIL_LISTENER_URL}/v1/components/{componentId}/autofill` with `{ entity_type_slug: entityTypeSlug }` body. Uses `getListenerConfig()` (Phase 6 idiom from `mutations.ts`).

**`components.confirmComponent`**

```typescript
// Input
{ componentId: string; correctedFields: Record<string, unknown> | null }

// Output
{ componentId: string; status: "confirmed" }
```

Proxy pattern: `POST {EMAIL_LISTENER_URL}/v1/components/{componentId}/confirm` with `{ corrected_fields: correctedFields }` body.

**`emails.reprocessEmail`**

```typescript
// Input
{ emailId: string }

// Output
{ ok: true }  // or void — backend response shape TBD; treat any 2xx as success
```

Proxy pattern: `POST {EMAIL_LISTENER_URL}/v1/emails/{emailId}/reprocess`.

### 9.3 New tRPC Query

**`entityTypes.list`**

```typescript
// Input: none (or optional { importerId?: string } for scoped types — Phase 7 uses no filter)

// Output
Array<{
  slug: string;
  label: string;
  description: string | null;
  fields: Array<{
    key: string;
    label: string;
    dataType: string;
    isRequired: boolean;
  }>;
}>
```

Drizzle read: `entity_types` join `entity_type_fields`; filter `is_active = true`; order by `label ASC`.

---

## 10. Out of Scope (Phase 7)

Per 07-CONTEXT.md `<deferred>` section — do NOT implement or stub:

- `key_terms` extraction — Phase 8.
- Entity-instance matching UI (`nauta_id` display) — backend match_type exists but no implementation yet.
- Bulk autofill (all regions at once).
- `auto_confirmed` routing rules.
- Re-autofill a confirmed region (terminal state in Phase 7).
- Any disabled/ghost placeholder buttons for future phases (explicitly forbidden — omit entirely).
- Dark mode toggle.
- Auth / per-user tenancy.
