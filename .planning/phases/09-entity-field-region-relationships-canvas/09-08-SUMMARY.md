---
phase: 09-entity-field-region-relationships-canvas
plan: 08
subsystem: canvas-editor-structural-layer
tags: [nextjs, react, trpc, optimistic-update, sonner, react-pdf, zoom-pan, role-color, active-parent, d-06, d-07, d-08, d-09, d-10, d-12]
dependency_graph:
  requires:
    - "09-04: emails.setRole/setEntityType/setFieldRelationship/autofillFields/denyField/confirmField tRPC mutations + emails.detail role/entityTypeId/entityTypeFieldId per component — use-role-mutations consumes them"
    - "Phase 6: useRegionEdit redraw mutation (supersede-never-mutate) — use-canvas-state REUSES it for move/resize (D-09, no new geometry write); createRegion for draws"
    - "Phase 5/6: region-overlay-box / overlay-layer / pdf-preview-pane / draw-overlay primitives (extended additively here)"
    - "@nauta/ui: button, separator, switch, tooltip (canvas-toolbar); resizable/sidebar reserved for 09-09 page wiring"
  provides:
    - "region-overlay-box: role-color rendering (entity=violet, field=amber, unrelated=slate, unclassified=primary) + isActiveParent ring-4 ring-violet-400/40 + inline ✓/✗ showConfirmDeny slot (z-30) — all additive/back-compat"
    - "overlay-layer: roleFilter + activeParentId + showUnrelated + confirmDeny props with the D-12 anti-bloat visibility rule (entity/unclassified always; field only when parent===activeParentId; unrelated hidden unless toggled)"
    - "pdf-preview-pane: zoom 0.25–4.0 (was 0.5–3.0) + zoom-to-cursor (Cmd/Ctrl+scroll) + Space-drag pan + Fit width/Fit page + zoom keybindings; existing props/page-sync intact"
    - "canvas-toolbar.tsx (NEW): Select/Draw tool group + nav + zoom group + Regions/History/Unrelated toggles + close, with V/S/D + zoom keybindings"
    - "canvas-shell.tsx (NEW): the four-zone editor frame (h-11 toolbar / w-64 LAYERS / flex-1 CANVAS / w-72 INSPECTOR) composing the toolbar; LAYERS/INSPECTOR/canvas/banner as slots"
    - "use-canvas-state.ts (NEW): tool-mode + selection + active-parent state machine; onBoxGeometryChange routes to redraw (D-09); immutable as const"
    - "use-role-mutations.ts (NEW): optimistic role/entity-type/field-relationship/confirm/deny + non-optimistic autofillFields phase machine; mutatingComponentIds"
  affects:
    - "09-09 (next wave): composes these into a working editor — LayersPanel/InspectorPanel/role-picker/field-relationship-picker plug into the shell slots; the page rewires email-detail onto canvas-shell + use-canvas-state + use-role-mutations"
tech_stack:
  added: []
  patterns:
    - "Additive prop extension keeps Phase-5/6 callers compiling: region-overlay-box/overlay-layer gained optional role/isActiveParent/showConfirmDeny/roleFilter/activeParentId props with safe defaults; the existing email-detail.tsx → pdf-preview-pane → overlay-layer chain passes none of them and renders identically (no-role boxes keep the primary statusClasses)"
    - "Role-color palette as 4 const Record maps (ROLE_BORDER/HOVER/SELECTED_RING/CHIP) keyed by NonNullable<ComponentRole>; roleClass replaces statusClasses only when a role is set AND the box is non-terminal (rejected/superseded keep the muted ghost)"
    - "D-12 visibility encapsulated in a pure isRoleVisible(component, roleFilter, activeParentId, showUnrelated) helper layered AFTER the Phase-6 region/page/history filters; history view bypasses role-hiding so nothing is lost"
    - "Zoom-to-cursor: capture pointer content-position pre-zoom, apply scale via setScale updater, re-anchor scrollLeft/Top by factor inside requestAnimationFrame (after the re-layout); Space-drag pan via pointer capture on the scroll viewport with cursor-grab/grabbing"
    - "use-role-mutations mirrors use-region-edit verbatim: per-mutation onMutate cancel + snapshot(getData) + setData map-over-components with a LITERAL patch (extractionStatus: 'confirmed' as const) so the inferred tRPC union type is preserved; onError revert + sonner toast; onSuccess invalidate"
    - "autofillFields is the ONLY non-optimistic mutation (it inserts candidate field children server-side): a Record<entityId, phase> machine (idle/extracting/reviewing/failed) + invalidate-on-success to pick up the new rows + the exact 6000ms 'AI autofill is unavailable — model access is pending.' failure toast"
    - "D-09 move/resize REUSES the existing Phase-6 redraw: use-canvas-state.onBoxGeometryChange normalizes the rect → edit.redraw(componentId, polygon, pageIndex); NO new geometry mutation authored (grep: only edit.redraw / edit.createRegion calls in the hook)"
    - "canvas-shell is structural: it owns no PDF state and renders CanvasToolbar wired to use-canvas-state + lifted toolbar props; the LAYERS/INSPECTOR panels and full react-pdf page wiring are deferred to 09-09 (slots are ReactNode props), honoring the split-canvas budget"
