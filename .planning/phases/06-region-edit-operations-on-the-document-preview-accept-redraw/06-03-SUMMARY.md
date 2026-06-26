---
phase: 06-region-edit-operations-on-the-document-preview-accept-redraw
plan: "03"
subsystem: web-ui
tags: [nextjs, react, trpc, react-query, sonner, pointer-events, tailwind, accessibility]

requires:
  - phase: 06-02
    provides: "clientXYToNormalized + normalizedRectToPolygon geometry helpers and the 7 tRPC component mutations this plan calls"

provides:
  - "useRegionEdit({ emailId }) hook — selection/draw/dialog state plus accept/reject/redraw/split/createRegion handlers with optimistic cache updates, snapshot revert, sonner toasts, and mutatingIds for aria-busy"
  - "ActionToolbar — role=toolbar with Accept/Reject/Redraw/Split/Merge/Nest per 06-UI-SPEC 3.2/6.1; CSS-hidden when nothing selected"
  - "DrawOverlay — pointer-capture rectangle draw surface (cursor-crosshair, min-size 0.01 guard, live dashed preview)"
  - "DrawModeBar — role=status banner with exact 6.2 copy; split confirm enabled at n>=2"
  - "Click/shift-click selection + status-differentiated styling (pending dashed, candidate solid, rejected/superseded muted) on RegionOverlayBox"
  - "showHistory filter on OverlayLayer (rejected/superseded hidden by default) + Show history Switch in the pane toolbar"
  - "+ Add region affordance that works with zero proposed regions (scoped to the resolved attachment_page component)"
  - "Toaster mounted in root layout"

affects:
  - "06-04 (reject-dialog, nest-picker, multi-select checkboxes, merge/nest handlers plug into ActionToolbar's optional onMerge/onNest props and the hook's rejectDialogOpen/nestPickerOpen state)"
  - "Phase 7 (accepted candidate regions are the autofill source)"

tech-stack:
  added: []
  patterns:
    - "Optimistic mutation: onMutate captures getData snapshot -> setData immutable spread -> onError reverts snapshot + toast.error -> onSuccess invalidate + toast.success"
    - "Draw surface uses setPointerCapture/releasePointerCapture so drags finish even when the pointer leaves the overlay"
    - "Interactive children under an inert container: overlay layer keeps pointer-events-none, boxes opt back in with pointer-events-auto"
    - "Draw-mode dimming: overlay wrapper gets opacity-40 + pointer-events-none + aria-hidden while DrawOverlay is mounted"
    - "mutatingIds derived from mutation.isPending + mutation.variables (no extra state) for aria-busy + animate-pulse"

key-files:
  created:
    - apps/web/src/app/emails/[id]/_components/use-region-edit.ts
    - apps/web/src/app/emails/[id]/_components/draw-overlay.tsx
    - apps/web/src/app/emails/[id]/_components/draw-mode-bar.tsx
    - apps/web/src/app/emails/[id]/_components/action-toolbar.tsx
  modified:
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx
    - apps/web/src/app/emails/[id]/_components/overlay-layer.tsx
    - apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx
    - apps/web/src/app/emails/[id]/_components/email-detail.tsx

key-decisions:
  - "Reject button + Delete key call reject() directly (no dialog) per plan instruction — 06-04 swaps in the AlertDialog confirmation"
  - "Merge/Nest buttons render per spec but stay disabled until 06-04 injects onMerge/onNest handlers (flows + mutations land there)"
  - "+ Add region lives in the PDF pane toolbar (Task 3 file set); EntitiesList header affordance deferred with the rest of 06-04 list work"
  - "bg-primary/[0.08] arbitrary value used for the pending fill — Tailwind v3.4 opacity modifiers only support steps of 5, so /8 from the pattern map would not generate"
  - "[Rule 1 - Bug] Added pointer-events-auto to RegionOverlayBox — children inherit the container's pointer-events-none, so clicks would never have reached the boxes"
  - "[Rule 2 - Missing critical] Exposed mutatingIds from useRegionEdit — required to satisfy the spec 7 aria-busy contract on in-flight mutations"
  - "[Rule 3 - Blocking] Rebuilt packages/api-client dist — package.json points types at dist/index.d.ts, which was stale and missing the 06-02 mutations, breaking apps/web tsc"

patterns-established:
  - "Region-edit state machine owned by one hook (useRegionEdit); components stay presentational and receive handlers via props"
  - "Draw routing in the parent: onRectDrawn switches on drawMode (redraw -> mutation, split -> accumulate, add -> createRegion with resolved page component)"

requirements-completed: []

duration: 25min
completed: 2026-06-12
---

# Phase 06 Plan 03: Region Selection Toolbar + Draw Mode Summary

**Click-to-select regions with a six-action floating toolbar, pointer-drawn redraw/split/add-region via DrawOverlay, and optimistic accept/reject tRPC mutations with snapshot revert and sonner toasts — all state owned by a new useRegionEdit hook.**

## What Was Built

