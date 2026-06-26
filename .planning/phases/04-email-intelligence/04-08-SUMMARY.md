---
phase: 04-email-intelligence
plan: "08"
subsystem: application/retrieval + infrastructure/llm + db
tags: [python, bedrock, titan, pgvector, halfvec, pg_trgm, rrf, drizzle, supabase, learning-flywheel]

requires:
  - "04-03 (Supabase repositories: ComponentRepository.update_embedding, ExtractionRepository.save/find_by_component_id/supersede_active)"
  - "04-07 (AutofillUseCase + AutofillProtocol.autofill(examples=...) — the few-shot slot)"
  - "04-01 (Drizzle halfvec customType + custom-migration layout this plan extends)"

provides:
  - "EmbeddingProtocol port + EmbeddingAdapter (AWS Bedrock Amazon Titan Text Embeddings V2, dim=1536, zero-vector on failure)"
  - "RetrievalPort port + SupabaseRetrievalRepository (hybrid vector + pg_trgm, RRF k=60) over confirmed regions"
  - "ConfirmRegionUseCase — confirm → embed (region + confirmed fields) → index on Component row (D-15); never overwrites prior confirmed values (D-16); idempotent"
  - "AutofillUseCase few-shot upgrade — embeds region, retrieves top-N confirmed examples, injects as few-shot; empty retrieval preserves cold-start (D-13)"
  - "POST /v1/components/{id}/confirm (X-API-Key, ConfirmAck)"
  - "Retrieval schema: knowledge_nodes, entity_instances, sender_profiles + 2 link tables (Drizzle TS + custom SQL migration 0006/0007: RLS deny-all, HNSW halfvec, pg_trgm GIN, moddatetime)"
  - "Postgres RPCs match_components_by_embedding + match_components_by_trgm (migration 0009) — the functions SupabaseRetrievalRepository calls"
  - "Container providers: EmbeddingProtocol, RetrievalPort, ConfirmRegionUseCase; AutofillUseCase moved to explicit factory"

affects:
  - "Phase 5 (review UI confirm action will call POST /v1/components/{id}/confirm)"
  - "Future: trigram identifier retrieval inert until key_terms extraction lands (see Deviations)"

tech-stack:
  added:
    - "boto3 bedrock-runtime (Amazon Titan Text Embeddings V2 — embeddings via the same IAM-role Bedrock path as Claude; no new HF/torch dep)"
  patterns:
    - "RRF k=60 merge of ranked lists (1/(k+rank)) as pure, unit-tested helpers"
    - "Graceful retrieval degradation: any retrieval failure → [] → cold-start path (D-13) preserved"
    - "Confirmed-only few-shot (status confirmed/auto_confirmed) + importer_id filter on every sub-query (T-04-27, T-04-28)"

key-files:
  created:
    - apps/email-listener/app/domain/ports/embedding_protocol.py
    - apps/email-listener/app/domain/ports/retrieval_port.py
    - apps/email-listener/app/infrastructure/llm/embedding_adapter.py
    - apps/email-listener/app/infrastructure/supabase/retrieval_repository.py
    - apps/email-listener/app/application/use_cases/confirm_region.py
    - apps/email-listener/tests/test_embedding_adapter.py
    - apps/email-listener/tests/test_retrieval_repository.py
    - apps/email-listener/tests/test_confirm_region.py
    - packages/db/src/schema/knowledge-nodes.ts
    - packages/db/src/schema/entity-instances.ts
    - packages/db/src/schema/sender-profiles.ts
    - packages/db/src/schema/component-links.ts
    - packages/db/migrations/0006_bitter_white_queen.sql
    - packages/db/migrations/0007_retrieval_rls_indexes.sql
    - packages/db/migrations/0009_retrieval_rpcs.sql
  modified:
    - apps/email-listener/app/application/use_cases/autofill.py
    - apps/email-listener/app/presentation/api/v1/components.py
    - apps/email-listener/app/container.py
    - packages/db/src/schema/index.ts
    - packages/db/src/schema/attachments.ts
    - packages/db/migrations/0008_funny_viper.sql

