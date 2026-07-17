# Phase 66 — /files vault, screenshot review (the first eyes on this surface)

**Reviewed:** 2026-07-17, post-merge, by the orchestrator.
**Run:** `.planning/ui-reviews/2026-07-17T11-04-55-955Z/` — `files-{desktop,mobile}-{light,dark}.png`
**Status of the surface:** wired (`files: filesRouter` in root.ts), bucket `user-files` created and
verified `public: false`, nav entry live, ratchet extended. Suite 85 files / 1073 passing, tsc clean.

Lane D built this without ever rendering it (no dev server in a worktree, jsdom does no layout). Its
SUMMARY said so plainly and named three things a human must look at. This is that look.

## Verdict: it is designed, not generic — with two real flaws, one of which is mine to escalate

### What is right, on real pixels

- **The identity holds in both themes.** Warm paper ground, ink primary, zero stock-shadcn blue.
  The ink button *inverts correctly* in dark (dark fill → light fill) — that is the ladder working,
  not luck.
- **The empty state TEACHES**, exactly as `taste-references.md` §2 demands: *"Drop a file anywhere
  to start your vault"* + an upload affordance. It names the next action instead of announcing
  emptiness. Compare the anti-pattern it dodged: "No files yet."
- **No tree, no details rail.** The planner overrode my briefing here (I said use `@kibo-ui/tree`;
  the taste doc bans a tree without real folder depth, and move/copy is out so a tree earns
  nothing). On the pixels this reads as calm rather than sparse — one pane, not three.
- **Law 1 holds:** nothing on the surface is madder. The only madder in the phase is the delete
  dialog's confirm fill, and the scoped law gate counts it to exactly one file.

### Flaw 1 — "Files / Files" at root (ESCALATED, not fixed)

`page.tsx:33` renders `<h1>Files</h1>` in a 48px bordered title bar; `vault-surface.tsx:271`
renders `<BreadcrumbPage>Files</BreadcrumbPage>` directly beneath it. At the vault root the surface
says its own name twice, 59px apart, and the top bar is otherwise empty.

**Why I did not just fix it:** the title bar is a *cross-surface convention* — Lane D copied the
shape from `knowledge/page.tsx`, and every surface has one. And the duplication only exists at
ROOT: inside a folder the breadcrumb reads `Files / Photos`, which the title bar does not repeat.
So the honest fix is a **design decision about where a route's name lives across the whole app**
(title bar vs. breadcrumb root), not a one-line patch to this file. Making that call unilaterally
at 08:15 while the user is travelling would be exactly the "generic by default" move they are
trying to stop.

**Recommendation when the user weighs in:** the breadcrumb is strictly better — it names the
location *and* navigates, and it is already the only element that stays correct at depth. The
title bar's h1 should become `sr-only` (keeping the a11y landmark) and the bar itself should either
carry the surface's actual controls or disappear. That is ~5 lines per surface and should be a
Phase 62 sweep item, since 62 already owns /knowledge, /studio, /settings and /login.

### Flaw 2 — the empty card is a large dead box

The empty state is a ~280px-tall bordered card with its content floating in the middle and ~500px
of dead page beneath it. It does not read as *centered-card-with-shadow syndrome* (there is no
shadow, and the border is `border-rule`, not a stock outline) — but it is a big empty rectangle
whose only job is to hold one sentence and one button. `taste-references.md` §6's anti-generic list
warns about exactly this shape.

**Not fixed, deliberately:** the same card is the container the *populated* vault renders rows
into, so its height is not empty-state-specific and shrinking it would be styling the empty case at
the populated case's expense. The right test is a vault with 20 files in it — which needs the
fixture work below.

## What is still unproven, plainly

- **Every capture is the EMPTY state.** The bucket was created minutes ago and contains nothing, so
  no row, no breadcrumb-at-depth, no upload progress, no drag-accept, no delete dialog has been
  seen by anyone. The three things Lane D's SUMMARY asked a human to look at — the drag-accept
  (rise vs. strobe), the empty state (teaching vs. lonely card), and dark-mode madder — only the
  last two are answerable from these frames.
- **This is 999.24/999.25's shape again**, one surface later: the harness photographs whatever
  state the fixture leaves, and an unseeded fixture means the interesting surface is invisible. The
  inbox needed a seeded email; the chat needed a seeded turn; the canvas needed a seeded layout.
  **The vault needs a seeded file tree** — `seedVaultFixture()` alongside `seedChatThreadFixture`,
  uploading 3-4 objects and a nested folder to `{userId}/`. Until then "the vault renders" means
  "the vault's empty state renders."
- **Nothing here proves upload works.** The procedures are unit-tested against a mocked storage
  client; the real bucket has never received a byte through the UI.

## UPDATE — 999.37 done: the POPULATED vault, and a false alarm I raised myself

`seedVaultFixture()` now seeds a real tree (3 files + a `Receipts/` folder with a nested file) into
the bucket through the production chokepoint — `vaultKey`/`emptyFolderPlaceholderKey`, never
hand-built strings, so the fixture cannot drift from the rule it exercises. Captured in both themes:
`.planning/ui-reviews/2026-07-17T11-29-40-792Z/files-desktop-{light,dark}.png`.

**What the populated surface actually shows, verified:** folder-first ordering, the folder row
correctly carrying no size/date, file sizes and dates as `tabular` metadata in sans (law 2 — file
names are metadata, not evidence), kind-by-geometry glyphs (never hue, law 3), and the whole thing
inverting cleanly in dark.

### The false alarm — worth recording, because I raised it

Reading the PNGs, I reported "every row wears a heavy 2px ink border — the list reads as if
everything is selected" and "a broken empty sliver column on the right edge", and I suspected the
drag-accept state (`border-ink`) was stuck on. **All of that was wrong.** Measuring the live DOM:

| Element | Reality |
|---|---|
| pane | `rounded-card border` — **1px**, `oklch(0.821 0.021 100.6)` = `--rule`, i.e. the IDLE state |
| rows | `border-b border-hair` — `oklch(0.883 0.018 99.6)` = `--hair` |
| geometry | pane `x=336 w=1024`, rows `x=337 w=1022` — correctly nested, 1px inset per side |

No stuck drag, no overflow, no sliver. I was eyeballing a scaled-down PNG and reading 1px warm
hairlines as heavy ink rules.

**The nuance this adds to this milestone's own lesson.** Eleven bugs shipped through green suites
because nobody looked at the rendered thing — that stands. But looking is not the terminus:
*pixels catch what gates cannot see, and measurement catches what pixels make you imagine.* The
same discipline that found the 11,296px scroll and the stock navy handles also produced this false
positive, and only `getComputedStyle` settled it. Two failures in one night from trusting a
confident read — this one, and Lane D's dropzone report (see DIRECTIVES → Correction log). Both
were caught by measuring rather than by arguing.

## Recorded for the backlog

- **999.37 — DONE** (this update). `seedVaultFixture` is wired into the harness.
- **999.38 — route-name duplication across surfaces** (flaw 1, "Files / Files" at root). Phase 62
  sweep candidate — it is an app-wide convention decision, not a one-file patch.
- **Still unproven:** upload has never moved a byte through the UI; drag-accept, upload progress and
  the delete dialog remain unseen (they need interaction, not a fixture). The seeded tree makes the
  *listing* reviewable — it does not make the *writes* reviewed.
