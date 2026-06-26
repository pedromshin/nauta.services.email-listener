# nauta.services.email-listener

## What This Is

A monorepo (mirroring acme-os-dev conventions) hosting Nauta services. The first service,
`apps/email-listener`, is a FastAPI server that receives and logs raw inbound emails — the
real-world entry point for the Nauta "Data-Entry Brain" design case (context/0). Deployed
to AWS ECS Fargate with staging (dev branch) and production (main branch) environments.

## Core Value

Reliably receive every inbound email destined for agent@magnitudetech.com.br and make it
observable — nothing lost, everything logged — as the foundation for later parsing,
persistence, and the agentic pipeline.

## Requirements

### Validated

- ✓ FastAPI service + Clean Architecture, /v1/emails/inbound, Docker dev, quality gates — Phase 1
- ✓ AWS ECS Fargate (prod + staging) + shared ALB + GitHub OIDC CI/CD live; /health 200 both envs — Phase 2
- ✓ Live inbound email connection (forward → agent@magnitudetech.com.br → logged) — Phase 3
- ✓ Email intelligence: PDF parse (text+OCR) + LLM segmentation + region model + autofill + retrieval flywheel (Bedrock) — Phase 4
- ✓ Review UI: inbox + /emails/[id] document preview with entity-region overlays — Phase 5
- ✓ Region edit ops (accept/redraw/split/merge/nest/reject), versioned + supersede-safe — Phase 6
- ✓ Click-to-autofill UI: region → candidate fields + confidence → human confirm — Phase 7
- ✓ Trigram key_terms extractor activating the pg_trgm retrieval arm — Phase 8
- ✓ Entity/field region-relationship model + canvas review surface + app shell + glassy inbox + entity-type CRUD — Phase 9

### Active

- [ ] Phase 10: extracted-entity identity, gallery (`/entities`) + detail (`/entities/[id]`) — request-6 R3/R4
- [ ] Phase 11: knowledge-graph visualization (`/knowledge`) — request-6 R6
- [ ] Deploy follow-up: push migration 0013 (+ Phase-9 backend) to staging/prod before next deploy

### Out of Scope

- Per-importer entity-type overrides (system-default types only, Phase 9)
- Server-side deny-restore endpoint (optimistic-only undo today — Phase 9 follow-up)
- Real auth boundary (X-API-Key is installation-wide; importer_id is data partitioning, not auth)

## Context

- Conventions copied from examples/acme-os-dev (apps/api FastAPI server, infrastructure
  Terraform, monorepo layout). Tooling: uv, ruff (120 cols), mypy, pytest, import-linter.
- Walkthrough: context/5 - walkthrough.md. Design case: context/0 - nauta_design_case.pdf.
- Webhook is provider-agnostic by decision; SES→S3→SQS is the expected eventual edge.

## Constraints

- **Tech stack**: Python 3.11 FastAPI, Docker, Terraform, GitHub Actions — mirrors acme-os
- **Deploy**: AWS ECS Fargate (user-confirmed pattern); dev→staging, main→production
- **Security**: secrets via AWS Secrets Manager; API key auth fails closed outside development

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ECS Fargate over App Runner/Lambda | User-confirmed production pattern; natural substrate for future queue/worker topology | — Pending |
| Generic webhook (not SES-shaped) | Provider-agnostic now; SES wiring is a stage-3 concern | — Pending |
| Full 4-layer Clean Architecture skeleton | User preference; matches apps/api for consistency | — Pending |
| Monorepo layout with placeholder apps/packages | Repo must mirror acme-os-dev broader structure | — Pending |
| Shared ALB, staging on :8080 | Cheapest two-env setup pre-domain; move to 443 host routing later | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-10 after initialization*
