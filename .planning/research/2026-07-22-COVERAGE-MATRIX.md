# Coverage matrix — vision prompt ↔ artifacts ↔ waves (2026-07-23)

Deterministic clause-by-clause audit of `.planning/prompts/2026-07-22-vision-and-handoff.md`
against what exists (research/audit artifacts) and what is scheduled (execution waves W0–W6).

Status legend:
- **✓ MAPPED** — both an artifact and an execution wave account for it.
- **◐ PARTIAL** — artifact exists but execution is thin/unscheduled, OR execution is scheduled but the artifact is shallow.
- **✗ GAP** — no dedicated artifact and/or no wave; needs to be added.
- **⊘ EXTERNAL** — depends on a third party (AWS/OneDrive), tracked but not ours to "do".

Wave key (from the launch plan): W0 security/data-integrity · W1 reliability+multipliers ·
W2 AI spine · W3 canvas+viz · W4 drive+home · W5 multiuser · W6 ventures.

---

## A. Infra / email seam (prompt §2–§3)

| # | Clause | Status | Artifact | Wave |
|---|---|---|---|---|
| I1 | SES production-access approval | ⊘ EXTERNAL | META-AUDIT §2 (noted) | — (AWS-gated) |
| I2 | Codify drift: personal-forward rule + forwarder Lambda → Terraform | ✓ MAPPED | `infrastructure/aws/ses-forwarder.tf`, `IMPORT-RUNBOOK.md`, vendored `lambda/ses-forwarder/` | W1 (run imports before apply) |
| I3 | Optionally extend forwarding to agent@/agent-staging@/agent-local@ | ✗ GAP | none | unscheduled (optional) |

## B. Meta / health (prompt §7 opening + bullet 1)

| # | Clause | Status | Artifact | Wave |
|---|---|---|---|---|
| A | Evaluate GSD ahead, report concisely | ✓ MAPPED | META-AUDIT §1, §4 | done (this audit) |
| B | Health/org of GSD, .claude, root, meta dirs | ✓ MAPPED | META-AUDIT §2 (P0/P1/P2) | GSD-hygiene already merged (STATE reconcile, untrack blobs, README/COMMANDS) |
| C1 | Full project health/architecture for AI-driven programming (incl. phone) | ◐ PARTIAL | claude-engineering §7 (phone), META-AUDIT §2 | W1 dev-tooling covers .mcp.json/settings/skill; **app-wide review not fully scoped** |
| C2 | Cleanup/prune legacy/dead/stale/deprecated code across ALL dirs | ✗ GAP | none (meta-dir hygiene only) | **no wave** — needs a codebase-hygiene sweep |
| C3 | Review ALL files/dirs; break large files→smaller, dirs→subdirs for scalability | ✗ GAP | none | **no wave** — same sweep |
| C4 | Review tests | ✓ MAPPED | `2026-07-22-tests-security-audit.md` | W0/W1 (fixes carry tests) |

## C. Cross-cutting engineering (prompt §7 bullets 2–6)

| # | Clause | Status | Artifact | Wave |
|---|---|---|---|---|
| D | Tests and security | ✓ MAPPED | `tests-security-audit.md` + email REPORT (CVE-2023-27043) | W0 (CVE), W1 (eval gates) |
| E1 | Declarative drift — AWS | ✓ MAPPED | Terraform runbook | W1 |
| E2 | Declarative drift — Supabase (+"anything else") | ◐ PARTIAL | migrations exist; no prod-schema drift check | **not scheduled** — add a Supabase drift check |
| F | Cost optimization | ◐ PARTIAL | `2026-07-22-cost-reliability.md` | research only; **no explicit exec item** |
| G | Reliability and scalability | ✓ MAPPED | `cost-reliability.md` | W1 |
| H | Multiuser: personal + org/teams/workspace perms/access/sharing | ✓ MAPPED | META-AUDIT gap row; FEATURE-CATALOG (single-user assumption) | W5 |

## D. Ecosystem research (prompt §7 bullet: ai/claude ecosystem; and the later research bullets)

| # | Clause | Status | Artifact | Wave |
|---|---|---|---|---|
| I | GitHub #1 day/week/month/year + more sources; apply to app AND to meta dev tools (claude code + gsd), plugins/skills/packages | ✓ MAPPED | `ecosystem/claude-engineering.md` §1 (day/week/month/year), §3 MCP, §4 subagents, §5 skills/plugins/hooks, §6 GSD alternatives, §7 phone; `ecosystem/app-packages.md` (app-side) | W1 dev-tooling (meta) / feature waves (app) |
| Q | Research ai/agentic/workflows/llm patterns/tools/plugins/skills/system-prompts/context/integrations/evals/observability/security/privacy | ✓ MAPPED | `ecosystem/llm-patterns-evals-observability-security.md` | W1 evals+tracing |
| Z | DS/DE: mlflow + similar, spark, dataflow, traditional + llm/ai/evals/fine-tuning/post-training/weights; communities/orgs/packages | ✓ MAPPED | `ecosystem/data-eng-ds.md` (mlflow=skip-now→Langfuse/MLflow3 at Stage2/3; spark/dataflow=overkill; evals=adopt now; Unsloth fine-tune gated ≥1k corrections; communities list) | W1 evals (Stage 1); W6 fine-tune ladder (Stage 3) |

