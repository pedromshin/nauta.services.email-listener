# Phase 24 Plan 05: UI Review Fix Pass Summary

Targeted TDD fix pass addressing the CORRECTNESS and CONTRACT-COMPLIANCE findings from
`24-UI-REVIEW.md` (2026-07-05 code-only audit). Not a full plan — no new PLAN.md, ROADMAP/STATE
entries added (per objective). Each fix independently verified against source before touching
code; all four findings were confirmed real.

## Findings Verified and Fixed

### 1. [CORRECTNESS, highest priority] FormComponent/InteractiveWidgetBoundary copy collision — CONFIRMED REAL, FIXED

`FormComponent.handleSubmit` set its own local `submitted` state to `true` synchronously on
click (before the server round-trip resolves), rendering "Submitted ✓" in `text-emerald-600`.
Because `InteractiveWidgetBoundary` re-renders the SAME live form tree (same `specJson`, same
tree position) across the `pending -> submitting` transition, React preserves that local state —
so the user saw "Submitted ✓" and "Submitting…" simultaneously on every clarify-widget submit,
and "Submitted ✓" reappeared next to a re-enabled, editable form after a 422 rejection.

**Fix:** Added an opt-in `hideOwnSubmittedAffordance?: boolean` field to the `form` catalog
node's wire schema (`packages/genui/src/schema/spec-schema.ts`) and manifest `propsSchema`
(`packages/genui/src/catalog/manifest.ts`), threaded it into `FormComponent`
(`packages/genui/src/catalog/form-component.tsx`) to gate the "Submitted ✓" render only, and set
it to `true` in `buildClarifyWidgetSpec`
(`apps/web/src/app/chat/_components/build-clarify-widget-spec.ts`). `InteractiveWidgetBoundary`'s
own badge/"Submitting…" row is now the sole source of truth for the clarify-widget submitted
signal. Defaults to unset/false — every existing Phase-19 studio form spec is unaffected
(verified by a dedicated regression test).

`packages/genui/src/renderer/spec-renderer.tsx` was NOT touched (confirmed still `ecc7a46`).

### 2. [CONTRACT] Missing "This was already answered." conflict copy — CONFIRMED REAL, FIXED

`errorMessages` in `use-conversation-controller.ts`'s `widgets` memo was populated ONLY when
`errorKind === "invalid"`. A 409 double-submit conflict (`errorKind: "conflict"`) produced no
message text anywhere in the client — confirmed via source read and the review's full-repo grep
(zero matches for "already answered").

**Fix:** Extracted the errorKind -> message mapping into an exported pure function
`errorMessageForWidgetError` and wired it into the memo. `"invalid"` and `"stale"` behavior is
unchanged (stale still returns `null` by design — it reconciles via the Stale badge's own
caption, D-12, avoiding a duplicate message); `"conflict"` now returns the UI-SPEC's mandated
string.

### 3. [CONTRACT] CompactInteractionEntry clarify branch bypasses key-value-list — CONFIRMED REAL, FIXED

`ClarifySummary` (inside `compact-interaction-entry.tsx`) hand-rolled a bare `<dl>` with no
`aria-label`, instead of routing through the mandated `key-value-list` catalog primitive the way
`SubmittedClarifyView` (`interactive-widget-boundary.tsx`) already does correctly.

**Fix:** Rebuilt `ClarifySummary` on top of a `key-value-list` `SpecRoot` (label = "Your
response", one `{key, value}` item per submitted field, boolean formatting unchanged) rendered
via `GenuiPartBoundary` with `variant="bare"` (the compact transcript bubble already supplies its
own `bg-muted`/`rounded-lg` shell, so the default `GenuiCard` wrapper would add an unwanted second
layer). `proposal_cards` path untouched. Empty-fields edge case (not covered by the UI-SPEC, and
excluded from `key-value-list`'s `items.min(1)` schema) falls back to a plain "Your response"
label rather than tripping `SAFE_FALLBACK_SPEC`.

### 4. [AESTHETIC, lower priority] Submitted proposal cards lose Card chrome — CONFIRMED REAL, FIXED

`SubmittedProposalView` rendered plain `rounded-lg`/`p-4` divs with no border/shadow, unlike the
live (pending) catalog `Card`'s `rounded-xl border ... shadow` + `p-6`
(`packages/ui/src/card.tsx`) — a visible container downgrade at the exact moment a choice locks
in.

**Fix:** Small, safe className alignment — both the chosen and dimmed card shells now carry
`rounded-xl border border-border ... shadow p-6`, preserving the existing ring+wash (chosen) and
`opacity-50`/`aria-disabled` (dimmed) treatment. No locked-renderer risk — pure Tailwind class
change on a single hand-rolled `<div>`, no schema/behavior change.

## Not Addressed (Out of Scope)

The review's Pillar 6 finding about dimmed/superseded/stale controls not being individually
removed from the tab order (per-control `aria-disabled` vs. the outer wrapper only) was **not**
in the four numbered findings this fix pass was scoped to, and was left untouched per the
objective's scope boundary. Flagging here for a future pass if desired.

## Deviation (Rule 3 auto-fix)

Adding `hideOwnSubmittedAffordance` to `FormNodeSchema` changed the generated Bedrock JSON Schema
shape, which tripped the pre-existing D-03 drift-gate test
(`packages/genui/src/generation/__tests__/artifacts.test.ts`) comparing the committed
`packages/genui/artifacts/spec.schema.json` against a freshly generated schema. Regenerated via
`npm run gen:artifacts` (workspace `packages/genui`) and committed the updated
`spec.schema.json`. `genui-prompt.json` was unaffected (no diff) — confirmed before committing.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `a8d6799` | test | RED: FormComponent/InteractiveWidgetBoundary submitted-copy collision |
| `43309d9` | feat | GREEN: `hideOwnSubmittedAffordance` schema + component + clarify-spec wiring |
| `c037a79` | test | RED: missing double-submit conflict copy |
| `3c115ad` | fix | GREEN: `errorMessageForWidgetError` surfaces "This was already answered." |
| `e54a59e` | test | RED: CompactInteractionEntry clarify key-value-list routing |
| `9e8c3dc` | fix | GREEN: `ClarifySummary` rebuilt on `key-value-list` + `GenuiPartBoundary` |
| `e59d79d` | test | RED: submitted proposal card chrome alignment |
| `99c3400` | fix | GREEN: `SubmittedProposalView` chrome matches live Card |
| `e662f28` | chore | Rule 3: regenerate `spec.schema.json` artifact (drift-gate fix) |

## Gate Results

- `npm run test --workspace=apps/web` — **150/150 passed** (18 files)
- `npm run test --workspace=packages/genui` — **477/477 passed** (26 files)
- `npm run typecheck --workspace=apps/web` (`tsc --noEmit`) — clean, no errors
- `npm run typecheck --workspace=packages/genui` (`tsc --noEmit`) — clean, no errors
- `git log -1 -- packages/genui/src/renderer/spec-renderer.tsx` — `ecc7a46` (unchanged, confirmed
  both before and after this fix pass)

## Deferrals

None. All four findings were fixed; the one deferral is the explicitly out-of-scope Pillar 6
tab-order finding noted above (never started — not a partial fix).
