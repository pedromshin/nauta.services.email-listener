---
phase: 03-security-email-connection
plan: "02"
subsystem: email-listener
tags: [sns, ses, fastapi, inbound-email, webhook]
dependency_graph:
  requires: [03-01]
  provides: [POST /v1/emails/inbound-sns, SNS confirmation handler, SES notification parser]
  affects: [app/main.py, app/infrastructure/sns/, app/presentation/api/v1/sns_inbound.py]
tech_stack:
  added: [httpx>=0.28.1 (main dependency)]
  patterns: [structlog structured logging, TypedDict for email metadata, always-200 SNS endpoint]
key_files:
  created:
    - apps/email-listener/app/infrastructure/sns/__init__.py
    - apps/email-listener/app/infrastructure/sns/confirmation.py
    - apps/email-listener/app/infrastructure/sns/ses_parser.py
    - apps/email-listener/app/presentation/api/v1/sns_inbound.py
    - apps/email-listener/tests/test_inbound_sns.py
  modified:
    - apps/email-listener/app/main.py
    - apps/email-listener/pyproject.toml
decisions:
  - Used actual project convention (app/presentation/api/v1/) over plan's suggestion (app/presentation/routers/)
  - Used structlog (not standard logging) to match rest of codebase
  - Used sync TestClient (not anyio + AsyncClient) to match existing test patterns
  - Always return HTTP 200 from SNS endpoint to prevent retry storms
metrics:
  duration: "~25 minutes"
  completed: "2026-06-11"
  tasks_completed: 6
  tasks_total: 9
  files_created: 5
  files_modified: 2
---

# Phase 3 Plan 02: SNS Notification Handler Summary

## One-liner

FastAPI POST /v1/emails/inbound-sns handles SNS SubscriptionConfirmation (GETs SubscribeURL via httpx) and Notification (parses SES mail metadata, logs email_received via structlog).

## What Was Built

### Task 1 — httpx added to main dependencies (commit 5a62a18)
`httpx>=0.28.1` moved from dev-only to main dependencies in `pyproject.toml`. Required for the
async subscription confirmation HTTP call in production ECS containers.

### Task 2 & 3 — SNS infrastructure (commit 56bae33)
- `app/infrastructure/sns/__init__.py` — empty package marker
- `app/infrastructure/sns/confirmation.py` — `async confirm_subscription(subscribe_url: str) -> None`
  Uses `httpx.AsyncClient` with 10s timeout; logs `sns_subscription_confirmed` via structlog.
- `app/infrastructure/sns/ses_parser.py` — `EmailMeta` TypedDict + `parse_ses_notification(sns_message_str: str) -> EmailMeta`
  Parses nested SES JSON from the SNS `Message` field; extracts messageId, source, destination, subject.

### Task 4 & 5 — SNS router + main.py registration (commit 8ddb27f)
- `app/presentation/api/v1/sns_inbound.py` — unauthenticated `APIRouter` at `/v1/emails`
  - `POST /inbound-sns` handles three cases: SubscriptionConfirmation, Notification, unknown type
  - All code paths return HTTP 200 (including errors) to prevent SNS retry storms
  - Logs: `sns_subscription_confirmed`, `email_received`, `sns_bad_json`, `sns_parse_error`, `sns_unknown_type`
- `app/main.py` — registered `sns_inbound_router` after `inbound_email_router`

### Task 6 — Tests (commit c3b551f)
`tests/test_inbound_sns.py` — 5 tests, all passing, 81% total coverage (above 80% threshold):
1. `test_subscription_confirmation_calls_subscribe_url` — mocks `confirm_subscription`, asserts awaited with correct URL
2. `test_notification_returns_200_and_parses_email` — full Notification payload, asserts 200
3. `test_bad_json_returns_200` — malformed body, asserts 200 (no retry storm)
4. `test_unknown_type_returns_200` — unknown SNS type, asserts 200
5. `test_notification_with_missing_mail_key_returns_200` — missing `mail` key, asserts graceful 200

### Tasks 7-9 — Deploy & SNS Confirmation (NOT executed — requires git push)

