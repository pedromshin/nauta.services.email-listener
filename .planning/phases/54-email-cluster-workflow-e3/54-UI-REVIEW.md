# Phase 54 — UI Review

**Audited:** 2026-07-12
**Baseline:** `.planning/phases/54-email-cluster-workflow-e3/54-UI-SPEC.md` (design contract)
**Screenshots:** not captured — local dev stack DOWN this run; code-level audit only per task instructions (stack not launched)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every string in the Copywriting Contract table matches implementation verbatim across all 3 new files |
| 2. Visuals | 2/4 | `EmailThreadNode`'s error/empty body states overflow the fixed 148px content budget and are very likely clipped by the shell's `overflow-hidden` |
| 3. Color | 3/4 | `EmptyState`'s Retry CTA renders `bg-primary`, an undisclosed second primary consumer contradicting the spec's explicit "exactly one new consumer" claim |
| 4. Typography | 3/4 | Error/empty branches inject `text-base`/second `text-sm` instance not accounted for in the phase's declared 2-size scale |
| 5. Spacing | 2/4 | Fixed `h-[220px]` shell + two-action `h-9` footer leaves only ~84px of usable padding-adjusted space for `EmptyState`'s error/empty content, which needs ~160px |
| 6. Experience Design | 2/4 | `ThreadClusterIndicator`'s "Open thread →" popover link has **zero** focus indicator — a real keyboard-accessibility break |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **`EmailThreadNode`'s error/empty `EmptyState` content overflows its 148px body budget, clipping the "Retry" action** — user impact: a user who hits a thread-load error cannot reach the Retry button (functionally unrecoverable without removing/re-adding the card) — concrete fix: give `EmptyState` an optional tighter density for card-embedded contexts (e.g. `size="micro"`: `p-3` instead of `p-8`, `size-5` icon, `text-xs` heading instead of `text-base`, no `mt-6` gap before the action) and use it from `email-thread-node.tsx:161-178`'s two `EmptyState` calls; alternatively shrink the footer to `h-7` (matching `KnowledgePreviewNode`) to reclaim ~16px.

   **Status: FIXED** (2026-07-12) — implemented as a compact inline recipe directly in `email-thread-node.tsx` (icon + single text-xs message + text-height ghost Retry, ~90px tall) rather than a new `EmptyState` size variant, so the shared `EmptyState` primitive and the shell's `320x220` dimensions stay untouched. See `.planning/phases/54-email-cluster-workflow-e3/54-UI-REVIEW-FIXES.md`. Commits: `1a460b9` (fix), `8b70e16` (test).

2. **`ThreadClusterIndicator`'s "Open thread →" link (`thread-cluster-indicator.tsx:100-109`) has no focus-visible styling at all** — user impact: a keyboard user tabbing through the popover gets no visual indication this link is focused, and it silently link to `href="#"` while `threadCardQuery.data` is still pending (no `aria-disabled`/`preventDefault` guard, unlike `email-thread-node.tsx:192-201`'s equivalent link) — concrete fix: add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm` to the className and mirror `EmailThreadNode`'s `aria-disabled`/`pointer-events-none`/`onClick preventDefault` guard for the pending-data case.

   **Status: FIXED** (2026-07-12) — link now mirrors `EmailThreadNode`'s sibling recipe byte-for-byte: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` plus a `canOpenThread`-gated `aria-disabled`/`pointer-events-none opacity-50`/`onClick preventDefault` guard for the pending case. Commits: `1a460b9` (fix), `8b70e16` (test).