key-decisions:
  - "Embedding hosting = AWS Bedrock Amazon Titan Text Embeddings V2 (amazon.titan-embed-text-v2:0), dim=1536, IAM-role auth — consistent with the phase-wide Bedrock transport; no Anthropic/OpenAI key, no HF/torch"
  - "Embedding total-failure returns a zero-vector (cosine distance ~1 from any real vector) so callers never branch on None"
  - "Retrieval RPCs (migration 0009) join email_components→extraction_records; corrected_fields take precedence over extracted_fields (D-16); SECURITY INVOKER so RLS applies; importer_id filtered on every row (T-04-28)"
  - "AutofillUseCase keeps embedder/retrieval as Optional(None) for unit-test ergonomics; the live container wires them via an explicit factory (dishka does not auto-inject defaulted Optionals)"
  - "0008 attachments-column migration made idempotent (ADD COLUMN IF NOT EXISTS) and committed to reconcile pre-existing push drift; this was unformalized drift, not new 04-08 scope"

requirements-completed: []

duration: "resumed across session-limit boundary; task 3 + checkpoint completed 2026-06-12"
completed: "2026-06-12"
---

# Phase 04 Plan 08: Learning Flywheel — Confirm → Embed → Index → Hybrid Retrieval Summary

**Closes the D-15 learning flywheel: human confirmation embeds a region and indexes it as a retrievable few-shot child; future same-type autofill runs hybrid (vector + pg_trgm, RRF k=60) retrieval over confirmed regions and injects the top-N as few-shot examples, with graceful cold-start fallback (D-13) and supersede-safety (D-16).**

## Accomplishments

- **Retrieval schema** (Drizzle TS + custom SQL): `knowledge_nodes`, `entity_instances`, `sender_profiles`, and two component-link tables, with RESTRICTIVE deny-all RLS, HNSW `halfvec_cosine_ops` on the embedding columns, a pg_trgm GIN index on `entity_instances.identifiers`, and a moddatetime trigger (migrations `0006`/`0007`, deferred from 04-01).
- **EmbeddingAdapter** — Amazon Titan Text Embeddings V2 on AWS Bedrock (`amazon.titan-embed-text-v2:0`, dim=1536), IAM-role auth, zero-vector on total failure.
- **SupabaseRetrievalRepository** — `find_similar_confirmed` issues a vector cosine query and a pg_trgm query (both `importer_id`-filtered), merges with RRF k=60 (`1/(k+rank)`, pure helpers), dedups by component_id, returns top-N `RetrievedExample`.
- **Retrieval RPCs** (migration `0009`, authored this resume) — `match_components_by_embedding` + `match_components_by_trgm` join `email_components`→`extraction_records`, return `id`/`content_text`/`extracted_fields` (corrected over extracted, D-16), plus a GIN `gin_trgm_ops` index on `email_components.content_text`. These are the functions the repository calls; without them few-shot silently no-ops.
- **ConfirmRegionUseCase** — promotes the candidate ExtractionRecord to `confirmed` (new record, never mutating priors — D-16), records `corrected_fields`, embeds region text + confirmed fields, and calls `update_embedding` so the region becomes a retrievable few-shot child (D-15). Idempotent.
- **AutofillUseCase few-shot upgrade** — embeds the region, calls `find_similar_confirmed`, injects retrieved examples; `[]` retrieval preserves the cold-start path (D-13). `routing_reason` reflects few-shot vs cold-start.
- **API**: `POST /v1/components/{id}/confirm` (X-API-Key, `ConfirmAck`).
- **DI**: `EmbeddingProtocol`, `RetrievalPort`, `ConfirmRegionUseCase` registered; `AutofillUseCase` moved to an explicit factory to inject the few-shot ports.
- **Applied live to local + staging + prod** via `npm run migrate:*`; the drizzle migrator is back in sync (10 recorded) in all three envs; 5 retrieval tables, both RPCs, both trgm indexes, and RLS verified live on staging and prod.

