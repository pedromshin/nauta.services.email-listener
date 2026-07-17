# Git Safety + Parallel-Agent Protocol

Measured against this repo's actual state on 2026-07-17. This report is descended from — and
consistent with — the protocol already embedded in `.planning/night-run/NIGHT-RUN-2026-07-16.md`
§"Protocols" (which cites this file by name). Treat that section as already-ratified; this report
is the fuller design + evidence behind it.

## 1. Measured facts

**Remotes/branches/tags**
- `origin` = `https://github.com/pedromshin/polytoken.ai.git` (repo was renamed from
  `nauta.services.email-listener`; local dir name is stale, harmless).
- `main` local == `origin/main`, 0 ahead / 0 behind — confirmed in sync at report time
  (HEAD `fa3df7c9`).
- `origin/backup/night-2026-07-16` exists and matches `main` at the point it was cut — the
  "push all local work" step in NIGHT-RUN.md (165 commits + this backup branch + tags v1.7/v1.8)
  already happened.
- All 8 tags (v1.2–v1.9) are pushed to origin (`git ls-remote --tags` confirms v1.7–v1.9 present
  remotely with dereferenced `^{}` objects, i.e. annotated and reachable).
- `dev` branch exists locally and remotely, tracks `origin/dev`, last commit `bdebf09` —
  behind `main`; it is the staging-deploy branch (see workflows below), not a work branch.
- One stale **local-only** branch: `backup/pre-squash` (points at old `ab7a80a`, phase-11 era,
  never pushed). Harmless but should eventually be deleted or pushed — currently it's dead
  weight nobody will find in a disaster-recovery scenario since it's not on origin.

**.gitignore coverage**
- Secrets: `.env`, `.env.local`, `.env.*.local`, `.env.staging`, `.env.production`, and a
  catch-all `.env*` (line 57) — verified no `.env*` files are tracked except the three
  `*.env.example` templates (intentional, contain no secrets). Terraform state/vars also ignored.
- Build/verify artifacts: `apps/web/.next/` and `apps/web/.next-verify/` both ignored (the
  verify-build dir split that prevents `build:local` from corrupting a live `next dev` server —
  documented in NIGHT-RUN.md trap list). `packages/api-client/dist/`, `*.tsbuildinfo` also
  ignored.
- UI-review screenshots: **not** covered by the root `.gitignore` but by a nested
  `.planning/ui-reviews/.gitignore` (`*.png`, `*.webp`, `*.jpg/jpeg`, `*.gif`, `*.bmp`,
  `*.tiff` — "Screenshot files — never commit binary assets"). This works: every PNG in the
  ~30 untracked `.planning/ui-reviews/<timestamp>/` dirs is filtered out by `git status`. But
  each dir's `index.md` (and any other non-image sidecar file) is **not** ignored and would be
  swept in by a broad `git add`. Right now none of those dirs are staged/tracked — they show as
  `??` (fully untracked), so no leak has happened, but a careless `git add .` inside one of
  these dirs would commit `index.md` files (low risk — no secrets in them, just review notes —
  but still repo clutter GSD conventions don't want committed per that gitignore's own comment).
- Gap: no root-level ignore for `.planning/debug/*.png` — one such PNG
  (`sidebar-after-fix.png`) is currently sitting untracked at the top of `git status`. Not
  covered by any `.gitignore`; if committed it's a one-off binary, not a systemic leak, but the
  convention established by `ui-reviews/.gitignore` isn't applied repo-wide to `.planning/debug/`.
