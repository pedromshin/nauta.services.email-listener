---
phase: 52-editable-genui-panels-studio-on-canvas
verified: 2026-07-12T03:30:00Z
status: human_needed
score: 17/17 must-haves verified (code-level)
overrides_applied: 0
human_verification:
  - test: "Pack switch on a real canvas panel (PANL-01)"
    expected: "Switching the toolbar Select re-themes the panel immediately; reloading the page shows the persisted pack"
    why_human: "Requires a running dev stack (Docker/FastAPI) and a real browser render — Docker/WSL was down this session, per 52-CONTEXT.md's environment-constrained posture"
  - test: "Param edit save + re-render on a real card/grid panel (PANL-02)"
    expected: "Editing a whitelisted field and saving round-trips through genui.applyPanelEdit and the panel re-renders with the new value"
    why_human: "Requires a live tRPC/Next.js server; only mocked in vitest this session"
  - test: "Regenerate against real FastAPI + Bedrock (PANL-03)"
    expected: "Clicking Regenerate produces a real new spec variant (not a mocked genui.generate response) and swaps the panel content in place"
    why_human: "FastAPI/Bedrock round-trip requires the stack up; genui.generate was mocked in all vitest coverage this session"
  - test: "Version history + restore on a real panel (PANL-03)"
    expected: "History popover lists prior versions with correct icon/verb/relative time; Restore reappends a new active version and the panel content reverts, with nothing deleted"
    why_human: "Visual/interaction confirmation on a real rendered panel; unit-tested with mocks only"
  - test: "NL re-theme against real Bedrock (PANL-04)"
    expected: "Typing an instruction and clicking Apply look calls the real genui.resolveRetheme -> real Bedrock forced-tool-use -> a validated {pack, overrides} that visibly re-themes the panel, with the 'Panel re-themed' toast"
    why_human: "One real Bedrock smoke call was made directly against the Python adapter (documented in 52-05-SUMMARY.md, live-verified there), but the FULL client->tRPC->FastAPI->Bedrock round trip through a real browser was not exercised — Docker/FastAPI down this session"
---

# Phase 52: Editable Genui Panels / Studio-on-Canvas Verification Report