## Task Commits

1. **Retrieval schema — Drizzle TS + custom SQL migration** - `e81128d` (feat)
2. **TDD RED — retrieval/confirm tests** - `e331a3e` (test)
3. **Embedding adapter (Bedrock Titan) + hybrid RRF retrieval repository** - `6796eb1` (feat)
4. **RED tests for confirm-region + autofill few-shot** - `f1abf99` (test)
5. **Wire confirm-region + few-shot autofill into container** - `42fe3ea` (feat)
6. **Retrieval RPCs (0009) + reconcile attachments schema drift** - `c15e4ef` (feat)

## Deviations from Plan

**1. [Gap found + fixed] Retrieval RPCs were missing.** `SupabaseRetrievalRepository` called `match_components_by_embedding`/`match_components_by_trgm`, but no migration defined them — few-shot would silently fall back to cold-start forever. Resolved on resume by authoring migration `0009_retrieval_rpcs.sql` (user decision: "fix now within 04-08") and applying it to all envs.

**2. [Known limitation] Trigram retrieval arm is currently inert (vector-only hybrid).** `autofill.py` calls `find_similar_confirmed(key_terms=())`; the plan's regex pre-pass for PO/BL/container identifier codes (RESEARCH §4.1) was not implemented, so the trgm RPC's `query_text <> ''` guard returns nothing and RRF effectively ranks by vector similarity alone. Functionally safe (vector retrieval works once confirmed regions with embeddings exist); the identifier-matching half is a candidate follow-up. The RPC + GIN index are in place, so enabling it is a code-only change in the use case.

**3. [Migration mechanics] DB state had drifted.** Both staging and prod had `email_attachments.file_ext`/`parent_attachment_id` already present (added out-of-band via `drizzle-kit push`) but `0006`/`0007` unapplied and the drizzle migrator stuck at `0005`. An uncommitted `0008_funny_viper` (those attachment columns) sat ahead of the retrieval work and would have crashed `migrate` with "column already exists". Per user decision (Option A), `0008` was made idempotent (`ADD COLUMN IF NOT EXISTS`) and committed with its `attachments.ts` columns to reconcile the drift, after which `migrate` ran cleanly `0006→0007→0008→0009` and the migrator returned to sync.

**4. [Renamed migration]** The plan referenced a single "retrieval_rls_indexes" custom migration; delivered as `0007_retrieval_rls_indexes.sql` (RLS/indexes) with the table DDL in the generated `0006_bitter_white_queen.sql`, plus the new `0009_retrieval_rpcs.sql` for the functions.

## Verification

- Quality gate green: ruff, ruff format, mypy (79 files), import-linter (3 contracts), full pytest suite passing at **89.8% coverage** (≥80%).
- `test_confirm_region.py` (10 tests): confirm marks status=confirmed, records corrected_fields, embeds + updates embedding (D-15), never calls `supersede_active` on an already-confirmed record (D-16/idempotent); autofill few-shot calls `find_similar_confirmed`, passes examples through, and preserves cold-start on empty retrieval (D-13); confirm endpoint returns 200 / requires X-API-Key / accepts corrected_fields.
- Live DB verified on staging `fyfwkjvbcrmjqjysdyqw` and prod `dazyccjijdahxyciptkp`: 5 retrieval tables, both RPCs, `idx_email_components_content_text_trgm`, `entity_instances` trgm GIN, `knowledge_nodes` RLS enabled, migrator recorded = 10.

## Notes for Downstream

- **Phase 5** confirm action wires to `POST /v1/components/{id}/confirm`.
- To activate true hybrid retrieval, add a `key_terms` extractor (regex over region text for PO/BL/container codes) and pass it into `find_similar_confirmed` — RPC and index are already live.
