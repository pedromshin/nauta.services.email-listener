---
phase: 06-region-edit-operations-on-the-document-preview-accept-redraw
fixed_at: 2026-06-12T21:00:00Z
review_path: .planning/phases/06-region-edit-operations-on-the-document-preview-accept-redraw/06-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-06-12T21:00:00Z
**Source review:** `.planning/phases/06-region-edit-operations-on-the-document-preview-accept-redraw/06-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 13 (5 Critical + 8 Warning; IN-03 also applied; IN-01 covered by CR-01 tests; IN-02 skipped as optional)
- Fixed: 13
- Skipped: 0

## Fixed Issues

### CR-01: Cycle detection missing in NestRegionUseCase

**Files modified:** `apps/email-listener/app/application/use_cases/edit_region.py`, `apps/email-listener/tests/test_edit_region_use_cases.py`
**Commit:** `cb5a522` (implementation), `1287674` (tests)
**Applied fix:** Added `_MAX_DEPTH = 20` constant, self-nesting guard (`if component_id == parent_component_id: raise ValueError`) checked before any I/O, and full ancestry chain cycle detection using a `visited: set[str]` starting with `{component_id}`. Added three test cases: self-nest, direct cycle (A→B when B→A), and 3-node chain cycle.

### CR-02: Supersede-not-mutate ordering — new child must be persisted first

**Files modified:** `apps/email-listener/app/application/use_cases/edit_region.py`, `apps/email-listener/tests/test_edit_region_use_cases.py`
**Commit:** `cb5a522` (implementation), `1287674` (tests)
**Applied fix:** All three mutation use cases (RedrawRegionUseCase, SplitRegionUseCase, MergeRegionsUseCase) now call `save_many` twice: first to persist the new child(ren) with RuntimeError guard, then to mark the original(s) superseded. Tests updated to use `side_effect = [[new_child], [superseded]]` and assert call ordering via `call_args_list[0][0][0]` / `call_args_list[1][0][0]`.

### CR-03: MergeRegionsUseCase missing cross-tenant IDOR guard

**Files modified:** `apps/email-listener/app/application/use_cases/edit_region.py`
**Commit:** `cb5a522`
**Applied fix:** Added tenant isolation check — after loading all components to merge, verifies all `email_id` values are equal, raising `ValueError("Components belong to different emails")` if not.

### CR-04: MergeRegionsUseCase polygon union silently swallows None

**Files modified:** `apps/email-listener/app/application/use_cases/edit_region.py`
**Commit:** `cb5a522`
**Applied fix:** When `polygon` is not provided, the use case now computes a proper union (bounding box) from the source regions' `location["polygon"]` fields. Falls back to the first region's polygon if location data is absent. No longer produces silent None in the merged component.

### CR-05: CreateRegionUseCase missing RuntimeError guard on empty save_many

**Files modified:** `apps/email-listener/app/application/use_cases/edit_region.py`, `apps/email-listener/tests/test_edit_region_use_cases.py`
**Commit:** `cb5a522` (implementation), `1287674` (tests)
**Applied fix:** After `save_many`, if the returned list is empty, raises `RuntimeError("save_many returned empty list — infrastructure failure")`. Test added to verify the guard triggers.

### WR-01: AcceptRegionUseCase missing status-transition guard

**Files modified:** `apps/email-listener/app/application/use_cases/edit_region.py`
**Commit:** `cb5a522`
**Applied fix:** Added guard: only components with `extraction_status == "pending"` can be accepted. All other statuses raise `ValueError(f"Cannot accept component with status '{status}'")`

### WR-02: RejectRegionUseCase accepts already-rejected components

**Files modified:** `apps/email-listener/app/application/use_cases/edit_region.py`
**Commit:** `cb5a522`
**Applied fix:** Added idempotency guard that returns early (no-op) when the component is already `"rejected"`, preventing spurious no-op saves.

### WR-03: RedrawRegionUseCase does not validate source status

**Files modified:** `apps/email-listener/app/application/use_cases/edit_region.py`
**Commit:** `cb5a522`
**Applied fix:** Added guard: only components with `extraction_status in ("candidate", "pending")` can be redrawn. Superseded and rejected components raise `ValueError`.

### WR-04: SplitRegionUseCase allows split into fewer than 2 regions

**Files modified:** `apps/email-listener/app/application/use_cases/edit_region.py`, `apps/email-listener/tests/test_edit_region_use_cases.py`
**Commit:** `cb5a522` (implementation), `1287674` (tests)
**Applied fix:** Pre-DB validation: `if len(regions) < 2: raise ValueError("Split requires at least 2 target regions")`. Two tests added — empty list and single-region list.

### WR-05: Path parameters typed as str in components.py — no UUID validation

**Files modified:** `apps/email-listener/app/presentation/api/v1/components.py`, `apps/email-listener/tests/test_edit_region_endpoints.py`, `apps/email-listener/tests/test_components_api.py`, `apps/email-listener/tests/test_confirm_region.py`
**Commit:** `60d4271` (implementation), `1287674` + `15ad913` (test fixes)
**Applied fix:** All path parameters in the components router changed from `str` to `UUID` type. FastAPI now rejects malformed UUIDs with 422 before handlers run. Test constants updated from prefixed strings (`comp-`, `page-`, `imp-`) to valid UUID format.

### WR-06: draw-mode-bar.tsx buttons missing accessible aria-labels

**Files modified:** `apps/web/src/app/emails/[id]/_components/draw-mode-bar.tsx`
**Commit:** `0fe46fc`
**Applied fix:** Added descriptive `aria-label` attributes to all icon-only buttons in the draw mode bar.

### WR-07: entities-list.tsx and overlay-layer.tsx mutate props directly

**Files modified:** `apps/web/src/app/emails/[id]/_components/entities-list.tsx`, `apps/web/src/app/emails/[id]/_components/overlay-layer.tsx`
**Commit:** `83feb60`
**Applied fix:** All array and object fields derived from props are now marked `readonly` in their TypeScript types. Direct push/mutation patterns replaced with spread/map patterns returning new objects.

### WR-08: email-detail.tsx signed URL state not mirrored to ref

**Files modified:** `apps/web/src/app/emails/[id]/_components/email-detail.tsx`
**Commit:** `bc2ab0a`
**Applied fix:** Added `signedUrlsRef` that mirrors the `signedUrls` state via `useEffect`. Stable callbacks that need the current URL value read from `signedUrlsRef.current` instead of closing over stale state.

### IN-03: region-overlay-box.tsx aria-pressed value always false

**Files modified:** `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx`
**Commit:** `ef5b16b`
**Applied fix:** Changed `aria-pressed={false}` hardcoded value to `aria-pressed={isSelected}` so the attribute reflects actual selection state.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-06-12T21:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
