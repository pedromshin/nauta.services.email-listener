# Codebase hygiene audit — 2026-07-23

> READ-ONLY audit. No source changed. Scope: `apps/web`, `apps/email-listener`, `packages/*`
> (with `apps/daemon` + `infrastructure` noted where relevant). Companion to
> `.planning/research/2026-07-22-META-AUDIT.md` (which covered `.planning/` / meta-dir hygiene —
> not re-litigated here). This audit is about *source* health.
>
> Scale for context: `apps/web/src` = 364 TS/TSX files, `apps/email-listener/app` = 241 py files,
> `packages/*/src` = 252 TS/TSX files. No dead-code tooling is installed (no `knip`, `ts-prune`,
> `depcheck`, `unimported` in any `package.json`), so unused-export findings below are grep-verified
> spot checks, not an exhaustive machine sweep. **Recommendation R0: add `knip` to the root dev
> deps** — at this file count, manual dead-export hunting does not scale and will silently rot.

---

## 0. Prioritized action list (do in this order)

Each item links to its detailed section. Effort: S = <½ day, M = ½–2 days, L = >2 days.

### P0 — cheap, unambiguous, no behavior risk
1. **Delete or populate the 3 stub packages** `packages/cli`, `packages/integrations`, `packages/shared` — each is a lone `README.md` ("Placeholder package. Populated when needed."), **no `package.json`**, matched by the `packages/*` workspace glob → npm emits workspace warnings and they pollute every `packages/*` glob (this audit's own `find` included them). **S.** §2.1
2. **Add `knip` (or `ts-prune`) to root devDeps + a `check:dead` script.** Precondition for trusting any future dead-export claim. **S.** §2 / R0
3. **Decide the fate of `packages/ui/src/spreadsheet-grid/`** (1,004-line grid + ~10 sub-components) — confirmed imported by **zero** app/package source (only planning + skill docs reference it). Either wire it (FEATURE-CATALOG EN-01/CV-03) or move it behind an explicit `experimental/` marker so it stops reading as shipped UI. **S to decide, M/L to wire.** §2.2, §5.1
4. **Finish the naming-drift decision** for `nauta-services-*` in the 2 deploy workflows + `variables.tf` default + `settings.py:97` SES bucket. These name **live AWS resources**, so this is a migration, not a rename — but it should be a *scheduled, tracked* item, not latent. **M (real infra migration).** §2.3

### P1 — structural, medium effort, high long-term leverage
5. **Split `packages/ui/src` (57 flat files)** into `primitives/` (shadcn) + `magicui/` (animation eye-candy). Caveat: the `./*` wildcard export map + subpath imports (`@polytoken/ui/button`, 61 call sites) make this a wide mechanical change — do it with the export map updated in the same commit. **M.** §3.1
6. **Split `apps/web/src/app/emails/[id]/_components` (34 flat files)** into `pdf/`, `regions/`, `panels/`, `hooks/`. Densest feature dir in the web app; mixes overlay geometry, panels, and hooks. **M.** §3.2
7. **Split the 3 largest production files** first (they gate comprehension of the two hottest subsystems): `run_chat_turn.py` (1,659), `container.py` (1,379), `genui/catalog/manifest.ts` (1,529). **M each.** §4
8. **Subdivide `apps/email-listener/app/application/use_cases` (33 flat files)** — `chat/`, `mail_rules/`, `research/` subpackages already exist; the entity/ingest/genui files should get the same treatment. **M.** §3.3

### P2 — polish / lower urgency
9. Split remaining >600-line production files (§4 table rows 4–13).
10. Subdivide `apps/web/src/app/chat/_canvas` (49 files) and `packages/db/src/schema` (33 files). §3.4, §3.5
11. Retire the "legacy Classify Page" affordance if the product decision is made (still wired, not dead — do not delete blind). §5.2

---

## 1. What is NOT a problem (scoping-out, to save re-investigation)

- **`__pycache__` dirs** show up in `find` but are **not tracked** (`git ls-files | grep __pycache__` → 0). Ignore; they are local build noise.
- **`nauta` in SQL migrations / `packages/db/migrations`** — historical, immutable by nature. Not drift; leave.
- **`nauta` in test fixtures / entity_instance domain comments** — describe the real inbound
  pipeline's rule-set name (`nauta-services-inbound`); accurate, not stale.
- **SES-forwarder Terraform drift is already codified** — `infrastructure/aws/ses-forwarder.tf`
  now exists and documents the Lambda + `personal-forward` rule + ordering (correcting
  META-AUDIT §2 "Infra drift", which predates this file). Only the **naming** drift (§2.3) remains.
- **`*.old`/`*.bak`/`copy`/`-v2` files** — none exist in tracked source (the one `find` hit,
  `web-search-tool-copy.test.tsx`, is a legitimately-named test about copy/labels, not a dupe).
- **"legacy" string matches** — ~30 hits, but nearly all are *graceful-degradation* doc comments
  ("a legacy/tampered node type degrades to unknown"), which is intended, tested behavior — not
  dead code. The two real ones are in §5.2.

---

## 2. Dead / unused exports & legacy remnants

### 2.1 Stub packages with no `package.json` (P0-1)
`packages/cli`, `packages/integrations`, `packages/shared` each contain exactly one file
(`README.md`, body: *"Placeholder package. Populated when needed."*). They have **no
`package.json`**, yet the root `workspaces` glob is `packages/*`, so npm treats each as a malformed
workspace. `@polytoken/cli|integrations|shared` are imported nowhere.
**Action:** delete the three dirs (git history preserves the intent), OR, if they are roadmap
placeholders, add a minimal private `package.json` so the workspace is well-formed and the intent
is explicit. Leaving them half-formed is the worst of both.

### 2.2 Confirmed-unwired shipped-looking code
- **`packages/ui/src/spreadsheet-grid/`** — `SpreadsheetGrid.tsx` (1,004 lines) + editors,
  clipboard, `column-header-menu`, `row-context-menu`, `conditional-formatting-dialog`,
  `add-column-dialog`, validation. `git grep 'spreadsheet-grid\|SpreadsheetGrid'` outside its own
  dir returns **only** `.planning/*` and skill docs — no `apps/web` / `packages/*` source importer.
  It even has a dedicated `./spreadsheet-grid` export entry, which makes it *look* shipped. This is
  the single largest block of dead-to-the-app code. (Matches META-AUDIT "Built but 100% unwired.")
  **Not "delete"** — it is the intended substrate for FEATURE-CATALOG EN-01/CV-03. **Action:** gate
  it visibly (an `experimental/` path or a top-of-file banner) until wired, so it stops reading as
  active UI to the next agent.

### 2.3 Legacy `nauta-services-*` naming drift (P0-4) — live resources, schedule as migration
85 tracked `nauta` hits outside lockfile/planning/SQL. The ones that are **operational drift** (a
polytoken product still emitting nauta-era names):

| Location | Line | Value |
|---|---|---|
| `.github/workflows/deploy-email-listener.yml` | 13–15 | `ECR_REPOSITORY / ECS_CLUSTER / ECS_SERVICE = nauta-services-email-listener*` |
| `.github/workflows/deploy-email-listener-staging.yml` | 13–15 | same, `-staging` |
| `apps/email-listener/app/settings.py` | 97 | `SES_S3_BUCKET = "nauta-services-ses-inbound-emails"` |
| `infrastructure/aws/variables.tf` | 16 | `project` default `"nauta-services"` |
| `infrastructure/aws/locals.tf` | 4 | `tg_prefix = "nauta-el"` |

These are **not** find-and-replaceable — each string names a resource that exists in AWS account
271369143207 (S3 bucket, ECR repo, ECS cluster/service, SES rule set `nauta-services-inbound`).
**Action:** create a dedicated "de-nauta rename" migration ticket (new bucket/cluster + cutover +
Terraform state move + workflow update), and until then annotate each site with a one-line
`# nauta-era name; live resource, see <ticket>` so nobody "fixes" it blindly and breaks prod.

### 2.4 Dead-export sweep status
Grep spot-checks surfaced no obviously-orphaned production export beyond §2.2. A real answer needs
tooling (R0). **Recommended first sweep once `knip` lands:** `packages/genui` and
`packages/api-client` (largest export surfaces), then `packages/ui` (the `./*` wildcard export
means unused primitives are invisible to bundler tree-shaking analysis and must be caught by knip's
`exports` check).

---

## 3. Directories with >~15 direct files → subdir plans

| Dir | Direct files | Verdict |
|---|---|---|
| `packages/ui/src` | 57 | **Split (P1-5)** |
| `apps/web/src/app/chat/_canvas` | 49 | Split (P2) |
| `apps/email-listener/app/domain/ports` | 37 | Group by bounded context (P2) |
| `apps/web/src/app/emails/[id]/_components` | 34 | **Split (P1-6)** |
| `packages/db/src/schema` | 33 | Split by domain (P2) |
| `apps/web/src/app/chat/_components` | 33 | Split (P2) |
| `apps/email-listener/app/application/use_cases` | 33 | **Split (P1-8)** |
| `apps/email-listener/app/infrastructure/supabase` | 27 | One repo file per aggregate — acceptable; optional `repositories/` nesting |
| `apps/web/src/app/knowledge/_components` | 21 | Borderline; defer |
| `apps/email-listener/app/infrastructure/llm` | 20 | Borderline (`adapters/` + `exemplars/`) |

### 3.1 `packages/ui/src` (57) — P1-5
Two clearly separable families:
- **`primitives/`** — the shadcn set: accordion, alert(-dialog), avatar, badge, breadcrumb, button,
  calendar, card, checkbox, collapsible, command, dialog, dropdown-menu, form, input, label,
  popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton,
  sonner, spinner, switch, table, tabs, textarea, tooltip, theme.
- **`magicui/`** — the animation layer: animated-beam, animated-list, avatar-stack, blur-fade,
  border-beam, confetti, dot-pattern, magic-card, marquee, number-ticker, shimmer-button,
  shine-border, typing-animation, meteors, rating, tags, relative-time.
- Keep `spreadsheet-grid/` (already nested), `code-block(-server)`, `chart`, `dialog-stack`,
  `sidebar` as feature modules.
- **Caveat (blocking):** `package.json` `exports` uses `"./*": ["./src/*.tsx","./src/*.ts"]` and
  the app imports by subpath (`@polytoken/ui/button` ×61, `/skeleton` ×23, `/badge` ×19, …).
  Moving files breaks those paths. Either (a) update the export map to add
  `"./primitives/*"` + `"./magicui/*"` and rewrite ~250 import lines (codemoddable), or (b) keep
  subpaths stable by adding a thin re-export barrel per moved file. Option (a) is cleaner; do it in
  one mechanical commit with a codemod, not by hand.

### 3.2 `apps/web/src/app/emails/[id]/_components` (34) — P1-6
- **`pdf/`** — pdf-preview-pane, draw-mode-bar, draw-overlay, overlay-layer, region-overlay-box,
  region-label, region-vocabulary, canvas-shell, canvas-toolbar, use-canvas-state.
- **`regions/`** — confirm-deny-controls, role-picker, entity-type-picker, nest-picker,
  field-relationship-picker, reject-dialog, reprocess-dialog, use-region-edit, use-role-mutations,
  status-badge.
- **`panels/`** — inspector-panel, layers-panel, layers-tree-row, fields-panel,
  extraction-summary-panel, entities-list, attachments-card, metadata-card, body-card,
  active-parent-banner, action-toolbar.
- **`hooks/`** — use-autofill, use-autofill-fields (the two non-region hooks).
- Leave `email-detail.tsx` (842, the composition root) at the top — but split it too (§4).

### 3.3 `apps/email-listener/app/application/use_cases` (33) — P1-8
`chat/`, `mail_rules/`, `research/` subpackages already exist — extend the pattern:
- **`entities/`** — resolve_entity_candidates, curate_entity_merge, promote_entity_on_confirm,
  backfill_entity_identities, suggest_entity_types, manage_entity_types, evaluate_anticipatory_candidates.
- **`ingest/`** — receive_inbound_email, ingest_inbound_email, reprocess_email, propose_regions,
  confirm_region, edit_region, deny_field, classify_document.
- **`genui/`** — generate_ui_spec, generate_code_island, resolve_retheme, set_component_relationship,
  submit_widget_interaction, autofill, autofill_fields.
- **`knowledge/`** — synthesize_knowledge, promote_edge, promote_source_ledger_entry.
- Keep `run_chat_turn*.py`, `confirm_action_dispatch`, `_token_provenance`, `cache_key` at top or
  under `chat/`.
(Update imports + `lint-imports` contract config accordingly — the Clean-Architecture import linter
will need the new package boundaries declared.)

### 3.4 `apps/web/src/app/chat/_canvas` (49) — P2
Group: `nodes/` (per node-type component + its test), `edges/` (data-edge, edge-payload-schema,
edge-creation-picker), `persistence/` (canvas-store, use-canvas-persistence, panel-overlay),
`controls/` (already a subdir), leaving `chat-canvas.tsx` + registry files at top. Big win for the
canvas track's planned complexity growth (vision doc leans hard on canvas).

### 3.5 `packages/db/src/schema` (33) — P2
Barrel is `index.ts`; files are flat by table. Optional domain nesting: `chat/` (the 9
`chat-*.ts`), `entities/` (entity-*, sender-profiles, references), `knowledge/`
(knowledge-node*, component*), `email/` (emails, threads, extractions, attachments,
forwarding-addresses, importers). Low urgency — flat-per-table is a defensible convention; only do
this if schema count keeps climbing.

### 3.6 `domain/ports` (37) — P2
Ports are one-interface-per-file (correct for hexagonal). 37 is a lot but each is small. Optional:
group by bounded context mirroring §3.3. Low priority.

---

## 4. Files >~400 lines → suggested splits

Production (non-test) files only; ranked. Test files >400 lines (18 of them, up to 1,379) are
**intentionally** large law-suites (`canvas-node-law`, `message-stream-law`, `render-node.test`) —
generally leave, but the two >700 (`test_submit_widget_interaction.py` 780, `render-node.test.tsx`
1,379) could split by scenario group.

| # | File | Lines | Suggested split |
|---|---|---|---|
| 1 | `apps/email-listener/app/application/use_cases/run_chat_turn.py` | 1,659 | Already has siblings (`_tool_loop`, `_widgets`, `_confirm_action`). Extract: `_turn_state.py` (the `_ServerRoundResult`/`_RoundAdvance`/`_MidStreamTerminalError`/`_TurnState` dataclasses, ~250–304), `_tool_offer.py` (`_build_tool_offer`, 576+), `_cost.py` (`_estimated_cost_so_far`/`_estimated_round_cost_so_far`, 1220+), `_status.py` (`_terminal_status_for`, 1060+). Leaves `RunChatTurn` as an orchestrator ~<500. |
| 2 | `packages/genui/src/catalog/manifest.ts` | 1,529 | It is one frozen `POLYTOKEN_CATALOG` object (903+) plus `compactEntry`/`toCompactCatalog` (1506+). Split per component *family* into `catalog/entries/*.ts` (layout, data, form, media, feedback…) each exporting its slice, compose them in `manifest.ts`; move `compactEntry`/`toCompactCatalog` to `catalog/compact.ts`. |
| 3 | `apps/email-listener/app/container.py` | 1,379 | 54 provider functions in one DI module. Split into `container/` package: `container/llm.py`, `container/repositories.py`, `container/use_cases_chat.py`, `container/use_cases_ingest.py`, etc., each a builder mixin/factory; `container/__init__.py` wires them. (High comprehension payoff — this is the file every new subsystem must touch.) |
| 4 | `packages/ui/src/spreadsheet-grid/SpreadsheetGrid.tsx` | 1,004 | Blocked on the §2.2 wire/gate decision. If wired: extract keyboard/clipboard handlers → `use-grid-keyboard.ts`, selection model → `use-grid-selection.ts`, render body → `GridBody.tsx`. Don't invest before it has a consumer. |
| 5 | `apps/web/src/app/chat/_canvas/chat-canvas.tsx` | 945 | Pure functions at top (`provenanceKey`, `buildSpecsByProvenance`, `buildPartsByProvenance`, `buildStreamingByProvenance`, `toPersistedShape`, `toFlowEdge`, `extractPointerPosition`, 148–297) → `canvas-provenance.ts` + `canvas-flow-adapters.ts`. Leaves the `ChatCanvas` component (317+) ~<550. |
| 6 | `apps/web/src/app/emails/[id]/_components/email-detail.tsx` | 842 | Composition root; extract the per-tab/per-panel JSX blocks into the §3.2 `panels/` files it already coordinates, and pull local types/constants (`FullPagePolygon` etc.) into `email-detail.types.ts`. |
| 7 | `apps/web/src/app/knowledge/_components/knowledge-graph.tsx` | 785 | Split layout/force-sim setup, node renderers, and the interaction/selection handlers into sibling modules; keep the graph shell. |
| 8 | `packages/ui/src/sidebar.tsx` | 778 | Vendored shadcn sidebar (many sub-exports in one file). Split into `sidebar/` (menu, group, trigger, rail, provider). Low urgency (it is stable vendored code) but it is the 2nd-biggest UI file. |
| 9 | `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx` | 763 | Extract draw-mode state machine (the "legacy flow vs shell Draw tool" logic, ~441–460, §5.2) → `use-draw-mode.ts`; overlay rendering → `PdfOverlay.tsx`. |
| 10 | `apps/web/src/app/chat/_hooks/use-conversation-controller.ts` | 752 | Large hook — split by concern (send/turn lifecycle vs tool-confirm vs canvas-sync) into composed sub-hooks. |
| 11 | `packages/genui/src/schema/spec-schema.ts` | 747 | Zod schema tree; split per node category into `schema/nodes/*.ts`, compose in `spec-schema.ts`. |
| 12 | `apps/web/src/app/_components/inbox-three-pane.tsx` | 726 | Split the three panes into `inbox/pane-list.tsx`, `pane-thread.tsx`, `pane-reading.tsx`; keep layout shell. |
| 13 | `packages/api-client/src/router/emails/mutations.ts` | 707 | Split by mutation group (region ops vs role/entity ops vs reprocess) into sibling router files merged in the emails router index. |

Remaining 400–700 line production files (17 more: `knowledge/graph.ts` 653, `code-block.tsx` 638,
`deep_research.py` 871, `autofill_fields.py` 641, `knowledge_graph_repository.py` 625,
`genui_generator_adapter.py` 571, `use-chat-stream.ts` 578, `use-canvas-persistence.ts` 576,
`packs.ts` 557, `components.py` 535, `research-trace.tsx` 533, `message-turn.tsx` 515,
`history-island.tsx` 517, `edit_region.py` 465, `dialog-stack.tsx` 484, `node-detail-pane.tsx` 483,
`entities/detail.ts` 473, `render-node.tsx` 467) are **P2** — split opportunistically when next
edited, not as a dedicated pass.

---

## 5. Deprecated / duplicated modules

### 5.1 Duplicated-intent, not literal dupes
- **Table rendering exists twice**: static genui `table` catalog entry
  (`packages/genui/src/catalog/manifest.ts`) *and* the unwired `spreadsheet-grid` (§2.2).
  FEATURE-CATALOG CV-03 already frames the grid as the *upgrade path* for the static table — so
  this is intentional divergence, but until CV-03 lands there are two table stories in-repo. Track,
  don't merge yet.
- **Entity table**: `apps/web/src/app/entities/_components/entities-table.tsx` reimplements grid
  behavior that EN-01 wants routed through `spreadsheet-grid`. Same theme — parallel table code
  awaiting consolidation.
- Duplicate *basenames* (`detail.ts`, `mutations.ts`, `history.ts`, `manifest.ts`, `types.ts`,
  `page.tsx`, `route.ts`, `index.ts`, `spec-renderer-island.tsx`, `layout.tsx`) are all
  domain-scoped siblings in different dirs — **not** duplication, normal Next/router structure.

### 5.2 Genuine legacy affordance still wired (do NOT delete blind)
- **"Classify Page" / `FullPagePolygon`** — `email-detail.tsx:29` comment marks it
  *legacy*, and `pdf-preview-pane.tsx:441-460, 616` runs a "legacy draw/split/add flow (drawMode)
  [that] always wins" alongside the newer shell Draw tool. This is a live dual-path UI, not dead
  code — but it is explicitly labeled legacy and is a comprehension tax on the 763-line
  pdf-preview-pane. **Action (P2-11):** product decision on whether the legacy Classify-Page path
  is still needed; if not, its removal simplifies the §4-9 split materially. If yes, isolate it in
  the extracted `use-draw-mode.ts` so its "always wins" precedence is contained and documented.

### 5.3 Model-id legacy notes (informational, already handled)
`settings.py:20` ("prior claude-sonnet-4-20250514 id is legacy") and `container.py:277` ("hardcoded
legacy haiku model 404s") are *comments recording resolved migrations*, not stale code. No action;
listed so a future sweep doesn't re-flag them.

---

## 6. Corrections / deltas vs the 2026-07-22 META-AUDIT
- **SES-forwarder Terraform drift is RESOLVED** — `infrastructure/aws/ses-forwarder.tf` now
  codifies the Lambda + `personal-forward` rule + ordering (META-AUDIT §2 listed it as open). Only
  the `nauta-services-*` *naming* drift (§2.3) remains.
- **New findings this audit adds:** the 3 malformed stub packages (§2.1), the absence of
  dead-code tooling (R0), the `packages/ui/src` 57-file flat sprawl + its export-map constraint
  (§3.1), and the concrete >400-line split map (§4).
- **Confirmed from META-AUDIT:** spreadsheet-grid 100% unwired (§2.2), `except Exception` swallow
  surface in ingest (out of scope here — that is a *correctness* finding for the email-hardening
  phase, not hygiene; see META-AUDIT §3 and FEATURE-CATALOG ST-04).