**Phase Goal:** Canvas genui panels become live editing surfaces instead of read-only renders — a
user can re-theme, tweak, and regenerate a panel in place.
**Verified:** 2026-07-12T03:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All 17 truths below are **code-level VERIFIED** (artifact exists, is substantive, is wired, and is
covered by a passing automated test I re-ran myself). None were accepted on SUMMARY.md's word alone.
The phase's own environment-constrained posture (Docker/WSL/FastAPI down all session) means the
LIVE-BROWSER confirmation of these same truths is still outstanding — see Human Verification below,
which is why overall status is `human_needed`, not `passed`.

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can switch a panel's `style_pack_id` from a per-panel control; choice persists across reloads (PANL-01, roadmap SC1) | VERIFIED | `pack-switcher.tsx` implements optimistic apply + `writeOverlay(setPack(...))`; `panel-overlay-context.tsx`'s `usePanelOverlay` persists via `scheduleSave`; overlay lives at `shared.panelOverlays.{panelId}`, the ONLY namespace `toCanvasStoreSeed` rehydrates (confirmed in `canvas-store-context.tsx` contract cited by 52-01-PLAN.md). `genui-panel-node-toolbar.test.tsx` proves a seeded overlay pack renders `--primary` on first mount with no interaction. `pack-switcher.test.tsx` (4/4 green) covers optimistic set + revert-on-failure + toast. |
| 2 | A pack-switch failure reverts the Select and toasts with Retry | VERIFIED | `pack-switcher.tsx` `applyPack` catch block reverts `pendingPackId` + calls `toast.error("Couldn't switch style — try again.", { action: {...} })` — verbatim UI-SPEC copy; test asserts this path. |
| 3 | User can tweak a panel's spec parameters through a bounded, schema-driven editing surface — no free-form JSON (PANL-02, roadmap SC2) | VERIFIED | `edit-params-control.tsx` computes `editableFieldsFor(root.type)` (card/section/stack/grid whitelist only) and renders `Input`/`Textarea`/`Select`/`Input type=number` rows per the UI-SPEC field-type mapping — no JSON textarea exists anywhere in the file (grepped). `edit-params-control.test.tsx` (5/5 green). |
| 4 | Saving routes through the same untrusted-input gate as FOUND-6 (`SpecRootSchema.safeParse` server-side); invalid → friendly banner, never partial apply | VERIFIED | `panel-edit.ts`'s `applyPanelEditProcedure` re-parses `currentSpecJson` via `SpecRootSchema.safeParse`, applies only whitelisted params via `applyWhitelistedParams`, and re-validates the patched result before returning `{ok:true}` — never echoes raw errors to the client (`logError` server-side only). `panel-edit-schema.test.ts` (13/13) + `panel-edit.test.ts` (7/7) green, re-run directly. |
| 5 | A successful param save appends an `edit` version (supersede-never-mutate) and the panel re-renders with the new params | VERIFIED | `edit-params-control.tsx` on `ok:true` calls `writeOverlay(appendVersion(overlay, { generatedBy: "edit", ... }))`; `appendVersion` (panel-overlay.ts) is a pure append — spreads `base.versions` into a NEW array, never mutates. Test asserts `writeOverlay` called with an `edit` version carrying the new title. |
| 6 | A panel whose root type has no editable params shows the edit button disabled with the correct tooltip | VERIFIED | `edit-params-control.tsx`: empty `fields` array renders the icon-button `disabled` with `TooltipContent` "This panel has no editable parameters" — exact UI-SPEC copy; asserted by test (text-root case). |
| 7 | User can regenerate a panel variant in place, with provenance retained and the prior version reachable (PANL-03, roadmap SC3) | VERIFIED | `regenerate-control.tsx` derives an intent via `deriveIntent`, calls `api.genui.generate`, and on a non-fallback outcome appends a `regenerate` version (with `stylePackId` threaded through, a documented Rule-2 auto-fix preventing a pack regression) via `appendVersion`. `regenerate-control.test.tsx` (7/7 green) covers success/fallback/no-data/isLocked. |
| 8 | While regenerating, the panel shows GeneratingRing + spinning icon + accessible busy label; a failure toasts and leaves the current version unchanged | VERIFIED | `RegenerateControl` sets `aria-label="Regenerating panel"` + `motion-safe:animate-spin` on the icon while pending, calls `onGeneratingChange(true)` which the panel shell (`genui-panel-node.tsx`) forwards into `<GeneratingRing active={generating}>`; on fallback outcome fires `toast.error(REGENERATE_ERROR_COPY, {action:{Retry}})` without calling `writeOverlay`. |
| 9 | Version History popover lists prior versions newest-first with per-provenance icon+verb+relative time, a Current row, and an empty state | VERIFIED | `version-history-control.tsx` renders a permanent "Current" row, maps `listPriorVersions(overlay)` (newest-first, excludes active) to rows with `VERB_ICONS`/`formatRelativeTime`, and the exact empty-state copy "No earlier versions yet — changes will appear here." when there are none. `version-history-control.test.tsx` (5/5 green). |
| 10 | Restoring a prior version reappends it as a new active version (supersede-never-mutate); nothing is ever deleted | VERIFIED | `restoreVersion` (panel-overlay.ts) clones the target version's content into a BRAND-NEW version, sets it active, and returns `{ ...overlay, versions: [...overlay.versions, cloned] }` — the original array entry is never removed or rewritten. Test asserts the versions array GROWS and none are removed. |
| 11 | A promptable NL re-theme instruction resolves, via one Bedrock forced-tool-use call, to a `{style_pack_id, token_overrides}` envelope; one-shot, no repair loop (PANL-04, roadmap SC4) | VERIFIED | `genui_retheme_adapter.py`'s `GenuiRethemeAdapter` makes exactly ONE `AsyncAnthropicBedrock` forced-tool-use call (`emit_retheme`), no loop; `resolve_retheme.py`'s `ResolveRethemeUseCase` never raises and never retries. 22/22 Python tests (`test_resolve_retheme.py` + `test_genui_retheme_adapter.py`) re-run directly, all pass. `ruff check` clean. One real Bedrock smoke call is documented + verified live in 52-05-SUMMARY.md (found + fixed a real malformed `radius` value mid-session, proving the regex gate is load-bearing). |
| 12 | LLM output is treated as untrusted and schema-validated (known pack id + allow-listed override keys + HSL/raw-value format) at the tRPC web boundary; invalid → friendly fallback, never partial | VERIFIED | `retheme.ts`'s `RethemeResolutionSchema` (`.strict()` inner `TokenOverridesSchema`) re-validates `style_pack_id` against `STYLE_PACK_IDS` and each override key/value against `ALLOWED_OVERRIDE_KEYS` + per-key regexes, REGARDLESS of what FastAPI's own `outcome` claimed. `retheme.test.ts` (19/19 green, re-run) explicitly covers unknown-pack, disallowed-key, malformed-HSL, non-2xx, network-error, and missing-data-field all degrading to `{ok:false}` with no leaked raw error text (confirmed via captured stderr logs during the run). |
| 13 | A user can type a ≤280-char NL instruction with a live counter and apply it | VERIFIED | `retheme-control.tsx`: `Textarea maxLength={280}` + `handleInstructionChange` slices to 280 defense-in-depth + `{instruction.length}/280` counter. `retheme-control.test.tsx` Test 1 asserts a 300-char input is capped to exactly 280 with the counter reading `280/280`. |
| 14 | Applying calls resolveRetheme and, on success, appends a `retheme` version carrying the resolved pack + overrides (content unchanged), re-themes in place, shows "Panel re-themed" toast | VERIFIED | `retheme-control.tsx`'s `handleApply` calls `api.genui.resolveRetheme` (D-06 `useQuery(enabled:false)+refetch` idiom) and on `{ok:true}` calls `writeOverlay(appendVersion(overlay, {generatedBy:"retheme", specJson: activeSpecJson (unchanged), stylePackId, tokenOverrides, instruction}))` then `toast.success("Panel re-themed")`. Test asserts this exact shape. |
| 15 | An invalid/failed resolution shows the inline error banner with instruction preserved (form stays open) — never a partial or silent apply | VERIFIED | On `{ok:false}` `retheme-control.tsx` renders the banner "Couldn't apply that look — try describing it differently." and does NOT call `writeOverlay`; instruction state is untouched. Test explicitly asserts `writeOverlay` was never called and the typed text remains. |
| 16 | The resolved pack + token overrides visibly re-theme the panel through PanelThemeScope | VERIFIED | `retheme-apply-integration.test.tsx` (1/1, re-run green) seeds a canvas store with a `retheme` VERSION (pack `playful-rounded` + a `primary` override), mounts the REAL `GenuiPanelNode`, and asserts the rendered wrapper's inline `--primary` equals the OVERRIDE value, not the pack's own base value — proves `resolveActivePanel -> PanelThemeScope` is load-bearing. |
| 17 | The panel's rendered content resolves from its overlay (active version if any, else base spec) and themes by the resolved pack; PanelThemeScope wraps only the genui_spec branch | VERIFIED | `genui-panel-node.tsx`: `const resolved = resolveActivePanel(overlay, specJson, isStreaming)`; `resolved.specJson` feeds `GenuiPartBoundary`; `PanelThemeScope packId={resolved.packId} tokenOverrides={resolved.tokenOverrides}` wraps only the non-interactive-widget branch. Directly read and confirmed in the file (lines 127-207). |

