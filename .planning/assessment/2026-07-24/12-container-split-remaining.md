# Container split — remaining groups (audit-verified spec)

_Source: the `container-split-audit` ultracode workflow (2026-07-24, 5 agents, 3 adversarial
lenses + spec + synthesis). Confidence: high._

## Audit verdict on the work done (genui + repositories + llm_adapter + cost + anticipatory)
- **Lens 1 (binding-set equivalence): EQUIVALENT** — original 88 bindings = current 88 (container
  + the register() modules), set-diff empty both ways, 0 duplicates. **Nothing dropped.**
- **Lens 2 (moved-factory fidelity): EQUIVALENT** — every moved factory body byte-identical to the
  pre-split original; no moved factory calls a patched global (`get_supabase_client` /
  `get_anthropic_client` / `boto3`).
- **Lens 3 (safety-net) was a DISCREPANCY → NOW FIXED**: the boot test reached only 66/88; the 22
  no-fan-in bindings are now resolved explicitly (commit `6e31a09`). Full graph guarded.

## MUST STAY in container.py (never move — direct patched-global call = boot-test patch target)
| factory | why |
|---|---|
| `_provide_supabase_client` | `get_supabase_client()` — patch target |
| `_provide_anthropic_client` | `get_anthropic_client()` — patch target |
| `_provide_raw_email_store` | `boto3.client('s3')` — patch target |
| `_provide_embedder` | `boto3.client('bedrock-runtime')` — cross-cutting `EmbeddingProtocol`; **inject** into document_region + chat_turn, don't move |
| `_provide_parser_registry` | `boto3.client('textract')` — and called directly by `_provide_ingest_use_case` |
| `_provide_httpx_client` | not patched (movable) but recommend co-locating with the client singletons |

## Remaining groups — extraction order (safest first), all verified movable except ingestion
1. **chat_turn_providers** — `_provide_run_chat_turn`, `_provide_submit_widget_interaction`
   (provides RunChatTurn, SubmitWidgetInteraction). Both boot-covered. LARGE bodies (inline
   CapabilityRegistry + define_research_capability + tool executors, ~15 injected ports). Watch
   mypy on every injected param. Depends on injected `httpx.AsyncClient`.
2. **document_region_providers** (16) — HIGHEST RISK: contains 12 of the (now-covered) standalone
   bindings (region-edit writes, ClassifyDocument, the 3 relationship setters, DenyField) + the 2
   autofill use cases + ConfirmRegion/ProposeRegions. `EmbeddingProtocol` consumed but provided by
   must-stay `_provide_embedder` — inject it.
3. **entity_providers** (15) — HIGH RISK: 6 EntityType/Field CRUD + SuggestEntityTypes + 5
   promote/resolve factories + 3 merge-curation. Optionally split into entity-type-mgmt vs
   entity-resolution (both independently all-movable).
4. **ingestion_providers** (14) — LAST, `all_movable=false`. Leave `_provide_raw_email_store` +
   `_provide_parser_registry` behind (boto3 anchors). `_provide_ingest_use_case` calls
   `_provide_parser_registry()` DIRECTLY → the moved module must import it via a **deferred
   (function-body) import from `app.container`** to avoid the top-level circular import
   (container.py imports composition at module load). The deferred call still resolves
   `app.container.boto3`, so the boot patch stays effective.

## Verify loop after EACH extraction (from apps/email-listener, uv-managed)
1. `uv run pytest app/__tests__/test_container_boot.py` — the 88-binding boot gate.
2. `uv run pytest app/__tests__` — full DI suite (MANDATORY for groups 2/3/4 whose bindings the
   boot closure historically didn't fan into; the boot gate proves the covered set wires, not the
   uncovered factory signatures — mypy is the primary net there).
3. `uv run mypy app` — catches an added unbound/required param on any factory.
4. `uv run lint-imports` — a `composition/*.py` module must NOT import `app.presentation.*`.

**Model for every group:** "boot test green" == "the covered set still wires", NOT proof the
group's own bindings wire. Treat steps 2+3 as the real gate for the risky groups.
