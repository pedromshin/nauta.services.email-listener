# Phase 32 — UI Review

**Audited:** 2026-07-07
**Baseline:** `.planning/phases/32-knowledge-canvas-tiered-graph-exploration/32-UI-SPEC.md`
**Screenshots:** not captured (no dev server running; static code audit only)
**Status:** ADVISORY (non-blocking)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All locked strings (tier labels, legend, popover, toasts) match verbatim or preserve contract intent |
| 2. Visuals | 3/4 | Layout-toggle button uses a raw Unicode glyph instead of a `lucide-react` icon |
| 3. Color | 3/4 | Tier encoding is exactly token-correct; but `backdrop-blur-md` glassmorphism persists across the whole `/knowledge` surface including the new toolbar, violating the repo's absolute ban |
| 4. Typography | 2/4 | Tier-filter active segment never receives the spec's `text-sm font-semibold` "Heading" treatment — all segments render at the Button default (`text-sm font-normal`) |
| 5. Spacing | 3/4 | Popover uses `space-y-3` (12px), a value not on the declared 4/8/16/24 scale (minor, has a loose precedent elsewhere) |
| 6. Experience Design | 4/4 | Loading pulse (reduced-motion gated), disabled-while-pending promote button, graceful omission of missing confidence/provenance rows, budget-exceeded toast — all implemented per contract |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **Tier-filter active segment has no visual weight differentiation** — `apps/web/src/app/knowledge/_components/tier-filter-control.tsx:79-83` — user impact: the spec's intentional narrow→wide "which segment is active" affordance relies partly on weight (Heading 14px/600 for the active segment vs. Label 12px/400 for inactive ones per `32-UI-SPEC.md` Typography table); as shipped, `Button`'s own default (`text-sm font-normal`, `packages/ui/src/button.tsx:9`) applies uniformly to all three segments regardless of `active`, so the only signal is background color — fix: add `className="text-sm font-semibold"` to the active branch and `className="text-xs"` to the inactive branch (merged with the existing color classes) in `tier-filter-control.tsx`.
2. **`backdrop-blur-md` glassmorphism violates the repo's absolute ban** — `apps/web/src/app/knowledge/_components/graph-toolbar.tsx:42` (also present in `filter-rail.tsx:96`, `node-detail-pane.tsx:373`, `taxonomy-banner.tsx:46`) — user impact: none functionally, but `docs/design/product-register-and-bans.md` item 3 states glassmorphism is banned and explicitly notes "no glassmorphism exception remains in this app" (resolved for `/chat` in Phase 28) — `/knowledge` was apparently never migrated, and this UI-SPEC's own front matter shows `reviewed_at: null` and every Checker Sign-Off row still `PENDING`, meaning this was never actually caught — fix: replace `bg-background/70 backdrop-blur-md` with the Phase-28 precedent `bg-background/95` (solid) across all four files.
3. **Layout-toggle button uses a raw Unicode glyph, not a `lucide-react` icon** — `apps/web/src/app/knowledge/_components/graph-toolbar.tsx:73` (`<span ...>⊞</span>`) — user impact: minor visual inconsistency (font-rendered glyph vs. crisp vector icon) and breaks the app's "one icon set" convention (`lucide-react` only, per Design System table and product-register guidance) — fix: swap for a `lucide-react` icon such as `LayoutGrid`, or since the button is permanently `disabled` with only dagre layout available, consider removing it entirely rather than shipping a placeholder glyph.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- Tier filter segment labels match verbatim: `"Confirmed only"` / `"+ Inferred"` / `"+ Ambiguous"` — `tier-filter-control.tsx:27-29`.
- Legend labels match verbatim: `"Confirmed"` / `"Suggested"` / `"Uncertain"` (never the raw `EXTRACTED`/`INFERRED`/`AMBIGUOUS` enum names) — `graph-legend.tsx:45,47,49`.
- Popover header `"Suggested relationship"` and field labels `"Relation"`/`"Tier"`/`"Confidence"`/`"Source"` match verbatim — `edge-detail-popover.tsx:117,120-130`.
- Promote button label `"Promote to confirmed"` matches verbatim — `edge-detail-popover.tsx:148`.
- Budget-exceeded toast matches verbatim: `"Showing the first 50 related items — narrow the tier filter to see more."` — `knowledge-graph.tsx:392-394`.
- Promote success: no redundant toast — the edge's `tier: "EXTRACTED"` patch (re-styling to solid) IS the confirmation, per contract — `knowledge-graph.tsx:527-539`.
- Promote error toast follows the `"Couldn't promote — {reason}"` shape and never leaks the raw upstream exception (`REJECTION_MESSAGES` map in `apps/web/src/app/api/knowledge/edges/[edgeId]/promote/route.ts:49-53`, upstream `detail` logged server-side only, line 122) — minor: the friendly reason strings ("This suggestion could not be found." / "This suggestion can no longer be promoted.") differ from the spec's literal examples ("Edge not found" / "Edge is not promotable") but satisfy the contract's actual intent (generic, non-leaking, reason-bearing). Not a deduction.
- Confidence/provenance rows are correctly OMITTED (not rendered as `"undefined"`) when absent — `edge-detail-popover.tsx:124,129`.