- **Task 1 — useRegionEdit hook + Toaster (569e8e0):** `use-region-edit.ts` owns selection (`selectedComponentIds`), draw mode (`drawMode`/`drawnRects`/`liveRect`), UI toggles (`showHistory`, dialog flags), and five mutation handlers. Accept and reject apply optimistic `utils.emails.detail.setData` updates with a captured snapshot reverted on error; redraw/split/createRegion invalidate on success. All toast copy matches 06-UI-SPEC 3.8 verbatim. `layout.tsx` mounts `<Toaster />` from `@nauta/ui/sonner`.
- **Task 2 — Draw surface + selection styling (0cdfebd):** `DrawOverlay` captures pointer events (setPointerCapture), converts client coords via `clientXYToNormalized` from `@nauta/api-client/geometry` (subpath import only), enforces the 0.01 minimum size, and emits `normalizedRectToPolygon` output. `DrawModeBar` renders the exact 6.2 headings/instructions with split confirm at n>=2. `RegionOverlayBox` gains click/shift-click selection, status classes (pending dashed, candidate solid, rejected/superseded muted + opacity-40), selected ring, and aria-pressed/selected/busy. `OverlayLayer` filters rejected/superseded unless `showHistory` and threads selection + mutating state.
- **Task 3 — Toolbar + end-to-end wiring (4dfcb62):** `ActionToolbar` (role=toolbar, aria-controls=region-overlay-layer) with the six 6.1 buttons, status-based enablement, tooltips, and context label. `PdfPreviewPane` mounts the toolbar (CSS-hidden when nothing selected), DrawModeBar + DrawOverlay during draw mode (overlay boxes dimmed + inert), the Show history switch, the + Add region button, and Esc/Delete/A keyboard shortcuts. `EmailDetail` instantiates the hook, resolves the `attachment_page` component for the current page, and routes finished draws to redraw/split-accumulate/createRegion.

## Verification

- `npx tsc --noEmit` in apps/web — exit 0 after each task.
- `npm run build` in apps/web — production build green (no client-side env requirement).
- All plan acceptance greps pass (role="toolbar", three aria-labels, clientXYToNormalized/normalizedRectToPolygon, no pointer-events-none in draw-overlay.tsx, showHistory, "Draw Mode: Redraw", selectedComponentIds, >=5 api.emails.* refs, sonner import, Toaster in layout).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale @nauta/api-client dist types**
- **Found during:** Task 1 verification
- **Issue:** `package.json` exports `types: ./dist/index.d.ts`; dist predated 06-02's mutations, so `api.emails.accept` etc. did not exist on the router type in apps/web.
- **Fix:** `npx tsc` rebuild in packages/api-client (dist is gitignored; no commit needed).
- **Files modified:** packages/api-client/dist/* (generated)
- **Commit:** n/a (build artifact)

**2. [Rule 1 - Bug] Overlay boxes unreachable by pointer**
- **Found during:** Task 2
- **Issue:** `OverlayLayer`'s root is `pointer-events-none`, inherited by children — click-to-select could never fire.
- **Fix:** Added `pointer-events-auto` to the `RegionOverlayBox` root so boxes are interactive targets while the container background stays click-through.
- **Files modified:** region-overlay-box.tsx
- **Commit:** 0cdfebd

**3. [Rule 2 - Missing critical] mutatingIds for aria-busy**
- **Found during:** Task 3
- **Issue:** Spec 7 requires `aria-busy="true"` on boxes during in-flight mutations; the hook exposed no way to know which ids were mutating.
- **Fix:** Derived `mutatingIds` from `mutation.isPending + mutation.variables` (accept/reject/redraw/split) and threaded it through OverlayLayer to the boxes.
- **Files modified:** use-region-edit.ts, pdf-preview-pane.tsx
- **Commit:** 4dfcb62

**4. [Rule 1 - Bug] Tailwind v3.4 cannot generate bg-primary/8**
- **Found during:** Task 2
- **Issue:** 06-PATTERNS specified `bg-primary/8`; v3.4 opacity modifiers only support steps of 5.
- **Fix:** Used the arbitrary-value form `bg-primary/[0.08]` to honor the spec's 8% fill.
- **Files modified:** region-overlay-box.tsx
- **Commit:** 0cdfebd

## Known Stubs

| Stub | File | Reason | Resolved by |
|------|------|--------|-------------|
| Merge/Nest buttons disabled (no handlers injected) | action-toolbar.tsx / pdf-preview-pane.tsx | Merge + nest mutation flows, multi-select checkboxes, and the nest picker are 06-04 scope; buttons render per spec 3.2 with optional handler props | 06-04 |
| Reject fires directly without confirmation dialog | use-region-edit.ts / pdf-preview-pane.tsx | Plan instruction: call reject() directly until 06-04 swaps in the AlertDialog | 06-04 |
| rejectDialogOpen / nestPickerOpen state unused | use-region-edit.ts | State pre-provisioned for 06-04's dialog + popover | 06-04 |

## Threat Flags

None — no new network endpoints, auth paths, or schema surface. All writes go through the 06-02 server-side tRPC mutations; pointer-derived polygons are clamped client-side and re-validated by zod (06-02) + Pydantic (06-01).

## Self-Check: PASSED

All 5 key files exist on disk; commits 569e8e0, 0cdfebd, 4dfcb62 present in git log.