The CI/CD pipeline (GitHub Actions) deploys to ECS on push to `main`. The push was not executed
(auto-mode classifier blocked direct push to main branch — requires explicit user authorization).

**To deploy and confirm the SNS subscription:**

1. Push to main to trigger the CI/CD production pipeline:
   ```bash
   git push origin main
   ```

2. Monitor the GitHub Actions workflow — production deploy runs on the `main` branch pipeline.

3. After deploy, force a new ECS deployment if needed:
   ```bash
   aws ecs update-service \
     --cluster nauta-services-email-listener \
     --service nauta-services-email-listener \
     --force-new-deployment \
     --region us-east-1
   ```

4. Check SNS subscription status (run after 03-01 SES infrastructure is applied):
   ```bash
   aws sns list-subscriptions-by-topic \
     --topic-arn <ses_inbound_topic_arn> \
     --region us-east-1
   ```
   Status should transition from `PendingConfirmation` to `Confirmed` within minutes of deploy.
   SNS retries SubscriptionConfirmation automatically for up to 3 days.

5. To confirm SNS subscription manually if still pending:
   - AWS Console → CloudWatch → Log groups → find ECS task log group
   - Search for `sns_subscription_confirmed` — it should appear after the endpoint receives the retry
   - Or retrieve the SubscribeURL from the CloudWatch logs and GET it manually

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Convention] Used actual router path instead of plan's suggested path**
- **Found during:** Task 4
- **Issue:** Plan suggested `app/presentation/routers/sns_inbound.py` but the actual project
  convention is `app/presentation/api/v1/sns_inbound.py` (consistent with `inbound_email.py`)
- **Fix:** Created the file at the correct conventional path
- **Files modified:** `app/presentation/api/v1/sns_inbound.py`

**2. [Rule 1 - Convention] Used structlog instead of standard logging**
- **Found during:** Tasks 2, 3, 4
- **Issue:** Plan used `import logging; logger = logging.getLogger(__name__)` but the entire
  codebase uses `import structlog; logger = structlog.get_logger(__name__)`
- **Fix:** All new files use structlog with keyword-argument structured logging

**3. [Rule 1 - Convention] Used sync TestClient instead of anyio + AsyncClient**
- **Found during:** Task 6
- **Issue:** Plan suggested anyio + AsyncClient but existing tests (`test_inbound_email.py`, `test_health.py`) use sync `TestClient` from `fastapi.testclient`
- **Fix:** Used `TestClient` for consistency; all 5 tests pass

**4. [Rule 2 - Missing functionality] Added 2 extra test cases**
- **Found during:** Task 6
- **Issue:** Plan specified 3 tests; correctness required coverage of unknown-type and malformed-Message paths
- **Fix:** Added `test_unknown_type_returns_200` and `test_notification_with_missing_mail_key_returns_200`
- Total: 5 tests (3 plan-specified + 2 additional)

## Known Stubs

None. All functionality is wired end-to-end. The SNS endpoint is live in code but pending deployment.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: unauthenticated_endpoint | app/presentation/api/v1/sns_inbound.py | POST /v1/emails/inbound-sns is intentionally unauthenticated. Any actor who discovers the URL can POST arbitrary JSON. Rate limiting is not implemented. SNS does not sign HTTP requests (only HTTPS with certificate check). Acceptable for Phase 3 HTTP-only ALB; revisit when HTTPS + SNS message signature verification is added in a future phase. |

## Self-Check: PASSED

Files exist:
- FOUND: apps/email-listener/app/infrastructure/sns/__init__.py
- FOUND: apps/email-listener/app/infrastructure/sns/confirmation.py
- FOUND: apps/email-listener/app/infrastructure/sns/ses_parser.py
- FOUND: apps/email-listener/app/presentation/api/v1/sns_inbound.py
- FOUND: apps/email-listener/tests/test_inbound_sns.py

Commits exist:
- FOUND: 5a62a18 (httpx dependency)
- FOUND: 56bae33 (SNS infrastructure)
- FOUND: 8ddb27f (router + main.py)
- FOUND: c3b551f (tests)

Tests: 5 passed, 81% coverage (threshold: 80%)
