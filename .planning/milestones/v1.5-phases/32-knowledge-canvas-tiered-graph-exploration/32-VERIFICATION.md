---
phase: 32-knowledge-canvas-tiered-graph-exploration
verified: 2026-07-08T00:00:00Z
status: human_needed
score: 9/9 must-haves verified (code-level)
overrides_applied: 0
human_verification:
  - test: "Tier line encoding renders visually distinct on /knowledge"
    expected: "EXTRACTED kne- edges look solid/full-opacity; INFERRED edges show a visible dashed stroke in muted color; AMBIGUOUS edges look faint (~45% opacity); structural edges (has_field, instance_of, etc.) look unchanged from before this phase"
    why_human: "Code confirms the correct style objects are computed (tierEdgeStyle unit tests + toFlowEdges branch) but actual pixel rendering, dash spacing legibility, and 'does it look confirmed/suggested/uncertain at a glance' is a visual judgment that requires a live browser"
  - test: "Bounded click-expand: click a knowledge node with neighbours, confirm the pulse ring, the merge animation/placement, and the budget toast when >50 items"
    expected: "Clicked node pulses (animate-pulse) while the tRPC call is in flight; new nodes/edges appear merged into the canvas without existing nodes jumping unexpectedly; re-clicking adds nothing new; a toast appears only when truncated"
    why_human: "Server-side depth clamp/budget cap and client merge/dedupe logic are unit-tested, but the dagre re-layout's visual stability (does the graph 'jarringly reposition' per the UI-SPEC's own caveat) and the real toast appearance require live interaction with materialized data"
  - test: "Tier filter segmented control interaction (mouse + keyboard arrow navigation)"
    expected: "Clicking 'Confirmed only' immediately hides dashed/faint kne- edges while structural edges stay visible; arrow-key navigation moves focus/selection between the three segments per radiogroup convention; active segment shows the primary/teal accent"
    why_human: "tierAllowsEdge's filtering logic is unit-tested and the wiring into initialNodes/initialEdges memos is confirmed in code, but real-time filter responsiveness and keyboard-navigation UX need a live browser"
  - test: "Promote affordance end-to-end: click a suggestion-tier edge, view the popover, click Promote, confirm the edge re-styles to solid; force a 409/404 and confirm the generic error toast"
    expected: "Popover opens anchored near the click point with the locked field order (Relation/Tier/Confidence/Source when available); Promote button shows Loader2 spin + disabled while pending; on success the popover closes and the edge is immediately solid with no page refetch; on 4xx the popover stays open and a generic 'Couldn't promote — {reason}' toast appears (never raw server exception text)"
    why_human: "The proxy route, Zod validation, 4xx-mapping, and client-side optimistic-style patch are all code-verified (including a green build showing the route registered), but the actual live round-trip against a running FastAPI backend, popover anchor positioning at real click coordinates, and toast timing/copy rendering require a live browser + backend"
  - test: "Legend readability and reduced-motion behavior"
    expected: "Bottom-left legend panel shows three swatches with plain labels 'Confirmed'/'Suggested'/'Uncertain' (never raw enum names) that visually match the corresponding edge styles; under prefers-reduced-motion the expand pulse degrades to a static ring instead of animating"
    why_human: "Legend copy strings are grep-verified in code; whether the swatches are visually legible against the canvas background and whether prefers-reduced-motion is honored in a real browser needs manual/OS-level testing"
---

# Phase 32: Knowledge Canvas: Tiered Graph Exploration Verification Report

