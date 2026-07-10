# Phase 45 — UI Review (Retroactive Audit)

**Audited:** 2026-07-10
**Baseline:** `.planning/phases/45-email-threads-forwarding-seam/45-UI-SPEC.md` (THRD-03 thread-grouped inbox, minimal v1.4-tokens posture) + `.claude/skills/polytoken-design-system/SKILL.md` token/convention rules
**Screenshots:** not captured — dev server responds with `307 -> /login` (Supabase Auth-gated route, per 45-04-SUMMARY.md's own runtime check); this is a **code-only audit** of the 5 assigned files plus the pre-existing `inbox-row.tsx`/`entity-chips.tsx` they compose (read for context, not independently scored)
**Status:** ADVISORY (non-blocking)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | No generic labels; friendly error/empty copy with technical detail routed to `console.error` only; CTAs are specific ("Open editor →", "Setup guide (incl. Gmail verification) →") |
| 2. Visuals | 3/4 | Clean hierarchy reuse, but collapsed thread rows and singleton rows are visually near-identical apart from a small chevron + badge — low scannability margin |
| 3. Color | 4/4 | Zero hardcoded colors; `bg-primary/10 text-primary` used only on the two spec-sanctioned surfaces (active filter, link); no new hue introduced |
| 4. Typography | 3/4 | Only 2 sizes / 2 weights in use (excellent restraint), but the shipped snippet line is `text-sm` while `45-UI-SPEC.md` line 59 literally declares `text-xs` |
| 5. Spacing | 3/4 | Standard scale throughout, but `inbox-thread-group.tsx` mixes `pl-6` (snippet) and `pl-4` (member indent) for conceptually-related nesting with no shared rationale, and `settings/forwarding/page.tsx` carries a `min-h-[70vh]` arbitrary value (precedented, but still off-scale) |
| 6. Experience Design | 4/4 | Skeleton loading, friendly error states, filter-aware empty states, disabled-while-fetching Load More, full aria-expanded/aria-pressed/aria-label coverage, timed copy-confirmation |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Snippet line typography contradicts its own spec** — `apps/web/src/app/_components/inbox-thread-group.tsx:99` ships `text-sm text-muted-foreground`, but `.planning/phases/45-email-threads-forwarding-seam/45-UI-SPEC.md:59-60` literally declares `text-muted-foreground text-xs` for the same element. User impact: none today (the shipped `text-sm` is arguably *more* consistent, since it matches `InboxRow`'s own subject-line treatment, `inbox-row.tsx:81-83`, which is what the same spec paragraph also invokes as the size precedent — the spec text is internally contradictory). Risk is for the v1.8 re-skin, which will treat `45-UI-SPEC.md` as the literal contract and may "fix" the size to `text-xs`, silently shrinking the snippet against the shipped, tested UI. Fix: amend `45-UI-SPEC.md` line 59 to read `text-sm text-muted-foreground` so the written contract matches the shipped/tested code, closing the drift before v1.8 reads the doc.

2. **Two unreconciled indent values for conceptually-linked nesting** — `apps/web/src/app/_components/inbox-thread-group.tsx:99` uses `pl-6` to align the snippet under the subject text (past the `size-4` chevron + `gap-2`), while line 106's expanded-members wrapper uses `pl-4` to indent member rows. Both exist to visually signal "this content belongs to the thread row above it," yet use different offsets with no comment explaining why they diverge. User impact: low (both read as "indented" at a glance), but it's exactly the kind of unreconciled magic number that compounds silently across future edits. Fix: either extract a shared `THREAD_INDENT = "pl-6"` (or `pl-4`) class constant used by both sites, or add a one-line comment at each site stating why the two values differ (snippet aligns under text past the icon; member rows use the spec's own `pl-4` example verbatim).

3. **Collapsed thread rows and singleton rows are visually near-identical** — `apps/web/src/app/_components/inbox-thread-group.tsx:74-103` renders a summary row whose only differentiators from a plain `InboxRow` (`inbox-row.tsx:63-90`) are a `size-4` `ChevronRight` icon and a small `Badge`. Both share the same `min-h-16`, same `hover:bg-muted/50`, same two-line text treatment. User impact: at a quick scan, a user cannot reliably tell "this row expands to more messages" from "this is one message" without deliberately looking for the chevron — the exact affordance the spec (`45-UI-SPEC.md:64-83`) relies on to communicate thread-ness. This is explicitly acceptable for v1 per the spec's own "no visual noise for the common case" rationale, so it is not a defect against the contract — but it is the single highest-leverage visual-hierarchy improvement available to v1.8's re-skin. Fix (deferred to v1.8, not required now): consider a subtle non-color affordance (e.g., a slightly heavier `font-semibold` weight is already applied, so instead try a left-edge accent rule or denser chevron) so thread-ness reads without requiring the badge to register first.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- No generic-label hits (`Submit`/`Click Here`/`OK`/`Cancel`/`Save`) anywhere in the 5 audited files — confirmed via grep.
- Error copy is friendly and actionable, never leaks raw error objects to the UI: `"Unable to load emails. Please try refreshing the page."` (`inbox-three-pane.tsx:333`), `"Unable to load your forwarding address. Please try refreshing the page."` (`forwarding-address-card.tsx:73-74`). Both components route the actual tRPC error to `console.error` only (`inbox-three-pane.tsx` via `page.tsx:17-21`; `forwarding-address-card.tsx:54-58`) — matches the CLAUDE.md guardrail "Log detailed errors server-side [/devtools]; show friendly messages client-side."
- Empty states are filter-aware, not a single generic string: `"No emails yet."` vs `"No emails with extracted entities yet."` (`inbox-three-pane.tsx:340-341`); `"No email selected"` / `"Select a message from the list to preview it here."` (`inbox-three-pane.tsx:124-126`).
- CTAs are specific and directional: `"Open editor →"` (`inbox-three-pane.tsx:143`), `"Setup guide (incl. Gmail verification) →"` (`forwarding-address-card.tsx:111`) — both name the destination/outcome rather than a bare verb.
- Card copy is on-brand and concrete: `"Your forwarding address"` / `"Forward mail here to ingest it into polytoken."` (`forwarding-address-card.tsx:63-65`).
- `"(no subject)"` fallback is consistent between `InboxRow` (`inbox-row.tsx:82`) and `InboxThreadGroup` (`inbox-thread-group.tsx:90`) — no copy drift between the flat and grouped paths.
- No deductions found.

### Pillar 2: Visuals (3/4)

- Persistent app shell (`apps/web/src/app/layout.tsx:40-43`, `AppSidebar` + `SidebarInset`) wraps every route including `/settings/forwarding` — confirmed the standalone forwarding-settings page is not orphaned; navigation chrome is always present.
- Icon-only interactive elements are correctly labeled: the copy button carries `aria-label="Copy forwarding address"` (`forwarding-address-card.tsx:92`), and its `Check`/`Copy` glyphs both carry `aria-hidden` (lines 96, 98) since the button's own label already conveys purpose.
- Typographic hierarchy is a clean, deliberate 2-weight system reused verbatim from `InboxRow`'s existing precedent (`font-semibold` for subject/title, `text-muted-foreground` for secondary/meta) — no new visual language introduced, exactly matching the spec's "reuse what InboxRow already uses" mandate (`45-UI-SPEC.md:24-36`).
- Deduction: the disclosure affordance for a thread row is minimal — a `size-4` `ChevronRight` (`inbox-thread-group.tsx:83-88`) plus a `Badge` are the only signals distinguishing an expandable group from a flat singleton row; both share identical container treatment (`min-h-16`, `hover:bg-muted/50`, two-line truncated text). This is spec-compliant (the spec explicitly wants "no visual noise for the common case," `45-UI-SPEC.md:55-57`) but does cost scannability — see Top Fix #3.
- The copy-to-clipboard icon swap (`Check` replaces `Copy` for 1.5s, `forwarding-address-card.tsx:34,95-99`) is a well-scoped, non-intrusive micro-interaction.

### Pillar 3: Color (4/4)

- Zero hardcoded hex/`rgb()` values in any of the 5 audited files (grep confirmed).
- `text-primary`/`bg-primary` usage is exactly 2 occurrences across the 5 files, both spec-sanctioned: the active-filter pill (`inbox-three-pane.tsx:103`, `"bg-primary/10 text-primary"`) and the runbook link (`forwarding-address-card.tsx:109`, `"text-primary underline-offset-4 hover:underline"`). Neither introduces a new usage pattern — `bg-primary/10` mirrors `InboxRow`'s pre-existing selected-row treatment (`inbox-row.tsx:38,71`) verbatim.
- `text-destructive` appears exactly twice, both for genuine error copy (`inbox-three-pane.tsx:332`, `forwarding-address-card.tsx:72`) — correct semantic scoping, not overused as a decorative color.
- The violet entity-chip hue (`entity-chips.tsx:69,73,77,89`) is pre-existing, unmodified code reused via the untouched `InboxRow` component — not a new color introduced by Phase 45, and its reuse (rather than a re-implementation) is exactly what `45-UI-SPEC.md:120-123` mandates.
- Full compliance with the spec's explicit "no new color" constraint (`45-UI-SPEC.md:35-36`, "No new color, no new radius/shadow work").

### Pillar 4: Typography (3/4)

- Distinct font sizes across the 5 files: `text-sm`, `text-xs` — 2 total. Distinct weights: `font-semibold`, `font-medium` — 2 total. Both are well inside the abstract ≤4-size/≤2-weight guideline and match the spec's zero-new-tokens mandate.
- Deduction: `inbox-thread-group.tsx:99` (`"truncate pl-6 text-sm text-muted-foreground"`) does not match the literal size token `45-UI-SPEC.md:59-60` declares for the same element (`"text-muted-foreground text-xs"`). The spec text is self-contradictory (it separately says the snippet should share "the existing row's subject line" tone, and that line is `text-sm` per `inbox-row.tsx:81-83`) — so the code is defensible as *more* correct than the doc, but a strict spec-compliance read still finds a literal mismatch. See Top Fix #1 for the recommended resolution (fix the doc, not the code).
- `font-medium` appears once (`forwarding-address-card.tsx:109`, the runbook link) — a pre-existing Tailwind/shadcn weight already used elsewhere in the app, not a Phase-45-original addition; does not meaningfully push past the 2-weight ceiling since default body weight is implicit/unstyled.
- `formatDate` (`value ? new Date(value).toLocaleDateString() : "—"`) is duplicated verbatim between `inbox-row.tsx:25-26` and `inbox-thread-group.tsx:29-30` rather than imported from one source — not a visual defect, but a DRY gap that risks silent formatting drift if one copy is edited without the other. Noted, not scored (out of this pillar's remit, but flagged for the fix backlog).

### Pillar 5: Spacing (3/4)

- Spacing classes across the 5 files are drawn almost entirely from the standard scale: `px-4`, `py-2`, `py-3`, `p-2`, `p-3`, `p-4`, `p-6`, `p-12`, `gap-1` through `gap-4`, `space-y-2`, `space-y-4` — all confirmed via grep, no raw pixel values.
- Deduction 1: `inbox-thread-group.tsx` uses two different indent offsets for related nesting — `pl-6` on the snippet line (line 99, aligning under the subject text past the `size-4` chevron + `gap-2` header) and `pl-4` on the expanded-members wrapper (line 106). The spec permits `pl-4` "or similar" for member indent (`45-UI-SPEC.md:78`), so neither value is individually wrong, but the pair is unreconciled — see Top Fix #2.
- Deduction 2: `settings/forwarding/page.tsx:17` uses `min-h-[70vh]`, an arbitrary bracket value outside the Tailwind spacing scale. This is precedented exactly (`login/page.tsx:28` uses the identical `min-h-[70vh]`), so it's a deliberate, consistent reuse of an established pattern rather than a net-new one-off — lower severity than a fresh arbitrary value, but the pattern itself was never a spacing-scale citizen and should be watched if it recurs a third time (candidate for a named utility).
- No other arbitrary bracket values found in the audited files.

### Pillar 6: Experience Design (4/4)

- Loading states: `Skeleton` used for both the inbox list (3× `h-16` rows, `inbox-three-pane.tsx:325-327`) and the forwarding card (`h-9`, `forwarding-address-card.tsx:69`) — a real loading affordance, not a blank flash.
- Error states: friendly, actionable copy with technical detail confined to `console.error` (see Pillar 1) — both `page.tsx` and `forwarding-address-card.tsx` follow the same pattern independently, showing it's an established convention, not a one-off.
- Empty states: filter-aware, distinct copy for "no emails" vs. "no emails with entities" (`inbox-three-pane.tsx:339-341`) rather than one generic empty message.
- Disabled/pending states: the Load More button disables and relabels itself during fetch (`disabled={loadMoreQuery.isFetching}`, label swaps to `"Loading…"`, `inbox-three-pane.tsx:369,372`).
- Interaction accessibility: `aria-expanded` on the thread-disclosure trigger (`inbox-thread-group.tsx:78`), `aria-pressed` on both the filter buttons (`inbox-three-pane.tsx:99`) and `InboxRow` (`inbox-row.tsx:67`), `aria-label` on the icon-only copy button and the read-only address input (`forwarding-address-card.tsx:84,92`), `aria-hidden` correctly applied to every purely-decorative icon.
- State-reset correctness: `extraItems`/`nextOffset` reset when the seed query identity changes (`inbox-three-pane.tsx:211-215`), with an explicit code comment explaining why `useMemo` is required to avoid an infinite-update loop — defensive, well-reasoned state management.
- No destructive actions exist in this phase's scope, so no confirm-dialog gap to assess.
- Full pass — comprehensive state coverage for what the spec itself calls a "minimal" surface.

---

## Registry Safety

Not applicable. `packages/ui/components.json` exists (shadcn is initialized project-wide), but `45-UI-SPEC.md` explicitly states this phase introduces "no new components, no new tokens, no new npm dependencies" (line 27) and both `45-04-SUMMARY.md` and `45-06-SUMMARY.md` confirm zero `package.json`/lockfile diffs across all task commits. No third-party registry blocks were installed or touched by Phase 45 — registry audit skipped, no flags possible.

---

## Files Audited

- `apps/web/src/app/_components/inbox-thread-group.tsx` (new, Plan 45-04)
- `apps/web/src/app/_components/inbox-three-pane.tsx` (modified, Plan 45-04)
- `apps/web/src/app/page.tsx` (modified, Plan 45-04)
- `apps/web/src/app/_components/forwarding-address-card.tsx` (new, Plan 45-06)
- `apps/web/src/app/settings/forwarding/page.tsx` (new, Plan 45-06)

Read for context (pre-existing, unmodified — not independently scored):
- `apps/web/src/app/_components/inbox-row.tsx`
- `apps/web/src/app/_components/entity-chips.tsx`
- `apps/web/src/app/layout.tsx`
- `packages/ui/src/card.tsx`
- `apps/web/src/app/login/page.tsx` (for the `min-h-[70vh]` precedent check)

Reference documents:
- `.planning/phases/45-email-threads-forwarding-seam/45-UI-SPEC.md`
- `.planning/phases/45-email-threads-forwarding-seam/45-CONTEXT.md`
- `.planning/phases/45-email-threads-forwarding-seam/45-04-SUMMARY.md`
- `.planning/phases/45-email-threads-forwarding-seam/45-06-SUMMARY.md`
- `.claude/skills/polytoken-design-system/SKILL.md`
