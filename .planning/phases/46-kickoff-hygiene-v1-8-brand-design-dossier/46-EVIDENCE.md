# Phase 46 Plan 01 — HYGN-01 Connected-Env Verification Evidence

**Purpose:** Honest evidence for the locally-feasible subset of backlog 999.3 — blocked ≠ passed.
Every command below was actually executed in this checkout on 2026-07-09. Raw outputs are copied
verbatim with credential material stripped; only model ids, a registry version hash, and numeric
aggregates are recorded.

---

## HYGN-01 — Eval harness (999.3)

### What was run

Per `.planning/milestones/v1.2-phases/16-studio-foundation-eval-harness-history-page-ideas-tabs/16-02-SUMMARY.md`
("Deferred: Task 4 — Record eval baseline against live Bedrock"), from `apps/email-listener`:

**Attempt 1 — smoke connectivity check (succeeded):**
```
uv run python -m scripts.genui_eval.run_eval --label smoke --limit 1 --no-judge
```
Result: `PASS`. 1/1 completed, 0 failed. Confirms live Bedrock reachability via the existing IAM
transport (`INFO:botocore.credentials:Found credentials in shared credentials file: ~/.aws/credentials`,
then a real `POST https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-haiku-4-5-20251001-v1:0/invoke "HTTP/1.1 200 OK"`).
Report: `apps/email-listener/scripts/genui_eval/reports/20260709T231511Z-smoke.json` (+ `.md`).

**Attempt 2 — full baseline, all 34 golden-set prompts (BLOCKED — recorded as evidence):**
```
uv run python -m scripts.genui_eval.run_eval --label baseline
```
Result: `blocked`. Failed with exit code 1 after ~40 seconds. Two chained real failures, exact text
(secrets already absent from the source error):

1. Bedrock throttling under the harness's hardcoded `asyncio.Semaphore(3)` concurrency cap:
   ```
   INFO:httpx:HTTP Request: POST https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-haiku-4-5-20251001-v1:0/invoke "HTTP/1.1 429 Too Many Requests"
   INFO:anthropic._base_client:Retrying request to /v1/messages in 0.489192 seconds
   INFO:httpx:HTTP Request: POST https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-haiku-4-5-20251001-v1:0/invoke "HTTP/1.1 429 Too Many Requests"
   INFO:anthropic._base_client:Retrying request to /v1/messages in 0.917034 seconds
   INFO:httpx:HTTP Request: POST https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-haiku-4-5-20251001-v1:0/invoke "HTTP/1.1 429 Too Many Requests"
   ...
   anthropic.RateLimitError: Error code: 429 - {'message': 'Too many requests, please wait before trying again.'}
   ```
