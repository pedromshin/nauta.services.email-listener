---
status: partial
phase: 09-entity-field-region-relationships-canvas
source: [09-VERIFICATION.md, 09-09-PLAN.md Task 4, 09-ADVERSARIAL-REVIEW.md]
started: 2026-06-14
updated: 2026-06-14
---

## Current Test

[awaiting human browser walkthrough — code is complete + machine-verified CLEARED]

## Context

All 10 plans executed; the 2 CRITICAL + 3 HIGH gaps the adversarial review found were fixed
(Bundles A/B/C) and re-verified **CLEARED**; both stacks green (Python 436 passed / 86.97% cov;
api-client vitest 56/56; web `next build` 0). The only outstanding item is this in-browser pass.

**Setup:** `cd apps/web && npm run dev` with `EMAIL_LISTENER_URL` + `EMAIL_LISTENER_API_KEY` set
server-side in `apps/web/.env.local`, against local Postgres with migration `0013` applied (already live).

## Tests

### 1. Inbox (`/`)
expected: glassy three-pane layout; sidebar nav (Inbox + Entity Types active; Entities/Knowledge "Soon");
light/dark toggle; per-email entity-type chips that deep-link to `/emails/{id}`.
result: [pending]

### 2. Entity Types (`/entity-types`)
expected: create a type; add/edit/reorder fields (field-type Select limited to string/number/date/array/object);
a referenced-field delete offers **Deactivate** (not hard-delete); optimistic updates + toasts.
result: [pending]

### 3. Editor (`/emails/{id}` with a PDF)
expected: draw a box (drag-to-draw armed by the Draw tool) → mark **Entity** + pick an entity type in the
Inspector → active-parent banner appears → draw more boxes (become field children) → role colors +
active-parent ring + inline ✓/✗ render **on the PDF** (not just the LAYERS tree) → "Show regions" toggle
hides the on-PDF overlays → zoom (Cmd/Ctrl+scroll), Space-drag pan, Fit width/page → Unrelated boxes hide
behind the toggle. Inline ✓ confirms; auto-detected ✗ removes the box; user-drawn ✗ keeps the box + clears value.
result: [pending]

### 4. Autofill round-trip (BLOCKED on infra, not code)
expected: with an entity selected + entity-type set, "Autofill Fields" → candidate field boxes appear with ✓/✗.
result: [pending — gated by Bedrock RPM quota]
note: live autofill currently hits Bedrock `429 ThrottlingException` on `us.anthropic.claude-sonnet-4-6`
(us-east-1). This is an account quota limit, NOT a code defect — the code degrades safely (empty result,
friendly toast, no crash). Raise the on-demand RPM quota (AWS Service Quotas → Bedrock) to exercise this path.

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 1 (autofill — Bedrock quota)

## Gaps

(none recorded yet — fill in per surface after the walkthrough; report issues to spin gap-closure plans)