3. **`EmptyState`'s Retry action renders a filled `bg-primary` button inside `EmailThreadNode`'s error state**, contradicting 54-UI-SPEC.md's Color contract ("This phase adds exactly one new consumer to the existing closed reservation list... No other new primary usage") and undermining Judgment Call #2's stated restraint (keeping the header icon neutral specifically to avoid primary overuse) — concrete fix: add an optional `actionVariant` prop to `EmptyState` (`apps/web/src/components/empty-state.tsx:74-93`, default `"default"` to preserve existing call sites) and pass `actionVariant="outline"` from `email-thread-node.tsx:168`'s Retry action to keep it in the neutral/ghost family the rest of the card uses.

   **Status: FIXED** (2026-07-12) — resolved as part of fix #1's compact recipe: Retry is now a plain `<button>` styled with the neutral-ghost `hover:bg-accent hover:text-accent-foreground` family (matching the footer link's recipe), never routing through `EmptyState`'s `ActionButton`/`bg-primary`. No `actionVariant` prop was added to `EmptyState` — the shared primitive is unchanged, per this fix's scope. Commits: `1a460b9` (fix), `8b70e16` (test).

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Verified every row of the Copywriting Contract table against the implementation, character-for-character:

- `add-email-thread-popover.tsx:94,101,109,111,113` — "Add thread" (aria-label + tooltip), "Add a thread" (heading), "Search your threads…" (placeholder), "No threads found." (`CommandEmpty`) — all exact matches.
- `add-email-thread-popover.tsx:122,125-126` — row secondary line `{n} message(s) · {relative time}` implemented as `{messageCount} message{messageCount===1?"":"s"} · {formatRelativeTime(...)}` — matches the contract's grammatical intent exactly.
- `email-thread-node.tsx:85,142,154,166-168,176-177,200,215` — "Untitled thread", `aria-label="Remove thread"`, `aria-label="Loading thread"`, "Couldn't load this thread.", "Try again, or open it from your inbox.", "Retry", "This thread is unavailable.", "It may have been removed or is no longer accessible.", "Open thread →", "Attach chat" — all exact matches.
- `email-thread-node.tsx:68,113,120` — `ATTACH_ERROR_COPY = "Couldn't attach a chat to this thread — try again."` + "Retry" toast action — exact match.
- `thread-cluster-indicator.tsx:40,49-57,89,98,108,112` — `NO_CONTEXT_COPY`, `clusterContextCopy`'s literal `"other chat(s)"`/`"captured source(s)"` suffix (not dynamic pluralization, as the contract explicitly requires), the `Linked thread: {subject}` aria-label, "Linked thread", "Open thread →", "Cluster context" — all exact matches.
- `tool-round-activity-row.tsx:29` / `tool-invocation-result-row.tsx:49-52` — "Searching the web…" / "Searched the web" / "Couldn't search the web." — exact matches, correctly reusing the existing result-count/error-row machinery with zero new component.

No generic labels ("Submit"/"OK"/"Click Here"), no ad-hoc copy invented outside the contract. This pillar is clean.

### Pillar 2: Visuals (2/4)

- **Clear focal point / hierarchy is correctly established on the happy path**: `email-thread-node.tsx:185-187`'s summary text is the only `text-foreground` (non-muted) copy in the card, matching the spec's stated "primary visual anchor" — header/footer stay deliberately low-contrast (`text-muted-foreground`). Good.
- **Icon-only buttons are paired with labels**: `Remove thread` (`email-thread-node.tsx:142`), `Add thread` (`add-email-thread-popover.tsx:94` + `TooltipContent`) both carry `aria-label`/tooltip. Good.
- **BLOCKER — error/empty body content overflows the card and is very likely clipped.** `email-thread-node.tsx:152-190`: the body wrapper is `relative flex-1 flex-col gap-1 px-3 py-2` inside a shell with `h-[220px]` and two `h-9` (36px) bars — leaving exactly 148px of body height. `EmptyState`'s `layout="centered" size="compact"` branch (`apps/web/src/components/empty-state.tsx:144-159`) renders `absolute inset-0 ... p-8` (32px padding, top+bottom = 64px), leaving only ~84px for content. The error branch's own content stack is: `size-8` icon (32px) + 2×`gap-3` (24px) + heading `text-base font-semibold` (~24px line-height) + `space-y-1` (4px) + body `text-sm` (likely wraps to 2 lines at this width, ~40px) + `mt-6` (24px) + default-size `Button` (36px, `h-9`, per `packages/ui/src/button.tsx:25`) ≈ **~160px total, roughly double the ~84px available.** The outer node shell has `overflow-hidden` (`email-thread-node.tsx:130`), so the overflow doesn't just look cramped — it gets hard-clipped, with the "Retry" button (the last flex child) the most likely casualty. This is the same `EmptyState` recipe `KnowledgePreviewNode`/`KnowledgePreviewMiniGraph` already use, but that sibling has a taller body budget (240px shell − 36px header − 28px `h-7` footer = 176px vs. this node's 148px) — this phase's own dimension choices (Judgment Call #1's 220px shell, the two-action `h-9` footer) make an already-marginal pattern concretely worse.

  **Status: FIXED** (2026-07-12) — `email-thread-node.tsx`'s error/empty branches no longer render `EmptyState` at all; a compact inline icon (`size-5`) + single `text-xs` message + text-height Retry button now fits in ~90px, well inside the 148px body budget, with no overflow/clip risk. Commits: `1a460b9` (fix), `8b70e16` (test).

