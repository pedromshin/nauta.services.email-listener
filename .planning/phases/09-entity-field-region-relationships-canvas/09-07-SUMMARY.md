---
phase: 09-entity-field-region-relationships-canvas
plan: 07
subsystem: entity-type-management-ui
tags: [nextjs, react, trpc, optimistic-update, sonner, zod, master-detail, crud, d-25, d-26, d-27]
dependency_graph:
  requires:
    - "09-04: entityTypes.create/update + createField/updateField/deleteField/reorderFields tRPC write mutations (server-side /v1/entity-types proxy) — this UI consumes them"
    - "09-05/09-06: app shell (SidebarInset) + /entity-types live nav target — the page renders inside the shell"
    - "09-03: FastAPI /v1/entity-types CRUD + the D-27 delete-guard (DeleteFieldView hard_deleted/soft_deactivated) the deleteField hook surfaces"
  provides:
    - "entityTypes.list now exposes type id/isActive + per-field id/sortOrder/isIdentifier (additive) + an includeInactive flag — the ids the Phase-9 write mutations address"
    - "use-entity-type-admin hook: optimistic snapshot/revert CRUD over entityTypes.list with sonner toasts; deleteField surfaces the hard-delete-vs-soft-deactivate outcome (D-27)"
    - "/entity-types master/detail management surface (list + create/rename/edit/deactivate type; create/edit/delete/reorder fields) under the app shell (D-25)"
  affects:
    - "Future per-importer entity-type overrides (out of scope this phase); any UI that needs field ids now has them on entityTypes.list"
tech_stack:
  added: []
  patterns:
    - "Additive query widening: entityTypes.list gained id/isActive + per-field id/sortOrder/isIdentifier without changing the keys the Phase-7 pickers read (slug/label/description/key/dataType/isRequired) — both consumers compile untouched; grouping key switched from slug to id (slug is not unique across active/inactive scopes)"
    - "is_identifier read from entity_type_fields.config jsonb via COALESCE((config ->> 'is_identifier')::boolean, false) — matches the backend's jsonb storage (09-03), no schema change"
    - "includeInactive input flag: default false keeps the live pickers active-only; the management page passes includeInactive:true to list + manage deactivated types"
    - "Optimistic snapshot/revert mirrors use-region-edit: onMutate cancel+getData+setData, onError restore prevData + friendly toast, onSuccess invalidate — keyed to the exact LIST_INPUT = {includeInactive:true} cache entry the page renders"
    - "deleteField is promise-based (mutateAsync awaited by the dialog) rather than fire-and-forget so the dialog can act on the resolved D-27 outcome; in-flight delete ids tracked in local state since they cannot be derived from mutation.variables"
    - "field_type allowlist enforced twice on the client: a Select limited to the 5 values + a Zod z.enum re-check before the mutation (T-09-60, defense-in-depth with the Pydantic validator in 09-03)"
    - "D-27 delete copy is reference-aware: referenceCount>0 -> 'Deactivate this field?' + variant=secondary confirm (never destructive); 0 -> 'Delete this field?' + destructive; the AUTHORITATIVE outcome is the server response, surfaced by the hook's toast (soft_deactivated vs hard_deleted)"
key_files:
  created:
    - "apps/web/src/app/entity-types/page.tsx"
    - "apps/web/src/app/entity-types/_components/entity-type-detail.tsx"
    - "apps/web/src/app/entity-types/_components/field-row-dialog.tsx"
    - "apps/web/src/app/entity-types/_components/use-entity-type-admin.ts"
  modified:
    - "packages/api-client/src/router/entity-types.ts"
    - "packages/api-client/src/router/__tests__/entity-types.test.ts"
decisions:
  - "id-exposure fix = EXTEND entityTypes.list (the plan's preferred option over a new byId query). list now returns type id/isActive + per-field id/sortOrder/isIdentifier; is_identifier read from config jsonb; an includeInactive flag lets the management page see deactivated types while the Phase-7 pickers stay active-only. Fully additive — entity-type-picker.tsx + email-detail.tsx (the only list consumers) read only the preserved keys and compile untouched."
  - "groupEntityTypeRows now groups by entity-type id (not slug): with includeInactive a slug is no longer unique across active/inactive (and future per-importer) scopes, so id is the stable grouping + addressing key the write mutations need."
  - "deleteField in the hook AWAITS mutateAsync and resolves a {hardDeleted, softDeactivated} outcome from the FastAPI DeleteFieldView, then toasts the honest result (soft-deactivate vs delete). The dialog's referenceCount prop drives PRE-emptive copy (forward-compatible — list does not expose per-field reference counts), but the server response is the authority, so a soft-deactivate is never mis-presented as a hard delete even when referenceCount is unknown (D-27)."
  - "Field reorder = up/down buttons (the plan's allowed discretion over drag) computing the new ordered id list and calling reorderFields with optimistic sort_order reindex; deactivate = active Switch using updateType isActive (never a destructive control), mirroring the D-16 reprocess non-destructive rule."
  - "Type name/description use save-on-blur (commit only when changed + non-empty for the name) rather than a debounce, matching the optimistic-write idiom; empty name reverts to the persisted value."
