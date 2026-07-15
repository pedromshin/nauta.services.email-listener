# Deferred Items — Phase 55

Out-of-scope discoveries logged during plan execution, per the executor's SCOPE BOUNDARY rule
(only auto-fix issues directly caused by the current task's changes).

## 55-02: token-render.spec.ts `/knowledge` test — pre-existing click-interception failure

**Found during:** 55-02 Task 1's elevated-blast-radius regression gate
(`npm run test:e2e -w @polytoken/web --grep "token-render"`).

**Symptom:** `e2e/token-render.spec.ts`'s `/knowledge: minimap container, a graph node, and the
React Flow Controls icon fill all resolve` test times out (60s) on
`page.locator("label", { hasText: "Knowledge Rules" }).click()` — Playwright reports
`<div data-sidebar="content" ...> subtree intercepts pointer events`, i.e. the app sidebar's
scrollable nav content is capturing the click intended for the `/knowledge` filter rail's
"Knowledge Rules" checkbox label.

**Root-cause isolation performed:** Fully reverted all 5 of 55-02 Task 1's files (globals.css +
the 4 neutralized JS configs) back to their exact 55-01 (pre-Task-1, still-HSL/`@config`-bridge)
committed state, then re-ran this exact test in isolation. **The identical failure reproduced on
the unmodified baseline** — confirming this is a pre-existing bug in the test spec's own
interaction sequence (or the `/knowledge` filter-rail/sidebar layering it depends on), not a
regression introduced by the oklch/`@theme`/`@source` port. All 55-02 Task 1 changes were then
restored (`git diff --stat` confirms byte-identical to pre-revert state).

**Why this was never caught before:** `token-render.spec.ts` was authored in 55-01, but Docker
was unreachable in that session (`BLOCKED-ENVIRONMENT`, per 55-01-SUMMARY.md) — this 55-02
session is the first time this spec has ever actually executed against a live browser.

**Supporting evidence this is NOT a color/token regression:** the sibling `/` (inbox) and `/chat`
(canvas) token-render tests both pass cleanly against 55-02's Task 1 changes, exercising the same
`assertRealColor` computed-style assertions across `bg-background`, `text-foreground`, the
`bg-sidebar` family, and the React Flow attribution chrome — all real, non-transparent colors
resolve correctly post-oklch-port.

**Disposition:** Deferred — out of 55-02's scope (not caused by this plan's changes). Needs a
fresh investigation into the `/knowledge` filter-rail's DOM layering / the seeded test fixture's
sidebar-expansion state in a follow-up session, independent of the Tailwind v4 migration.

## 55-02: `packages/genui` `artifacts.test.ts` registryVersion hash drift — pre-existing

**Found during:** 55-02 Task 2's `npm run test -w @polytoken/genui` gate (run to confirm the
`themed-wrapper.tsx`/`tokens.ts` edits didn't regress the genui suite).

**Symptom:** `src/generation/__tests__/artifacts.test.ts`'s committed-vs-fresh
`buildGenuiPromptPayload()` snapshot comparison fails on a `registryVersion.version` hash
mismatch (committed `eaaf8d3e...` vs freshly computed `2562c1fb...`) — unrelated to color/CSS
content; this is a content-hash of the genui component catalog/registry payload sent to Bedrock.

**Root-cause isolation performed:** `git stash`'d all 3 of 55-02 Task 2's `packages/genui/src/theme`
file changes (`themed-wrapper.tsx`, `tokens.ts`, `__tests__/themed-wrapper.test.tsx`) and re-ran
this exact test in isolation against the untouched baseline. **The identical failure reproduced**
— confirming this hash drift pre-exists this plan's changes entirely (not caused by the
`hsl(...)`-wrapping fix or the comment rewording). All 3 files were then restored via
`git stash pop` (`git diff --stat` confirms byte-identical to pre-stash state).

**Disposition:** Deferred — out of 55-02's scope (not caused by this plan's changes; unrelated
to STCK-01's oklch/`@theme`/`@source` surface entirely). The committed `GENUI_PROMPT_PATH`
artifact needs regenerating in a follow-up session against whatever change in the catalog/
registry actually drifted it (not diagnosed here — orthogonal to this plan).
