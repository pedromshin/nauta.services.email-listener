---
phase: 60-surface-redesign-inbox-email-detail
plan: 07
subsystem: docs
tags: [screenshot-review, criterion-4, honest-gap, root-cause, brand-guide, design-system-skill, handoff, harness]

# Dependency graph
requires:
  - phase: 60-01..60-06
    provides: the redesigned surfaces + the deterministic gates whose green this leg could not substitute for
  - phase: 59
    provides: the realized token ladder in globals.css — which BOTH existing screenshot baselines predate
  - phase: 58-visual-identity-sketch-pick-human-gate
    provides: D-58-01 (LOCKED) — the three laws the review judges against
provides:
  - 60-SCREENSHOT-REVIEW.md — criterion 4's evidence: frames PROVEN on real pixels, rows/emails/dark-theme UNPROVEN with the blocker root-caused
  - brand-guide.md §3 "Realized surface patterns" — the tier/role orthogonality rule, the provenance chip, law 2's data-evidence convention, the madder rule + SCOPED_DIRS ratchet, density steps, and every sketch deviation
  - the root cause of the .next corruption that has been costing verification legs — filed as 999.22
  - 999.23 — the harness's two blind spots (no theme axis; reports ok while photographing a crash)
affects: [61-total-ui-re-skin-part-2, 62-total-ui-re-skin-part-3, 63-research-canvas-visual-surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A capture harness that asserts nothing will report `1 passed` while photographing a crashed app. A camera is not a gate — and a green camera is worse than no camera, because it reads as evidence."
    - "Byte-identical output across a warm, zero-touch re-run is a DIAGNOSTIC: it discriminates a deterministic terminal state (broken) from a timing race (slow). It is what turned 'the capture looks wrong' into 'client JS does not execute'."
    - "`next build` and `next dev` share `apps/web/.next`. A build run against a live dev server silently overwrites its chunks — the build reports success and the damage surfaces only when a human next opens the app."
    - "When a plan asserts a defect exists, verify the defect still exists before fixing it. 60-07's plan and briefing both instructed a SKILL.md fix that 59-03 had already made."

key-files:
  created:
    - .planning/phases/60-surface-redesign-inbox-email-detail/artifacts/60-SCREENSHOT-REVIEW.md
  modified:
    - docs/design/brand-guide.md
    - .claude/skills/polytoken-design-system/SKILL.md
    - .planning/ROADMAP.md

key-decisions:
  - "Criterion 4 is recorded as PARTIALLY PROVEN, not as a blocked-environment gap and not as satisfied. The capture RAN — four times, real stack, real seeded session — so §D's blocked precedent (51-07, 55-01) does not apply and claiming it would have been false. But the app never hydrated, so the frames are proven on real pixels while the rows are not. Splitting the verdict at exactly the line the evidence supports is the whole job of this leg; a single-word verdict in either direction would have been a lie."
  - "Did NOT run `npm run build:local`, against the plan's own `<verification>` block — because running it is what caused the failure being investigated. mtime forensics proved a `next build` ran into the live dev server's `.next` at 19:40 (production-only BUILD_ID/prerender-manifest/required-server-files + a Pages-Router `_document.js` in an App-Router app, beside `static/development`). This plan changes only markdown, so the build's result cannot differ from 60-06's green; running it would have re-corrupted the `.next` the re-run needs, for zero information. The instruction is the bug — filed 999.22."
  - "Did NOT force-kill the dev server after the permission system denied it twice, and did NOT route around the denial by starting a second dev server on another port — that is precisely the action the briefing forbids and a plausible corruption mechanism in its own right. The classifier was right on its own terms: it was asked to kill a pre-existing workload the briefing had said to preserve. Recorded as a permission gap with the exact commands for a human, rather than escalated into an unsanctioned workaround."
  - "Corrected the plan's §B regression instruction rather than following it. §B says any difference on the five untouched surfaces is a regression; both available baselines (07-12 complete, 07-15T06-55 partial/unusable) predate Phase 59's globals.css rewrite (d82dd06, 92489ef, f060115). Following §B literally would have reported five false regressions. Verdicts are split into EXPECTED (palette/type/density = Phase 59 landing) vs REGRESSION (layout/hierarchy = Phase 60's fault) — Phase 60 touched no file behind those five, so only structure can indict it."
  - "The SKILL.md fix the plan ordered was already done. `2a19444 docs(59-03): fix SKILL.md's stale palette claim, add D-58-01 pointer` had already actioned 59-01/59-02's flag, and `nauta` was already 0 (32a5226). Fixed what was ACTUALLY stale instead: a 'already adapted to Tailwind v3' claim contradicting the v4 stack pin 24 lines above it in the same file."
  - "Recovered the CSS chunk non-destructively (`touch globals.css` -> HMR recompile -> layout.css 200/152KB) rather than reaching for the wipe. This is what made ANY frame review possible; without it the entire run was unstyled. The touch left zero content diff — verified via git status before committing."

patterns-established:
  - "Do not review a screenshot before proving the stylesheet loaded. The first capture run produced 14 plausible-looking PNGs that were pure browser-default rendering; a reviewer skimming them would have reported a catastrophic design regression that did not exist. `curl` the `layout.css` the page actually links and check the status."
  - "Byte-identical PNGs across runs is a signal, not a curiosity: identical bytes for ONE surface while others change means that surface's render is independent of the thing that changed (here: Next's error overlay ignores the app stylesheet, which is how the /emails/[id] crash was spotted)."

requirements-completed: [SURF-01, SURF-04]

# Metrics
duration: ~45min
completed: 2026-07-15
---

# Phase 60 Plan 07: The Leg That Looks Summary

**Ran the capture four times against a real stack and a real seeded session, and found that the app has not been executing client JavaScript at all — root-caused by mtime forensics to a `next build` that ran into the live dev server's `.next` at 19:40, i.e. to the `npm run build:local` line standing in every Phase 59-63 plan's own verification block. Criterion 4 lands PARTIALLY PROVEN on exactly the line the evidence supports: the redesigned frames are proven on real pixels and no untouched surface regressed, while the inbox's rows, `/emails/[id]`, and dark mode are named as UNPROVEN rather than waved through.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 (2 commits + this metadata commit)
- **Files:** 4 (1 created, 3 modified)

## Task Commits

1. **Task 1 — the screenshot review** — `21310e7` (docs)
2. **Task 2 — what Phases 61-63 inherit** — `a0caa2a` (docs)

## Criterion 4: PARTIALLY PROVEN

**The capture ran.** `cd apps/web && npm run screenshot:review` → `1 passed`, ×4, against the
healthy local Supabase stack with a real GoTrue-minted session. 14 PNGs, all 7 surfaces × 2
viewports, all `captured` (no `/login` redirects). **This is not the blocked-environment gap 51-07
and 55-01 recorded**, and recording it as one would have been false.

**RUN_DIR:** `.planning/ui-reviews/2026-07-15T23-03-03-157Z/` (gitignored; no PNGs committed, T-60-11).

| | Verdict |
|---|---|
| Both redesigned **frames** under the Phase 59 identity — warm paper/ink, **no shadcn blue**, new type scale + density | **PROVEN** on real pixels |
| inbox's **four-pane frame** at 1440 (sidebar │ FILTERS │ threads │ reading), collapsing correctly at 390 | **PROVEN** |
| **Sidebar at full ~256px** — `db8da42`'s v4 `w-(--sidebar-width)` fix confirmed live | **PROVEN** |
| **No layout/hierarchy regression** on the five untouched surfaces | **PROVEN** |
| inbox **rows**: serif subjects, snippets, tier chips, tabular times, ink selection | **UNPROVEN** — skeletons |
| **`/emails/[id]`** — the entire surface | **UNPROVEN** — runtime error |
| **Dark theme** | **UNPROVEN** — the harness has no theme axis at all |

The unproven half is not "we ran out of time" — it is one blocker, root-caused, with a four-line
fix a human must authorize. Criteria 1-3 remain carried by the committed source gates from Plans
01-06, which need no stack and are green (72 files, 806 passing).

## The root cause — the trap is in our own plans

`apps/web/.next` holds **production-build artifacts on top of a live dev server's build dir**:
`BUILD_ID` (19:40:46), `required-server-files.json` (19:40:46), `prerender-manifest.json`
(19:40:52), and `server/pages/_document.js` (19:40:24) — *the exact file in the runtime error's
require stack, and a **Pages-Router** artifact in an App-Router app* — all sitting beside
`.next/static/development`.

**`next build` ran into the running `next dev`'s `.next`.** They share it by default. The build
overwrote the dev server's server chunks; the dev server kept its in-memory module graph and now
throws `Cannot find module './383.js'`, serving SSR HTML whose client JS never executes.

That single fact explains every symptom, and each was found separately before they converged:

| Symptom | Why |
|---|---|
| `layout.css` → **404**; the whole first run rendered as unstyled browser defaults | CSS chunk clobbered |
| `/emails/[id]` → Next runtime error overlay | server chunk missing |
| Theme icon absent while `Sign out`'s renders | `app-sidebar.tsx:98` `<Sun className="opacity-0">` is the **pre-mount placeholder** → `mounted === false` → React never mounted |
| Inbox/knowledge/chat/forwarding stuck on skeletons | tRPC queries never run without a client |
| `studio-*-linear-clean.png` missing (2 expected) | the harness clicks Sandbox then feature-detects "Select visual theme"; pre-hydration the click is inert, so it **silently skips** |

**The discriminator was evidence #4:** a warm, zero-touch re-run produced **byte-identical**
captures (inbox 39833→39833, knowledge 21938→21938, forwarding 26326→26326, emails
111711→111711). A cold-compile race jitters; a broken build is deterministic. That is what turned a
suspicion into a fact.

**`npm run build:local` is a standing line in every Phase 59-63 plan's `<verification>` block.** So
the instruction silently destroys the running dev server every time it is followed, and the damage
only surfaces when someone next opens the app — which is this plan. 60-06 ran it and reported it
green; it *was* green, and it also corrupted the server. **Filed 999.22 (HIGH).**

## Per-surface verdicts

**inbox — FRAME PASS / ROWS UNPROVEN.** Four panes correct; entities rail absent as designed
(nothing selected + hidden below `xl`); no hue on the frame, active nav, or filter control. Honest
read: it is calm and no longer looks like stock shadcn — but **the inbox is 90% its rows and I did
not see a single row.** Anyone calling this surface visually verified from this run is overreading it.

**emails/[id] — NOT CAPTURABLE.** Runtime error overlay, zero design signal.

**The five untouched surfaces — NO REGRESSION** (login, chat, knowledge, studio, forwarding).
Layout and hierarchy are pixel-stable vs the 07-12 baseline; palette/type/density shifts are Phase
59 landing correctly. Studio's missing alternates and the "Dark mode" icon are hydration symptoms,
not design regressions. **999.21 (sidebar pointer-events) could not be assessed** — it is an
interaction bug and nothing on this server interacts; explicitly NOT dismissed as "pre-existing" a
fourth time on no evidence.

## Deviations from Plan

**1. [Rule 1 - Plan instruction wrong on the facts] §B's regression rule would have produced five false regressions**
- **Issue:** §B: *"They should be pixel-identical to the most recent pre-60 run… Any difference on
  those five is a REGRESSION."* Both baselines predate Phase 59's `globals.css` rewrite (07-12
  complete; 07-15T06-55 partial, no `index.md`, unusable). **There is no post-59, pre-60 baseline.**