**Score:** 17/17 code-level truths verified. 0 failed. 5 items require live human/browser verification (see below) before the phase can be called fully `passed`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/web/src/app/chat/_canvas/panel-overlay.ts` | Overlay schema + 6 pure helpers | VERIFIED | `PanelOverlaySchema`/`PanelVersionSchema` (both `.strict()`), `resolveActivePanel`/`setPack`/`appendVersion`/`restoreVersion`/`listPriorVersions`/`parseOverlay` all present, immutable (spread-only), read directly. |
| `apps/web/src/app/chat/_canvas/panel-theme-scope.tsx` | CSS-var theming wrapper | VERIFIED | `PanelThemeScope` merges `getStylePack(packId).resolvedVars` + `tokenOverrides`, zero raw hex/palette classes; `panel-theme-scope.test.tsx` 4/4 green. |
| `apps/web/src/app/chat/_canvas/panel-overlay-context.tsx` | `usePanelOverlay` + `CanvasPersistenceProvider` | VERIFIED | Present; `panel-overlay-context.test.tsx` 4/4 green. |
| `apps/web/src/app/chat/_canvas/panel-actions-toolbar.tsx` | `role="toolbar"` row composing pack-switcher + 4 controls | VERIFIED | `role="toolbar" aria-label="Panel actions"` present; mutual-exclusion lock (`busyAction`) + `isStreaming` force-lock implemented; owns generating-signal forwarding. |
| `apps/web/src/app/chat/_canvas/controls/pack-switcher.tsx` | PANL-01 optimistic Select | VERIFIED | Fully implemented, not a stub (see Truth 1/2). |
| `apps/web/src/app/chat/_canvas/controls/edit-params-control.tsx` | Parameter Editor Popover | VERIFIED | Fully implemented, not the Plan-02 skeleton (grep confirms no "Interface-first skeleton" comment remains). |
| `apps/web/src/app/chat/_canvas/controls/regenerate-control.tsx` | One-click Regenerate | VERIFIED | Fully implemented. |
| `apps/web/src/app/chat/_canvas/controls/version-history-control.tsx` | History popover + Restore | VERIFIED | Fully implemented. |
| `apps/web/src/app/chat/_canvas/controls/retheme-control.tsx` | NL Re-theme popover | VERIFIED | Fully implemented. |
| `apps/web/src/app/chat/_canvas/genui-panel-node.tsx` | Toolbar mount + overlay-resolved spec + theme wrap + GeneratingRing shell + `min-h-[272px]` | VERIFIED | All present, read directly (lines 82-238); `min-h-[272px]` confirmed; `.node-drag-handle` h-9 row untouched. |
| `packages/api-client/src/router/genui/panel-edit-schema.ts` | Whitelist + `applyWhitelistedParams` | VERIFIED | Present, pure, DB-free; 13/13 tests green. |
| `packages/api-client/src/router/genui/panel-edit.ts` | `genui.applyPanelEdit` server gate | VERIFIED | Registered in `genui/index.ts`; 7/7 tests green. |
| `packages/api-client/src/router/genui/retheme.ts` | `genui.resolveRetheme` + `RethemeResolutionSchema` | VERIFIED | Registered; 19/19 tests green; authoritative web-boundary gate confirmed by direct read. |
| `apps/email-listener/app/domain/ports/retheme_resolver.py` | `RethemeResolverPort` + `ALLOWED_OVERRIDE_KEYS` | VERIFIED | Present. |
| `apps/email-listener/app/application/use_cases/resolve_retheme.py` | `ResolveRethemeUseCase` | VERIFIED | Present, never raises, coerces unknown packs, filters disallowed keys — read directly. |
| `apps/email-listener/app/infrastructure/llm/genui_retheme_adapter.py` | Bedrock forced-tool-use adapter | VERIFIED | Present; one call, no loop. |
| `apps/email-listener/app/presentation/api/v1/genui.py` | `POST /v1/genui/retheme` route | VERIFIED | `@router.post("/retheme")` confirmed via grep. |
| `apps/email-listener/app/container.py` | DI wiring | VERIFIED | `_provide_genui_retheme_adapter`/`_provide_resolve_retheme_use_case` registered. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `pack-switcher.tsx` | `usePanelOverlay(panelId).writeOverlay` + `setPack` | `onValueChange → writeOverlay(setPack(overlay, id))` | WIRED | Confirmed by direct read + passing test. |
| `genui-panel-node.tsx` | `resolveActivePanel` + `PanelThemeScope` | resolves active spec/pack, wraps ScrollArea body | WIRED | Confirmed by direct read (lines 127-207). |
| `edit-params-control.tsx` | `api.genui.applyPanelEdit` → `appendVersion(edit)` | save → procedure → writeOverlay | WIRED | Confirmed by grep + test. |
| `panel-edit.ts` | `SpecRootSchema` + `applyWhitelistedParams` | parse, apply, re-validate | WIRED | Confirmed by direct read. |
| `regenerate-control.tsx` | `api.genui.generate` → `appendVersion(regenerate)` | generate → writeOverlay | WIRED | Confirmed by direct read + test. |
| `version-history-control.tsx` | `restoreVersion` + `listPriorVersions` | restore click → writeOverlay | WIRED | Confirmed by direct read + test. |
| `retheme.ts` | FastAPI `POST /v1/genui/retheme` | fetch + `RethemeResolutionSchema.safeParse` | WIRED | Confirmed by direct read; server route exists. |
| `resolve_retheme.py` | `RethemeResolverPort` (Bedrock) | `resolver.resolve(...)` | WIRED | Confirmed by direct read + one real Bedrock smoke call (52-05-SUMMARY.md). |
| `retheme-control.tsx` | `api.genui.resolveRetheme` → `appendVersion(retheme)` | apply → resolveRetheme → writeOverlay | WIRED | Confirmed by direct read + test. |
| `resolveActivePanel(retheme version)` | `PanelThemeScope` | version.stylePackId/tokenOverrides → inline CSS vars | WIRED | Confirmed by `retheme-apply-integration.test.tsx` (re-run, green) — proves the FULL chain end to end at the unit level. |

### Behavioral Spot-Checks / Test Re-Runs (executed directly by this verifier, not taken from SUMMARY claims)

| Suite | Command | Result | Status |
|---|---|---|---|
| Full `_canvas` vitest suite | `npm run test -w @polytoken/web -- _canvas --run` | 25 files / 193 tests passed | PASS |
| api-client genui boundary tests | `npm run test -w @polytoken/api-client -- panel-edit-schema.test.ts panel-edit.test.ts retheme.test.ts --run` | 3 files / 39 tests passed | PASS |
| Python retheme resolution tests | `cd apps/email-listener && uv run pytest app/application/use_cases/__tests__/test_resolve_retheme.py app/infrastructure/llm/__tests__/test_genui_retheme_adapter.py -q --no-cov` | 22/22 passed | PASS |
| Committed design gates | `npm run test -w @polytoken/web -- palette-ban.test.ts token-contrast.test.ts token-registration.test.ts --run` | 12/12 passed | PASS |
| Web typecheck (outside pre-existing `app/dev/design` scratch exclusion) | `npx tsc --noEmit -p apps/web/tsconfig.json` | 0 errors outside `app/dev/design` (55 pre-existing errors confined entirely to that untracked scratch dir, confirmed by direct grep) | PASS |
| api-client typecheck | `npm run typecheck -w @polytoken/api-client` | Clean | PASS |
| Python lint | `uv run ruff check` on the 3 new retheme files | All checks passed | PASS |
| DB migration check | `git log --name-only` since phase start | Zero migration files touched | PASS (matches "no migration tonight" commitment) |
| Debt-marker scan | grep `TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER` across all 19 phase-touched source files | 0 matches | PASS |
| Stub-residue scan | grep "Interface-first skeleton" across `controls/*.tsx` | 0 matches (all 4 skeletons genuinely replaced) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PANL-01 | 52-01, 52-02 | Switch style pack in place, persists across reloads | SATISFIED | Truths 1-2; REQUIREMENTS.md marks Complete — confirmed accurate. |
| PANL-02 | 52-03 | Bounded schema-validated param editing, FOUND-6 gate | SATISFIED | Truths 3-6; REQUIREMENTS.md marks Complete — confirmed accurate. |
| PANL-03 | 52-04 | Regenerate in place + provenance + version history/restore | SATISFIED | Truths 7-10; REQUIREMENTS.md marks Complete — confirmed accurate. |
| PANL-04 | 52-05, 52-06 | NL re-theme resolves to pack/token choices, no repair loop | SATISFIED | Truths 11-16; REQUIREMENTS.md marks Complete — confirmed accurate. |

No orphaned requirements: REQUIREMENTS.md's Phase 52 row lists exactly PANL-01..04, and every plan's frontmatter `requirements` field accounts for one of them (52-01/52-02 → PANL-01; 52-03 → PANL-02; 52-04 → PANL-03; 52-05/52-06 → PANL-04).

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no "not yet implemented"/"coming soon" strings, no residual "Interface-first skeleton" inert controls, in any of the 19 files this phase created/modified. All four Plan-02 skeleton controls were confirmed genuinely replaced with working implementations by Plans 03/04/06.

### Human Verification Required

The phase's own environment (Docker/WSL/FastAPI down the entire session) meant every mutation path was
verified against mocked transports (`api.genui.generate`, `api.genui.resolveRetheme`, `api.genui.applyPanelEdit`)
in vitest, plus one real direct-to-Bedrock Python smoke call (documented in 52-05-SUMMARY.md, not
routed through the full client→tRPC→FastAPI stack). This is an honest, deliberate deferral — not a
fabricated pass — and is already queued to `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md`
§G item 5, consolidating all five actions into one runsheet entry. That queued item is reproduced here
as the phase's outstanding human-verification gate:

### 1. Pack switch on a real canvas panel

**Test:** Open a chat conversation with a genui-spec panel on the canvas; switch the toolbar's style-pack Select.
**Expected:** The panel re-themes immediately; reloading the page shows the choice persisted.
**Why human:** Requires the dev stack up (Docker/FastAPI) and a real browser render.

### 2. Param edit save + re-render

**Test:** Open the parameter editor popover, edit a whitelisted field, Save.
**Expected:** The panel re-renders with the new value via a real `genui.applyPanelEdit` round-trip.
**Why human:** Requires a live Next.js/tRPC server; only mocked in this session's tests.

### 3. Regenerate against real FastAPI + Bedrock

**Test:** Click Regenerate on a real panel.
**Expected:** A real `genui.generate` call (live Bedrock) swaps the panel's content in place.
**Why human:** `genui.generate` was mocked in every vitest test this session; no live call was made from the client path.

### 4. Version history + restore

**Test:** Open the History popover, click "Restore version" on a prior entry.
**Expected:** Prior versions list correctly (icon/verb/relative time); restoring reverts the visible content and appends a NEW version (nothing deleted).
**Why human:** Visual/interaction confirmation on a real rendered panel; unit-tested with mocks only.

### 5. NL re-theme against real Bedrock (full client round trip)

**Test:** Open the Re-theme popover, type an instruction, click "Apply look".
**Expected:** A real `genui.resolveRetheme` call resolves through Bedrock to a validated `{pack, overrides}` that visibly re-themes the panel; "Panel re-themed" toast shows.
**Why human:** One real Bedrock smoke call was made directly against the Python adapter (52-05-SUMMARY.md) and found + fixed a real malformed-value bug — good evidence the resolution pipeline works — but the FULL client→tRPC→FastAPI→Bedrock path through a real browser was never exercised this session.

### Gaps Summary

No code-level gaps. All 4 requirements (PANL-01..04) are genuinely implemented, wired end-to-end, and
covered by passing automated tests that I re-ran myself (not merely cited from SUMMARY.md): 193 web
vitest tests in `_canvas`, 39 api-client boundary tests, 22 Python tests, 12 committed design-gate
tests — all green, zero anti-patterns, zero stub residue, zero new migration. The two-belt validation
for the highest-risk surface (untrusted LLM output resolving to CSS custom properties) is real and
independently proven: the Python use case filters/coerces, and the tRPC `RethemeResolutionSchema` is
the authoritative re-validator, demonstrated live catching a real malformed `radius` value during the
session's one permitted Bedrock smoke call.

The phase is held at `human_needed` rather than `passed` purely because the environment could not
support a live-browser, live-stack confirmation of the five PANL actions tonight (Docker/WSL/FastAPI
down all session, an honestly-documented and pre-declared constraint in 52-CONTEXT.md, not a
discovered gap). This is exactly the kind of check that cannot be verified programmatically and must
be exercised by a human against a running stack — the phase's own plans already queued it to
`MORNING-CHECKLIST.md` §G item 5 rather than fabricating a pass, which this verification confirms is
present and complete.

---

_Verified: 2026-07-12T03:30:00Z_
_Verifier: Claude (gsd-verifier)_
