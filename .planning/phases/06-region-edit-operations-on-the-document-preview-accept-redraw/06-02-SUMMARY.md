---
phase: 06-region-edit-operations-on-the-document-preview-accept-redraw
plan: "02"
subsystem: api-client
tags: [typescript, trpc, zod, vitest, geometry, mutations, fastapi-proxy]

requires:
  - phase: 06-01
    provides: "Seven FastAPI region-edit endpoints (accept/reject/redraw/split/merge/nest/createRegion) this plan proxies"

provides:
  - "clientXYToNormalized(clientX, clientY, overlayBounds) -> readonly [number, number] — pointer to [0,1] overlay coords"
  - "normalizedRectToPolygon(x0, y0, x1, y1) -> ReadonlyArray<readonly [number, number]> — rect drag to 4-corner polygon"
  - "componentMutationProcedures with 7 tRPC mutations (accept/reject/redraw/split/merge/nest/createRegion)"
  - "getListenerConfig() server-side env guard — reads EMAIL_LISTENER_URL/API_KEY at call time, never at module init"
  - "apps/web/.env.example documenting EMAIL_LISTENER_URL + EMAIL_LISTENER_API_KEY as server-side-only"

affects:
  - "06-03+ (draw-overlay.tsx imports clientXYToNormalized + normalizedRectToPolygon)"
  - "apps/web email-detail.tsx (calls the 7 tRPC mutations for toolbar actions)"
  - "Phase 7 (accept mutation produces candidate regions that autofill operates on)"

tech-stack:
  added: []
  patterns:
    - "Server-side env guard at call time: getListenerConfig() reads process.env inside the function body so Next.js build succeeds without env vars present"
    - "polygonSchema shared across redraw/split/merge/createRegion — z.array(z.tuple([0-1, 0-1])).length(4)"
    - "camelCase input -> snake_case FastAPI body mapping inline in each mutation (page_index, parent_component_id, component_ids)"
    - "TDD RED/GREEN: tests committed before implementation; as const readonly tuples ensure immutability"

key-files:
  created:
    - packages/api-client/src/router/emails/mutations.ts
    - apps/web/.env.example
  modified:
    - packages/api-client/src/geometry.ts
    - packages/api-client/src/geometry.test.ts
    - packages/api-client/src/router/emails/index.ts
    - packages/api-client/tsconfig.json

key-decisions:
  - "getListenerConfig reads env at call time (not module scope) so tsc/build succeed without env vars — mirrors attachments/[id]/route.ts pattern"
  - "polygonSchema defined once and shared across all 4 polygon-bearing mutations"
  - "parseErrorDetail helper extracts FastAPI {detail} from non-2xx responses before throwing"
  - "[Rule 3 - Blocking] Added dom to tsconfig lib — DOMRect not available in es2022-only lib; required for clientXYToNormalized parameter type"

patterns-established:
  - "Server-side tRPC mutation proxy: getListenerConfig guard + fetch + camelCase->snake_case body + error unwrap"
  - "Geometry helper style: pure function, as const readonly tuple/array returns, reuses private clamp, JSDoc contract"

requirements-completed: []

duration: 6min
completed: 2026-06-12
---

# Phase 06 Plan 02: Geometry Helpers + tRPC Mutation Proxy Summary

**Two pure geometry helpers (pointer->normalized, rect->polygon) with vitest TDD coverage, and seven server-side tRPC mutations proxying FastAPI region-edit endpoints using EMAIL_LISTENER_URL + EMAIL_LISTENER_API_KEY — API key never reaches the client bundle.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-12T21:18:30Z
- **Completed:** 2026-06-12T21:24:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `clientXYToNormalized` and `normalizedRectToPolygon` added to `geometry.ts` — pure, immutable (as const), using existing `clamp` helper; reverse-drag normalization via Math.min/max
- 6 new vitest cases (center/clamp-low/clamp-high/immutability for the first; 4-corner + reversed for the second) — all 14 geometry tests pass
- `componentMutationProcedures` with 7 mutations: accept, reject, redraw, split, merge, nest, createRegion — each with zod input validation, server-side env guard, and camelCase→snake_case body mapping
- `emailsRouter` updated to spread `componentMutationProcedures` alongside `emailDetailProcedures`
- `apps/web/.env.example` created with `EMAIL_LISTENER_URL` + `EMAIL_LISTENER_API_KEY` marked server-side only