key_files:
  created:
    - "apps/web/src/app/emails/[id]/_components/canvas-toolbar.tsx"
    - "apps/web/src/app/emails/[id]/_components/canvas-shell.tsx"
    - "apps/web/src/app/emails/[id]/_components/use-canvas-state.ts"
    - "apps/web/src/app/emails/[id]/_components/use-role-mutations.ts"
  modified:
    - "apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx"
    - "apps/web/src/app/emails/[id]/_components/overlay-layer.tsx"
    - "apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx"
decisions:
  - "Back-compat strategy = OPTIONAL new props with safe defaults (role?, isActiveParent?, showConfirmDeny?, roleFilter?, activeParentId?, showUnrelated?). The existing email-detail.tsx → PdfPreviewPane → OverlayLayer caller passes none of them, so Phase 6/7 boxes keep the primary statusClasses and the whole app still typechecks + builds. This is the 09-08 'structural layer'; the rewire onto canvas-shell is 09-09 (critical-no-break constraint honored)."
  - "ComponentRole exported as a type from region-overlay-box ('entity'|'field'|'unrelated'|null) and reused by overlay-layer + the hooks — single source of truth for the role union; null = unclassified, matching D-01 (no enum value for unclassified)."
  - "Role-color override only applies when role !== null AND status is not rejected/superseded — terminal boxes always keep the muted ghost (history view). Selected ring is role-tinted (violet/amber/slate) when classified, primary otherwise; active-parent adds the outer ring-4 ring-violet-400/40 (D-10)."
  - "D-12 field visibility = reveal-on-select: a field box renders only when activeParentId != null && parentComponentId === activeParentId. An explicit roleFilter (when set) overrides the default rule to show ONLY that role. Unrelated hidden unless showUnrelated (toolbar toggle defaults off, D-05)."
  - "Zoom expanded to 0.25–4.0 (ZOOM_MIN/MAX/STEP consts); the inline pdf-preview-pane toolbar gained a clickable {N}% reset + Fit width/Fit page buttons while the standalone canvas-toolbar exposes the same controls for the 09-09 shell. Both share the same handler semantics."
  - "use-role-mutations patches the emails.detail cache with LITERAL string statuses ('confirmed'/'rejected' as const) rather than a generic Partial patch — a generic patch widened extractionStatus/role to string and broke the inferred tRPC union; the literal-in-map idiom (exactly use-region-edit's) keeps tsc 0."
  - "denyField is optimistically marked 'rejected' then reconciled by invalidate — the server is origin-aware (D-18: auto-detected soft-reject vs user-drawn clear-value), so the optimistic guess is corrected by the post-success refetch rather than the client trying to predict the origin."
  - "canvas-shell + the two hooks are intentionally UNWIRED (no page consumes them yet) — expected per the plan: 09-08 ships the structural layer that compiles; 09-09 composes the panels + page wiring. Verified by npm run web:build EXIT 0 with /emails/[id] still rendering the existing PdfPreviewPane."
metrics:
  duration: "~30m"
  completed: "2026-06-13"
  tasks: 3
  files: 7
---

# Phase 9 Plan 08: Entity/Field Region-Relationship Canvas — Structural Layer Summary

