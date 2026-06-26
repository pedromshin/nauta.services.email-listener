# 04-06 (trimmed) — Email Ingestion + Read API

**Goal:** Inbound email → persisted to Supabase (email + attachments) → readable via API.
**NO** parser / segmentation / autofill / AI dispatch. Wiring only — schema + repos already exist and are deployed (local/staging/prod).

## The one blocker
`ReceiveInboundEmailUseCase` and the SNS handler **only log** — nothing writes to the DB. This plan fixes that.

## What already exists (don't rebuild)
- **Tables** (live in all 3 envs): `emails`, `email_attachments` (+ components, extraction_records, entity_types — ignore those).
- **Repos** (working, tenant-scoped by `importer_id`):
  - `app/infrastructure/supabase/email_repository.py` — `save()` upserts on `(importer_id, message_id)` (idempotent), `find_by_id`, `find_by_message_id`, `update_parse_status`.
  - `app/infrastructure/supabase/attachment_repository.py` — `save()` upserts on `id`, `find_by_email_id`.
- **Entities:** `app/domain/entities/email.py` (`Email`, frozen, mirrors table 1:1), `app/domain/entities/attachment.py` (`Attachment`).
- **SES parser:** `app/infrastructure/sns/ses_parser.py` — `parse_ses_notification()` returns only `{message_id, sender, recipients, subject}` from the SNS Message field. Does NOT fetch the raw MIME or attachments yet.
- **SNS handler:** `app/presentation/api/v1/sns_inbound.py` — POST `/v1/emails/inbound-sns`, handles SubscriptionConfirmation + Notification, currently just logs `email_received`. Always returns 200.
- **DI container:** `app/container.py` (dishka). Supabase client provided via `_provide_supabase_client` (annotated delegate — dishka can't introspect `@lru_cache`; follow that pattern for any new provider).
- **Settings:** `app/settings.py` — `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, env hierarchy Dev/Staging/Prod.

## Raw email source
SES writes the full raw MIME to **S3**: `s3://nauta-services-ses-inbound-emails/inbound/{local,staging,prod}/...` keyed by SES messageId. The SNS notification gives `mail.messageId` + metadata but NOT the body/attachments — those come from fetching + parsing the raw MIME from S3 (stdlib `email` module). boto3 is already a dep.

## Work to do
1. **Fetch raw MIME from S3** — new adapter (e.g. `infrastructure/s3/raw_email_store.py`) using boto3, IAM-role auth (no keys), bucket from settings/env. Object key = `inbound/{env}/{messageId}`.
2. **Parse MIME → Email + Attachment[]** — stdlib `email.message_from_bytes`. Extract sender name/addr, to/cc, subject, body_html, body_text, in_reply_to, references, received_at, and walk parts for attachments (filename, content_type, bytes).
3. **Store attachment bytes** — DECISION NEEDED: Supabase Storage bucket vs S3. `Attachment.storage_key` is the pointer. Pick the simplest that the frontend can read back (Supabase Storage signed URL is easiest for a acme-os-style inbox). Set `parse_status="pending"` / emails `parse_status="received"` (no AI).
4. **Wire ingestion** — replace the log-only path in `sns_inbound.py` Notification branch (or `ReceiveInboundEmailUseCase`) to: fetch raw → parse → `email_repo.save()` → for each attachment store bytes + `attachment_repo.save()`. Keep returning 200; idempotent via upsert.
5. **Read API** (new router `presentation/api/v1/emails.py`, auth via existing X-API-Key middleware):
   - `GET /v1/emails` — list (paginated, importer-scoped): id, sender, subject, received_at, attachment_count.
   - `GET /v1/emails/{id}` — detail + attachments metadata + body.
   - `GET /v1/emails/{id}/attachments/{attachment_id}` — download bytes (or redirect to signed URL).
6. **importer_id** — single-tenant for now; find the existing default importer id (seeded? check `importers` table / env) and use it consistently.

## Quality gate (must pass before commit)
From `apps/email-listener`: `uv run ruff check .` + `uv run ruff format --check .` + `uv run mypy app` + `uv run lint-imports` + `uv run pytest --no-cov`. TDD: write repo/parse tests first.

## After this
Build a net-new inbox frontend (analogous to `examples/acme-os`) to view email → attachment preview.

## Status of envs (NOT this plan's concern — already handled)
Deploy fix pushed (requirements.txt synced + poppler-utils). Local + prod already ingest via SNS. Don't spend time here.