- No `.gitattributes` file exists anywhere in the repo. `core.autocrlf` is `false` locally.
  This is the direct cause-class for the "10,848-line phantom diff" incident: with no
  `.gitattributes` forcing `text=auto eol=lf`, line-ending behavior is whatever each
  contributor's/agent's local `core.autocrlf` happens to be. RETROSPECTIVE.md independently
  documents a near-identical prior incident (v1.6: "CRLF/LF line-ending churn in `.planning`
  files caused two fix commits by different agents with opposite conventions — verifier later
  established the repo is LF at byte level"). This is a recurring failure mode, not a one-off.

**GitHub Actions — path filtering verified**
- All three workflows (`ci-email-listener.yml`, `deploy-email-listener.yml`,
  `deploy-email-listener-staging.yml`) are path-filtered to
  `apps/email-listener/**` + the workflow file itself. Confirmed by reading each file directly.
  - CI: runs on PRs and pushes to `main`/`dev`, filtered to those paths.
  - Prod deploy: push to `main`, same path filter → ECR build, Trivy scan (blocks on
    CRITICAL/HIGH), ECS force-new-deployment, wait-stable, smoke test.
  - Staging deploy: push to `dev`, same path filter, deploys to `-staging` ECS service.
  - **Consequence for the protocol**: almost all of tonight's/this milestone's work
    (`apps/web/**`, `.planning/**`, `packages/**`) pushes to `main` WITHOUT triggering any
    AWS deploy or CI run. Only edits under `apps/email-listener/**` trigger CI/CD. This means
    frequent `git push origin main` for web/planning work is safe from an "accidental prod
    deploy" standpoint — it only risks a Vercel deploy (see next).

**Vercel deploy behavior**
- `vercel.json` at repo root: `installCommand: npm install`, `buildCommand: npm run build -w
  @polytoken/web`, `outputDirectory: apps/web/.next`, `framework: nextjs`. No `git.deploymentEnabled`
  overrides present in the file, consistent with the memory note that git auto-deploy is ON for
  `main` (production) and any other branch push produces a preview deployment. Confirmed no
  workflow file guards this — Vercel's own dashboard setting is the sole gate, invisible to
  `git log`. Practical implication: **every push to `main`**, even docs-only `.planning/` pushes,
  can trigger a Vercel production build (cheap/harmless unless it fails and pages the user, but
  worth knowing pushes are not "free" the way the path-filtered GH Actions make them look).
  Pushing to any other branch (e.g., a worktree feature branch) produces a Vercel preview, not
  production — this is actually a reason to prefer short-lived branches over pushing straight to
  `main` mid-phase.

**Worktree viability**
- `git worktree list` shows exactly one worktree (this checkout) at present — no worktrees in
  use despite `.planning/config.json` having a `use_worktrees` flag (currently `false`).
- Repo size: `.git` = 35 MB (small, worktrees are cheap to add — each worktree shares the same
  object store, no duplication cost there). Full working tree (excluding `.git` and
  `node_modules`) is not huge on its own; total tree including all 6 `node_modules` dirs
  (root + `apps/web` + 4 packages) is **2.5 GB** — this is the real cost of worktrees here.
- npm workspaces layout: root `package.json` declares `"workspaces": ["packages/*", "apps/web"]`
  — 5 workspace packages (`api-client`, `db`, `genui`, `tailwind-config`, `ui`) plus `apps/web`.
  Each has its own `node_modules/` (npm workspaces hoists what it can to the root but leaves
  package-local `node_modules` for peer-dep edge cases) — confirmed 6 separate `node_modules`
  directories exist. A naive `git worktree add` gives a fresh checkout with **zero**
  `node_modules` — every worktree needs its own `npm install` (no cheap symlink sharing across
  worktrees without extra tooling), which at this dependency footprint is a real per-worktree
  cost (minutes, not seconds) but not prohibitive for phase-scale work.
- Note: `apps/email-listener` is a separate Python/uv service (root scripts shell out to
  `uv run pytest` etc.) — it doesn't participate in the npm workspace graph, so a worktree
  touching only Python code needs `uv sync`, not `npm install`, and vice versa. Worktrees used
  for mixed web+listener work pay both setup costs.
- Verdict: worktrees ARE viable here (small `.git`, no exotic submodules, no OS-specific build
  quirks observed) but are **not free** — budget an `npm install`/`uv sync` per worktree spin-up,
  and expect it to eat noticeably into the 2.5 GB disk footprint per additional worktree if any
  worktree needs a full `node_modules` for every workspace package.

**GSD inter-agent conventions already present**
- `.planning/STATE.md`, `.planning/HANDOFF.json` — durable cross-session state, both currently
  dirty in `git status` (being actively updated by the concurrent `main` agent this session —
  confirms multiple agents ARE touching this checkout concurrently right now).
- Per-plan `NN-MM-SUMMARY.md` files under each phase dir (e.g.
  `49-01-SUMMARY.md` … `49-05-SUMMARY.md`) — the executor's structured handoff.
- Per-phase `deferred-items.md` (11 found across milestones) — the standard place executors
  park out-of-scope discoveries instead of scope-creeping a fix into an unrelated commit.
- `.planning/night-run/NIGHT-RUN-2026-07-16.md` — a purpose-built run-log for this exact
  autonomous, multi-agent, multi-session window; it already codifies a HEARTBEAT file
  (`.planning/night-run/HEARTBEAT`, touched every turn, staleness-checked by any resuming
  session to detect a live second orchestrator) and a "Run order" checklist as the
  single source of truth for what's done.
- `.planning/config.json` currently has `"use_worktrees": false` and `"auto_advance": true` —
  i.e., the orchestration layer already has a worktree toggle, it's just off.

## 2. The three incidents this milestone (root-caused)

1. **Index races from parallel executors on one checkout** — staged files from one agent's
   `git add` got swept into a sibling agent's commit; one agent's commit reverted another's
   work. Root cause: the git index (`.git/index`) is a single, unlocked, shared file — there is
   no OS-level concept of "my staged changes" vs "your staged changes" when N processes run
   `git add`/`git commit` against the same working directory. This is structural, not a
   discipline failure alone — it recurs any time 2+ writer agents share a checkout, no matter
   how careful their `add` scoping is, because a `commit` can land between another agent's `add`
   and `commit`.
2. **Premature `git checkout --`** — an executor destroyed its own uncommitted Task 1 work by
   running `git checkout -- <path>` (discarding working-tree changes) without first stashing or
   copying them out. `git checkout --`/`restore` is irreversible for uncommitted content; there
   is no reflog entry for working-tree-only changes.
3. **CRLF flip → 10,848-line phantom diff** — some tool/editor/agent step wrote CRLF line
   endings into files the repo otherwise keeps as LF, and with no `.gitattributes` normalizing
   this, git saw every line of the affected file(s) as changed. This is the second time this
   exact failure mode has hit the repo (RETROSPECTIVE.md logs a v1.6-era recurrence) —
   `.gitattributes` was never added after the first occurrence, so it recurred.

## 3. Protocol

### (1) Single-writer rule + when worktrees are mandatory

- **Default: exactly one committing agent per checkout, always.** Read-only agents (verifiers
  reading source, planners reading context, reviewers) may run concurrently against the same
  checkout with zero risk — they never call `git add`/`commit`. The risk is exclusively
  N≥2 processes calling `git add`/`commit` against the same `.git/index` inside the same window.
- **Worktrees are mandatory, not optional, whenever two or more agents will produce commits
  in overlapping time windows.** `git worktree add ../wt-<phase>-<task> <branch>` gives each
  writer its own index + working tree, sharing only the object database (cheap given the 35 MB
  `.git`). This directly fixes incident #1 — there is no shared index to race on.
  - Cost to budget per worktree: one `npm install` at the root (workspaces will hoist) plus
    `uv sync` inside `apps/email-listener` if that service is touched — do this once per
    worktree at creation, not per task.
  - Sequential execution on the single main checkout remains acceptable (and cheaper) when
    tasks are known to have disjoint `files_modified` sets — this milestone's own
    RETROSPECTIVE.md notes 11–15 sequential executors were run specifically because disjoint
    file ownership made ordering "trivially safe" without worktrees. Use worktrees for
    *concurrency*, not as a blanket replacement for sequential execution — sequential-on-main is
    fine and cheaper when there's no real parallelism to gain.
- **This is what NIGHT-RUN.md already codifies** (§Protocols item 1) — this report confirms it
  against the measured incidents and adds the worktree cost model.

### (2) Push cadence

- `git push origin main` **at every green phase boundary** — i.e., after a phase's plans are
  all committed and its gate/verification is green (or explicitly deferred with a documented
  human gate, never faked green). Never push mid-phase with a red suite.
- Because GH Actions are path-filtered to `apps/email-listener/**`, pushing `apps/web/**` or
  `.planning/**` work to `main` does **not** trigger AWS CI/CD — the only side effect is a
  Vercel production build. This makes push-at-boundary cheap and low-risk for non-listener work;
  for `apps/email-listener/**` changes, treat a push to `main` as a real production deploy
  trigger (Trivy-gated, but still real) — push those only when the phase is fully verified.
- Maintain a rolling `backup/<label>` ref pushed to origin at the start of any long unattended
  (autonomous/overnight) run, as already done for `backup/night-2026-07-16`. This ref is the
  disaster-recovery anchor if `main` gets force-something'd or a rebase goes wrong mid-run — it
  costs nothing (shares objects with `main`) and should be cut fresh at the start of each
  multi-hour autonomous window, named `backup/<run-date>`.
- Tag milestone boundaries (already the convention: v1.2–v1.9 all pushed) — keep doing this;
  it gives a second, semantically-labeled recovery anchor independent of the backup branch.

### (3) Commit hygiene rules for agents

- **Scoped `add` only**: `git add <specific paths the agent's plan owns>`. Never `git add -A`
  or `git add .` outside a worktree dedicated to that agent's task. In a shared checkout this is
  the only thing standing between one agent's WIP and another's commit — but per incident #1,
  scoping alone is not sufficient under true concurrency (a race can still land between add and
  commit), so treat scoped-add as a **necessary but not sufficient** control; worktrees are the
  sufficient one.
- **No `git checkout --`/`git restore` (working-tree discard) without a backup copy first.**
  Before any discard operation, copy the file(s) to a scratch location (or `git stash push
  <path>`, which is recoverable via `git stash list`/`git fsck --unreachable` even if dropped,
  unlike a bare checkout) — this is now standing guidance reinforced by the harness-level
  system reminder already active in this session ("run `git status` first and stash... before
  any command that could discard uncommitted work").
- **Never force-push, never `reset --hard`, never `clean -f`** without explicit user
  instruction — standard destructive-op guardrail, doubly important with multiple agents since
  a force-push from one agent can silently erase another's already-pushed commits.
- **`git status` review after any broad add** before committing — catch accidental inclusion of
  `.planning/debug/*.png`-style stragglers or nested-dir sidecar files (e.g. `ui-reviews/*/index.md`)
  that aren't covered by the narrower `.gitignore` patterns.
- **Land `.gitattributes` to close the CRLF recurrence permanently**: a root
  `.gitattributes` with `* text=auto eol=lf` (or scoping to `*.md *.json *.ts *.tsx *.py
  eol=lf` if binary assets need exclusion) would make line-ending behavior deterministic
  regardless of any individual agent's/tool's `core.autocrlf`. This has now recurred across two
  milestones (v1.6 and this one per RETROSPECTIVE.md) without the fix landing — flagging as the
  single highest-leverage unaddressed gap from this investigation.

### (4) Inter-agent communication — what exists, what to add

**Already exists (keep using, don't reinvent):**
- `HEARTBEAT` file + staleness check (NIGHT-RUN.md §6) — the mechanism preventing a
  `resume-at`-triggered session from becoming a second live orchestrator.
- `HANDOFF.json` / `STATE.md` — durable state read-first by any resuming session.
- Per-plan `SUMMARY.md` — structured executor→orchestrator handoff (what changed, what's
  deferred, requirements completed).
- `deferred-items.md` per phase — the designated overflow valve for out-of-scope findings,
  keeping commits scoped to their stated task (directly supports the "scoped adds only" rule —
  an agent that finds unrelated work has a place to write it down instead of fixing it inline
  and polluting its commit).
- `night-run/NIGHT-RUN-2026-07-16.md` Run-order checklist as single source of truth for a
  multi-session autonomous window.

**Gaps to add:**
- **A `WORKTREES.md` (or a `worktrees` block in `HANDOFF.json`) registry** listing: which
  worktree exists, which branch it tracks, which agent/task owns it, and whether it has been
  merged/deleted. Right now nothing tracks worktree lifecycle — if `use_worktrees` flips to
  `true`, a resuming session has no record of stray worktrees left by a prior session (disk
  cost, and a source of "which checkout has the real state" confusion). `git worktree list`
  alone gives paths+branches but not ownership/intent.
  - Recommend: When session ends, prune all worktree dirs that merged cleanly to main (`git worktree remove <path>`, `git branch -d <branch>` after merge).
- **A lightweight commit-lock convention** for the rare case a single checkout must be shared
  briefly (e.g., `.planning/.git-lock-<agent>` sentinel file, checked-and-removed by the sole
  writer) — belt-and-suspenders under the single-writer rule for any transitional moment before
  worktrees are spun up. Low priority given worktrees solve this properly, but a one-line
  sentinel is cheap insurance against the discipline lapsing under time pressure.
- **Explicit CRLF/LF byte-level convention documented in CLAUDE.md or a repo `CONTRIBUTING`
  note**, cross-linked from `.gitattributes` once added, so agents (and human tools) don't
  independently "fix" line endings in opposite directions again (this exact double-fix already
  happened once per RETROSPECTIVE.md).

### (5) DB safety for local Supabase — fixtures vs. real data

- Root scripts (`sb:start`, `sb:stop`, `sb:reset`, `sb:status`) wrap the Supabase CLI directly —
  `db:reset` (`supabase db reset`) is destructive to the **local** Supabase Postgres instance
  only (it replays migrations + seed, wiping local data). Given this repo's Drizzle-owns-schema
  convention (per project memory: `/supabase` = system config only, `packages/db` Drizzle owns
  schema), local resets are expected/routine and not a data-loss risk to anything durable.
- The measured risk is **local fixture data being mistaken for real captured data** (e.g., the
  `.planning/.pending-auth-captures.jsonl` file currently modified in `git status` — an
  auth-capture artifact) — or the reverse, an agent wiping local DB state that a *different*
  concurrent agent (in another worktree, same local Supabase instance) was relying on for its
  own test run. Local Supabase is a single shared Postgres instance per machine — worktrees do
  **not** give each writer its own database the way they give each writer its own git index.
  - **Do not run `sb:reset`/`db:migrate` from more than one concurrent agent** against the same
    local Supabase instance — this is a second, DB-level single-writer rule, orthogonal to the
    git single-writer rule and not solved by worktrees at all. Any multi-worktree parallel plan
    touching DB migrations/fixtures must serialize those specific steps even if file-level work
    is parallel.
  - Given prior memory notes ("prod secret non-ASCII outage", "fake tests mask live-DB bugs",
    "redrive-inbound.sh terraform-synced"), staging/prod DB operations are already understood
    as high-stakes and gated — this protocol adds nothing new there, only flags that *local*
    Supabase needs the same one-writer discipline the git layer needs, for the same reason
    (shared, unlocked, single instance).

## 4. Summary recommendation

The protocol already written into `NIGHT-RUN-2026-07-16.md` §Protocols is correct and should
remain authoritative for this run. This report's additions, in priority order:

1. Add root `.gitattributes` (`* text=auto eol=lf`) — closes a twice-recurred failure mode,
   ~5-minute fix, currently the single highest-leverage gap.
2. Flip `.planning/config.json` `use_worktrees` to `true` only for phases with genuinely
   concurrent writers; budget `npm install`/`uv sync` per worktree spin-up (2.5 GB tree makes
   this non-trivial but not prohibitive); add a worktree lifecycle registry (§4 above) so
   sessions don't lose track of open worktrees.
3. Treat local Supabase as a second single-writer resource, independent of git — serialize
   `sb:reset`/migration steps across concurrent agents even inside a worktree-parallel plan.
4. Delete or push the orphaned local `backup/pre-squash` branch — harmless now, but it's an
   untracked disaster-recovery gap (not on origin) that costs nothing to fix.
5. Extend the `ui-reviews/.gitignore` pattern (or root `.gitignore`) to cover
   `.planning/debug/*.png` and any future ad-hoc debug-screenshot dirs, closing the one
   currently-untracked stray (`sidebar-after-fix.png`) and preventing recurrence.
