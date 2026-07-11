---
phase: 51-total-ui-re-skin
plan: 03
subsystem: ui
tags: [tailwind, design-tokens, react, entities, inbox]

# Dependency graph
requires:
  - phase: 48-token-system-extensions
    provides: "color.graph.* closed palette, color.tier.* ladder, radius.pill — the token surfaces this plan consumes"
  - phase: 51-total-ui-re-skin (51-02)
    provides: "the color.graph.* conversion idiom (bg-{alias}/10 text-{alias} border-{alias}/30 tint recipe) already established on region-overlay-box.tsx/role-picker.tsx/inspector-panel.tsx"
provides:
  - "Inbox entity chips (entity-chips.tsx) on color.graph.entity + radius.pill, closing backlog 999.16's inbox half"
  - "/entities/[id] StatusBadge on the color.tier.* ladder (confirmed->tier-extracted, candidate->tier-inferred), closing backlog 999.16's entities half"
  - "/entities list pages (table/mosaic) + entity-fields.tsx palette-clean (D-49-04 light-touch conversion, no redesign)"
  - "RSKN-06 fully closed (both named sub-scopes); RSKN-02/RSKN-05 remain satisfied"
affects: [51-05, 51-06, 51-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interactive chip pill recipe: rounded-pill Badge call-site override (never editing the shared @polytoken/ui Badge primitive) + neutral-ghost hover (hover:bg-accent hover:text-accent-foreground) + focus-visible:ring-ring/ring-offset-1, matching ProvenanceLink's CHIP_CLASS_NAME"
    - "Confidence-tier badge = solid pair (bg-{tier} text-{tier}-foreground + matching border), not a translucent tint — decorative dots inside a solid-pair badge use the pair's own -foreground token, not the base alias, to stay visible"
    - "'Attention/problem' badges with no named D-49-03 map entry (orange/red raw classes) route to bg-destructive/10 text-destructive — the existing precedent for problem-state UI already used in these same files (ErrorState's border-destructive/text-destructive), not a new alias"

key-files:
  created: []
  modified:
    - apps/web/src/app/_components/entity-chips.tsx
    - apps/web/src/app/entities/[id]/_components/entity-detail.tsx
    - apps/web/src/app/entities/[id]/_components/entity-fields.tsx
    - apps/web/src/app/entities/_components/entities-table.tsx
    - apps/web/src/app/entities/_components/entities-mosaic.tsx

key-decisions:
  - "entities-gallery.tsx read in full; zero raw palette occurrences found (already palette-clean) — left untouched, not force-edited to satisfy the files_modified list"
  - "Table/mosaic StatusBadge 'Confirmed' branch left on its existing bg-primary/10 token (not a palette violation, D-49-04 light-touch scope boundary) — only entity-detail.tsx's StatusBadge was the named RSKN-06 target for the full tier-ladder swap; table/mosaic's 'Candidate' branch was still converted to the same solid tier-inferred pair for app-wide label consistency since raw amber-* there IS a violation"
  - "orange-* ('possible duplicates') and red-* ('conflict') badges classified as destructive-tint (bg-destructive/10 text-destructive) — neither color family is named in the D-49-03 map; destructive is the nearest already-established semantic home for problem/attention states in these exact files"

patterns-established:
  - "Decorative status dots inside a solid {tier}/{alias} badge fill use the paired -foreground token, never the base alias (avoids the dot rendering invisible against an identically-colored fill)"

requirements-completed: [RSKN-02, RSKN-06, RSKN-05]

# Metrics
duration: 11min
completed: 2026-07-11
---

# Phase 51 Plan 03: Entity Chips + StatusBadge Token Burn-down Summary

**Inbox entity chips onto `color.graph.entity` + `radius.pill`, `/entities/[id]` StatusBadge onto the `color.tier.*` confidence ladder, and the `/entities` list pages palette-converted — closing backlog 999.16 in full.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-11T20:42:00Z
- **Completed:** 2026-07-11T20:53:27Z
- **Tasks:** 2 completed
- **Files modified:** 5 (entity-chips.tsx, entity-detail.tsx, entity-fields.tsx, entities-table.tsx, entities-mosaic.tsx; entities-gallery.tsx read but needed no changes)

## Accomplishments
- `entity-chips.tsx`'s 5 raw `violet-*` occurrences converted to `color.graph.entity` (tint recipe: `bg-graph-entity/10 border-graph-entity/30 text-graph-entity`, solid `bg-graph-entity` for the decorative dot), with an explicit `rounded-pill` call-site override (shared Badge primitive untouched) and the neutral-ghost hover/active + `focus-visible:ring-ring` recipe on the interactive chip, matching `ProvenanceLink`'s pill pattern exactly
- `/entities/[id]`'s `StatusBadge` moved off `bg-primary/10`/raw `amber-*` onto the solid `tier-extracted`/`tier-inferred` pairs (confirmed -> tier-extracted, candidate -> tier-inferred), the RSKN-06 "entities half" target
- `/entities` list pages (`entities-table.tsx`, `entities-mosaic.tsx`) and `entity-fields.tsx` palette-converted (D-49-04 light-touch: entity-type badges -> `graph-entity` tint, candidate row/badge -> `tier-inferred`, duplicate/conflict warning badges -> `destructive` tint) with zero structural changes
- Both named sub-scopes of RSKN-06 closed in the same plan; requirement marked complete in `REQUIREMENTS.md`

## Task Commits

Each task was committed atomically:

1. **Task 1: Inbox entity chips -> graph-entity + rounded-pill + hover/active** - `dff4401` (feat)
2. **Task 2: StatusBadge -> tier ladder + /entities pages palette conversion** - `82af00d` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `apps/web/src/app/_components/entity-chips.tsx` - 5 violet-* occurrences -> graph-entity tint/solid; rounded-pill override; neutral-ghost hover + standard focus ring on the interactive chip; static overflow "+N" chip left non-interactive
- `apps/web/src/app/entities/[id]/_components/entity-detail.tsx` - StatusBadge confirmed/candidate -> solid tier-extracted/tier-inferred pairs; decorative dots use the pair's -foreground token
- `apps/web/src/app/entities/[id]/_components/entity-fields.tsx` - "conflict" badge (raw red-100/red-700) -> bg-destructive/10 text-destructive
- `apps/web/src/app/entities/_components/entities-table.tsx` - candidate StatusBadge -> tier-inferred pair; entity-type badge (violet) -> graph-entity tint; display-name dot accent (violet-500) -> bg-graph-entity; candidate-row background tint -> bg-tier-inferred/10; "possible duplicates" badge (orange) -> bg-destructive/10 text-destructive
- `apps/web/src/app/entities/_components/entities-mosaic.tsx` - same 4 conversions as entities-table.tsx (candidate badge, card tint, entity-type badge, duplicates badge), mosaic-card variant

## Decisions Made
- **entities-gallery.tsx needed no edits.** Read in full per the plan's `<read_first>` step; the surface-wide palette grep returned zero matches (the file's only "off-neutral" surfaces are `bg-primary/10` view-toggle buttons — a valid token, not a violation — and the pre-existing `bg-background/70 backdrop-blur-md` header, which is the glassmorphism-ban burn-down's concern, not this plan's, and not on this plan's file list). This matches the plan's own occurrence table, which enumerated "table 5, mosaic 4, detail 2, fields 1" and implicitly 0 for gallery.
- **Table/mosaic "Confirmed" StatusBadge branch intentionally left on `bg-primary/10 text-primary border-primary/20`.** That combination is a valid registered token (not on the banned palette-class list), and D-49-04 scopes these list pages to "palette conversion + register check ONLY, no structural changes" — upgrading it to `tier-extracted` would be a discretionary consistency change beyond the named violation set. Only `entity-detail.tsx`'s StatusBadge was the explicit RSKN-06 target for the full ladder swap. The "Candidate" branch in table/mosaic WAS converted (raw `amber-*` is a genuine violation) and was given the same solid `tier-inferred` pair as `entity-detail.tsx` for app-wide label consistency, since `tier-inferred`'s naturally-light base hue keeps it visually close in weight to the untouched `primary/10` confirmed badge.
- **orange-*/red-* -> `destructive` tint.** Neither color family appears in the UI-SPEC's D-49-03 conversion map (which only names violet/amber/slate-family/white/emerald). Both occurrences ("possible duplicates" in table/mosaic, "conflict" in entity-fields.tsx) signal an attention/problem state. `destructive` is already the established token for problem-state UI in these exact files (`entity-detail.tsx` and `entities-gallery.tsx`'s `ErrorState` both use `border-destructive`/`text-destructive` for "failed to load"/"could not load" messaging) — reused rather than minting a new alias, satisfying the map's own fallback instruction ("use the nearest semantic alias... do not mint a new alias this phase").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StatusBadge decorative dots would render invisible against the new solid badge fill**
- **Found during:** Task 2 (entity-detail.tsx StatusBadge conversion)
- **Issue:** The plan's `<interfaces>` block specifies the badge fill itself as the solid `bg-tier-extracted`/`bg-tier-inferred` alias (not a translucent tint, matching `tier-filter-control.tsx`'s active-segment precedent). The original dots (`bg-primary`, `bg-amber-400`) were solid accents that contrasted against a *lighter, translucent* badge background (`bg-primary/10`, `bg-amber-50`). A literal 1:1 rename (dot = same base alias as the badge fill) would make the dot exactly the same color as its own container — i.e. visually invisible, not merely stylistically different.
- **Fix:** Used the pair's own `-foreground` token for the dot (`bg-tier-extracted-foreground` on the dark-teal confirmed badge, `bg-tier-inferred-foreground` on the light-lavender candidate badge) so the decorative indicator stays visible while the badge as a whole still consumes only the named `tier-extracted`/`tier-inferred` pair (no new alias).
- **Files modified:** `apps/web/src/app/entities/[id]/_components/entity-detail.tsx`
- **Verification:** Visual inspection of the resulting class combinations against the computed token contrast pairs (`--tier-extracted-foreground` on `--tier-extracted`, and vice versa for inferred) — both pairs were purpose-built by Phase 48 for AA contrast, so the dot (same pairing, inverted) reads clearly against the fill.
- **Committed in:** `82af00d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - minor visual bug)
**Impact on plan:** Cosmetic-only fix inside the exact two badges the plan named; no scope creep, no new token, no structural change.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backlog 999.16 (the Phase-48-audit-named off-token chip/badge stragglers) is fully closed — both the inbox-chip half and the entities-StatusBadge half.
- RSKN-06 marked complete in `REQUIREMENTS.md`/`REQUIREMENTS.md` traceability table. RSKN-02/RSKN-05 were already complete from 51-02 and remain satisfied (this plan's inbox-chip work is additive to RSKN-02's thread-inbox scope, not a re-opening).
- `/entities` pages are now palette-clean; no deferred items were logged (every occurrence had a token home — no "mint a new alias" case arose).
- No blockers for sibling Wave-1 plans (51-04..51-07); this plan touched only files in its own `files_modified` list, no shared-primitive edits.

---
*Phase: 51-total-ui-re-skin*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 5 modified source files + this SUMMARY.md confirmed present on disk; both task commits
(`dff4401`, `82af00d`) confirmed present in `git log --oneline --all`.
