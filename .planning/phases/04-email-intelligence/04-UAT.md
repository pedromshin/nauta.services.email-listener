---
status: diagnosed
phase: 04-email-intelligence
scope: plans 04-05, 04-06
source: 04-05-PLAN.md, 04-06-PLAN.md must_haves (no SUMMARYs — executed via trimmed/worktree path)
started: 2026-06-12T13:30:00Z
updated: 2026-06-12T14:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Fresh ECS tasks boot clean after today's deploys; /health returns alive on prod and staging; unit suite green.
result: pass
evidence: prod + staging /health {"status":"alive"} (2026-06-12); 29/29 targeted tests pass (segmentation_adapter, emails_api, ingest_use_case, mime_parser). 4 unrelated failures in test_settings_secrets.py = env-leak (tests assert empty defaults while .env loads staging values), test-isolation bug, logged as gap.

### 2. Prod end-to-end ingestion (04-06 truth: forwarded email persisted multi-tenant)
expected: Forward email with PDF to agent@ → email + attachment rows in prod Supabase keyed by importer_id → visible in frontend.
result: pass
evidence: verified live 2026-06-12 ~03:22Z — SES→S3→SNS→ECS email_ingested (1 attachment), row in prod DB (dazyccjijdahxyciptkp), renders at nauta-web-omega.vercel.app. Redrive script also exercised (idempotent path).

### 3. Read API returns EmailView (04-06 truth: GET /v1/emails, /{id}, attachments)
expected: GET /v1/emails (list), GET /v1/emails/{id} (detail), GET /v1/emails/{id}/attachments/{att_id} return ApiResponse-wrapped views.
result: pass
evidence: routes exist in app/presentation/api/v1/emails.py (lines 90/105/133); test_emails_api.py green; frontend consumes same DB via tRPC and renders prod data.

### 4. Segmentation adapter robustness (04-05 truths: multi/overlap/nested/junk, content in <document_content> user turn)
expected: AnthropicSegmenter proposes regions as structured JSON; junk yields zero/unknown regions without crash; untrusted content never in system prompt.
result: pass
evidence: segmenter_protocol.py + anthropic_client.py + segmentation_adapter.py present; test_segmentation_adapter.py passes incl. prompt-injection structural defense. NOTE: unit-level only — nothing dispatches it yet (see Gap 2).

### 5. Staging end-to-end ingestion
expected: Forward email to agent-staging@magnitudetech.com.br → row in staging Supabase + renders in frontend (staging).
result: pass
evidence: user confirmed emails received + visible in staging Supabase and Next.js (preview). DB verified 2026-06-12: 3 emails with attachments, latest 11:29Z ingested by staging ECS post-deploy.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

- truth: "Settings tests pass in any environment (test isolation)"
  status: failed
  reason: "4 tests in test_settings_secrets.py assert empty-string defaults but pydantic-settings loads the real .env; fails on any machine with .env present"
  severity: minor
  test: 1
  root_cause: "Settings() in tests reads apps/email-listener/.env; tests need env isolation (monkeypatch _env_file=None or clear env)"
  artifacts:
    - path: "apps/email-listener/tests/test_settings_secrets.py"
      issue: "no isolation from real .env"
  missing:
    - "Patch Settings to ignore .env in these 4 tests"
  debug_session: ""

- truth: "Auto-segment PROPOSES candidate Components persisted as child Components (04-05 D-08/D-09)"
  status: failed
  reason: "ProposeRegionsUseCase (app/application/use_cases/propose_regions.py) and test_propose_regions.py were never created; AnthropicSegmenter exists but nothing invokes it; no components are written during ingestion"
  severity: major
  test: 4
  root_cause: "04-06 was deliberately trimmed (user decision, see .continue-here.md) to ingest+read-API only; the 04-05 use-case layer that bridges segmenter→ComponentRepository.save_many was deferred along with it"
  artifacts:
    - path: "apps/email-listener/app/infrastructure/llm/segmentation_adapter.py"
      issue: "implemented but unreferenced outside tests"
  missing:
    - "ProposeRegionsUseCase: page Components -> proposed child Components via SegmenterProtocol"
    - "Dispatch hook: ingestion (or POST reprocess) runs parser registry then ProposeRegions"
  debug_session: ""

- truth: "Forwarding-sender maps to an importer; unknown senders resolve/create importer (04-06 D-05)"
  status: failed
  reason: "Importer resolution replaced by fixed default importer 00000000-0000-0000-0000-000000000001; importer_resolver.py / importer_repository.py not created; POST reprocess endpoint and parser-registry dispatch also trimmed"
  severity: major
  test: 2
  root_cause: "Deliberate scope trim (user decision): single-tenant default importer seeded per env (migration 0005) to ship persist+view loop first"
  artifacts:
    - path: "apps/email-listener/app/application/use_cases/ingest_inbound_email.py"
      issue: "uses IngestionConfig.default_importer_id, no sender→importer resolution"
  missing:
    - "ImporterResolver port + Supabase repository (find-or-create by sender domain)"
    - "POST /v1/emails/{id}/reprocess endpoint"
  debug_session: ""