## E. Email system (prompt §7 email block + review ask)

| # | Clause | Status | Artifact | Wave |
|---|---|---|---|---|
| J1 | Emails auto-ingested + processed | ✓ MAPPED | REPORT (ING-*) | W0 ingest fixes |
| J2 | Detect same abstract entity across different domains/addresses; auto-establish relationship to sender | ✓ MAPPED | REPORT (RES-*), FEATURE-CATALOG AI-03 | W0 RES fixes → W2 AI-03 ingest-time resolution |
| J3 | See on canvas: abstract entities + senders + communications | ✓ MAPPED | FEATURE-CATALOG TM-02, AI-01 | W2/W3 |
| K | Traditional UI AND canvas circular treemap; AI sets relationships + circle labels | ✓ MAPPED | FEATURE-CATALOG TM-01/TM-02; app-packages §1 (d3 pack) | W3 |
| L | Email preview → correct AI analysis → updates relationships | ✓ MAPPED | REPORT (UI-*), FEATURE-CATALOG EN-04 | W1 UI honesty → W2 |
| M | Reprocess all emails up to a date | ✓ MAPPED | REPORT (RPR-1, REG-1/3) | W0/W1 |
| P1 | Full careful review of whole email AI analysis system (suspected bugs) | ✓ MAPPED | `email-system-review/REPORT.md` (53 confirmed) | done |
| P2 | Detailed step-by-step manual-testing runsheet Pedro runs himself | ✓ MAPPED | `email-system-review/MANUAL-TESTING-RUNSHEET.md` | done (per-wave runsheets to follow) |

## F. Product surfaces (prompt §7 feature block + canvas block)

| # | Clause | Status | Artifact | Wave |
|---|---|---|---|---|
| N | Excel-like tabular in-house/best-stack, scalable; agent suggests create/extract/add-update tables; ref kaszek-os-dev + review better ways | ◐ PARTIAL | FEATURE-CATALOG CV-03/EN-01; app-packages §2 (spreadsheet build-vs-adopt) | W3; **kaszek-os-dev not directly reviewed (external repo)** |
| O | Persistent exclusively-agentic-genui home; email-in reports; agent-generated persistent panels (info/design/format/components); drag/drop/expand/resize/snap/remove/hide/stash/bench + persistency | ✓ MAPPED | FEATURE-CATALOG HM-01/HM-02, CV-02 | W4 |
| T1 | Canvas: right-click custom, click-drag+keyboard, add/remove, more interactivity | ✓ MAPPED | FEATURE-CATALOG CI-01..07 | W3 |
| T2 | Prepare/plan/org for dramatic canvas complexity growth | ✓ MAPPED | FEATURE-CATALOG §2–§3 architecture notes | W3 |
| T3 | Comprehensive suggested-features doc (canvas/chat/drive/all pages), AI-integration as the tie | ✓ MAPPED | **`2026-07-22-FEATURE-CATALOG.md` IS this doc** (AI-* spine ties all) | done |
| U | Drive backups + versioning; robust against catastrophic loss | ✓ MAPPED | FEATURE-CATALOG DR-02, DR-06 | W4 |
| V | Chat agent deep context/search/integration w/ drive; research/manage/create files+dirs | ✓ MAPPED | FEATURE-CATALOG AI-05/AI-06, CH-01, DR-05 | W2/W4 |
| W1 | Visualize drive many ways; canvas circular treemap | ✓ MAPPED | FEATURE-CATALOG TM-04 | W3/W4 |
| W2 | Agent ui-generates on-the-spot custom viz per subfolder (images/thousands docs/varied sizes/tens GB), agentically frontend-represented | ◐ PARTIAL | TM-01 "leaf renderer slot" + AI-01 | W4; **deep per-content agentic leaf-gen is thin — expand** |
| S1 | Migrate OneDrive → polytoken (~500GB, all kinds); download all, upload single folder | ◐ PARTIAL | mentioned in launch W6 | **no mechanics doc** (bulk import/dedupe/resume) |
| S2 | Easily add polydrive files to chat | ✓ MAPPED | FEATURE-CATALOG CH-01/DR-03 | W4 |
| X | Persistent robust remote desktops; select one/multiple; live cost + per-hour | ✓ MAPPED | FEATURE-CATALOG DX-03; `cloud-desktop/RFC.md`, `AWS-ARCHITECTURE.md` | W6 |
| Y | Reduce frontend clunkiness (page change/interaction); find issues + research; fluid/frictionless/snappier/persistent | ◐ PARTIAL | app-packages §6 (Next15/React19 snappiness) | research only; **no exec wave** |