### Pillar 3: Color (3/4)

- 60/30/10 discipline is otherwise excellent: `bg-background`/`bg-muted`/`bg-popover` dominate, `text-graph-email` is restrained to icon-only usage in exactly the two declared consumers (`email-thread-node.tsx:135`, `thread-cluster-indicator.tsx:92`), and `ring-primary` appears ONLY on the selection ring (`email-thread-node.tsx:66,130`) — verified via grep, zero stray `text-primary`/`bg-primary`/`border-primary` in the 3 new files. No hardcoded hex/rgb anywhere in the touched files.
- **WARNING — the Color contract's "exactly one new consumer" claim for `--primary` is false once the reused `EmptyState` primitive is traced through.** `apps/web/src/components/empty-state.tsx:82-84`'s `ActionButton` hardcodes `variant="default"` (`packages/ui/src/button.tsx:13-14`: `bg-primary text-primary-foreground`). `email-thread-node.tsx:168`'s Retry action renders through this exact path, producing a second, undisclosed filled-primary element inside this phase's new card — contradicting both the Color contract's closed-reservation claim and the "Neutral/ghost hover family... every new interactive element in this phase" enumeration (which lists the remove button, footer links, popover triggers, `CommandItem` rows, and "Attach chat" button, but conspicuously omits the Retry action nested inside `EmptyState`). Same pre-existing gap exists in `KnowledgePreviewMiniGraph`'s error branch, so this isn't a regression Phase 54 introduced outright — but the spec's own "exactly one" language for THIS phase is now demonstrably inaccurate, and it visually undercuts Judgment Call #2's stated intent (restraint on primary usage) right below the neutral header icon.

  **Status: FIXED for `EmailThreadNode`** (2026-07-12) — Retry no longer routes through `EmptyState`/`ActionButton`; it's a plain `<button>` in the `hover:bg-accent hover:text-accent-foreground` neutral-ghost family, so `EmailThreadNode`'s card now has zero `bg-primary` consumers, restoring the "exactly one new consumer" (the selection ring) claim for THIS phase. `KnowledgePreviewMiniGraph`'s identical pre-existing gap is out of this fix's scope (not introduced by Phase 54). Commits: `1a460b9` (fix), `8b70e16` (test).

### Pillar 4: Typography (3/4)

- All directly-authored copy across the 3 new files sticks to the declared scale: `text-xs`/`font-normal` for meta copy, `text-xs`/`font-semibold` for popover headings, and exactly the one declared `text-sm` consumer (`thread-cluster-indicator.tsx:99`, the linked-thread subject line) — verified via grep across `email-thread-node.tsx`, `add-email-thread-popover.tsx`, `thread-cluster-indicator.tsx`: only `text-xs` and one `text-sm` instance appear, no arbitrary `text-[...]` values, no weights beyond `font-normal`/`font-semibold`.
- **WARNING — the error/empty `EmptyState` branches inject sizes the phase's Typography table doesn't disclose.** `empty-state.tsx:151-152`'s compact/centered branch renders the heading at `text-base font-semibold` (16px — a size absent from 54-UI-SPEC's entire Typography table) and the body at `text-sm text-muted-foreground` (14px — a **second** consumer of the size the spec calls out as having "Exactly ONE consumer this phase"). This only affects the rarer error/empty states (loading/success are clean), but it means the phase's claim "This phase introduces no new size or weight... every string above reuses a size already in 51-UI-SPEC's inherited scale" doesn't hold for the full state matrix of the one component it introduces.

  **Status: FIXED for `EmailThreadNode`** (2026-07-12) — the error/empty branches no longer render `EmptyState`'s `text-base`/`text-sm` heading+body pair; the compact inline replacement uses `text-xs` exclusively (icon + message + Retry), so `EmailThreadNode`'s full state matrix now sticks to the declared two-size scale. Commits: `1a460b9` (fix), `8b70e16` (test).

