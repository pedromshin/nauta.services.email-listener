# Commands

## Local dev server

```powershell
cd C:\Users\pc\Desktop\nauta.services.email-listener\apps\email-listener
$env:PYTHONUNBUFFERED = "1"
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Notes:

- PYTHONUNBUFFERED=1 flushes structlog output immediately in the VS Code terminal.
- Avoid `--reload` for log watching: it spawns a child worker whose stdout can detach
  from the visible terminal on Windows, and orphaned children become zombies that keep
  answering requests (200 OK) while their logs go nowhere.

## If "no logs" — kill zombie processes (the #1 cause)

Old uvicorn/python processes keep listening and answer requests silently. Kill them all:

```powershell
Get-Process python,uvicorn -ErrorAction SilentlyContinue | Stop-Process -Force
```

Then restart the server above. Verify nothing else holds the port:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
```

## ngrok tunnel (separate terminal — must be running before uvicorn for SNS to reach local)

```powershell
ngrok http --domain=spliceable-exhaustive-dimple.ngrok-free.dev 8000
```

## ngrok setup (first time or after update)

```powershell
# 1. Update to latest (3.20.0+):
winget install --id Ngrok.Ngrok --source winget --force
# 2. Restart terminal, then add authtoken (get fresh one from dashboard.ngrok.com after rotating):
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```

## Quality gate (from apps/email-listener)

```powershell
cd C:\Users\pc\Desktop\nauta.services.email-listener\apps\email-listener
uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run lint-imports && uv run pytest --no-cov
```

## Run single test

```powershell
uv run pytest tests/path/to/test_file.py -v
```

## Terraform (from infrastructure/aws)

```powershell
cd C:\Users\pc\Desktop\nauta.services.email-listener\infrastructure\aws
terraform plan
terraform apply
```

## Stop local server

Ctrl+C in the uvicorn terminal.

    npm run web:dev