Built the canvas editor's structural layer (D-06..D-10, D-12): extended the Phase-5/6 overlay primitives with role-color rendering + active-parent ring + an inline ✓/✗ confirm/deny slot and the D-12 anti-bloat role-filtering, expanded the PDF zoom to 0.25–4.0 with zoom-to-cursor / Space-pan / fit, and added the new four-zone `canvas-shell` + `canvas-toolbar` plus the two hooks (`use-canvas-state` for tool/selection/active-parent + redraw-based move/resize, `use-role-mutations` for optimistic role/relationship/confirm/deny + non-optimistic autofillFields) — all additive and back-compatible so the existing `/emails/[id]` editor still typechecks and builds.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Role-color region-overlay-box + role-filtering overlay-layer (D-10/D-12 + Color palette) | `21eb350` | region-overlay-box.tsx, overlay-layer.tsx |
| 2 | canvas-toolbar + pdf-preview-pane zoom expansion (D-07/D-08) | `1f55670` | pdf-preview-pane.tsx, canvas-toolbar.tsx |
| 3 | use-canvas-state + use-role-mutations + canvas-shell (D-06/D-08/D-09/D-10) | `3430a1d` | use-canvas-state.ts, use-role-mutations.ts, canvas-shell.tsx |

## What Was Built

### Task 1 — Role-color overlay + D-12 filtering (back-compat)
- `region-overlay-box.tsx`: added `ComponentRole` type + optional `role`, `isActiveParent`, `showConfirmDeny`, `onConfirm`, `onDeny` props. Four palette maps (`ROLE_BORDER`/`ROLE_HOVER`/`ROLE_SELECTED_RING`/`ROLE_CHIP`). When `role` is set and the box is not rejected/superseded, the role border/fill replaces `statusClasses` (`roleClass ?? statusClasses`); selected adds a role-tinted ring; `isActiveParent` adds `ring-4 ring-violet-400/40`; the label chip is tinted per role. The inline ✓/✗ slot renders at `absolute -top-3 right-0 z-30 pointer-events-auto` only when `showConfirmDeny`, wired to `onConfirm`/`onDeny`. No-role boxes are byte-for-byte the Phase 6/7 behavior.
- `overlay-layer.tsx`: added `roleFilter`, `activeParentId`, `showUnrelated`, `confirmDenyComponentIds`, `onConfirmField`, `onDenyField` props (+ optional `role`/`parentComponentId` on the component shape). A pure `isRoleVisible(...)` helper layers the D-12 rule after the Phase-6 filters: entity/unclassified always show, a field shows only when `parentComponentId === activeParentId`, unrelated hides unless `showUnrelated`; an explicit `roleFilter` shows only that role. Passes `isActiveParent` + `showConfirmDeny` through to each box.

### Task 2 — Zoom expansion + canvas-toolbar (D-07/D-08)
- `pdf-preview-pane.tsx`: `ZOOM_MIN/MAX/STEP` = 0.25/4.0/0.25 (was 0.5–3.0); `clampScale`; a `{N}%` reset button + Fit width / Fit page (computed from `scrollRef.clientWidth/Height − 32` over the unscaled page size). Cmd/Ctrl+scroll zoom-to-cursor re-anchors the viewport scroll by the zoom factor inside `requestAnimationFrame`. Space-held arms pan; pointer-down captures and scrolls the viewport (`cursor-grab`/`cursor-grabbing`). Zoom keybindings (Cmd/Ctrl +/-/0, Cmd/Ctrl+Shift+W/F) added to the existing key handler. All existing props + the display:none overlay-sync (05-04) are intact.
- `canvas-toolbar.tsx` (NEW): `role="toolbar"`, `h-11 ... bg-background shrink-0`. Tool-mode group (Select `MousePointer2` / Draw `Pencil`, armed = `bg-primary/10 text-primary border border-primary/30`, `aria-pressed` + `aria-keyshortcuts` "v s"/"d", V/S/D window keybinding that skips form fields), nav group (`aria-live="polite"` page indicator), zoom group (out/reset/in/Fit width/Fit page), Regions/History/Unrelated switches (Unrelated default off, D-12), ghost `X` close.