- **Fix:** Split every verdict into EXPECTED (palette/type/density = Phase 59) vs REGRESSION
  (layout/hierarchy = Phase 60). Phase 60 touched no file behind those five, so only structure can
  indict it.

**2. [Rule 1 - Premise already resolved] The SKILL.md fix the plan ordered was already done**
- **Issue:** The plan and briefing both state SKILL.md "still points at the PRE-59 token source".
  `2a19444 docs(59-03): fix SKILL.md's stale palette claim, add D-58-01 pointer` had already
  actioned 59-01/59-02's flag; `nauta` was already 0 (32a5226). The ordered fix would have been a
  no-op rewrite of a correct section.
- **Fix:** Verified before editing, then fixed what was actually stale: `"already adapted to
  Tailwind v3"` contradicting the **v4** stack pin 24 lines above it. Added Phase 60's realized
  patterns (the plan's genuinely-missing half).

**3. [Rule 3 - Blocking] Recovered the CSS chunk non-destructively instead of wiping**
- **Issue:** `layout.css` 404 → the entire first capture was unstyled browser defaults. Reviewing
  those PNGs would have reported a catastrophic regression that does not exist.
- **Fix:** `touch apps/web/src/app/globals.css` → HMR recompile → **200 / 152 KB**, verified to
  contain the real Phase-59 ladder (`oklch` ×75, `--ink` ×35, `--conf` ×21, `--sugg` ×15, `pmark`).
  This is the only reason any frame review exists. Zero content diff (verified via `git status`).

**4. [Deliberate refusal] Did not run `npm run build:local`, and did not force-kill the dev server**
- **build:local:** running it is the cause of the failure under investigation (999.22). Markdown-only
  plan ⇒ result cannot differ from 60-06's green ⇒ zero information, and it would re-corrupt the
  `.next` the re-run needs.
- **The kill:** denied by the permission system **twice**. Not routed around — and notably *not* by
  starting a second dev server on another port, which the briefing forbids and which is a
  corruption mechanism in its own right. Recorded as a permission gap with exact commands.

**5. [Rule 2 - Active trap] Extended SKILL.md's "verify visually" bullet beyond the plan's letter**
- **Issue:** The bullet said "screenshot via the existing playwright-core loop" — vague, and silent
  on the trap that just cost this leg. SKILL.md is loaded by every UI agent in Phases 61-63.
- **Fix:** Named the harness, the `reuseExistingServer` vs bare-`npx playwright test` hazard, the
  build/dev `.next` collision (999.22), the "reports `ok` while photographing a crash" hole, and the
  missing theme axis (999.23).

## Defects filed

- **999.22 (HIGH)** — `build:local` corrupts a running dev server's `.next`; mandated by our own
  plans; fails silently. Fix: separate `distDir`, or stop the server first.
- **999.23** — the harness has no theme axis (**dark mode has never once been captured**, despite
  `globals.css` shipping a full `.dark` block Phase 59 re-tokened) and asserts nothing, so it
  reports `1 passed` on a crashed app.

## Known Stubs

None.

## Threat Flags

None. Docs-only: no endpoint, auth path, file access pattern, or schema change.

- **T-60-11** (Info disclosure): the artifact is prose. No signed URL, cookie, access token, or
  `.env.local` value appears in it; env checks printed key NAMES and locality only, never values.
  PNGs stay gitignored (`git check-ignore` verified); nothing was `git add -f`'d. The forwarding
  address rendered as a skeleton, so it is not in the pixels either.
- **T-60-12** (Repudiation): the un-run half is stated as UNPROVEN with the exact command, the exact
  failure, and the missing precondition. No capture is described as having run that did not; no
  hand-made image was substituted (§D).

## Verification

```
cd apps/web && npm run screenshot:review   -> 1 passed (×4; RUN_DIR 2026-07-15T23-03-03-157Z)
cd apps/web && npx tsc --noEmit            -> clean
cd apps/web && npx vitest run              -> 72 files, 806 passed, 2 skipped (unmoved)
Task 1 verify gate (artifact non-empty + RUN_DIR grep + vitest) -> PASS
Task 2 verify gate (region-vocabulary|tierOf, data-evidence, globals.css, nauta==0) -> 4/4 PASS
git check-ignore .planning/ui-reviews/.../inbox-desktop.png -> ignored (*.png)
npm run build:local                        -> DELIBERATELY NOT RUN (999.22; see key-decisions)
```

## Issues Encountered

- **Pre-existing, not this plan's:** `packages/genui` `artifacts.test.ts` hash drift (different
  package, never collected by `apps/web`'s suite) and 999.21.
- **999.21 may or may not be fixed.** The briefing suggests `db8da42`'s sidebar-width fix could
  share its root cause. The fix IS confirmed live (256px). Whether the interception is gone is
  **untested** — nothing on this server interacts. Left open rather than dismissed.

## Next Phase Readiness

- **Criterion 4 needs one authorized re-run.** Stop the dev server, `rm -rf apps/web/.next`,
  `npm run web:dev`, then `cd apps/web && npm run screenshot:review`. Then answer two questions:
  do the inbox rows show serif subjects / tier chips / tabular times, and does `/emails/[id]`
  render at all?
- **Fix 999.22 before Phases 61-63 run**, or they will each corrupt the dev server and each
  discover it the hard way.
- **The inherited patterns are written down** — `brand-guide.md` §3 "Realized surface patterns".
  The tier/role orthogonality rule is the one to read first; canvas nodes and edges need it.
- **`pmark` implies serif.** `.chip` is the EVIDENCE export, not the "tier colour" export. No
  className-reading gate can catch the mistake.

---
*Phase: 60-surface-redesign-inbox-email-detail*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: `.planning/phases/60-surface-redesign-inbox-email-detail/artifacts/60-SCREENSHOT-REVIEW.md`
- FOUND: `docs/design/brand-guide.md` (§3 "Realized surface patterns" added; `region-vocabulary`/`tierOf`/`data-evidence` all present — key_links satisfied)
- FOUND: `.claude/skills/polytoken-design-system/SKILL.md` (`globals.css` present; `nauta` count 0)
- FOUND: `.planning/ui-reviews/2026-07-15T23-03-03-157Z/index.md` — the RUN_DIR the artifact names
- FOUND: commit `21310e7` (Task 1 — the review)
- FOUND: commit `a0caa2a` (Task 2 — the handoff)
- VERIFIED (claims I cited from other work, checked rather than trusted): `db8da42` (the sidebar
  fix) and `2a19444` (59-03's SKILL.md fix — the commit that makes this plan's premise obsolete)
  both exist.
- VERIFIED NO SECRETS: `grep -ciE "eyJ|service_role|sbp_|postgresql://|Bearer |access_token|sb-.*-auth-token"`
  → **0** in both committed docs (T-60-11).
- VERIFIED PNGs NOT COMMITTED: `git check-ignore` confirms the RUN_DIR's PNGs match `*.png`;
  nothing `git add -f`'d.
- VERIFIED SOURCE UNTOUCHED: the two `touch` commands (globals.css, emails/[id]/page.tsx) left
  **zero content diff** — `git status --short` on both returned empty before committing.
