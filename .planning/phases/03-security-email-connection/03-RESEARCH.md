# Phase 3: Security + Email Connection - Research

**Researched:** 2026-06-11
**Domain:** Gmail inbound email → HTTP webhook, durable receipt scaffolding, API key security
**Confidence:** MEDIUM (PoC path HIGH; SES production scaffolding MEDIUM)

---

## Summary

Phase 3 wires agent@magnitudetech.com.br (a Google Workspace Gmail account) to the already-live
POST /v1/emails/inbound endpoint running on ECS Fargate. The goal is a real email arriving in
service logs — a validated end-to-end path — not a production-grade pipeline.

The service endpoint already exists, accepts JSON, and is protected by X-API-Key. The two tasks
are: (1) choose and configure a Gmail-to-webhook bridge, and (2) scaffold the durable receipt
pattern (EMAIL-02) without necessarily implementing it fully in this phase.

The simplest valid PoC path is **Zapier (or Make.com)**: Gmail triggers on new email to
agent@magnitudetech.com.br, Zapier maps fields to the InboundEmailIn JSON shape, and POSTs to
the ALB with the X-API-Key header. Zero infrastructure changes, proven in <30 minutes.
The Gmail API + Cloud Pub/Sub path is more production-worthy but adds OAuth service-account setup,
HTTPS/TLS cert requirement, and a 7-day watch-renewal loop — non-trivial overhead for a PoC.

**Primary recommendation:** Use Zapier (free tier) for the PoC. Scaffold the SES+S3+SQS
architecture in Terraform (commented or separate module) so it is ready for v2 production wiring.

---

## Project Constraints (from CLAUDE.md)

- Immutable only: always return new objects (applies to Python domain entities — already frozen dataclasses)
- Named exports exclusively
- Type everything explicitly; `unknown` → narrow when unsure
- Files: 200-400 lines typical, 800 max
- Validate inputs at system boundaries (Pydantic — already done at the router)
- Use `uv`/`pip` for Python services (this project)
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- TDD: test first (RED), implement (GREEN), refactor (IMPROVE)
- Store secrets in env vars only; surface missing secrets at startup
- Parameterized queries for SQL (not applicable here — no DB layer yet)
- Log detailed errors server-side; friendly messages client-side

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gmail inbound trigger | External bridge (Zapier/Gmail API) | — | Gmail delivers; bridge transforms and POSTs |
| Payload normalization | API / Backend (FastAPI router) | — | InboundEmailIn Pydantic model already validates |
| Authentication | API / Backend (middleware) | — | require_api_key already enforces X-API-Key |
| Structured logging | API / Backend | — | ReceiveInboundEmailUseCase already logs via structlog |
| Durable receipt (scaffold) | Infrastructure (SES+S3+SQS) | — | Future: SES receipt rule writes to S3, SQS notifies consumer |

---

## Standard Stack

### Core (PoC path)

| Component | Version/Tier | Purpose | Notes |
|-----------|-------------|---------|-------|
| Zapier | Free tier | Gmail → HTTP POST bridge | No infrastructure, no OAuth, instant setup [ASSUMED] |
| Existing FastAPI endpoint | POST /v1/emails/inbound | Receives normalized JSON | Already live on ECS Fargate |
| X-API-Key middleware | Already deployed | Auth gate | Header: `X-API-Key` |

### Core (Production scaffold — SES path)

| Component | Version | Purpose | Notes |
|-----------|---------|---------|-------|
| AWS SES (inbound) | — | Receive SMTP for agent@magnitudetech.com.br | Requires MX record on magnitudetech.com.br domain [ASSUMED] |
| Amazon S3 | — | Durable email store (raw .eml) | SES writes before processing — EMAIL-02 |
| Amazon SQS | — | Work queue decouples receipt from processing | Prevents double-processing via visibility timeout |
| SES Receipt Rule | — | Trigger: deliver to S3, notify SQS | Configured per recipient/domain |