2. The per-prompt `try/except` in `run_eval.py::_eval_prompt` is designed to catch exactly this
   (module docstring: "Per-prompt try/except: one prompt failure does not abort the run") but its
   own `logger.error("eval_prompt_failed", ..., exc_info=True)` call crashed instead, because the
   Windows console codepage (`cp1252`) cannot encode a character in the formatted traceback:
   ```
   File ".../structlog/_output.py", line 113, in msg
       print(message, file=f, flush=True)
   File ".../encodings/cp1252.py", line 19, in encode
       return codecs.charmap_encode(input,self.errors,encoding_table)[0]
   UnicodeEncodeError: 'charmap' codec can't encode characters in position 117-138: character maps to <undefined>
   ```
   This second failure is a genuine, previously-undiscovered bug in `run_eval.py`'s error path on
   Windows (it escapes the per-prompt guard and aborts the entire `asyncio.gather`, defeating the
   "one prompt failure does not abort the run" design contract). It is **out of scope to fix** in
   this evidence-only plan (not caused by this plan's changes, and `run_eval.py` is not in this
   plan's `files_modified`) — logged here as a discovered defect, not silently worked around.

   No stale `uvicorn`/`python` processes were killed before this attempt: `run_eval.py` drives the
   `GenerateUiSpecUseCase` directly via `create_container()` (see `run_eval.py:270`), never over
   HTTP, so a locally-running FastAPI dev server (confirmed present: `uvicorn.exe app.main:app
   --host 0.0.0.0 --port 8000`, PIDs 46592/56172/57824) is not on this strand's call path and could
   not have caused or masked the 429/encoding failure. Verified via the generated report files
   (below), not terminal streaming.

**Attempt 3 — bounded fallback per plan's own guidance ("if rate-limited... capture a bounded run
`--limit 5`"), with the encoding workaround (SUCCEEDED — produced the recorded numbers):**
```
PYTHONIOENCODING=utf-8 uv run python -m scripts.genui_eval.run_eval --label baseline --limit 5
```
Result: `PASS`. 5/5 completed, 0 failed, live LLM-as-judge scoring included.
Report: `apps/email-listener/scripts/genui_eval/reports/20260709T231753Z-baseline.json` (+ `.md`).

**Attempt 4 — deterministic (`--no-judge`) pass over the identical 5 prompts, for a same-corpus
compare_reports delta (SUCCEEDED):**
```
PYTHONIOENCODING=utf-8 uv run python -m scripts.genui_eval.run_eval --label baseline-nojudge --limit 5 --no-judge
```
Result: `PASS`. 5/5 completed, 0 failed.
Report: `apps/email-listener/scripts/genui_eval/reports/20260709T231930Z-baseline-nojudge.json` (+ `.md`).

```
uv run python -m scripts.genui_eval.compare_reports scripts/genui_eval/reports/20260709T231930Z-baseline-nojudge.json scripts/genui_eval/reports/20260709T231753Z-baseline.json
```

### Recorded numbers (verbatim from the generated reports — Attempt 3, the recorded run)

- **registry_version:** `2562c1fb84e66b1c7c48cf3dba5b7e67e8adac1a3e69bc8de1ef2e3aebcf6216`
  (from the run's structlog `registry_version=` field, identical across all requests in the run)
- **Generator model id:** `us.anthropic.claude-haiku-4-5-20251001-v1:0` (`settings.genui_model_id`,
  recorded in the report's `model_id` field)
- **Judge model id:** `us.anthropic.claude-sonnet-4-6` (`settings.genui_escalation_model_id`,
  `DEFAULT_GENUI_ESCALATION_MODEL_ID` — the runner uses the escalation model as the judge)
- **Rubric weights** (`scripts/genui_eval/rubric.py::WEIGHTS`): valid-spec 0.30, composed 0.30,
  on-intent 0.25, a11y 0.15
- **Composition thresholds** (`rubric.py`): `COMPOSE_MIN_NODES=6`, `COMPOSE_MIN_TYPES=3`,
  `COMPOSE_MIN_DEPTH=2`, `COMPOSE_MIN_LAYOUT_CHILDREN=1`

**Run aggregates (Attempt 3 — `baseline`, 5 prompts, live judge):**

| total_prompts | completed | failed | mean_overall | mean_valid_spec | mean_composed | mean_on_intent | mean_a11y |
|---|---|---|---|---|---|---|---|
| 5 | 5 | 0 | 0.9495 | 1.0 | 1.0 | 0.798 | 1.0 |

`mean_brand_score`, `mean_distinctiveness`, `mean_retrieval_overlap` are all `null` in this run
(no `--style-pack`/`--all-packs` flag used — baseline run has `style_pack_id=None` throughout, so
the brand judge, which is gated on a known `style_pack_id`, never fires; see `run_eval.py:178-185`).

**compare_reports delta (`baseline-nojudge` vs `baseline`, same 5 prompts):**

| Criterion | Baseline (no-judge) | Candidate (live judge) | Delta |
|-----------|----------|-----------|-------|
| overall | 1.000 | 0.950 | -0.050 |
| valid-spec | 1.000 | 1.000 | +0.000 |
| composed | 1.000 | 1.000 | +0.000 |
| on-intent | N/A | 0.798 | N/A |
| a11y | 1.000 | 1.000 | +0.000 |

Regressions (delta < -0.05, driven purely by the judge subtracting weighted on-intent score, not a
real quality regression — the no-judge pass has no on-intent term at all):

| Prompt ID | Baseline | Candidate | Delta |
|-----------|----------|-----------|-------|
| 9 | 1.000 | 0.905 | -0.095 |
| 8 | 1.000 | 0.930 | -0.070 |

Per-prompt judge rationale (verbatim, truncated field as stored in the report) for the two lowest
on-intent scores in-sample: prompt 9 (on-intent 0.62) — "covers top 5 performers... but uses
stacked cards instead of a proper chart for the trend. The deal pipeline stages don't match the
requested flow..."; prompt 8 (on-intent 0.72) — "falls short on several key points: the layout
uses a 2-column grid (not mobile-first with up to 3 columns), there are no explicit lo[ading
states]...".

### Golden-set corpus coverage note

The 34-prompt corpus (`packages/genui/src/eval/golden-set.json`) spans 11 categories: Landing/
Marketing (7), SaaS App Shell (6), Dashboard/Admin (4), Internal Tool (4), Weird/Curveball (4),
Portfolio (2), UI Component (2), Data Tables/Grids (2), Form/Multi-step (1), Clone (1),
E-commerce (1). The 5-prompt bounded evidence run (ids 1, 5, 7, 8, 9) covers Landing/Marketing,
SaaS App Shell, and Dashboard/Admin only — it does **not** include the sole Form/Multi-step
prompt (id 25) or exercise a `--style-pack`/`--all-packs` run. Re-running the full 34-prompt
corpus (or `--all-packs`, which multiplies load ~6x) was not attempted after Attempt 2's 429s —
doing so risks re-triggering the same Bedrock throttling against a shared account-level quota
(plausibly also drawn on by the concurrently-running Phase 43 track's own Bedrock-backed chat
testing in this same checkout) and the same unresolved Windows encoding crash on any subsequent
failure. This scope limitation is recorded honestly below per-DEF rather than papered over.

### Per-DEF disposition

- **DEF-17-05-01** ("Connected-env live `--all-packs` evaluation", Phase 17): **blocked**. The
  harness's `--all-packs` mode (which sets `style_pack_id` per pack and enables the brand judge,
  producing `mean_brand_score`/`mean_distinctiveness`) was not run. `mean_brand_score` and
  `mean_distinctiveness` are `null` in every report produced today. Command that would exercise
  it: `uv run python -m scripts.genui_eval.run_eval --label baseline --all-packs`. Not attempted
  — see corpus-coverage note above (6x load on an endpoint already observed to 429 at 1x load).
- **DEF-18-03-01** ("Live eval lift-vs-baseline on the profile/feed/nav catalog-expansion corpus",
  Phase 18): **blocked (partial)**. The harness itself is proven functional end-to-end against
  live Bedrock (Attempt 3, `composed_score: 1.0` for all 5 in-sample prompts — i.e. the
  composed-not-placeholder rubric passes broadly), but none of the 5 bounded-run prompts
  specifically targets the Phase-18 component types (avatar/feed-item/nav/section) called out by
  the original deferred item, so the specific "new components render composed, not degraded to
  generic cards" claim is not directly evidenced by this run.
- **DEF-19-01** ("Live Bedrock eval-harness lift on form-heavy corpus prompts", Phase 19):
  **blocked (partial)**. The golden set contains exactly one Form/Multi-step prompt (id 25); the
  5-prompt bounded evidence run did not include it (ran ids 1/5/7/8/9). The harness mechanism
  itself is proven working (Attempts 3-4), but the form-specific lift measurement was not
  captured in this bounded run.
- **DEF-20-01**: see the Code-island isolation section below — not an eval-harness item.

**Command that produced each disposition:** DEF-17-05-01 → not run (see command above, deferred);
DEF-18-03-01 / DEF-19-01 → `PYTHONIOENCODING=utf-8 uv run python -m scripts.genui_eval.run_eval
--label baseline --limit 5` (Attempt 3), cross-referenced against
`packages/genui/src/eval/golden-set.json` category/id coverage.

---

## HYGN-01 — Code-island isolation (999.3, DEF-20-01)

### Playwright toolchain availability check

`apps/web/e2e/code-island-isolation.spec.ts` (Phase 20 SPIKE) exercises the jailed-eval code-island
sandbox — opaque-origin iframe jail, inline `<meta>` CSP, cookie/localStorage/parent-DOM/navigation
denial — in a real browser, across both configured engines in `apps/web/playwright.config.ts`:
**chromium** and **firefox** (`projects: [{ name: "chromium", ... }, { name: "firefox", ... }]`).
The spec's own header states jsdom would pass vacuously (no real `sandbox`/CSP/opaque-origin
enforcement), so this browser run is the only way to exercise the runtime guarantee directly.

Check command + output:
```
ls node_modules/@playwright          -> No such file or directory
ls apps/web/node_modules/@playwright -> No such file or directory
grep -n "playwright" apps/web/package.json package.json -> (no matches)
```
`@playwright/test` is genuinely absent from both the root and `apps/web` `node_modules`, and is not
declared in either `package.json`. Making the spec runnable requires
`npm i -D @playwright/test && npx playwright install chromium firefox`, which mutates root
`package.json`/`package-lock.json`.

**Disposition: blocked.** Per this plan's concurrency constraint, no npm dependency may be
installed and root `package.json`/`package-lock.json` must not be mutated while the Phase 43
track owns that surface in a parallel run against the same checkout. `DEF-20-01` is therefore
recorded `blocked (browser toolchain uninstallable under the Phase-46 concurrency constraint)` —
not run, not faked, not worked around by installing anyway.

### Deterministic substitute: host-side AST-allowlist vitest proof

Per the spec's own header ("The host-side AST allowlist (`validate-island-code.test.ts`, ... vitest
cases) is the primary, deterministic proof already green; this spec is the runtime backstop for
that allowlist"), the locally-feasible substitute was run — no new dependency required (`vitest` is
already hoisted to the workspace root `node_modules/.bin`):