## G. Ventures + housekeeping

| # | Clause | Status | Artifact | Wave |
|---|---|---|---|---|
| R | Deeper inference layer; distributed inference; provide-LLM→earn-credits; others join→share gains; website/desktop/phone each different device; choose/recommended model optimal for hardware; run+share for all three simultaneously; idle compute→credits | ✓ MAPPED | `ecosystem/distributed-inference.md`, `e7-inference/ARCHITECTURE.md`, FEATURE-CATALOG DX-01/DX-02 | W6 (Phase 0 device-profiling → own-fleet → credits pilot) |
| AA | Save full prompt backup | ✓ MAPPED | `.planning/prompts/2026-07-22-vision-and-handoff.md` | done |
| AB | Business/organization research folder | ✓ MAPPED | `business/README.md` + 01–08 tracks | done; W6 execution |

## H. New emphases from the 2026-07-23 review request (not separable clauses in the original — flagged explicitly)

| # | Clause | Status | Artifact | Wave |
|---|---|---|---|---|
| US | **Actual user stories** — for emails and throughout the project | ✗ GAP | none (FEATURE-CATALOG = feature/asset view, not narrative user stories) | **no artifact** — needs a user-stories doc per surface |
| DP | **Design patterns throughout the project** (beyond visual identity) | ◐ PARTIAL | `docs/design/taste-references.md`, `58-IDENTITY.md` (visual); polytoken-design-system skill (UI kit) | interaction/UX patterns across surfaces not systematized |

---

## Gap summary — what is NOT yet accounted for (action list)

1. **C2/C3 — App-wide dead-code prune + file/dir refactor for scalability.** Meta-dir hygiene is
   done; the actual application source (apps/web, email-listener, packages) has no scheduled
   legacy/dead-code sweep or large-file/large-dir split. → **Add a "codebase hygiene" track to W1**
   (knip/ts-prune for TS dead exports, vulture/ruff for Python, import-linter already enforces
   listener layering; identify files >~400 lines and dirs >~15 files for split). Run as
   read-only audit first, then mechanical splits behind tests.
2. **US — User stories.** No narrative user-story artifact exists. → **Produce `USER-STORIES.md`**
   (email triage, entity curation, canvas/treemap, drive migration, home board, remote desktop,
   distributed inference), each as "As <persona> I want <goal> so that <value>" + acceptance
   criteria. Feeds the per-wave manual runsheets. Do before W2 so the AI spine targets real flows.
3. **Y — Frontend snappiness/frictionless.** Research exists (app-packages §6) but no execution
   wave. → **Add a "perceived-performance" item to W1**: route-transition audit, RSC/streaming
   boundaries, optimistic UI on canvas/inbox, prefetch, skeleton states; measure with a before/after
   trace.
4. **F — Cost optimization** as an explicit deliverable (not just research). → **Add a cost item to
   W1**: turn `cost-reliability.md` recommendations into concrete changes (model routing, cache,
   quota surfaces) with a measured baseline.
5. **E2 — Supabase declarative drift.** AWS drift is codified; DB side isn't checked. → **Add a
   migrations-vs-prod-schema drift check** (diff Drizzle schema against a prod schema dump) to the
   W1 drift item. (Prod-DB connection is classifier-blocked — Pedro runs the dump; we diff it.)
6. **S1 — OneDrive 500GB migration mechanics.** Only named as a W6 line. → **Write a migration
   design doc** (download strategy, content-addressed dedupe, resumable chunked upload, integrity
   verification, versioning-on-import) before W4 drive work so the vault design supports it.
7. **W2 — Agentic per-subfolder leaf visualization** (images vs thousands of docs vs huge mixed
   sizes). TM-01's "leaf renderer slot" is a hook, not the agentic generator. → **Expand TM track**
   with an agent capability that picks/gens a leaf viz by content profile.
8. **DP — Cross-surface interaction/design patterns.** Visual identity is governed; interaction
   patterns (empty states, loading, error surfacing, confirm-on-irreversible, selection model)
   aren't systematized. → **Fold a "UX pattern catalog" into the design-system skill** as W3 canvas
   work hardens the patterns.
9. **I3 — Extend SES forwarding to agent@ addresses.** Optional per prompt §3c; not scheduled.
   → leave as an optional W1 add-on (one Terraform rule + Lambda env).
10. **N — kaszek-os-dev reference** for the spreadsheet was not directly reviewed (separate repo,
    not in session scope). → app-packages §2 covered build-vs-adopt generically; if Pedro wants the
    specific comparison, add kaszek-os-dev to session sources.

Everything else (33 of ~43 atomic clauses) is **✓ MAPPED** to both an artifact and a wave.
