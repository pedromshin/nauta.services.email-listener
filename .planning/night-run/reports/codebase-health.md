# Codebase Health Audit — Optimization for Long-Term Claude-Driven Development

Date: 2026-07-17 · Scope: monorepo readiness for autonomous multi-agent (GSD) overnight builds.
Method: read-only inspection of file sizes, agent-facing docs/skills, intel/graph staleness, test shape.

**Headline:** the single biggest lever is that **zero `CLAUDE.md` files exist anywhere** in the
repo, yet the hard-won tribal knowledge (npm-not-pnpm, the env-file split, the OAuth/Supabase
wrinkle) already lives in `docs/RUN-LOCAL.md` — it just sits at a path Claude Code never
auto-loads. The knowledge is written; it is parked in the wrong location. Everything else is
second-order.

---

## 1. File-size outliers (800 max / 200-400 typical)

`.venv/` and `dist/` dominate any raw `wc -l` sort and are irrelevant (third-party / generated).
Filtering to **real first-party source**, the offenders are:

### Python (`apps/email-listener/app`, excl `.venv`, tests)
| Lines | File | Note |
|------:|------|------|
| **2263** | `app/application/use_cases/run_chat_turn.py` | 2.8× the max. The chat-turn orchestrator — the hottest agent-edited file in the backend. A merge-conflict and context-window magnet. |
| **1284** | `app/container.py` | DI wiring; grows every phase. |
| 641 | `app/application/use_cases/autofill_fields.py` | over typical, under max |
| 625 | `app/infrastructure/supabase/knowledge_graph_repository.py` | |
| 581 | `app/infrastructure/llm/exemplars/__init__.py` | prompt exemplars in a package `__init__` |
| 571 | `app/infrastructure/llm/genui_generator_adapter.py` | |
| 535 | `app/presentation/api/v1/components.py` | |

### packages/ (excl `dist`, tests)
| Lines | File |
|------:|------|
| **1248** | `packages/genui/src/catalog/manifest.ts` — component catalog; data-heavy, tolerable but big |
| **1004** | `packages/ui/src/spreadsheet-grid/SpreadsheetGrid.tsx` |
| 778 | `packages/ui/src/sidebar.tsx` |
| 707 | `packages/api-client/src/router/emails/mutations.ts` |
| 665 | `packages/genui/src/schema/spec-schema.ts` |
| 653 | `packages/api-client/src/router/knowledge/graph.ts` |
| 638 | `packages/ui/src/code-block.tsx` |

### apps/web/src (excl tests)
| Lines | File |
|------:|------|
| **895** | `app/chat/_canvas/chat-canvas.tsx` — only web source over the 800 max |
| 842 | `app/emails/[id]/_components/email-detail.tsx` |
| 782 | `app/knowledge/_components/knowledge-graph.tsx` |
| 763 | `app/emails/[id]/_components/pdf-preview-pane.tsx` |
| 752 | `app/chat/_hooks/use-conversation-controller.ts` |
| 603 | `app/_components/inbox-three-pane.tsx` |

### Test files (the real size problem)
Tests are larger than the source they cover — these are read in full every time an agent touches
the area:
| Lines | File |
|------:|------|
| **1379** | `packages/genui/src/__tests__/render-node.test.tsx` |
| 719 | `packages/api-client/src/router/chat/__tests__/context-edges.test.ts` |
| 694 | `apps/web/.../chat/_canvas/__tests__/canvas-node-law.test.tsx` |
| 669 | `packages/api-client/src/router/__tests__/cross-tenant-adversarial.test.ts` |
| 646 | `apps/web/.../transcript-overlay.test.tsx` |

**Verdict:** only ~4 first-party files exceed the 800 max (`run_chat_turn.py`, `container.py`,
`manifest.ts`, `SpreadsheetGrid.tsx`) plus `chat-canvas.tsx` at 895. This is a *focused* problem,
not a sprawl problem. `run_chat_turn.py` at 2263 is the one that actively costs agent throughput
(every chat-backend phase re-reads it and risks conflicts). Do **not** launch a grand split —
carve `run_chat_turn.py` only, when a phase next touches it.

---

## 2. Repo-level `CLAUDE.md` — the #1 gap

**There are no `CLAUDE.md` files in the repo. None at root, none per-package.** Claude Code
auto-loads `CLAUDE.md` from cwd upward and from subdirectories it reads into; with none present,
every fresh agent session starts blind and re-derives the same facts from scratch.