### Pillar 5: Spacing (2/4)

- Every spacing value that IS new this phase is a byte-exact match to a declared exception or an existing sibling precedent: `h-[220px] w-[320px]` shell, `size-6`/`size-3.5` remove button, `h-7`/`pointer-coarse:h-11` footer link, `size-11 bg-background/95` toolbar trigger, `w-[26rem]` popover (verified identical to `model-picover.tsx:125`'s `w-[26rem]`), `max-w-[160px]`/`max-w-[72px] sm:max-w-[140px]` trigger truncation — all confirmed against their named analogs. No unjustified arbitrary values.
- **BLOCKER (same root cause as the Visuals finding above, restated in spacing terms) — the fixed-dimension math doesn't reconcile.** The phase's own Judgment Call #1 (`h-[220px]` shell) and footer sizing decision (two actions needing `h-9` vs. `KnowledgePreviewNode`'s single-action `h-7`) together shrink the body's usable content budget to 148px gross / ~84px net-of-`EmptyState`'s-own-padding — well under the ~160px the reused `EmptyState` "compact" recipe actually needs for its icon+heading+body+action stack. This is a genuine, checkable sizing contradiction between two parts of the same contract (the fixed-shell judgment call vs. the "byte-identical `EmptyState` reuse" instruction), not just a subjective spacing-taste issue.

  **Status: FIXED** (2026-07-12) — resolved by abandoning `EmptyState` reuse for this card's error/empty states rather than growing the shell: the fixed `h-[220px] w-[320px]` shell and `h-9` header/footer are untouched, and the new ~90px-tall compact recipe leaves comfortable headroom inside the 148px body budget. Commits: `1a460b9` (fix), `8b70e16` (test).

### Pillar 6: Experience Design (2/4)

- Loading → error → empty → success branch order is correctly implemented (`email-thread-node.tsx:153-189`) and matches the declared precedent. `role="status" aria-label="Loading thread"` present on the skeleton state. Attach-chat in-flight (`Loader2` + `disabled`), toast-error-with-Retry, and the "no success toast, the visible conversation switch IS the confirmation" behavior are all implemented per the Interactive-State Contract (`email-thread-node.tsx:104-126`).
- **BLOCKER — `thread-cluster-indicator.tsx:100-109`'s "Open thread →" popover link has NO focus state at all.** Its className is `"text-xs text-muted-foreground hover:text-accent-foreground"` — no `focus`/`focus-visible` classes whatsoever. This directly violates the Color contract's explicit, unconditional rule: "Focus ring | `focus-visible:ring-ring` | Every interactive element added this phase... never dropped." A keyboard user tabbing to this link gets zero visual feedback that it's focused — a real accessibility break, not a cosmetic nit.

  **Status: FIXED** (2026-07-12) — link now carries `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`, mirroring `EmailThreadNode`'s footer link recipe. Commits: `1a460b9` (fix), `8b70e16` (test).

- **WARNING — same link doesn't guard the pending-data case.** While `threadCardQuery.data` is still loading, `href` resolves to `"#"` with no `aria-disabled`, `pointer-events-none`, or `onClick` guard — unlike `email-thread-node.tsx:192-201`'s equivalent "Open thread" link, which correctly disables via `aria-disabled`/`pointer-events-none`/`opacity-50`/`preventDefault`. Inconsistent handling of the identical loading-state problem between two components governed by the same contract.

  **Status: FIXED** (2026-07-12) — added the same `canOpenThread`-gated `aria-disabled`/`pointer-events-none opacity-50`/`onClick preventDefault` guard as `EmailThreadNode`'s sibling link. Commits: `1a460b9` (fix), `8b70e16` (test).

- **WARNING — `thread-cluster-indicator.tsx:90`'s trigger button uses `focus:outline-none focus:ring-2 focus:ring-ring`** (not `focus-visible:`, and missing `ring-offset-1`) — mirrors `cost-meter.tsx:36`'s pre-existing recipe verbatim (and the UI-SPEC's own Component 3 code snippet shows this same non-`focus-visible` recipe), but it still contradicts the phase's own Interactive-State Contract intro ("Every new element follows... the focus-visible rule unchanged") and the Color contract's "never dropped" language. Lower severity than the missing-entirely case above since a ring IS shown (just on mouse click too, not only keyboard focus), but still a real inconsistency against every OTHER new element in this phase (remove button, footer link/button all correctly use `focus-visible:...ring-offset-1`).

  **Status: FIXED** (2026-07-12) — trigger's ring classes switched to `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`, aligning with every other new interactive element in this phase. `cost-meter.tsx:36`'s identical pre-existing pattern is out of this fix's scope. Commits: `1a460b9` (fix), `8b70e16` (test).
- The overflow/clipping issue documented under Visuals/Spacing also functionally removes the Retry action's reachability in the error state, compounding the state-coverage story here.

---

## Registry Safety

`packages/ui/components.json` exists, but 54-UI-SPEC.md's own Registry Safety table declares zero third-party registry usage this phase ("none (no new installs this phase)" for both the shadcn-official and `@kibo-ui`/`@coss`/`@magicui`/`@tweakcn` rows) — confirmed against the implementation: every primitive consumed (`Popover`, `Command`, `Tooltip`, `Button`, `Skeleton`) is a pre-existing `@polytoken/ui` component, no new imports from a registry path. Registry audit: 0 third-party blocks checked, no flags.

---

## Files Audited

- `.planning/phases/54-email-cluster-workflow-e3/54-UI-SPEC.md` (design contract)
- `.planning/phases/54-email-cluster-workflow-e3/54-04-SUMMARY.md`
- `.planning/phases/54-email-cluster-workflow-e3/54-06-SUMMARY.md`
- `apps/web/src/app/chat/_canvas/email-thread-node.tsx`
- `apps/web/src/app/chat/_canvas/add-email-thread-popover.tsx`
- `apps/web/src/app/chat/_components/thread-cluster-indicator.tsx`
- `apps/web/src/app/chat/_components/tool-round-activity-row.tsx`
- `apps/web/src/app/chat/_components/tool-invocation-result-row.tsx`
- `apps/web/src/app/chat/_canvas/knowledge-preview-node.tsx` (comparison baseline)
- `apps/web/src/app/chat/_canvas/knowledge-preview-mini-graph.tsx` (comparison baseline)
- `apps/web/src/components/empty-state.tsx` (shared primitive, traced for Color/Typography/Spacing findings)
- `apps/web/src/components/provenance-link.tsx` (`hrefFor`/`ProvenanceKind`)
- `apps/web/src/app/chat/_canvas/node-data-schemas.ts`, `node-type-registry.ts`, `node-types.ts`, `canvas-layout.ts` (registry wiring)
- `apps/web/src/app/chat/_canvas/chat-canvas.tsx`, `apps/web/src/app/chat/page.tsx` (mount points)
- `apps/web/src/app/chat/_canvas/add-knowledge-preview-popover.tsx`, `apps/web/src/app/chat/_components/model-picker.tsx`, `apps/web/src/app/chat/_components/cost-meter.tsx` (precedent comparisons)
- `packages/ui/src/button.tsx` (Button variant/size recipe)
- `packages/tailwind-config/web.ts`, `packages/tailwind-config/base.ts`, `apps/web/src/app/globals.css` (token verification: `graph-email`, `rounded-pill`, `shadow-elevation-*`)
- `.claude/skills/polytoken-design-system/SKILL.md`