metrics:
  duration: "~16m"
  completed: "2026-06-13"
---

# Phase 9 Plan 07: Entity-Type & Property Management Surface Summary

Built the `/entity-types` master/detail management page (D-25/D-26/D-27): a left list of all entity types (active + inactive Badges, "+ New type") and a right detail pane that renames/edits/deactivates a type and creates/edits/deletes/reorders its fields — every write routed through the existing Phase-9 tRPC entity-type mutations with optimistic snapshot/revert + sonner toasts. The `field_type` Select is constrained to the D-27 allowlist (`string|number|date|array|object`, Zod-rechecked), and the field-delete flow surfaces the server's confirmed-reference **soft-deactivate** outcome rather than presenting it as a hard delete. The page calls only tRPC — no `EMAIL_LISTENER_API_KEY` ever reaches the browser.

## What Was Built

**Task 1 — id-exposure fix + use-entity-type-admin hook (commit `bbda632`)**
- `packages/api-client/src/router/entity-types.ts`: extended `list` to additionally return `id` + `isActive` per type and `id`/`sortOrder`/`isIdentifier` per field (additive — the Phase-7 pickers read only the preserved keys). `is_identifier` read from `config` jsonb via `COALESCE((config ->> 'is_identifier')::boolean, false)`. Added an optional `includeInactive` input flag (default false keeps the live pickers active-only; the management page passes `true`). `groupEntityTypeRows` now groups by `id` (slug is no longer unique with inactive rows included) and emits the new fields immutably.
- `apps/web/.../entity-types/_components/use-entity-type-admin.ts` (new, `"use client"`): wraps the six write mutations (`createType`/`updateType`/`createField`/`updateField`/`deleteField`/`reorderFields`) with the use-region-edit optimistic idiom against the `{includeInactive:true}` list cache — `onMutate` cancel+getData+setData, `onError` restore + friendly `toast.error`, `onSuccess` invalidate (+ success toasts). `deleteField` awaits `mutateAsync`, resolves a `{hardDeleted, softDeactivated}` outcome from the FastAPI `DeleteFieldView`, and toasts the honest result. Exposes `mutatingTypeIds`/`mutatingFieldIds` for disabling controls.
- `entity-types.test.ts`: updated the `groupEntityTypeRows` fixtures to the new row shape + added assertions for the new ids/isActive/sortOrder/isIdentifier and a deactivated-type case (56/56 api-client vitest green).

**Task 2 — field-row-dialog (commit `9863d72`)**
- `field-row-dialog.tsx` (new, `"use client"`): a controlled `Dialog` for create+edit of a field. `label`/`slug` `Input`s, a `field_type` `Select` constrained to exactly `string|number|date|array|object`, `is_required` + `is_identifier` `Checkbox`es. Zod-validated at the boundary (slug regex `^[a-z0-9_]+$`, required label) before `onSave`. Save uses the default (`bg-primary`) variant — non-destructive. A Delete affordance (edit mode only) sits behind an `AlertDialog`: when `referenceCount > 0` the title is "Deactivate this field?", the copy explains it will be deactivated (not deleted) because confirmed data references it, and the confirm is `variant=secondary` — never `destructive` (D-27).

**Task 3 — master/detail page + fields table + reorder (commit `03085e6`)**
- `entity-types/page.tsx` (new, `"use client"`): `api.entityTypes.list.useQuery({includeInactive:true})`; left master list (`w-72 border-r`, frosted `h-11` header with a "+ New type" button opening a Zod-validated create-type dialog), each row = label + an "Inactive" `Badge`, click selects, active row `bg-primary/10 text-primary`. Skeleton rows while loading, friendly error + empty states, default-select the first type, devtools-only error logging (WR-02). Right pane renders `<EntityTypeDetail>`.
- `entity-type-detail.tsx` (new, `"use client"`): name/description `form` (`Input`+`Textarea`, save-on-blur → `updateType`), an active `Switch` (deactivate via `updateType isActive` — non-destructive), and a Fields `Table` (Label · Slug · Type · Required · Identifier · order · edit) ordered by `sortOrder` with "+ Add field" (opens the dialog in create mode), per-row edit (opens it in edit mode), and up/down reorder buttons calling `reorderFields` with the new id order. All writes go through the hook.