### No Packages to Install

The PoC path (Zapier bridge) requires zero Python package changes. The existing `InboundEmailIn`
Pydantic model already accepts the fields Zapier can provide.

---

## Package Legitimacy Audit

No new packages required for Phase 3 PoC. Section not applicable.

---

## Gmail → Service: Option Analysis

### Option A: Zapier (RECOMMENDED for PoC) [ASSUMED]

**How it works:**
1. Zapier "New Email" trigger on agent@magnitudetech.com.br Gmail (OAuth, user-granted)
2. Zapier "Webhooks by Zapier" action: POST to `http://<ALB_DNS>/v1/emails/inbound`
3. Zapier maps Gmail fields → InboundEmailIn JSON body
4. Zapier sets custom header `X-API-Key: <value>`

**Pros:**
- Zero infrastructure changes; zero code changes
- Works over HTTP (ALB has no HTTPS yet — Zapier supports plain HTTP)
- Free tier: 100 tasks/month (enough for PoC)
- Setup time: ~20 minutes
- Validates the entire end-to-end path immediately

**Cons:**
- Not production-appropriate (Zapier is a third party handling email content)
- 15-minute polling delay on free tier (not real-time push)
- Payload is Zapier's Gmail format, needs field mapping

**Payload mapping** (Zapier Gmail fields → InboundEmailIn):
```json
{
  "sender": "{{From}}",
  "recipients": ["{{To}}"],
  "subject": "{{Subject}}",
  "raw_body": "{{Body Plain}}",
  "headers": {},
  "attachments": []
}
```

### Option B: Gmail API + Google Cloud Pub/Sub [ASSUMED]

**How it works:**
1. Create GCP Pub/Sub topic + push subscription pointing to ALB endpoint
2. Call Gmail API `watch()` with the Pub/Sub topic (must renew every 7 days)
3. Gmail pushes notification to Pub/Sub; Pub/Sub pushes JWT-signed POST to endpoint
4. Endpoint receives Pub/Sub envelope, decodes base64, fetches full email via Gmail API

**Pros:**
- Near-realtime (seconds latency)
- Official Google-supported path
- No third-party handling of email content

**Cons:**
- Requires HTTPS with valid TLS cert (Pub/Sub rejects plain HTTP) — ALB currently HTTP-only
- Requires GCP project + service account + IAM setup
- Pub/Sub push envelope wraps email notification; endpoint must be adapted to decode it
- Gmail `watch()` requires renewal every 7 days (cron job needed)
- Payload is a Pub/Sub envelope with base64-encoded Gmail historyId, NOT the full email — must
  call Gmail API to fetch the actual message (adds OAuth token management)
- Full email content requires an additional Gmail API read call per notification
- Setup time: 2-4 hours minimum

**Verdict:** Appropriate for production, too complex for this PoC phase.

### Option C: Gmail auto-forward to a parsing service (e.g., Mailgun inbound) [ASSUMED]

**How it works:** Gmail filter forwards a copy to a Mailgun/SendGrid inbound address; those
services POST a parsed JSON payload to the endpoint.

**Pros:** Simple Gmail-side setup; parsing service handles MIME

**Cons:** Adds a billable third-party parsing service; introduces another credential to manage;
overkill for PoC when Zapier already covers the need.

**Verdict:** Not recommended for PoC.

### Option D: Direct SES inbound (production path) [ASSUMED]

**How it works:** MX record for magnitudetech.com.br (or subdomain) points to AWS SES;
SES receipt rule writes .eml to S3 + notifies SQS; consumer Lambda or ECS task reads SQS,
fetches .eml from S3, POSTs to endpoint.

**Pros:** Fully durable (EMAIL-02), production-grade, no third-party
**Cons:** Requires DNS change to magnitudetech.com.br MX record, domain verification in SES,
Lambda or polling consumer implementation, and terraform for SES + S3 + SQS + IAM. Much larger
scope than PoC.