## Task Commits

1. **Task 1 RED: failing tests** - `19441d6` (test)
2. **Task 1 GREEN: geometry helpers** - `30cf3eb` (feat)
3. **Task 2: mutations + router + .env.example** - `f644b1f` (feat)

## Files Created/Modified

- `packages/api-client/src/geometry.ts` — added `clientXYToNormalized` + `normalizedRectToPolygon` after `polygonToRect`
- `packages/api-client/src/geometry.test.ts` — added 6 new test cases in 2 describe blocks
- `packages/api-client/src/router/emails/mutations.ts` — new file; 7 tRPC mutations with zod validation + server-side fetch
- `packages/api-client/src/router/emails/index.ts` — import + spread of `componentMutationProcedures`
- `packages/api-client/tsconfig.json` — added `"dom"` to lib array (auto-fix)
- `apps/web/.env.example` — new file; EMAIL_LISTENER_URL + EMAIL_LISTENER_API_KEY with server-only comment

## Decisions Made

- `getListenerConfig()` reads env at call time (not module scope) to match the Next.js convention established in `attachments/[id]/route.ts` — build passes without env vars present
- `polygonSchema` defined once at module scope and shared across redraw/split/merge/createRegion rather than inlining the definition in each mutation
- `parseErrorDetail` extracted as a helper to uniformly unwrap FastAPI `{detail}` from non-2xx responses

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added "dom" to tsconfig lib for DOMRect**
- **Found during:** Task 1 GREEN — tsc acceptance-criteria check
- **Issue:** `DOMRect` is a browser DOM type not included in `es2022` lib; `tsc --noEmit` produced 5 errors (geometry.ts line 65 + 4 test lines)
- **Fix:** Added `"dom"` to the `lib` array in `packages/api-client/tsconfig.json`
- **Files modified:** `packages/api-client/tsconfig.json`
- **Verification:** `npx tsc --noEmit` exits 0; all 14 vitest tests still pass
- **Committed in:** `30cf3eb` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for DOMRect type resolution; no behavior change; no scope creep.

## Issues Encountered

None beyond the auto-fixed tsconfig issue.

## Known Stubs

None — mutations.ts makes real HTTP calls to FastAPI; geometry helpers are fully implemented; no placeholder values.

## Threat Flags

None — all security-relevant surface was pre-registered in the plan's threat model:
- T-06-07 (EMAIL_LISTENER_API_KEY server-side only): implemented via `getListenerConfig()` + grep confirms 0 NEXT_PUBLIC_ references
- T-06-08 (zod validation): every mutation validates componentId uuid, polygon 4 [0-1] tuples, pageIndex int>=0, componentIds min(2) before any fetch
- T-06-10 (env at call time): env read inside function body, not module init

## Next Phase Readiness

- Geometry helpers ready for `draw-overlay.tsx` import (`@nauta/api-client/geometry` export already configured in package.json)
- All 7 mutations available as `api.emails.accept/reject/redraw/split/merge/nest/createRegion` via the tRPC client in `apps/web`
- `.env.example` provides the template for local + production env setup

---

*Phase: 06-region-edit-operations-on-the-document-preview-accept-redraw*
*Completed: 2026-06-12*

## Self-Check: PASSED

Files exist:
- `packages/api-client/src/geometry.ts` — FOUND
- `packages/api-client/src/geometry.test.ts` — FOUND
- `packages/api-client/src/router/emails/mutations.ts` — FOUND
- `packages/api-client/src/router/emails/index.ts` — FOUND
- `apps/web/.env.example` — FOUND

Commits exist:
- `19441d6` — test(06-02) RED failing tests
- `30cf3eb` — feat(06-02) geometry helpers GREEN
- `f644b1f` — feat(06-02) mutations + router + .env.example