```
cd packages/genui
npx vitest run src/sandbox/validate-island-code.test.ts
```

Verbatim result:
```
 RUN  v2.1.9 C:/Users/pc/Desktop/nauta.services.email-listener/packages/genui

 ✓ src/sandbox/validate-island-code.test.ts (39 tests) 38ms

 Test Files  1 passed (1)
      Tests  39 passed (39)
   Start at  20:16:36
   Duration  2.05s (transform 103ms, setup 0ms, collect 150ms, tests 38ms, environment 1.24s, prepare 119ms)
```

39/39 passed (the spec file's own header comment references "24 vitest cases" — the file has since
grown to 39 test cases; the verbatim count recorded here is what was actually observed running
today, not the stale comment).

This proves the AST-allowlist gate that the sandbox's static code-safety guarantee rests on is
green and deterministic. Combined with the isolation spec's own stated primacy ordering (AST
allowlist = primary/deterministic proof; Playwright spec = runtime backstop only), the isolation
guarantee is substantively evidenced even with the runtime browser spec blocked — DEF-20-01's
underlying safety property is not left completely unverified, only its cross-browser runtime
confirmation is deferred.

### Dependency-mutation guard verification

```
git status --porcelain package.json package-lock.json
```
Output: empty (no changes) — confirmed both before and after this evidence-gathering session. No
`npm install`/`npm i` command was run at any point in this plan.

---