The knowledge that agents keep rediscovering **already exists** — but in `docs/RUN-LOCAL.md`
(a doc, not auto-loaded) and in the user's *global* `~/.claude/` memory (not repo-portable, not
visible to a subagent that lands mid-tree). `docs/RUN-LOCAL.md` is genuinely excellent and already
documents:
- **npm workspaces, NOT pnpm** (with the "pnpm pollutes the tree" rationale)
- **the env-file split** (`apps/email-listener/.env` vs root `.env.local`) — called "the #1 footgun"
- the Google OAuth / `supabase start` shell-env wrinkle

What is **still missing everywhere** and burns agent-hours:
- **`build:local` vs `build`** — `apps/web` has `build:local` = `dotenv -e ../../.env.local -v NEXT_DIST_DIR=.next-verify -- next build`. The `NEXT_DIST_DIR=.next-verify` split exists precisely so a verify build does not clobber the running dev server's `.next` (per MEMORY: "build:local silently corrupting the dev server"). No source doc states "use build:local for verification, never bare `next build` while a dev server is up."
- **the Playwright second-server trap** — `playwright.screenshot.config.ts` uses `webServer.reuseExistingServer: true` on port 3000. If an agent starts its own `next dev` and Playwright *also* boots one (or a zombie holds 3000), captures silently hit the wrong server. `workers: 1 / fullyParallel: false` is load-bearing (shared timestamped RUN_DIR) — undocumented outside a code comment.
- **jsdom has no layout** — MEMORY's "rendered-geometry blind spot": four layout bugs shipped through green vitest suites because jsdom does no layout. Gates read token strings; real geometry needs `test:geometry` (Playwright) or reading the PNG. This is the most expensive recurring lesson in the whole project and lives only in user-global memory.
- **tier / token vocabulary locations** — tokens: `apps/web/src/app/globals.css` (12-token oklch ladder, D-58-01); design law + palette: `docs/design/brand-guide.md`; the `polytoken-design-system` skill is the index. An agent with no CLAUDE.md has no pointer to any of these.

**Fix:** a root `CLAUDE.md` (~40-60 lines) that is *pointers, not prose* — package manager, the two
build commands and when to use each, the env-file split (link RUN-LOCAL), the jsdom/geometry
caveat, the playwright port-3000 rule, and a "where things live" table (tokens, design law,
skills, migrations). Optionally a 5-line `apps/email-listener/CLAUDE.md` (uv not pip; `npm run
check` is the gate; Clean Architecture layering enforced by `lint-imports`) and
`apps/web/CLAUDE.md` (build:local rule; jsdom caveat).

---

## 3. `.claude/skills/` inventory

**Present:** exactly one — `polytoken-design-system` (SKILL.md + `references/component-catalog.md`
+ two build scripts). It is high quality, actively maintained (updated through Phase 55/58/59), and
correctly scoped. Auto-discoverable via the skill description.

**Skills that would pay for themselves** (each replaces a recurring multi-step rediscovery):
- **`run-local-stack`** — promote `docs/RUN-LOCAL.md` + `scripts/preflight-local.ps1` into a skill so agents *trigger* it instead of hoping to find the doc. Highest ratio: the env-split footgun is hit repeatedly.
- **`verify-rendered-geometry`** ("run the harness and read the PNG") — encodes: never trust jsdom for layout; run `test:geometry` / `screenshot:review`; where captures land (`.planning/ui-reviews/<ts>/`); reuse port-3000, one worker. Directly attacks the single most expensive recurring class of shipped bug.
- **`verify-class-in-built-css`** — a tiny skill/script that greps the *built* CSS (`.next-verify`) for a Tailwind class to prove it was emitted, not just present in source. MEMORY records "madder-on-a-status passing the gate" — token strings in source lie; the compiled artifact does not.

Skill descriptions are the discovery surface — write each one to trigger on the exact phrasing
agents use ("screenshot the app", "verify the color", "start the stack green").

---

## 4. `.planning/intel/` and graph staleness

- **`.planning/intel/` does not exist.** The `/gsd:intel` and `/gsd:map-codebase` outputs
  (`.planning/codebase/`) were never generated or were cleaned. Not fatal, but it means there is no
  cheap pre-digested codebase map for a cold agent — they pay full exploration cost each time.
- **`.planning/graphs/`** — `graph.json` (12.7 MB) + `GRAPH_REPORT.md` dated **Jul 7**; ~10 days
  and multiple milestones (Phases 55-61: Tailwind v4 migration, visual-identity re-skin, surface
  redesign) stale. The graph predates the entire current design system.
