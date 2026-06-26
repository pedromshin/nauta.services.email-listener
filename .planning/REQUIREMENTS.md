# Requirements: nauta.services.email-listener

**Defined:** 2026-06-10
**Core Value:** Reliably receive every inbound email and make it observable.

## v1 Requirements

### Service (SRVC)

- [x] **SRVC-01**: Service exposes GET /health (liveness) and /health/ready (readiness)
- [x] **SRVC-02**: POST /v1/emails/inbound accepts a raw email payload and returns 202
- [x] **SRVC-03**: Received emails are logged structurally (sender, recipients, subject, sizes, attachments metadata)
- [x] **SRVC-04**: Endpoint requires X-API-Key when API_KEY is configured; fails closed in staging/production
- [x] **SRVC-05**: Clean Architecture layers enforced by import-linter

### Developer Experience (DEVX)

- [x] **DEVX-01**: Fresh clone + Docker → `npm run dev` runs the server on localhost:8000
- [x] **DEVX-02**: Quality gates runnable locally and in CI (ruff, mypy, import-linter, bandit, pytest 80%)

### Infrastructure (INFRA)

- [x] **INFRA-01**: Terraform provisions ECR, ECS Fargate cluster + prod/staging services, ALB, IAM (OIDC)
- [x] **INFRA-02**: Push to dev deploys staging; push to main deploys production
- [x] **INFRA-03**: Deploys are gated by tests, Trivy image scan, and post-deploy /health smoke test
- [x] **INFRA-04**: GitHub repository created; AWS_DEPLOY_ROLE_ARN + health URL vars configured

## v2 Requirements

### Email Connection (EMAIL)

- [x] **EMAIL-01**: agent@magnitudetech.com.br forwards full inbound emails to the service (SES inbound or equivalent)
- [x] **EMAIL-02**: Durable receipt path (S3 + SQS) so no email is lost or double-processed

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email parsing/classification | Walkthrough stage 3+; service is passive listener for now |
| Persistence/storage | Later stage |
| web app, packages content | Placeholders until needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SRVC-01..05 | Phase 1 | Complete |
| DEVX-01..02 | Phase 1 | Complete |
| INFRA-01..04 | Phase 2 | Complete (ECS Fargate live; staging :8080 + prod :80 /health 200) |
| EMAIL-01..02 | Phase 3 | Complete (verified live end-to-end 2026-06-11) |

**Coverage:** v1: 11 total + v2 EMAIL: 2 = 13 mapped, unmapped: 0 ✓
**Note:** Phases 4–8 (Email Intelligence backend, Review UI, region edit ops,
click-to-autofill UI, key_terms extractor) are **decision-driven** — scoped via
each phase's CONTEXT.md D-IDs, no REQ-IDs mapped (per ROADMAP). Verified via
per-phase VERIFICATION.md (4 + 8 passed; 5/6/7 human_needed — visual UAT only).

---
*Requirements defined: 2026-06-10*
*Last updated: 2026-06-13 — milestone audit checked off INFRA/EMAIL (Phases 2–3 complete + live-verified)*
