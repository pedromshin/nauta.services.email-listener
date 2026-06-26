---
phase: 09-entity-field-region-relationships-canvas
plan: 09
subsystem: canvas-editor-composition
tags: [nextjs, react, trpc, optimistic-update, sonner, role-color, active-parent, autofill-fields, d-06, d-10, d-11, d-12, d-13, d-14, d-15, d-16, d-17, d-18]
dependency_graph:
  requires:
    - "09-08: canvas-shell.tsx (four-zone frame with LAYERS/INSPECTOR/canvas/banner slots), use-canvas-state.ts (mode/selectedIds/activeParentId + onDrawComplete + edit), use-role-mutations.ts (setRole/setEntityType/setFieldRelationship/confirmField/denyField + autofillFields + mutatingComponentIds), region-overlay-box.tsx (role/isActiveParent/showConfirmDeny), overlay-layer.tsx (roleFilter/activeParentId), canvas-toolbar.tsx"
    - "09-04: emails.setRole/setEntityType/setFieldRelationship/autofillFields/denyField/confirmField/createRegion tRPC mutations + emails.detail role/entityTypeId/entityTypeFieldId per component + extractedFields/confidenceScore"
    - "Phase 5/6/7: PdfPreviewPane (self-contained canvas zone), useRegionEdit (createRegion/redraw/split/nest), entity-type-picker.tsx, status-badge.ts, fields-panel.tsx"
    - "@nauta/ui: button, badge, input, popover, scroll-area, skeleton; lucide-react (ChevronDown/ChevronRight/Square/MousePointer2/Sparkles/Loader2)"
  provides:
    - "layers-panel.tsx + layers-tree-row.tsx (NEW): the entities-first LAYERS tree (D-06/D-12) — entity rows always; field rows only under expanded/selected parent; unrelated behind a toggle; populated/related fields only; role chips (violet/amber/slate); inline ✓/✗ on candidate field rows"
    - "role-picker.tsx (NEW): static segmented entity|field|unrelated group + Clear role (D-11)"
    - "field-relationship-picker.tsx (NEW): parent-entity + field-property Popovers (property disabled until parent chosen) → setFieldRelationship (D-04/D-11)"
    - "confirm-deny-controls.tsx (NEW): the canonical inline floating ✓/✗ (z-30) with origin-aware deny + undo toast (D-16/D-17/D-18)"
    - "active-parent-banner.tsx (NEW): violet-tinted role=status aria-live banner with the exact D-10 copy + Clear"
    - "inspector-panel.tsx (NEW): the single role + relationship control point (D-11) — Region Identity, RolePicker, EntityTypePicker, FieldRelationshipPicker, Autofill Fields (gated on entity+entityTypeId) + Confirm All Fields, Candidate Value (<0.5 destructive)"
    - "use-autofill-fields.ts (NEW): per-entity phase machine + non-optimistic autofillFields (invalidate-on-success) + exact 6000ms degrade toast + confirmAllFields (D-13/14/15)"
    - "email-detail.tsx (REWIRED): renders <CanvasShell> composing LayersPanel + InspectorPanel + PdfPreviewPane + ActiveParentBanner driven by the 09-08 hooks; D-10 active-parent drawing routes a drawn box to a FIELD child of the active entity"
  affects:
    - "Phase 9 is feature-complete at the editor surface: the canvas review loop (select entity → autofill → candidate field boxes → inline ✓/✗) is wired end-to-end at /emails/[id], pending human verification (Task 4)."
