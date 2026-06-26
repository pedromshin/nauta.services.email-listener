# Build context: repo root (matches monorepo CI convention)
# --- Build stage ---
FROM python:3.11-slim AS builder

WORKDIR /build

COPY apps/email-listener/requirements.txt .
RUN pip3 install --no-cache-dir --upgrade "pip" "setuptools>=79.0.1" "wheel>=0.46.2" && \
    pip3 install --no-cache-dir --user -r requirements.txt

# --- Runtime stage ---
FROM python:3.11-slim

# Security: apply outstanding OS patches and upgrade vulnerable Python tooling
# CVE-2026-23949 (jaraco.context), CVE-2026-24049 (wheel) — fixed via setuptools/wheel upgrade
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends poppler-utils && \
    rm -rf /var/lib/apt/lists/* && \
    pip3 install --no-cache-dir --upgrade "setuptools>=79.0.1" "wheel>=0.46.2"

# Security: non-root user, no shell login
RUN groupadd -r appuser && useradd -r -g appuser -d /home/appuser -s /usr/sbin/nologin appuser

WORKDIR /app

COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local

COPY --chown=appuser:appuser apps/email-listener/app ./app
COPY --chown=appuser:appuser apps/email-listener/pyproject.toml .

USER appuser

ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import httpx; httpx.get('http://localhost:8000/health', timeout=2.0)"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
