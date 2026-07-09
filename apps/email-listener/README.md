# email-listener

FastAPI service that receives and logs raw inbound emails. No parsing, no persistence yet —
those arrive in later stages of the Polytoken data-entry pipeline.

## Layout (Clean Architecture)

```
app/
├── main.py                  → app factory + lifespan
├── settings.py              → Base → Dev/Staging/Prod (pydantic-settings)
├── container.py             → Dishka DI container
├── domain/entities/         → InboundEmail (zero external deps)
├── application/use_cases/   → ReceiveInboundEmailUseCase (log-only)
├── infrastructure/observability/ → structlog setup (JSON in staging/prod)
└── presentation/
    ├── api/                 → /health, /health/ready, POST /v1/emails/inbound
    └── middleware/          → request logging, API-key auth
```

Layer rules are enforced by import-linter (`uv run lint-imports`).

## Run

```bash
# Docker (from repo root)
npm run dev

# Local
uv sync
uv run uvicorn app.main:app --reload
```

## Endpoints

| Method | Path                | Description                              |
| ------ | ------------------- | ---------------------------------------- |
| GET    | `/health`           | Liveness                                 |
| GET    | `/health/ready`     | Readiness                                |
| POST   | `/v1/emails/inbound`| Receive raw email (202) — logs and acks  |

`POST /v1/emails/inbound` requires `X-API-Key` when `API_KEY` is set
(always set in staging/production; optional in development).

## Quality

```bash
uv run pytest          # tests, 80% coverage gate
uv run ruff check .    # lint
uv run ruff format .   # format
uv run mypy app        # types
uv run lint-imports    # architecture layers
uv run bandit -c pyproject.toml -r app   # security
```