tech_stack:
  added: []
  patterns:
    - "Composition-over-refactor: the existing self-contained PdfPreviewPane (its own zoom/draw/overlay toolbar, Phase 5/6) is placed verbatim into the CanvasShell `canvas` slot rather than decomposed — honors the no-break constraint; the shell adds LAYERS/INSPECTOR/banner around it"
    - "View-model adapters in email-detail map emails.detail components → LayersComponent / InspectorComponent: role coerced to ComponentRole, entityTypeLabel resolved from the component's own entityTypeId via entityTypes.list (idToLabel), property label from fieldIdToLabel, candidateValue from the first extractedFields entry (auto-escaped React text node, T-09-80)"
    - "slug→id bridge: EntityTypePicker emits a SLUG but setEntityType takes an entityTypeId — email-detail resolves slug→id via a memoized slugToId map before calling setEntityType"
    - "D-10 active-parent drawing: a dedicated createRegion mutation in email-detail reads the new component_id from the ApiResponse envelope on success, then chains setRole=field + setFieldRelationship(activeParentId) — useRegionEdit.createRegion (which discards the id) is left untouched"
    - "D-12 LAYERS visibility encapsulated in layers-panel: entity/unclassified always; field rows render only under an expanded parent (auto-expanded when selected/active); unrelated gated on the toggle; populated-fields-only via isPopulatedField (candidateValue !== null || entityTypeFieldId !== null)"
    - "use-autofill-fields delegates confirmAllFields to the use-role-mutations confirmField (single optimistic path) rather than re-wiring confirm — avoids duplicate mutation state for the same component"
key_files:
  created:
    - "apps/web/src/app/emails/[id]/_components/layers-panel.tsx"
    - "apps/web/src/app/emails/[id]/_components/layers-tree-row.tsx"
    - "apps/web/src/app/emails/[id]/_components/role-picker.tsx"
    - "apps/web/src/app/emails/[id]/_components/field-relationship-picker.tsx"
    - "apps/web/src/app/emails/[id]/_components/confirm-deny-controls.tsx"
    - "apps/web/src/app/emails/[id]/_components/active-parent-banner.tsx"
    - "apps/web/src/app/emails/[id]/_components/inspector-panel.tsx"
    - "apps/web/src/app/emails/[id]/_components/use-autofill-fields.ts"
  modified:
    - "apps/web/src/app/emails/[id]/_components/email-detail.tsx"
decisions:
  - "PdfPreviewPane is composed (not decomposed) into the CanvasShell canvas slot. It is a self-contained Phase 5/6 component with its own working toolbar (page/zoom/draw/overlay) and intricate zoom-to-cursor/Space-pan logic. Refactoring it to be fully controlled by the CanvasShell's separate toolbar would be a large, high-risk change under the critical-no-break constraint. The CanvasShell toolbar's view toggles (Regions/History/Unrelated) drive the LAYERS panel + shared state; its page/zoom buttons mirror page state but the pane's internal toolbar remains the functional PDF control surface. NOTE for human verify (Task 4): the editor currently shows BOTH the shell toolbar and the pane's internal toolbar — a follow-up can collapse these once PdfPreviewPane is made fully controlled."
  - "Candidate value is derived as the FIRST entry of a field component's extractedFields (the autofill use case writes one value per field child). Rendered as a React text node — no dangerouslySetInnerHTML anywhere (T-09-80 mitigated)."
  - "isAutoDetected for confirm-deny-controls is a client-side affordance flag only (drives the Undo toast). The server is the authority for the actual origin-aware soft-reject vs clear-value outcome (per the 09-08 use-role-mutations design: optimistically mark rejected, reconcile on invalidate). The detail query does not expose content_raw/origin, so the inline LAYERS ✓/✗ + the inspector route deny through roleMutations.denyField and let the server decide; the standalone confirm-deny-controls.tsx exposes the isAutoDetected prop + Undo toast for callers that know the origin."
  - "use-role-mutations already had an inline autofillFields phase machine (09-08). 09-09 adds the dedicated use-autofill-fields.ts per the plan (per-entity phases + Confirm All Fields) and email-detail consumes IT for the inspector's autofill state, leaving the 09-08 inline machine in place (unused by the new composition) to avoid touching the 09-08 hook."
  - "RolePicker is fully static (no fetch) — the three roles are a known enum; only entityTypes.list is fetched (lazily, in the field-relationship + entity-type pickers)."
metrics:
  duration: "~12m"
  completed: "2026-06-13"
  tasks: 3
  files: 9
