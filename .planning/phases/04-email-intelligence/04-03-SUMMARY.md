---
phase: "04"
plan: "03"
subsystem: infrastructure/supabase
tags: [supabase, repositories, drizzle, dishka, di-container, terraform, bedrock]
dependency_graph:
  requires: ["04-01", "04-02"]
  provides: ["supabase-client-factory", "five-repository-adapters", "di-container-wiring", "bedrock-region-config", "bedrock-iam-invoke"]
  affects: ["04-04", "04-05", "04-06", "04-07", "04-08"]
tech_stack:
  added: ["supabase-py>=2.15.0", "anthropic>=0.40.0", "pypdf>=5.0.0", "pdfminer.six>=20240706", "pdf2image>=1.17.0", "boto3>=1.35.0", "pillow>=10.4.0"]
  patterns: ["lru_cache singleton factory", "supabase-py PostgREST chaining", "dishka APP-scope binding", "cast(dict[str,Any]) for JSON narrowing", "asyncio.run() test pattern", "Bedrock InvokeModel via ECS task IAM role (no secret)"]
key_files:
  created:
    - apps/email-listener/app/infrastructure/supabase/__init__.py
    - apps/email-listener/app/infrastructure/supabase/client.py
    - apps/email-listener/app/infrastructure/supabase/email_repository.py
    - apps/email-listener/app/infrastructure/supabase/attachment_repository.py
    - apps/email-listener/app/infrastructure/supabase/component_repository.py
    - apps/email-listener/app/infrastructure/supabase/entity_type_repository.py
    - apps/email-listener/app/infrastructure/supabase/extraction_repository.py
    - apps/email-listener/tests/test_settings_secrets.py
    - apps/email-listener/tests/test_supabase_repositories.py
    - apps/email-listener/tests/test_container.py
  modified:
    - apps/email-listener/app/settings.py
    - apps/email-listener/app/container.py
    - apps/email-listener/pyproject.toml
    - infrastructure/aws/variables.tf
    - infrastructure/aws/locals.tf
    - infrastructure/aws/ecs.tf
    - infrastructure/aws/iam.tf
decisions:
  - "LLM transport is AWS Bedrock (InvokeModel via ECS task IAM role), NOT the Anthropic direct API — all-AWS stack, IAM-role auth, no new long-lived secret"
  - "BEDROCK_REGION env var (falls back to AWS_TEXTRACT_REGION); BEDROCK_MODEL_ID overridable via env with DEFAULT_BEDROCK_MODEL_ID constant"
  - "bedrock:InvokeModel granted on the ECS TASK role (runtime call by app), scoped to Claude foundation-model + inference-profile ARNs — no wildcard *"
  - "lru_cache on get_supabase_client for singleton; dishka wraps with lambda to avoid MissingHintsError on lru_cache wrappers"
  - "cast(dict[str,Any], result.data[0]) at all supabase-py call sites — type narrowing without changing _from_row signatures"
  - "asyncio.run() for async repo methods in sync pytest — pytest-asyncio not installed, consistent with wave-1 pattern"
  - "SupabaseEntityTypeRepository.find_by_slug uses .is_(importer_id, None) for system defaults, .eq for tenant rows"
  - "SupabaseExtractionRepository.supersede_active uses update+neq, never delete (D-16)"
metrics:
  duration_minutes: 70
  completed_date: "2026-06-11"
  tasks_completed: 4
  tasks_total: 4
  files_created: 10
  files_modified: 7
---

# Phase 04 Plan 03: Supabase Repository Adapters + Container Wiring Summary

Five PostgREST repository adapters wired to domain ports via dishka DI container; settings extended with SUPABASE_URL/SUPABASE_SECRET_KEY plus AWS Bedrock config (BEDROCK_REGION, BEDROCK_MODEL_ID); Terraform grants Bedrock InvokeModel to the ECS task IAM role (no long-lived LLM secret).

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Settings + Supabase client factory | c837b24 | Done |
| 2 | Five Supabase repositories with importer_id isolation | 31784d5 | Done |
| 3 | Register repositories in dishka container | 448f18b | Done |
| 4 | Wire LLM transport into Terraform (Bedrock IAM) | 637099a | Done |
| ~~5~~ | ~~CHECKPOINT: Create Anthropic Secrets Manager secret~~ | — | **Obsoleted by Bedrock decision** |