**Verdict:** Target architecture to scaffold; not to implement fully in Phase 3 PoC.

---

## Existing Endpoint: What It Accepts

From `apps/email-listener/app/presentation/api/v1/inbound_email.py` [VERIFIED: codebase]:

```
POST /v1/emails/inbound
Header: X-API-Key: <value>
Content-Type: application/json

{
  "sender": string (1..998 chars),
  "recipients": [string, ...] (min 1),
  "subject": string (optional, max 998),
  "raw_body": string (optional, max 10 MiB),
  "headers": {string: string} (optional),
  "attachments": [] (optional, metadata only)
}

Response: 202 {"status": "ok", "data": {"received": true, "attachment_count": N}}
```

**No schema changes needed** for the Zapier PoC. The existing model accepts all the fields
Zapier can provide. `attachments` defaults to `[]` which is fine for PoC.

---

## Authentication Flow

From `apps/email-listener/app/presentation/middleware/auth.py` [VERIFIED: codebase]:

- Header name: `X-API-Key` (configurable via `API_KEY_HEADER` setting)
- Staging/production: `API_KEY` env var must be set; empty = 503
- Comparison: `secrets.compare_digest` (timing-safe)
- Zapier supports custom headers on webhook actions — set `X-API-Key: <API_KEY>` in the Zapier
  webhook step

The API_KEY for production/staging is already set as a GitHub secret and injected into ECS task
definitions (from Phase 2). The Zapier Zap needs the same key value.

---

## ALB Endpoint (Current State)

From `infrastructure/aws/outputs.tf` and `alb.tf` [VERIFIED: codebase]:

- Production: `http://<alb_dns_name>/v1/emails/inbound` (port 80)
- Staging: `http://<alb_dns_name>:8080/v1/emails/inbound`
- ALB DNS: retrieved via `terraform output alb_dns_name`
- **No HTTPS yet** — this is why Pub/Sub path is blocked (requires valid TLS cert)
- Zapier supports HTTP POST to plain HTTP URLs — PoC is unblocked

For production (Option D / SES path), HTTPS + ACM cert will be needed anyway (separate phase).

---

## Durable Receipt Architecture (EMAIL-02 Scaffold)

The SES + S3 + SQS pattern is the standard AWS answer to EMAIL-02. It should be scaffolded
as Terraform (even if not applied) so the production migration is a `terraform apply` away.

**Pattern** [ASSUMED based on AWS docs]:

```
Internet → SES (MX receipt rule) → S3 bucket (raw .eml)
                                 → SNS topic → SQS queue
                                                  ↓
                                         Consumer (ECS task or Lambda)
                                         reads SQS, fetches .eml from S3,
                                         POSTs to /v1/emails/inbound
```

**Key properties:**
- S3 write is atomic before any notification fires — no email lost on consumer crash
- SQS visibility timeout prevents double-processing (consumer must ack/delete after success)
- Dead-letter queue (DLQ) captures processing failures for retry
- SES requires domain/email verification + MX record pointing to `inbound-smtp.<region>.amazonaws.com`

**Terraform modules to scaffold** (not apply in PoC):
- `aws_ses_receipt_rule_set` + `aws_ses_receipt_rule`
- `aws_s3_bucket` (email store, lifecycle policy)
- `aws_sqs_queue` (main + DLQ)
- `aws_sns_topic` + `aws_sns_topic_subscription`
- IAM: SES → S3 write, SES → SNS publish, consumer → SQS + S3 read

---

## Architecture Patterns

### System Architecture Diagram (PoC)