### Task 3 — Hooks + shell (D-06/D-08/D-09/D-10)
- `use-canvas-state.ts` (NEW): owns `mode` (`select`/`draw`), `selectedIds` (single + shift-toggle), `activeParentId` (+ set/clear). `onDrawComplete(rect, pageIndex)` → `createRegion` via an injected `resolvePageComponentId`. `onBoxGeometryChange(componentId, rect, pageIndex)` normalizes and routes to the EXISTING Phase-6 `edit.redraw` (D-09 supersede — no new geometry mutation). Returns `as const`.
- `use-role-mutations.ts` (NEW): `setRole`/`setEntityType`/`setFieldRelationship`/`confirmField`/`denyField` are optimistic (snapshot `emails.detail`, patch the component with a literal, revert + 6000ms toast on error, invalidate on success). `autofillFields` is non-optimistic with a `Record<entityId, phase>` machine and the exact 6000ms failure toast. Exposes `mutatingComponentIds`.
- `canvas-shell.tsx` (NEW): four-zone frame — `flex flex-col h-full` → `<CanvasToolbar/>` (h-11) → `flex flex-1 min-h-0 overflow-hidden` with `w-64` LAYERS / `flex-1 min-w-0 ... bg-muted/40` CANVAS (+ banner slot) / `w-72` INSPECTOR. LAYERS/INSPECTOR/canvas/banner are `ReactNode` slots (panels land in 09-09).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Optimistic cache patch widened inferred tRPC union types**
- **Found during:** Task 3 (use-role-mutations first tsc)
- **Issue:** A generic `patchComponent(componentId, patch: Partial<...>)` helper spread `{ ...c, ...patch }`, which widened `extractionStatus` to `string` and `role` to the local union — `setData` then rejected the updater against the inferred `emails.detail` query type (`extractionStatus: "candidate" | ... | "error"`).
- **Fix:** Replaced the generic helper with the exact `use-region-edit` idiom — each mutation inlines its own `setData` map with a literal patch (`extractionStatus: "confirmed" as const`), preserving the inferred union. `snapshot()`/`revert()` typed via `ReturnType<...detail.getData>`.
- **Files modified:** `apps/web/src/app/emails/[id]/_components/use-role-mutations.ts`
- **Commit:** `3430a1d`

No other deviations — the plan executed as written. The 09-04 mutations and `emails.detail` role/entityTypeId/entityTypeFieldId fields were already in place (confirmed before coding), so no backend or data-layer changes were needed.

## Authentication Gates

None. All mutations proxy through the existing 09-04 tRPC procedures (X-API-Key server-side only); no client auth involved.

## Known Stubs

None that block the plan's goal. `canvas-shell.tsx`, `use-canvas-state.ts`, and `use-role-mutations.ts` are intentionally **unwired** (no page consumes them yet) — this is the explicit 09-08/09-09 split per the plan's critical-no-break constraint: 09-08 ships the structural layer that compiles; 09-09 composes the LAYERS/INSPECTOR panels + pickers + active-parent banner and rewires the page onto the shell. The LAYERS/INSPECTOR slots are empty `ReactNode` props by design. Verified non-blocking: `npm run web:build` EXIT 0 with the existing `/emails/[id]` editor still rendering the current `PdfPreviewPane`.

## Verification

- `cd apps/web && npx tsc --noEmit` → EXIT 0 (after each task)
- `npm run web:build` (api-client tsc + full next build) → EXIT 0; all 6 routes compiled, `/emails/[id]` still builds (141 kB), `/` + `/entity-types` unchanged.
- Acceptance greps confirmed per task: role palette + active-parent ring + confirm/deny slot in region-overlay-box; roleFilter/activeParentId/parentComponentId + D-12 field rule in overlay-layer; 0.25/4.0 + Fit + cursor-grab in pdf-preview-pane; armed class + aria-pressed/keyshortcuts + aria-live + Unrelated/Regions/History in canvas-toolbar; mode/selectedIds/activeParentId/onBoxGeometryChange(redraw)/as const in use-canvas-state; setRole/.../autofillFields + exact 6000ms toast + mutatingComponentIds in use-role-mutations; w-64/flex-1 min-w-0/w-72/h-11 in canvas-shell.
- No new geometry mutation (D-09): use-canvas-state calls only `edit.redraw` / `edit.createRegion`.

## Self-Check: PASSED

All created files exist on disk (canvas-toolbar.tsx, canvas-shell.tsx, use-canvas-state.ts, use-role-mutations.ts, 09-08-SUMMARY.md) and all three task commits (21eb350, 1f55670, 3430a1d) are present in git history.
