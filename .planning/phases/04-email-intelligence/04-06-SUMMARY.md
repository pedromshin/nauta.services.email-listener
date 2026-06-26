---
phase: 04-email-intelligence
plan: "06"
subsystem: application/ingestion
tags: [python, s3, mime, supabase, fastapi, ingestion, read-api, clean-architecture]

requires:
  - "04-03 (Supabase repositories + settings + DI container)"
  - "04-04 (PdfParser + parser registry)"
  - "04-05 (SegmenterProtocol — dispatch deferred to 04-11)"

provides:
  - "S3RawEmailStore — fetch raw MIME from SES inbound bucket (IAM role auth)"
  - "stdlib MIME parser domain service: bodies, threading headers, attachments"
  - "SupabaseAttachmentStorage — private Storage bucket, lazy ensure, upsert"
  - "IngestInboundEmailUseCase — idempotent under SNS redelivery (stable email id, deterministic uuid5 attachment ids)"
  - "Read API: GET /v1/emails (paginated + attachment counts), /{id} detail, /{id}/attachments/{att_id} download — X-API-Key, tenant-scoped"
  - "Settings: SES_S3_BUCKET/prefix per env, ATTACHMENTS_BUCKET, DEFAULT_IMPORTER_ID"
  - "Terraform: ECS task role s3:GetObject on inbound/*"

affects:
  - "04-11 (gap plan — adds parser-registry dispatch + ProposeRegions into this live ingestion path)"
  - "04-12 (gap plan — replaces DEFAULT_IMPORTER_ID with sender→importer resolution; adds reprocess endpoint)"
  - "04-07 (autofill API builds on components produced downstream of this pipeline)"

tech-stack:
  added: []
  patterns:
    - "Always-200 SNS handler contract preserved while delegating to ingestion use case"
    - "Idempotency via deterministic IDs (SES message id → email id; uuid5 → attachment ids)"
    - "parse_status lifecycle column (received/pending) for later pipeline stages"

key-files:
  created:
    - apps/email-listener/app/application/use_cases/ingest_inbound_email.py
    - apps/email-listener/app/domain/services/mime_parser.py
    - apps/email-listener/app/domain/ports/attachment_storage.py
    - apps/email-listener/app/domain/ports/raw_email_store.py
    - apps/email-listener/app/infrastructure/s3/raw_email_store.py
    - apps/email-listener/app/infrastructure/supabase/attachment_storage.py
    - apps/email-listener/app/presentation/api/v1/emails.py
    - apps/email-listener/tests/test_ingest_use_case.py
    - apps/email-listener/tests/test_mime_parser.py
    - apps/email-listener/tests/test_emails_api.py
    - apps/email-listener/tests/test_raw_email_store.py
    - apps/email-listener/tests/test_attachment_storage.py
    - apps/email-listener/tests/test_repository_listing.py
    - apps/email-listener/tests/test_container.py
  modified:
    - apps/email-listener/app/container.py
    - apps/email-listener/app/main.py
    - apps/email-listener/app/presentation/api/v1/sns_inbound.py
    - apps/email-listener/app/settings.py
    - apps/email-listener/app/infrastructure/supabase/email_repository.py
    - apps/email-listener/app/infrastructure/supabase/attachment_repository.py
    - infrastructure/aws/iam.tf

key-decisions:
  - "Live ingestion entrypoint is IngestInboundEmailUseCase (not the plan's DecomposeEmailUseCase name) — SNS handler delegates to it while keeping the always-200 contract"
  - "Importer resolution deferred: DEFAULT_IMPORTER_ID fixed UUID used at ingest time; sender→importer find-or-create delivered by gap plan 04-12 (D-05)"
  - "Attachment parsing/segmentation dispatch deferred to gap plan 04-11 — this plan persists emails+attachments and exposes the read API"

requirements-completed: []

duration: unknown (closed out retroactively)
completed: "2026-06-11"
---

# Phase 04 Plan 06: Ingestion Pipeline + Read API Summary

**End-to-end inbound persistence: SES→S3 raw MIME fetch, stdlib MIME parse, email+attachment persistence to Supabase (idempotent under SNS redelivery), private attachment storage, and the tenant-scoped read API — live and UAT-verified in prod and staging**

> Close-out note: this SUMMARY was written retroactively by the orchestrator. The plan was
> executed via a trimmed/worktree path that committed code but never wrote a SUMMARY.md.
> Functionality was verified live by UAT (04-UAT.md Tests 2, 3, 5 — all pass) on 2026-06-12.

## Accomplishments

- `S3RawEmailStore` fetches raw MIME from the SES inbound bucket using the ECS task IAM role
- Domain-service MIME parser (stdlib `email`): bodies, threading headers, attachment extraction
- `SupabaseAttachmentStorage`: private Storage bucket (`email-attachments`), lazy bucket ensure, upsert semantics
- `IngestInboundEmailUseCase`: idempotent under SNS redelivery — stable email id from SES message id, deterministic uuid5 attachment ids, `parse_status` lifecycle
- SNS inbound handler now ingests for real while preserving the always-200 contract
- Read API: paginated email list with attachment counts, email detail, attachment download — X-API-Key auth, importer-scoped
- Terraform grant: ECS task role `s3:GetObject` on `inbound/*`
- Verified live in **prod** (email forwarded → row in prod DB → renders at nauta-web-omega.vercel.app) and **staging** (3 emails with attachments, latest 2026-06-12 11:29Z)

## Task Commits

1. **Persist inbound emails — S3 raw MIME fetch, parse, store, read API** - `93b0ebb` (feat)

## Deviations from Plan

**1. [Scope reallocation] Importer resolution (D-05) not implemented** — ingestion uses fixed `DEFAULT_IMPORTER_ID`; UAT Gap "forwarding-sender maps to an importer" (major) → delivered by gap plan **04-12** along with `POST /v1/emails/{id}/reprocess`.

**2. [Scope reallocation] Parser-registry dispatch + ProposeRegions not wired** — attachments persist but are not parsed into Components during ingestion; UAT Gap 2 (major) → delivered by gap plan **04-11**.

**3. [Renamed] Use case is `IngestInboundEmailUseCase`, not `DecomposeEmailUseCase`** — the plan's `decompose_email.py` was never created; downstream gap plans (04-11/04-12) explicitly target the live `ingest_inbound_email.py` path.

## Verification

- UAT 04-UAT.md Tests 2 (prod E2E), 3 (read API), 5 (staging E2E): **pass**.
- Remaining gaps tracked in 04-UAT.md `## Gaps` and planned as 04-10/04-11/04-12.