```
[Sender] → Gmail (agent@magnitudetech.com.br)
                ↓ (Zapier polls every 15 min)
           [Zapier Zap]
           - Trigger: New Gmail email
           - Action: POST to ALB
                ↓
      [ALB :80 (HTTP)] → [ECS Fargate: FastAPI]
                              ↓
                    require_api_key (X-API-Key)
                              ↓
                    InboundEmailIn (Pydantic)
                              ↓
                    ReceiveInboundEmailUseCase
                              ↓
                    structlog → CloudWatch Logs
```

### System Architecture Diagram (Target / SES production)

```
[Sender] → SES inbound (MX: magnitudetech.com.br)
                ↓
          SES Receipt Rule
           ├── S3 (raw .eml) ← durable store
           └── SNS → SQS
                       ↓
              Consumer (Lambda or ECS polling)
              - Fetches .eml from S3
              - Parses/maps to InboundEmailIn
              - POSTs to /v1/emails/inbound
```

---

## Common Pitfalls

### Pitfall 1: Zapier free tier 15-minute polling delay
**What goes wrong:** Emails don't appear in logs for up to 15 minutes; team thinks integration is broken.
**Why it happens:** Free Zapier plan polls Gmail rather than receiving a push.
**How to avoid:** Document the delay expectation; Zapier Starter plan offers faster polling (2 min).
**Warning signs:** Email sent but no log entry for >15 minutes.

### Pitfall 2: `recipients` field must be a JSON array
**What goes wrong:** Zapier sends `"To"` as a comma-separated string, failing Pydantic validation (`list[str]` required).
**Why it happens:** Gmail API / Zapier returns `To` as a string like `"alice@example.com, bob@example.com"`.
**How to avoid:** In Zapier, use a "Formatter" step to split `To` on `, ` before the webhook step, or set `recipients` to `["{{To}}"]` (single-element list wrapping).
**Warning signs:** 422 Unprocessable Entity from the endpoint; Pydantic `list[str]` validation error in logs.

### Pitfall 3: API key leakage in Zapier configuration
**What goes wrong:** Production API key stored in Zapier Zap configuration visible to other Zapier users on the account.
**Why it happens:** Zapier headers are stored in plaintext in the Zap config.
**How to avoid:** Use the staging API key for the PoC Zap. Document that production key must use a secrets-aware bridge (Pub/Sub or SES path) before going live.
**Warning signs:** Non-obvious; audit who has access to the Zapier account.

### Pitfall 4: SES requires domain MX record change
**What goes wrong:** SES receipt rules are applied but no email arrives because MX records still point to Google.
**Why it happens:** DNS change requires propagation time and coordination with the domain registrar.
**How to avoid:** Do not change MX records during the PoC phase; scaffold SES in Terraform only.
**Warning signs:** SES rule shows `Active` but no emails land in S3 bucket.

### Pitfall 5: Pub/Sub path requires HTTPS (blocks current ALB)
**What goes wrong:** Pub/Sub push subscription fails with "invalid endpoint" because ALB only serves HTTP.
**Why it happens:** Google Cloud Pub/Sub requires a valid HTTPS endpoint with a publicly trusted TLS cert.
**How to avoid:** Don't choose the Pub/Sub path until HTTPS/ACM is provisioned on the ALB (future phase).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gmail polling / push bridge | Custom Gmail API poller | Zapier (PoC) or Pub/Sub (prod) | Renewal loop, OAuth token refresh, error handling are all non-trivial |
| Durable email store | Custom DB table for raw email bytes | S3 + SES delivery | SES encryption, lifecycle management, atomic write-before-notify |
| Double-processing prevention | Application-level dedup logic | SQS visibility timeout + DLQ | Built-in idempotency without distributed lock |
| Email MIME parsing | Custom parser | Python `email` stdlib or `mail-parser` | MIME edge cases (multipart, encodings, attachments) are a trap |

---

## Code Examples

### Zapier field mapping (manual JSON body template)

```json
{
  "sender": "{{zap_meta_human_now}}",
  "recipients": ["agent@magnitudetech.com.br"],
  "subject": "{{subject}}",
  "raw_body": "{{body_plain}}",
  "headers": {},
  "attachments": []
}
```

