# polytoken.services

Monorepo for Polytoken services. First service: **email-listener** — a FastAPI server that receives and logs raw inbound emails, the entry point for the Polytoken "Data-Entry Brain" pipeline.

## Structure

```
├── apps/
│   ├── email-listener/   → FastAPI service (Clean Architecture) — active
│   └── web/              → placeholder
├── packages/             → api-client, cli, db, integrations, shared, ui — placeholders
├── infrastructure/
│   └── aws/              → Terraform: ECR, ECS Fargate (prod + staging), ALB, IAM (OIDC)
└── .github/workflows/    → CI + deploy pipelines
```

## Quickstart (Docker)

Requires Docker. From the repo root:

```bash
npm run dev          # build + run the email-listener at http://localhost:8000
npm run dev:watch    # same, with hot-reload on app/ changes
npm run dev:down     # stop
```

Smoke test:

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/v1/emails/inbound \
  -H "Content-Type: application/json" \
  -d '{"sender":"a@b.com","recipients":["agent@magnitudetech.com.br"],"subject":"hi","raw_body":"hello"}'
```

## Local development (without Docker)

Requires [uv](https://docs.astral.sh/uv/):

```bash
cd apps/email-listener
uv sync
uv run uvicorn app.main:app --reload
```

## Quality gates

```bash
npm run check        # lint + format + typecheck + architecture + tests (80% coverage)
```

## Deployments

| Environment | Branch | ECS Service                              |
| ----------- | ------ | ---------------------------------------- |
| Production  | `main` | `nauta-services-email-listener`          |
| Staging     | `dev`  | `nauta-services-email-listener-staging`  |

Push to `dev` → deploys staging. Push to `main` → deploys production.
Pipeline: test → docker build → Trivy scan → push to ECR → ECS force-new-deployment → health smoke test.

See [infrastructure/README.md](infrastructure/README.md) for provisioning.