---

# Phase 9 Plan 09: Entity/Field Region-Relationship Canvas — Editor Composition Summary

Completed the canvas editor surface (D-06/D-10/D-11/D-12/D-13/D-14/D-15/D-16/D-17/D-18): the entities-first LAYERS tree (`layers-panel` + `layers-tree-row`), the INSPECTOR (`inspector-panel`) with the role picker + field-relationship pickers + the gated "Autofill Fields" action, the canonical inline `confirm-deny-controls`, the D-10 `active-parent-banner`, the non-optimistic `use-autofill-fields` per-entity phase hook, and the `email-detail.tsx` rewire that composes the 09-08 `CanvasShell` + hooks into a working editor at `/emails/[id]`. tsc + `npm run web:build` both green; the human-verification loop (Task 4) is awaiting a browser session.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | LAYERS tree (panel + row): role chips, D-12 visibility, inline ✓/✗ | `e1391d2` | layers-panel.tsx, layers-tree-row.tsx |
| 2 | Role/field-relationship pickers + inline confirm/deny + active-parent banner | `65ac814` | role-picker.tsx, field-relationship-picker.tsx, confirm-deny-controls.tsx, active-parent-banner.tsx |
| 3 | INSPECTOR + use-autofill-fields + email-detail CanvasShell composition | `8062fe9` | inspector-panel.tsx, use-autofill-fields.ts, email-detail.tsx |

## What Was Built

### Task 1 — LAYERS tree (D-06/D-12)
- `layers-tree-row.tsx`: a 36px `role="treeitem"` row. ENTITY (chevron + violet chip + label + page badge, click selects + arms active-parent), FIELD (`pl-8`, amber chip + property + ":" + candidate value + inline `h-4` ✓/✗; confirmed → `bg-green-50`, no controls), UNCLASSIFIED (`Square` icon + muted label). `aria-selected`/`aria-expanded`. (`SquareDashed` is not exported by this lucide-react version → `Square` with reduced opacity.)
- `layers-panel.tsx`: `role="navigation"` → `role="tree"`. D-12 visibility — entity/unclassified always; field rows only under an expanded parent (auto-expanded when selected/active); unrelated behind the toggle; populated/related fields only (`isPopulatedField`). Exact empty-state copy ("No regions yet" / "Draw a rectangle on the document to define your first region."). ScrollArea h-full; inline ✓/✗ → confirm/deny.