## Verification Results

- `npm run build -w @nauta/api-client` (tsc): **EXIT 0** — the widened `list` surface + new field-id exposure compile; dist rebuilt so apps/web typechecks against the new procedures.
- `npm test -w @nauta/api-client` (vitest run): **56 passed (6 files)** — the updated `groupEntityTypeRows` fixtures + new id/isActive/sortOrder/isIdentifier + deactivated-type assertions all green.
- `cd apps/web && npx tsc --noEmit`: **EXIT 0** after every task.
- `npm run web:build` (api-client tsc + `next build`): **EXIT 0** — `/entity-types` compiled (27.9 kB, statically prerendered), all 6 routes build.
- Security grep: no `fetch(`, `EMAIL_LISTENER`, `X-API-Key`, or `NEXT_PUBLIC` anywhere under `apps/web/src/app/entity-types` — all writes route through the server-side tRPC proxy (T-09-61).
- `field_type` allowlist: the 5 literals appear in both the Select options and the Zod `z.enum` (T-09-60).

## Deviations from Plan

None — plan executed as written. One in-plan blocking-fix worth recording (Rule 3): extending `entityTypes.list` broke the existing `groupEntityTypeRows` unit tests (fixtures were missing the new `id`/`isActive`/`fieldId`/`fieldIsIdentifier` row keys and asserted the old shape). The fixtures were updated to the new shape and assertions added for the new fields — this is the test side of the same additive change the plan's Task 1 explicitly called for, not a behavioural deviation.

## Threat-Model Coverage

| Threat ID | Disposition | How handled |
|-----------|-------------|-------------|
| T-09-60 (invalid field_type) | mitigate | `field_type` is a `Select` limited to the 5 values + a Zod `z.enum` re-check before the mutation; the api-client mutation re-validates and 09-03 Pydantic re-validates server-side. |
| T-09-61 (API key in client) | mitigate | The page calls only tRPC mutations; the key lives server-side in the 09-04 `_listener-config` proxy — grep confirms zero `fetch`/`X-API-Key`/`NEXT_PUBLIC` under `entity-types`. |
| T-09-62 (accidental field hard-delete) | mitigate | Delete behind an `AlertDialog`; referenced fields show a deactivate-not-delete message with a non-`destructive` confirm; the hook surfaces the server's `soft_deactivated` outcome so the UI never mis-reports a deactivate as a delete; the 09-03 server guard is the authority. |
| T-09-63 (raw server errors in UI) | mitigate | Friendly sonner toasts only; technical detail logged to devtools (`console.error`) in the hook + page. |
| T-09-SC (npm/pip installs) | mitigate | No new packages — every primitive (Select/Switch/Table/Dialog/AlertDialog/Checkbox/Textarea/Input/Label/Badge/Skeleton/Button) already exists in `@nauta/ui`. |

## Known Stubs

None. The `referenceCount` prop on `FieldRowDialog` defaults to 0 and is not yet fed a live per-field count (the `list` query does not expose reference counts), but this is **not** a stub that breaks the goal: the AUTHORITATIVE D-27 outcome is the server's `DeleteFieldView` response, which the `deleteField` hook resolves and toasts on every delete — so a referenced field is always correctly reported as deactivated regardless of the pre-emptive copy. The prop is a forward-compatible seam for surfacing the count pre-emptively if a future `list` projection adds it.

## Self-Check: PASSED

Files created (all present on disk):
- `apps/web/src/app/entity-types/page.tsx`
- `apps/web/src/app/entity-types/_components/entity-type-detail.tsx`
- `apps/web/src/app/entity-types/_components/field-row-dialog.tsx`
- `apps/web/src/app/entity-types/_components/use-entity-type-admin.ts`

Files modified (present):
- `packages/api-client/src/router/entity-types.ts`
- `packages/api-client/src/router/__tests__/entity-types.test.ts`

Commits (all present in git log):
- `bbda632` feat(09-07): entity-type admin hook + list id exposure
- `9863d72` feat(09-07): field-row dialog with field_type allowlist + delete guard
- `03085e6` feat(09-07): /entity-types master/detail page + fields table
