# Phase 8: Trigram key_terms extractor - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous run; defaults from 04-08-SUMMARY deferral, STATE follow-ups, mission brief)

<domain>
## Phase Boundary

Backend-only (apps/email-listener, Python). Two deliverables:

1. **key_terms extractor:** deterministic (regex/rule-based, NO LLM) extraction of
   logistics identifiers from component text — PO numbers, invoice numbers, BL
   numbers, booking references, container numbers (ISO 6346 with check-digit
   validation). Wire it into both ends of hybrid retrieval (04-08): at INDEX time
   nothing changes (trgm matches against component content), at QUERY time
   AutofillUseCase passes extracted key_terms (currently hardcoded `key_terms=()`)
   into RetrievalPort.find_similar_confirmed, activating the dormant pg_trgm arm
   of RRF (RPCs match_components_by_trgm + GIN index live since migration 0009).
2. **Confirm-fallback FK fix:** ConfirmRegionUseCase's no-candidate fallback path
   writes ExtractionRecord(entity_type_id="") which violates the live NOT NULL
   UUID FK (documented in STATE follow-up b). Fix so the fallback resolves a real
   entity type or skips record creation with a logged warning (decide: skip +
   warn — confirming a region with no prior autofill has no entity type to
   attribute; still embed + index the component per D-15).

Out of scope: UI changes; new retrieval RPCs; embedding changes.
</domain>

<decisions>
## Implementation Decisions

- **Extractor location:** pure domain service `app/domain/services/key_terms.py`
  — `extract_key_terms(text: str) -> tuple[str, ...]` (deduped, order-stable,
  uppercased canonical forms). No I/O, no deps beyond stdlib `re`.
- **Patterns (initial set, precision over recall):**
  - Container: ISO 6346 `[A-Z]{3}[UJZ]\d{6}\d` + check-digit validation (reject
    invalid check digits — corpus has MSCU1234567-style examples).
  - BL number: carrier-prefixed alnum runs (e.g. `[A-Z]{4}\d{8,12}`) + explicit
    label capture (`B/L|BL|BILL OF LADING\s*(?:NO\.?|#|:)?\s*([A-Z0-9-]{6,})`).
  - Booking: `BOOKING\s*(?:NO\.?|#|:)?\s*([A-Z0-9-]{6,})`.
  - PO: `P\.?O\.?\s*(?:NO\.?|#|:)?\s*([A-Z0-9-]{4,})`.
  - Invoice: `INV(?:OICE)?\s*(?:NO\.?|#|:)?\s*([A-Z0-9/-]{4,})`.
  Label-anchored captures preferred; bare-pattern matches only for container
  numbers (self-validating). Cap result at ~20 terms.
- **Query-time wiring:** AutofillUseCase.execute computes
  `key_terms = extract_key_terms(component.content_text)` and passes it to
  retrieval (replacing the `key_terms=()` placeholder, 04-08). Retrieval RPC arm
  activates automatically when terms is non-empty (existing code path).
- **Confirm-fallback fix (decision: skip-and-warn):** in ConfirmRegionUseCase,
  when no candidate and no confirmed record exists, do NOT insert an
  ExtractionRecord with empty entity_type_id; log warning
  `confirm_region_no_candidate_record_skipped` and continue with embed+index
  (D-15 flywheel still closes). Update the integration test to cover this path
  against real Postgres.
- **Tests:** TDD the extractor (corpus-derived positive/negative cases incl.
  check-digit rejects, label variants, dedupe, cap); AutofillUseCase test asserts
  retrieval receives non-empty key_terms for a container-bearing region;
  confirm-fallback test asserts no save + warning + embedding still persisted.
  Full gates: uv run pytest -q (≥80%), ruff, mypy app, lint-imports, bandit.
- **No schema/migration work** — RPCs + GIN index live; trgm arm consumes
  text terms directly.
</decisions>

<code_context>
## Existing Code Insights

- apps/email-listener/app/application/use_cases/autofill.py — `key_terms=()`
  placeholder at the find_similar_confirmed call (line ~139).
- apps/email-listener/app/domain/ports/retrieval_port.py +
  infrastructure/supabase/retrieval_repository.py — hybrid RRF k=60; trgm arm
  calls match_components_by_trgm RPC when key_terms non-empty.
- apps/email-listener/app/application/use_cases/confirm_region.py — fallback at
  the `entity_type_id=""` ExtractionRecord (no-candidate branch).
- tests/corpus/logistics_vocab/*.pdf + ground_truth.json — realistic identifier
  examples for extractor test cases.
- tests/test_integration_real_postgres.py — env-gated integration idiom to extend.
- 04-08-SUMMARY.md — the deferral rationale and RPC contract.
</code_context>

<specifics>
## Specific Ideas

- Canonicalize terms: strip whitespace/punctuation noise, uppercase; keep the
  raw matched form as the term (retrieval similarity is trigram-based).
- ISO 6346 check digit: standard 11-char validation (letters→values map, weights
  2^i, mod 11, 10→0).
</specifics>

<deferred>
## Deferred Ideas

- LLM-assisted key-term extraction for unlabeled identifiers.
- Persisting key_terms on component rows / index-time term storage.
- Carrier-specific BL format dictionaries.
</deferred>