**Phase Goal:** Reviewers can see and explore the confidence-tiered knowledge graph directly on
`/knowledge` — tier becomes a first-class visual and interaction concept on the canvas, not just a
database column.
**Verified:** 2026-07-08
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/knowledge` renders EXTRACTED edges solid, INFERRED dashed, AMBIGUOUS faint, reusing existing edge-style conventions | ✓ VERIFIED (code-level) | `tier-edge-style.ts` `tierEdgeStyle()` returns exact UI-SPEC-locked style objects (INFERRED: `strokeDasharray:"5 3"` + `hsl(var(--muted-foreground))`; AMBIGUOUS: same stroke + `opacity:0.45`/labelStyle `0.6`; EXTRACTED/undefined: `{}`). `knowledge-graph.tsx` `toFlowEdges` applies this only when `ge.id.startsWith("kne-")`, leaving structural edges untouched. 4/4 `tier-edge-style.test.ts` pass. Visual rendering is a human-verification item (see below). |
| 2 | Clicking a node expands neighbours via a bounded (≤2-hop) server-side query — not unbounded/client-only | ✓ VERIFIED | `expand.ts` `clampDepth` clamps to `[1,2]` (undefined→1, 5→2, 0→1), `capBudget` truncates to ~50 nodes and drops orphaned edges, `walkKnowledgeGraph` is a pure BFS with all I/O behind an injected tenant-scoped callback. `expandNode` procedure is a read-only `.query`, joins on the seed's `importerId` for tenant scope, fail-closes on unknown/inactive seed. Registered in `index.ts`. Wired via `utils.knowledge.expandNode.fetch` in `knowledge-graph.tsx`'s `handleNodeClick` → `mergeGraph` (dedupe-by-id) → `layoutGraph`. 15/15 `expand.test.ts` + 5/5 `graph-merge.test.ts` pass. |
| 3 | A tier filter control narrows to EXTRACTED-only or widens to include suggestions | ✓ VERIFIED | `tier-filter.ts` `tierAllowsEdge` — structural edges always pass; kne- edges pass by cumulative tier rank against filter state; unknown tier defaults to widest-only. `tier-filter-control.tsx` `TierFilterControl` renders `role="radiogroup"`/`role="radio"` with the exact locked labels "Confirmed only"/"+ Inferred"/"+ Ambiguous", arrow-key navigation, and reuses filter-rail's active/inactive token pair (no new color). Wired into `initialNodes`/`initialEdges` memos AND (per the 32-03 cross-plan fix) into the expand-merge path, so the filter can no longer be bypassed by expand-clicking. 6/6 `tier-filter.test.ts` pass. |
| 4 (plan-added) | Suggestion-tier edges get a promote affordance (Phase-30 closure) | ✓ VERIFIED | `edge-detail-popover.tsx` renders the exact locked field order/copy; `route.ts` reads `EMAIL_LISTENER_API_KEY` server-side only (grep confirms zero client-importable reference); Zod-validates edgeId + importerId; maps 404/409/403 to generic REJECTION_MESSAGES; never returns raw upstream `detail`. `knowledge-graph.tsx` wires `onEdgeClick` to open only for `kne-` + INFERRED/AMBIGUOUS edges, and `handlePromote` patches local edge state to EXTRACTED on 2xx (no refetch) / toasts generic error on 4xx. |

**Score:** 4/4 roadmap success-criteria truths + 9/9 plan-level must-haves verified at the code level (artifacts exist, are substantive, wired, and unit-tested). All 5 items above additionally carry a browser-level visual/interaction dimension that could not be exercised by this static/automated verification pass — routed to human verification below, consistent with this project's established pattern (e.g. Phase 29 verification).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api-client/src/router/knowledge/expand.ts` | `expandNode` read-only tRPC procedure + `clampDepth`/`capBudget` pure helpers | ✓ VERIFIED | Present, substantive, registered in `index.ts` via `...knowledgeExpandProcedures` |
| `packages/api-client/src/router/knowledge/expand.test.ts` | DB-free tests | ✓ VERIFIED | 15/15 passing |
| `apps/web/src/app/knowledge/_components/graph-merge.ts` | Pure dedupe-by-id merge | ✓ VERIFIED | `mergeGraph` present, immutable (no mutation of inputs), idempotent |
| `apps/web/src/app/knowledge/_components/graph-merge.test.ts` | Merge tests | ✓ VERIFIED | 5/5 passing |
| `apps/web/src/app/knowledge/_components/tier-edge-style.ts` | Pure tier→style map | ✓ VERIFIED | `tierEdgeStyle` matches UI-SPEC Color table exactly |
| `apps/web/src/app/knowledge/_components/tier-edge-style.test.ts` | Style tests | ✓ VERIFIED | 4/4 passing |
| `apps/web/src/app/knowledge/_components/tier-filter.ts` | Pure tier-visibility predicate | ✓ VERIFIED | `tierAllowsEdge` + `TierFilterState` present |
| `apps/web/src/app/knowledge/_components/tier-filter.test.ts` | Filter tests | ✓ VERIFIED | 6/6 passing |
| `apps/web/src/app/knowledge/_components/tier-filter-control.tsx` | 3-segment radiogroup | ✓ VERIFIED | Exact locked labels, `role="radiogroup"`/`role="radio"`, arrow-key nav |
| `apps/web/src/app/knowledge/_components/graph-legend.tsx` | Legend panel | ✓ VERIFIED | Plain labels "Confirmed"/"Suggested"/"Uncertain", reuses `tierEdgeStyle` (single source of truth) |
| `apps/web/src/app/knowledge/_components/edge-detail-popover.tsx` | Suggestion-edge popover + Promote button | ✓ VERIFIED | Contains exact strings "Suggested relationship"/"Relation"/"Tier"/"Confidence"/"Source"/"Promote to confirmed"; rows 4-5 conditionally omitted, never render "undefined" |
| `apps/web/src/app/api/knowledge/edges/[edgeId]/promote/route.ts` | Server-side-keyed promote proxy | ✓ VERIFIED | `X-API-Key` injected server-side only (grep-confirmed no client leak); Zod-validated; 404/409/403 mapped to friendly generic messages; appears in `npm run build` route list as `ƒ /api/knowledge/edges/[edgeId]/promote` |
| `packages/api-client/src/router/knowledge/graph.ts` | GraphEdge confidence + provenance payload | ✓ VERIFIED | `confidence`/`provenanceSummary` added to `GraphEdge`, `buildProvenanceSummary` derives safe plain-text summary from closed `source` enum (never raw jsonb) |
| `packages/api-client/src/router/knowledge/graph.test.ts` | Extended tests | ✓ VERIFIED | 21/21 passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `knowledge-graph.tsx` | `api.knowledge.expandNode` | `utils.knowledge.expandNode.fetch` in `handleNodeClick` | ✓ WIRED | Fires on same click as selection; merges via `mergeGraph`; re-lays-out via `layoutGraph` |
| `expand.ts` | `KnowledgeNodeEdges` | BFS select over active edges, importer join | ✓ WIRED | `innerJoin(KnowledgeNodes, sourceNodeId → importerId)`, `isActive=true` filter |
| `knowledge-graph.tsx` | `tierEdgeStyle` | `toFlowEdges` applies style when id startsWith `kne-` | ✓ WIRED | Confirmed at line ~159 |
| `knowledge-graph.tsx` | `tierAllowsEdge` | edge-level filter in `initialNodes`/`initialEdges` memos AND expand-merge path | ✓ WIRED | Confirmed at lines ~318/331/384 — the 32-03 cross-plan fix closing 32-02's documented gap is present in the actual code, not just claimed in the summary |
| `edge-detail-popover.tsx` | `/api/knowledge/edges/[edgeId]/promote` | `fetch POST` in `knowledge-graph.tsx`'s `handlePromote` | ✓ WIRED | kne- prefix stripped before POST |
| `apps/web/.../promote/route.ts` | `POST /v1/knowledge/edges/{id}/promote` | server-side fetch with `X-API-Key` | ✓ WIRED | Confirmed; key read at request time only |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| expand.test.ts passes | `npx vitest run src/router/knowledge/expand.test.ts` (packages/api-client) | 15/15 passed | ✓ PASS |
| graph.test.ts passes (incl. 32-03 additions) | `npx vitest run src/router/knowledge/graph.test.ts` | 21/21 passed | ✓ PASS |
| graph-merge.test.ts / tier-edge-style.test.ts / tier-filter.test.ts pass | `npx vitest run` (apps/web, 3 files) | 15/15 passed | ✓ PASS |
| packages/api-client typecheck | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| apps/web typecheck | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| apps/web production build | `npm run build --workspace=@nauta/web` | succeeded, 13/13 static pages, promote route registered, `/knowledge` 1.77 kB | ✓ PASS |
| No raw hex introduced | grep `#[0-9a-fA-F]{3,6}` across 4 new tier/popover/legend files | no matches | ✓ PASS |
| API key never client-reachable | grep `EMAIL_LISTENER_API_KEY`/`NEXT_PUBLIC.*API_KEY` across `apps/web/src` | only server route files + comments reference the var name; no client-importable module reads it | ✓ PASS |
| No debt markers in phase files | grep TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER across all 10 phase-touched files | no matches | ✓ PASS |
| FilterRail untouched by tier concerns | grep `TierFilterControl`/`tier-filter` in `filter-rail.tsx` | no matches (correctly separated) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GRAPH-01 | 32-02 | Tiered edge visual encoding | ✓ SATISFIED (code-level) | `tier-edge-style.ts` + `toFlowEdges` wiring, unit-tested |
| GRAPH-02 | 32-01 | Bounded click-to-expand | ✓ SATISFIED | `expand.ts` + `graph-merge.ts` + click wiring, unit-tested |
| GRAPH-03 | 32-02 | Tier filter control | ✓ SATISFIED | `tier-filter.ts` + `tier-filter-control.tsx`, unit-tested, applied to both initial-load AND expand-merge paths |
| TIER-03 (Phase-30 UI closure) | 32-03 | Promote affordance reachable from UI | ✓ SATISFIED | Popover + proxy route + wiring, code-verified |