### Pillar 2: Visuals (3/4)

- Clear focal point: the canvas remains the dominant surface; new controls (tier filter, legend, popover) are additive chrome, not competing focal elements.
- Icon-only buttons are labeled: `aria-label="Zoom to fit"` and `aria-label="Toggle layout"` — `graph-toolbar.tsx:57,68`. `Check`/`Loader2` icons in the promote button are paired with visible text — `edge-detail-popover.tsx:143-148`.
- Visual hierarchy: legend + popover + filter provide redundant (non-color-only) ways to identify tier, matching the spec's accessibility rationale.
- Deduction: `graph-toolbar.tsx:73` renders a raw `⊞` Unicode character for the layout-toggle icon instead of a `lucide-react` icon — inconsistent icon vocabulary (see Top 3 Fix #3).

### Pillar 3: Color (3/4)

- `tier-edge-style.ts` is token-exact against the spec's color table: EXTRACTED untouched (no override), INFERRED = `hsl(var(--muted-foreground))` + `strokeDasharray: "5 3"`, AMBIGUOUS = same stroke + `opacity: 0.45` + `labelStyle opacity: 0.6` — `tier-edge-style.ts:26-48`, matches `32-UI-SPEC.md:113-129` line-for-line.
- Tier-filter active/inactive classes reuse `filter-rail.tsx`'s exact token pair (`border-primary bg-primary text-primary-foreground` / `border-border bg-background text-muted-foreground`) — no new color — `tier-filter-control.tsx:80-83`.
- Promote button is `variant="default"` (the single accent), correctly scoped to the one trust-raising action on the surface — `edge-detail-popover.tsx:138`.
- Tier badges reuse the neutral `bg-muted text-muted-foreground border-border` recipe, AMBIGUOUS at `opacity-60` — `edge-detail-popover.tsx:81-85`, matches spec exactly.
- No raw hex/`rgb()` found anywhere in `apps/web/src/app/knowledge/_components` (grep clean).
- Deduction: `backdrop-blur-md` (glassmorphism) is present in `graph-toolbar.tsx:42` — the file that now hosts the new tier-filter control — plus three sibling files in the same surface. This is an explicit absolute-ban item (#3 in `product-register-and-bans.md`) with no documented exception for `/knowledge`. Pre-existing (not introduced by Phase 32's diff — `git log` shows the toolbar file's blur predates this phase), but it is a live defect in the surface under audit and the UI-SPEC's own Checker Sign-Off table was never actually completed (`reviewed_at: null`, all rows `PENDING`), so it was never caught. See Top 3 Fix #2.

### Pillar 4: Typography (2/4)

- 2-weight discipline holds: grep across `apps/web/src/app/knowledge/_components` found zero `font-medium` occurrences; every file carries an explicit "no font-medium" comment banner.
- Popover typography matches: header `text-sm font-semibold` (`edge-detail-popover.tsx:117`), row labels `text-xs text-muted-foreground` (`DetailRow`, line 69), row values `text-sm` (line 70) — matches the Label/Heading/Body rows in the spec's typography table.
- Deduction (primary): the spec's typography table explicitly separates "tier-filter segment labels" (Label role, 12px/`text-xs`/400) from "toolbar segment active label" (Heading role, 14px/`text-sm`/600 semibold) — i.e., the ACTIVE segment should visually step up to Heading weight/size while inactive segments stay at Label size. As implemented, `Button`'s cva default (`text-sm font-normal`, `packages/ui/src/button.tsx:9`) applies uniformly to all three segments in `tier-filter-control.tsx:71-89` — no size or weight distinction between active and inactive beyond background color. Both the size AND weight rows of the contract are missed for this control. See Top 3 Fix #1.

### Pillar 5: Spacing (3/4)

- `DetailRow` uses `gap-2` (8px), matching the spec's declared `sm` token for "popover internal row gaps" — `edge-detail-popover.tsx:68`.
- `PopoverContent` padding is the unchanged `p-4` (16px) primitive default, matching the spec's `md` token.
- Legend uses `gap-1.5`/`gap-3`/`px-3`/`py-2` — all pre-approved idioms per the spec's explicit note ("every new surface reuses `p-4`/`gap-1.5`/`gap-2`/`px-2`/`py-1.5` idioms already established") — `graph-legend.tsx:22,43`.
- Minor deduction: `edge-detail-popover.tsx:116` wraps its content in `space-y-3` (12px) — not one of the declared 4/8/16/24-point scale values for this phase. A loose precedent exists (`node-detail-pane.tsx:377` uses `gap-3` in its empty state), so this is not a novel invention, but it is not the `sm`/`md` token pairing the spec calls out for "popover internal row gaps" either. Low-severity, does not visibly break rhythm.

### Pillar 6: Experience Design (4/4)

- Loading state: `pendingExpandNodeId` drives `animate-pulse motion-reduce:animate-none` on the clicked node's wrapper, correctly gated for reduced motion — `knowledge-graph.tsx:616-618`, matches the spec's accessibility note on TOKEN-05 precedent.
- Disabled state: promote button gets a real `disabled={pending}` (not just a visual dim), preventing double-submit — `edge-detail-popover.tsx:140`, matches the spec's defense-in-depth requirement.
- Error state: 4xx from promote keeps the popover open and fires a `sonner` error toast with a generic, non-leaking reason — `knowledge-graph.tsx:517-524`.
- Empty/graceful-degradation state: confidence/provenance rows are cleanly omitted (never `"undefined"`) when the data-layer fields are absent — `edge-detail-popover.tsx:124,129`.
- Budget-exceeded state: `result.truncated` triggers the exact specified toast — `knowledge-graph.tsx:391-395`.
- No confirmation dialog for promote (correct — promote is trust-raising, not destructive, per spec).
- Merge/dedupe: `mergeGraph` + re-run `layoutGraph` over the union avoids duplicate nodes/edges on repeated expand-clicks — `knowledge-graph.tsx:378-389`.
- Filter-bypass guard: expand-click results are re-filtered through `tierAllowsEdge` before merging, so a narrowed tier filter can't be silently bypassed by expanding a node — `knowledge-graph.tsx:383-385`, a defensive fix beyond the letter of the spec.

---

## Files Audited

- `.planning/phases/32-knowledge-canvas-tiered-graph-exploration/32-UI-SPEC.md`
- `docs/design/product-register-and-bans.md`
- `apps/web/src/app/knowledge/_components/tier-edge-style.ts`
- `apps/web/src/app/knowledge/_components/tier-filter.ts`
- `apps/web/src/app/knowledge/_components/tier-filter-control.tsx`
- `apps/web/src/app/knowledge/_components/graph-legend.tsx`
- `apps/web/src/app/knowledge/_components/edge-detail-popover.tsx`
- `apps/web/src/app/knowledge/_components/knowledge-graph.tsx`
- `apps/web/src/app/knowledge/_components/graph-toolbar.tsx`
- `apps/web/src/app/api/knowledge/edges/[edgeId]/promote/route.ts`
- `packages/ui/src/button.tsx` (Button primitive default weight/size reference)