- **`graphify-out/`** — last real build **Jul 9** (`.graphify_ast.json` etc.); also pre-dates the
  v4/identity work. Two parallel graph stores (`graphs/` and `graphify-out/`) both stale and both
  large (~12 MB each) — they inflate the repo and, worse, will *mislead* an agent that queries them
  expecting current structure.

**Verdict:** low-effort, real payoff — either refresh (`/gsd:graphify --update` as a *sole* workload
per MEMORY's fan-out warning) or, if the graph isn't being queried during runs, stop shipping stale
12 MB artifacts and regenerate on demand. Confirm `graphify-out/` is gitignored (it appears to be
scratch); if not, it should be.

---

## 5. Test suite shape (~80 web files / 992 tests / ~52s)

- **Distribution:** web `src` = 80 test files; `packages` = 140 test files. Colocation is
  consistent: **70/80 web tests live in `__tests__/` dirs**, 10 colocated as siblings — a minor
  inconsistency, not worth churn.
- **Slowest / heaviest by size** (proxy for runtime, and definitely for read cost):
  `render-node.test.tsx` (1379), `context-edges.test.ts` (719), `canvas-node-law.test.tsx` (694),
  `cross-tenant-adversarial.test.ts` (669). These are the ones an agent should be told to run
  *targeted* (`vitest run <file>`), never as part of a full-suite loop — which aligns with the
  user's global rule "run single tests, not full suite."
- **jsdom ceiling (the load-bearing caveat):** `vitest.config.ts` runs `environment: "jsdom"` with
  `SKIP_ENV_VALIDATION`. jsdom does no layout — the entire green vitest suite cannot catch a
  half-width sidebar or a page scrolled to 11,296px. Geometry lives only in the three Playwright
  configs (`playwright.geometry.config.ts`, `.screenshot.config.ts`, base). Agents must know which
  gate proves what; today only user-global memory says so.
- **Good signals:** dedicated adversarial/law tests (`react-flow-stock-ban.test.ts`,
  `canvas-node-law`, `cross-tenant-adversarial`, `token-contrast`) show the suite already encodes
  "don't regress this specific lesson" — a healthy autonomous-run pattern. Keep adding these; they
  are cheaper than a skill for one-off invariants.

---

## 6. Top 5 highest-leverage improvements (ranked by agent-hours saved per hour invested)

1. **Create a root `CLAUDE.md` (pointers, not prose).** ~1 hr invested; saves the same cold-start
   rediscovery in *every* future session. First step: create `/CLAUDE.md` with a "where things
   live" table + the 5 footguns (npm-not-pnpm→link RUN-LOCAL, build vs build:local, env-split,
   jsdom-no-layout→use test:geometry, playwright port-3000/one-worker). Pure additive, zero risk.

2. **Promote the rendered-geometry lesson from user-global memory into repo-visible form**
   (a `verify-rendered-geometry` skill *or* a `## Verifying UI` section in CLAUDE.md). This lesson
   caused 4 shipped bugs in one night; encoding it once prevents the highest-cost recurring class of
   overnight failure. First step: write the skill from MEMORY's `rendered-geometry-blind-spot.md` +
   the existing `screenshot.config.ts` wiring.

3. **Refresh or retire the two stale graph stores.** They are ~10 days and several milestones stale
   and actively misleading. First step: decide if graphs are queried during runs — if yes, run
   `/gsd:graphify --update` as a sole workload; if no, gitignore `graphify-out/` and drop the 12 MB
   `graphs/graph.json` from tracking, regenerate on demand.

4. **Carve `run_chat_turn.py` (2263 lines) — and only it — when a phase next touches it.** It is the
   one file where size demonstrably taxes throughput (re-read + conflict risk on every chat phase).
   First step: at the next chat-backend phase, extract the tool-loop and confirm-action branches
   into sibling modules under `use_cases/chat/`. Do not touch the other outliers pre-emptively.

5. **Add a `verify-class-in-built-css` micro-skill/script.** Cheap to build, kills the "token in
   source but not emitted" false-green (`madder-on-a-status`). First step: a ~15-line script that
   builds with `build:local` and greps `.next-verify` CSS for a given class, wired into a skill an
   agent triggers on "verify the color/class actually renders."

**Explicitly not recommended:** a monorepo-wide file-split refactor, converting all colocated tests
to `__tests__`, or a big intel/map-codebase regeneration ceremony. None compound; all consume a
run's budget for cosmetic gain. Everything above is additive and pays back within one or two
subsequent sessions.