### Task 2 — Pickers + inline controls + banner (D-11/D-16/D-17/D-18/D-10)
- `role-picker.tsx`: static segmented entity|field|unrelated (role-color active states) + "Clear role" ghost; `role="group" aria-label="Region role"`.
- `field-relationship-picker.tsx`: Parent-entity Popover (same-page ENTITY regions; "No entity regions on this page.") + Field-property Popover (lazy `entityTypes.list` filtered to the parent's type; disabled until a parent is chosen; "Select a parent entity first." / "No fields defined for this entity type."). → `setFieldRelationship`.
- `confirm-deny-controls.tsx`: the canonical inline floating ✓/✗ (`absolute -top-3 right-0 z-30`, green confirm / destructive deny, exact UI-SPEC classes). ✗ origin-aware (D-18): auto-detected → deny + `toast.info("Field value cleared.", { Undo, 3000ms })`; user-drawn → deny only. ✓ confirms (flywheel).
- `active-parent-banner.tsx`: violet-tinted `role="status" aria-live="polite"`, exact copy `"Active entity: {label} — next drawn boxes become fields"` + Clear (Esc).

### Task 3 — INSPECTOR + autofill + composition (D-11/D-13/D-14/D-15)
- `use-autofill-fields.ts`: per-entity phase machine (`idle|extracting|reviewing|confirmed|failed`); non-optimistic `autofillFields` (invalidate `emails.detail` on success → "reviewing"); failure → exact `toast.error("AI autofill is unavailable — model access is pending.", { duration: 6000 })` + "failed"; `confirmAllFields` bulk-confirms via the role-mutations `confirmField` (D-14, a conscious action).
- `inspector-panel.tsx`: `role="complementary"`. No-selection ("Select a region" / "Click a box on the canvas or a row in the Layers panel to inspect it."). Single-selection: Region Identity (role chip + label + status/page badges); RolePicker; EntityTypePicker (role=entity|field, full-width controlled Popover); FieldRelationshipPicker (role=field); "Autofill Fields" (`Sparkles`; extracting → `Loader2` + "Extracting…" + `aria-busy`) gated on role=entity AND entityTypeId, plus "Confirm All Fields" once candidates exist; Candidate Value section (inline `Input h-8`, confidence `<0.5` destructive) + "Confirm Field".
- `email-detail.tsx`: rewired to render `<CanvasShell>` with LAYERS=`<LayersPanel>`, INSPECTOR=`<InspectorPanel>`, canvas=`<PdfPreviewPane>` (which internally mounts OverlayLayer + DrawOverlay), banner=`<ActiveParentBanner>` — driven by `useCanvasState` + `useRoleMutations` + `useAutofillFields`. Computes `parentOptions` (same-page ENTITY regions, 06-04 pattern), resolves entity-type slug→id, and routes a draw-with-active-parent through a dedicated `createRegion` mutation that chains `setRole=field` + `setFieldRelationship(activeParentId)` (standalone unclassified region otherwise). Reprocess dialog + signed-URL TTL cache preserved; Bedrock degradation preserved (autofill 404 → toast, boxes untouched).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `SquareDashed` not exported by the installed lucide-react**
- **Found during:** Task 1 (first tsc)
- **Issue:** `import { SquareDashed } from "lucide-react"` failed — TS2305 (no exported member). The UI-SPEC asks for a "square-dashed icon" for UNCLASSIFIED rows, but this lucide-react version only ships `Square` (plus `square-dashed-bottom*` variants, not the plain dashed square).
- **Fix:** Used `Square` with `text-muted-foreground/60` to convey the muted unclassified state. `Square` is explicitly listed in the UI-SPEC §Registry Safety lucide blocks, so this stays within the sanctioned icon set.
- **Files modified:** `layers-tree-row.tsx`
- **Commit:** `e1391d2`

**2. [Rule 3 - Blocking] readonly `Polygon` rejected by the createRegion zod input**
- **Found during:** Task 3 (active-parent draw wiring tsc)
- **Issue:** The dedicated `api.emails.createRegion` mutation's zod input expects a mutable `[number, number][]`, but the draw handler passes a readonly `Polygon` (TS4104).
- **Fix:** Copied the readonly polygon into fresh mutable tuples (`polygon.map(([x, y]) => [x, y] as [number, number])`) at the mutation boundary — the immutable source is preserved (CLAUDE.md immutability honored).
- **Files modified:** `email-detail.tsx`
- **Commit:** `8062fe9`

**3. [Rule 1 - Bug] EntityTypePicker rendered permanently closed in the inspector**
- **Found during:** Task 3 (first inspector pass)
- **Issue:** I initially wired `<EntityTypePicker open={false} onOpenChange={() => undefined} />`, which left the controlled Popover permanently closed (non-functional entity-type selection).
- **Fix:** Added local `entityTypeOpen` state in `inspector-panel.tsx` to control the Popover (`open={entityTypeOpen} onOpenChange={setEntityTypeOpen}` + `aria-expanded`).
- **Files modified:** `inspector-panel.tsx`
- **Commit:** `8062fe9`

## Authentication Gates

None. All writes proxy through the existing 09-04 tRPC procedures (X-API-Key server-side only — T-09-82 verified by grep: no key in the new client components).

## Known Stubs

None blocking the plan's goal. Two intentional, documented gaps for the human-verify pass (Task 4):
1. **Dual toolbars (UX, not a stub):** the CanvasShell toolbar and the PdfPreviewPane's internal toolbar both render. The composition is functional (page/zoom/draw work via the pane; view toggles + tool mode via the shell); collapsing the two requires making PdfPreviewPane fully controlled, deferred to a follow-up to honor the no-break constraint. Documented under Decisions.
2. **isAutoDetected origin signal:** the LAYERS-row + inspector deny paths route through `roleMutations.denyField` and rely on the server's origin-aware outcome (the detail query does not expose `content_raw`/origin). The standalone `confirm-deny-controls.tsx` exposes the `isAutoDetected` prop + Undo toast for callers that know the origin (canvas overlay). No data is fabricated; deny is server-authoritative.

## Threat Surface Scan

No new network endpoints, auth paths, or trust-boundary surfaces beyond the plan's `<threat_model>`. T-09-80 (no `dangerouslySetInnerHTML`), T-09-82 (no client API key), and T-09-SC (no new npm packages) all verified by grep. No threat flags.

## Verification

- `cd apps/web && npx tsc --noEmit` → EXIT 0 (after each task).
- `npm run web:build` (api-client tsc + full next build) → EXIT 0; all 5 routes compiled; `/emails/[id]` renders the new CanvasShell composition (135 kB / 310 kB first load).
- Acceptance greps: `role="tree"` + D-12 visibility + exact empty-state copy in layers-panel; role chips + inline ✓/✗ + 36px treeitem in layers-tree-row; static segmented role-picker + Clear; parent/property Popovers (property disabled until parent) in field-relationship-picker; z-30 floating ✓/✗ + origin-aware deny + 3000ms undo toast in confirm-deny-controls; exact D-10 banner copy + aria-live in active-parent-banner; autofill gated on entity+entityTypeId + Candidate Value `<0.5` destructive in inspector-panel; non-optimistic + 6000ms toast in use-autofill-fields; `<CanvasShell>` composing LayersPanel + InspectorPanel + banner + D-10 field-of-active-parent draw routing in email-detail.
- Security: no `dangerouslySetInnerHTML`, no client `X-API-Key`/`NEXT_PUBLIC*KEY`, no `console.log` in the new files.

## Task 4 — Human Verification (AWAITING, NOT fabricated)

Task 4 is a `checkpoint:human-verify` (blocking) that requires a running browser against a local Postgres with the 09-01 migration applied and `EMAIL_LISTENER_URL` + `EMAIL_LISTENER_API_KEY` set server-side. It cannot be executed by the autonomous executor and has **not** been fabricated. Run `cd apps/web && npm run dev`, then verify the three surfaces:

1. **Inbox (`/`):** glassy three-pane layout; sidebar nav (Inbox + Entity Types active; Entities/Knowledge "Soon"); theme toggle (light/dark); per-email entity chips deep-link to `/emails/{id}`.
2. **Entity Types (`/entity-types`):** create a type; add/edit/reorder fields (field_type limited to string/number/date/array/object); a referenced-field delete offers DEACTIVATE (not hard-delete).
3. **Editor (`/emails/{id}` with a PDF):** draw a box on empty area (draws by default); mark it ENTITY + pick an entity type in the INSPECTOR; with it selected, see the active-parent banner; draw more boxes (become field children); click "Autofill Fields" → candidate field boxes appear with inline ✓/✗; click ✓ ✓ ✗ down the list (auto-detected ✗ removes the box; a user-drawn ✗ keeps the box, clears the value); confirm zoom (Cmd/Ctrl+scroll), Space-drag pan, Fit width/page, and that UNRELATED boxes hide behind the toggle.

**Acceptance:** all three surfaces render and the canvas review loop (select entity → autofill → ✓/✗) works against real data, OR issues are described for gap closure. If Bedrock access is still pending, autofill degrades to the friendly toast ("AI autofill is unavailable — model access is pending.") and boxes stay untouched (expected — verify the toast, not a crash). Resume signal: type "approved" or describe issues per surface.

## Self-Check: PASSED

All 8 created files + the rewired email-detail.tsx exist on disk; all three task commits (`e1391d2`, `65ac814`, `8062fe9`) are present in git history (verified below).