No orphaned requirements found — REQUIREMENTS.md maps only GRAPH-01/02/03 to Phase 32, and all three plans declare and satisfy them.

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers, no raw hex, no client-side secret leakage, no empty/stub implementations found in any of the 14 phase-touched files.

### Cross-Plan Gap Verification

32-02-SUMMARY.md documented a known scope gap: the GRAPH-02 expand-merge path did not re-apply the GRAPH-03 tier filter, so an expand-click while filtered to "Confirmed only" could surface INFERRED/AMBIGUOUS edges. 32-03-SUMMARY.md claimed this was fixed. This verification independently confirmed the fix is actually present in `knowledge-graph.tsx`'s `expandNode` callback (`filteredMergedEdges = merged.edges.filter((e) => tierAllowsEdge(e, tierFilter))`, applied before `layoutGraph`/`setNodes`/`setEdges`) — not just claimed in the summary.

### Human Verification Required

See YAML frontmatter `human_verification` — 5 items covering: tier line visual distinctness, expand pulse/merge/toast behavior, tier filter live interaction, promote end-to-end round trip against a running backend, and legend/reduced-motion rendering. All are browser-rendering or live-backend behaviors that automated static/unit-test verification cannot exercise, consistent with this project's established human-verification pattern (e.g. Phase 29).

### Gaps Summary

No code-level gaps found. All 3 roadmap success criteria (GRAPH-01/02/03) plus the plan-added promote-affordance closure are implemented, tested (36 api-client + 15 web unit tests, all green), type-clean (`tsc --noEmit` clean in both packages), and build-clean (`npm run build --workspace=@nauta/web` succeeds with the new promote route registered). The one previously-documented cross-plan integration gap (tier filter bypass via expand-click) was independently confirmed fixed in the actual code, not just claimed. Remaining uncertainty is entirely in the visual/interactive dimension that requires a live browser and a running backend — routed to human verification rather than marked as a gap.

---

_Verified: 2026-07-08_
_Verifier: Claude (gsd-verifier)_
