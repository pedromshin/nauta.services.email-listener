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