Note: In the Zapier UI, `{{subject}}` and `{{body_plain}}` are Zapier dynamic field references
from the Gmail trigger step. The exact field names depend on Zapier's Gmail trigger output.

### Verifying the endpoint manually (curl)

```bash
# Replace <ALB_DNS> and <API_KEY> with actual values from terraform output / AWS Secrets Manager
curl -s -X POST "http://<ALB_DNS>/v1/emails/inbound" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{
    "sender": "test@example.com",
    "recipients": ["agent@magnitudetech.com.br"],
    "subject": "Phase 3 smoke test",
    "raw_body": "Hello from Phase 3 research.",
    "headers": {},
    "attachments": []
  }'
# Expected: HTTP 202, {"status":"ok","data":{"received":true,"attachment_count":0}}
```

### SES Terraform scaffold (stub, not for apply in PoC)

```hcl
# infrastructure/aws/ses.tf (scaffold only — do not apply until MX ready)
resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "email-listener"
}

resource "aws_ses_receipt_rule" "inbound" {
  name          = "store-and-notify"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = ["agent@magnitudetech.com.br"]
  enabled       = false  # enable only when MX record is pointed at SES
  scan_enabled  = true

  s3_action {
    bucket_name = aws_s3_bucket.email_store.id
    position    = 1
  }

  sns_action {
    topic_arn = aws_sns_topic.email_received.arn
    position  = 2
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SES → Lambda (synchronous) | SES → S3 → SQS → Lambda | Best practice | Durable; Lambda not invoked until message is safely stored |
| Polling Gmail IMAP | Gmail API push (Pub/Sub) | ~2018 | Realtime; eliminates 5-min polling delay |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Zapier free tier supports custom HTTP POST headers (X-API-Key) | Option A | If false, need paid tier or different bridge |
| A2 | Zapier free tier polls Gmail (15 min); paid plans offer 2 min | Option A | Actual delay may differ; doesn't block PoC |
| A3 | Pub/Sub push requires HTTPS with publicly trusted cert | Option B | If Google accepts HTTP for internal testing, Option B becomes viable |
| A4 | SES inbound requires MX record change at domain registrar | Production scaffold | If user controls magnitudetech.com.br DNS, this is straightforward |
| A5 | ALB currently serves only HTTP (no ACM cert provisioned) | ALB Endpoint | Confirmed from alb.tf — no aws_lb_listener for 443 exists |
| A6 | SES + S3 + SQS is the standard AWS durable receipt pattern | Production scaffold | Could use EventBridge Pipes instead; SQS pattern is more established |

---

## Open Questions (RESOLVED)

1. **Who controls DNS for magnitudetech.com.br?**
   RESOLVED: User controls DNS for magnitudetech.com.br. MX record change is feasible.
   → SES inbound path is viable for Phase 3.

2. **Zapier/Make.com availability**
   RESOLVED: User has neither Zapier nor Make.com and prefers not to use them.
   → Use SES inbound directly (MX change + receipt rule → SNS → HTTP POST to ALB). No third-party service needed.

3. **Exact ALB DNS name**
   RESOLVED: `nauta-services-email-listener-2115368239.us-east-1.elb.amazonaws.com`
   Retrieved via `terraform output alb_dns_name`.

4. **Staging vs Production for PoC**
   RESOLVED: Use production endpoint (port 80) for the SES receipt rule. SES delivers to HTTP endpoints — ALB port 80 is available. Staging (:8080) is accessible too but production is the primary validation target.

5. **Durability (EMAIL-02)**
   RESOLVED: Minimal working version only. Receive email → log it → done. No S3/SQS activation in Phase 3. Supabase and pipeline/records schemas are Phase 4. ROADMAP success criterion 2 is re-scoped: "durable receipt path scaffolded and ready to activate."

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Zapier account | PoC bridge | Unknown | — | Make.com (equivalent) |
| AWS CLI | Retrieve terraform outputs | Assumed present (used in Phase 2) | — | AWS Console |
| Terraform | SES scaffold | Assumed present (used in Phase 2) | — | — |
| Gmail / Google Workspace admin | Zapier OAuth grant | User must grant | — | No fallback |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest |
| Config file | `apps/email-listener/pyproject.toml` (or `pytest.ini`) |
| Quick run command | `cd apps/email-listener && uv run pytest tests/ -x -q` |
| Full suite command | `cd apps/email-listener && uv run pytest tests/ --cov=app --cov-report=term-missing` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMAIL-01 | POST /v1/emails/inbound returns 202 with valid Zapier-shaped payload | integration | `pytest tests/presentation/test_inbound_email.py -x` | Likely exists (Phase 1); verify |
| EMAIL-01 | Endpoint rejects missing X-API-Key with 401 | unit | `pytest tests/presentation/test_inbound_email.py::test_auth -x` | Likely exists |
| EMAIL-02 | SES Terraform scaffold is valid HCL | manual-only | `terraform validate infrastructure/aws/` | No — Wave 0 gap |

### Wave 0 Gaps

- [ ] Confirm existing test coverage of `/v1/emails/inbound` endpoint with auth + payload validation
- [ ] `terraform validate` passes after SES scaffold is added

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | X-API-Key via `secrets.compare_digest` — already implemented |
| V3 Session Management | No | Stateless webhook; no sessions |
| V4 Access Control | Partial | Endpoint gated by API key; no role-based control needed for PoC |
| V5 Input Validation | Yes | Pydantic `InboundEmailIn` — already implemented at boundary |
| V6 Cryptography | No | No secrets stored by the service; API key compared in memory only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged webhook POST (spoofed sender) | Spoofing | X-API-Key gate; secret must be known to caller |
| API key in Zapier config (third-party exposure) | Information Disclosure | Use staging key for PoC; rotate after PoC validated |
| Oversized payload (10 MiB body limit) | Denial of Service | `MAX_BODY_BYTES = 10 * 1024 * 1024` already enforced in router |
| Email content exfiltration via Zapier | Information Disclosure | Acceptable for PoC; SES path eliminates third-party for production |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `apps/email-listener/app/presentation/api/v1/inbound_email.py` — endpoint schema verified
- Codebase: `apps/email-listener/app/presentation/middleware/auth.py` — auth mechanism verified
- Codebase: `infrastructure/aws/alb.tf` — HTTP-only (no 443 listener) confirmed
- Codebase: `infrastructure/aws/outputs.tf` — ALB DNS output key confirmed

### Secondary (MEDIUM confidence)
- [Gmail API Push Notifications | Google for Developers](https://developers.google.com/workspace/gmail/api/guides/push) — Pub/Sub requirements including HTTPS mandate
- [Amazon SES email receiving concepts | AWS Docs](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-concepts.html) — SES+S3+SQS receipt pattern
- [Zapier Gmail + Webhooks integration](https://zapier.com/apps/gmail/integrations/webhook) — Gmail trigger to HTTP POST action

### Tertiary (LOW confidence — requires validation)
- Zapier free tier polling interval (15 min): [ASSUMED] — not verified from official Zapier pricing docs
- Pub/Sub JWT authentication for push endpoints: [ASSUMED] — referenced in search results, not directly verified via official doc fetch

---

## Metadata

**Confidence breakdown:**
- Existing endpoint schema: HIGH — read directly from codebase
- Zapier PoC path viability: MEDIUM — product exists, integration confirmed via search, specific free-tier behavior ASSUMED
- SES production scaffold: MEDIUM — standard AWS pattern, widely documented
- Pub/Sub HTTPS requirement: MEDIUM — cited in official Google docs references

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (30 days — Zapier/Google APIs are stable)
