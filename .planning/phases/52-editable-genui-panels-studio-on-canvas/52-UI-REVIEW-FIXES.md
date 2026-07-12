# Phase 52 — UI Review Fixes

**Closed:** 2026-07-12
**Source:** `52-UI-REVIEW.md`'s Top 3 Priority Fixes #1 and #2 (Overall score 21/24)
**Scope:** the top two findings only — #3 (two-row toolbar chrome density) stays deferred to a live-canvas pass per the review's own recommendation (needs a real browser, not a code-level fix).

---

## Finding #1 — Silent failure on real persistence errors (Pack Switch + Restore Version)

**Problem:** `usePanelOverlay`'s `writeOverlay`/`scheduleSave` path (`use-canvas-persistence.ts:439-472`) was fire-and-forget. The revert-on-failure + `toast.error` behavior in `pack-switcher.tsx`/`version-history-control.tsx` was only ever exercised against a synthetic synchronous throw from a test-supplied `scheduleSave` — never against a real, asynchronous `chat.saveCanvasLayout` mutation failure. A genuine network hiccup mid-switch or mid-restore looked like a silent success: no revert, no toast, only the easy-to-miss ambient `SaveStatusIndicator` flipping to "error" elsewhere on screen.

**Fix:**

- `useCanvasPersistence`'s `scheduleSave(canvasStore?, onError?)` now accepts an optional `onError` callback. Callbacks registered while calls are still coalescing into the SAME pending debounce timer accumulate in `pendingErrorListenersRef`; when that cycle's timer fires, the accumulated list is "owned" by that cycle (cleared immediately, before the mutation resolves) so a later cycle's outcome can never re-fire a stale listener. The list is invoked only from the mutation's own `onError` (or the pre-existing `buildSnapshot` invariant-failure branch) — never on success, never synchronously.
- `CanvasPersistenceContextValue.scheduleSave` (the context-bound wrapper every panel consumes) and `usePanelOverlay`'s `writeOverlay(next, onSaveError?)` both forward the same optional callback end-to-end, so a panel's own write can react to ITS write's real outcome.
- `pack-switcher.tsx` and `version-history-control.tsx` factor their existing `revertAndToast` closure out of the `catch` block and pass it as `writeOverlay`'s `onSaveError` — so the SAME revert-and-toast logic now fires on either signal: (a) the pre-existing synchronous-throw test seam (kept intact, zero test changes required to the existing 4/5 tests), or (b) a genuine async failure delivered later via the new callback.

**Tests added:**

- `use-canvas-persistence-save-error.test.tsx` (4 tests, hook-level, tRPC mutation mocked, fake timers) — proves `scheduleSave`'s `onError` fires only on a real mutation failure, never on success, fires every listener coalesced into one debounce cycle, and never leaks a listener across cycles.
- `pack-switcher.test.tsx` — new "REAL async persist failure" test: captures the `onError` callback passed to the mocked `scheduleSave`, confirms the optimistic apply lands with NO revert/toast yet, then invokes the captured callback asynchronously and confirms the Select reverts + the exact toast copy fires.
- `version-history-control.test.tsx` — same pattern for Restore: confirms the optimistic success toast + popover close land first (the write hasn't failed yet), then the captured `onSaveError` firing later produces the exact error toast + Retry action.

**Verification:** full `_canvas` suite — 26 test files, 199 tests passing (was 193 before this change; +6 new: 4 hook-level + 1 pack-switcher + 1 version-history-control).

**Commits:**

| Commit | Type | Description |
|--------|------|-------------|
| `bff7377` | test | RED: failing hook-level test for `scheduleSave` onError propagation |
| `df69453` | fix | GREEN: `scheduleSave`/`writeOverlay`/context plumbing |
| `ad6d002` | fix | `pack-switcher.tsx`/`version-history-control.tsx` wired to the real failure signal |
| `473a20e` | test | genuine-async-failure coverage for both controls |

---

## Finding #2 — Popover form-control typography (text-sm leaking into text-xs popovers)

**Problem:** `edit-params-control.tsx`'s `EditParamField` rendered its `Label` at `text-xs` (12px) but the `Input`/`Textarea`/`SelectTrigger` beneath it inherited the shadcn base components' un-overridden `text-sm` (14px) — a 3rd, unacknowledged type size inside a popover 52-UI-SPEC.md explicitly claims is "all content is form controls or list rows at text-xs". `retheme-control.tsx`'s instruction `Textarea` had the identical un-overridden inheritance.

**Fix:** added `className="text-xs"` to:

- `edit-params-control.tsx` — the `string`-kind `Input`, the `text`-kind `Textarea`, the `number`-kind `Input`, and the enum `SelectTrigger` (kept its existing `h-9 w-full`, appended `text-xs`).
- `retheme-control.tsx` — the instruction `Textarea`.

No height changes — `tailwind-merge` (`packages/ui/src/index.ts`'s `cn`) resolves the `text-xs`/`text-sm` conflict in favor of the later class, so the 36px-tall `Input`/`SelectTrigger` controls keep their existing height with just the smaller type inside.

**Scope note:** `add-knowledge-preview-popover.tsx` has the identical pre-existing pattern (flagged in the review as "not a NEW mistake this phase invented") — left untouched, out of Phase 52's scope.

**Commit:** `832c98e`.

---

## Gates

| Gate | Result |
|------|--------|
| Full `_canvas` test suite | 26 files / 199 tests passing |
| `palette-ban.test.ts` | 2/2 passing |
| `token-contrast.test.ts` | 6/6 passing |
| `token-registration.test.ts` | 4/4 passing |
| `tsc --noEmit` (excluding pre-existing `apps/web/src/app/dev/design` errors, unrelated to this change) | clean |