Task 5 (the human-verify checkpoint to create an `ANTHROPIC_API_KEY` Secrets Manager secret) is **dropped**. With the Bedrock decision there is no secret to create — Bedrock access is granted by IAM at `terraform apply` time. The only remaining human step is the normal, non-blocking `terraform apply` (deferred, not a checkpoint).

## What Was Built

### Task 1 — Settings + Supabase Client Factory

`app/settings.py` extended with:
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY` — PostgREST connection (real Secrets Manager secret, unwrapped via `parse_secret_value()`)
- `BEDROCK_REGION` — Bedrock region for InvokeModel; `bedrock_region` property falls back to `AWS_TEXTRACT_REGION`
- `BEDROCK_MODEL_ID` — overridable Claude model id; `bedrock_model_id` property returns `DEFAULT_BEDROCK_MODEL_ID` when unset
- `AWS_TEXTRACT_REGION` — Textract region default `us-east-1`

Bedrock config carries **no secret parsing** — authentication is via the ECS task IAM role, not a credential. `app/infrastructure/supabase/client.py` provides `get_supabase_client()` decorated with `@lru_cache` — fail-closed (raises RuntimeError) if URL or key is empty. 18 settings/client tests, all pass.

### Task 2 — Five Repository Adapters

All five adapters implement their domain port Protocol, injected with `Client` via constructor. Key invariants:

| Repository | Table | importer_id isolation | Special |
|---|---|---|---|
| SupabaseEmailRepository | emails | upsert on `(importer_id,message_id)` | `find_by_message_id` double-eq filter |
| SupabaseAttachmentRepository | email_attachments | via email_id FK | — |
| SupabaseComponentRepository | email_components | via email_id FK | embedding tuple→list serialization |
| SupabaseEntityTypeRepository | entity_types | `.is_(None)` for system, `.eq()` for tenant | nested `entity_type_fields(*)` select |
| SupabaseExtractionRepository | extraction_records | eq on component_id | `supersede_active` update-not-delete (D-16) |

These adapters are LLM-transport-agnostic and were left unchanged by the Bedrock decision. 6 mock-client tests assert key behaviors. mypy, import-linter (3/3 contracts), bandit all clean.

### Task 3 — Dishka Container Registration

`app/container.py` now provides:
- `Client` via `lambda: get_supabase_client()` (APP scope; lru_cache preserves singleton)
- 5 repository adapters bound to their port interfaces at APP scope
- `ReceiveInboundEmailUseCase` (unchanged)

5 container resolution tests confirm each port resolves to the correct concrete type.

### Task 4 — Terraform LLM Transport (AWS Bedrock)

- `variables.tf`: dropped `anthropic_api_key_arn_prod/_staging`; added `bedrock_region` (default `us-east-1`).
- `locals.tf`: dropped `anthropic_api_key_arn`; added `bedrock_region` to both `production` and `staging` environment maps.
- `ecs.tf`: removed `ANTHROPIC_API_KEY` from the `secrets` concat; added `BEDROCK_REGION` to the plain `environment` block. `BEDROCK_MODEL_ID` is intentionally not set in TF — the app defaults it via `DEFAULT_BEDROCK_MODEL_ID` and it stays env-overridable.
- `iam.tf`: removed anthropic ARNs from the execution-role `GetSecretValue` statement; added a new `bedrock:InvokeModel` + `bedrock:InvokeModelWithResponseStream` statement on the ECS **task** role (runtime call by app code), scoped to Claude ARNs only:
  - `arn:aws:bedrock:<region>::foundation-model/anthropic.claude-*`
  - `arn:aws:bedrock:<region>:<account>:inference-profile/*.anthropic.claude-*`

`terraform fmt -check` (exit 0) and `terraform validate` (Success) both pass. **`terraform apply` was NOT run** — applying the IAM grant is the deferred, non-blocking human step.

## Deviations from Plan

### Architectural Decision (Rule 4 — user-directed)

**[Rule 4 - Architectural] LLM transport switched from Anthropic direct API to AWS Bedrock**
- **Decision owner:** User (explicit choice; the original `ANTHROPIC_API_KEY` direct-API approach was an unreviewed planner default)
- **Rationale:** The entire stack is AWS; Bedrock authenticates via the existing ECS task IAM role, avoiding a new long-lived secret and its rotation/storage burden
- **Impact:** Removed `ANTHROPIC_API_KEY` field + property from settings; removed all `anthropic_api_key_arn` Terraform wiring; added `BEDROCK_REGION`/`BEDROCK_MODEL_ID` settings and a scoped `bedrock:InvokeModel` IAM policy on the task role; **obsoleted the Task 5 human-verify checkpoint** (no secret to create)
- **Files modified:** `app/settings.py`, `tests/test_settings_secrets.py`, `infrastructure/aws/{variables,locals,ecs,iam}.tf`
- **Commits:** e15503f (settings), 637099a (terraform)

### Auto-fixed Issues

**1. [Rule 1 - Bug] dishka MissingHintsError on lru_cache factory**
- **Found during:** Task 3
- **Issue:** `provider.provide(get_supabase_client, provides=Client)` raises `MissingHintsError` because dishka cannot introspect `_lru_cache_wrapper.__call__` parameters
- **Fix:** Wrapped in `lambda: get_supabase_client()` with explicit `scope=Scope.APP` — singleton guarantee preserved via lru_cache
- **Files modified:** `app/container.py`
- **Commit:** 448f18b

**2. [Rule 1 - Bug] Test patch target wrong**
- **Found during:** Task 3 test run
- **Issue:** Patching `app.infrastructure.supabase.client.get_supabase_client` did not intercept the lambda call in container.py (lambda captured the function reference at import time)
- **Fix:** Changed patch target to `app.container.get_supabase_client` (the name imported into container.py)
- **Files modified:** `tests/test_container.py`
- **Commit:** 448f18b

## Known Stubs

None — all five repositories are fully wired to live Supabase tables. Data flow is end-to-end; stubs exist only in test doubles (MagicMock), not in production paths.

## Threat Flags

None — no new network endpoints or auth paths beyond the plan's threat model. Notable trust-boundary changes from the Bedrock decision **reduce** secret surface:
- Eliminated the planned `ANTHROPIC_API_KEY` long-lived secret entirely; LLM auth now flows through the ECS task IAM role.
- `bedrock:InvokeModel` is scoped to Claude foundation-model + inference-profile ARNs (no wildcard `*` resource).
- The Supabase `sb_secret_...` key (RLS-bypass) remains the only LLM/DB credential; it is sourced exclusively from AWS Secrets Manager and never logged.

## Deferred (non-blocking) human step

Run `terraform apply` (per environment) to activate the `bedrock:InvokeModel` task-role grant and the `BEDROCK_REGION` env var. This is the normal deploy step — no secret creation, no checkpoint gate. Verify after apply:

```bash
aws ecs describe-task-definition \
  --task-definition nauta-services-email-listener \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`BEDROCK_REGION`]'
```

## Self-Check: PASSED

- `app/infrastructure/supabase/client.py` — EXISTS
- `app/infrastructure/supabase/email_repository.py` — EXISTS
- `app/infrastructure/supabase/attachment_repository.py` — EXISTS
- `app/infrastructure/supabase/component_repository.py` — EXISTS
- `app/infrastructure/supabase/entity_type_repository.py` — EXISTS
- `app/infrastructure/supabase/extraction_repository.py` — EXISTS
- `app/container.py` — EXISTS (updated)
- `app/settings.py` — EXISTS (Bedrock fields, no ANTHROPIC_API_KEY)
- `tests/test_settings_secrets.py` — EXISTS (18 tests pass, commits c837b24 + e15503f)
- `tests/test_supabase_repositories.py` — EXISTS (6 tests pass, commit 31784d5)
- `tests/test_container.py` — EXISTS (5 tests pass, commit 448f18b)
- `infrastructure/aws/iam.tf` — EXISTS (Bedrock InvokeModel on task role, commit 637099a)
- Commits c837b24, 31784d5, 448f18b, e15503f, 637099a — all present in git log
- `grep -c ANTHROPIC_API_KEY` across app/ + infrastructure/aws/ returns 0 — verified removed
