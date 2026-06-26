---
phase: 04-email-intelligence
plan: "05"
subsystem: infrastructure/llm
tags: [python, anthropic, bedrock, llm, segmentation, clean-architecture, protocol]

requires:
  - "04-02 (Component entity + domain ports layout)"
  - "04-04 (page Components with normalized geometry as segmenter input)"

provides:
  - "AsyncAnthropicBedrock client factory (lru_cache, IAM role auth, no api_key)"
  - "ProposedRegion frozen dataclass + SegmenterProtocol port"
  - "AnthropicSegmenter — structured JSON via segment_document tool schema"
  - "Prompt-injection structural defense: document content confined to <document_content> in user turn (D-14)"
  - "Retry policy _MAX_RETRIES=3 / _RETRY_DELAYS=(2,5,15); returns [] on total failure"
  - "_MAX_PAGE_CHARS=32000 token-cost guard (T-04-17)"

affects:
  - "04-11 (gap plan — builds ProposeRegionsUseCase and dispatches this segmenter from live ingestion)"
  - "04-07 (autofill consumes region Components produced via this segmenter)"

tech-stack:
  added:
    - anthropic[bedrock] (AsyncAnthropicBedrock — LLM transport is Bedrock, not direct API)
  patterns:
    - "Tool-schema structured output (segment_document) instead of free-text JSON parsing"
    - "Untrusted content isolated to user turn inside delimiters; instructions in system prompt only"
    - "Graceful total-failure: segmenter returns [] rather than raising into ingestion"

key-files:
  created:
    - apps/email-listener/app/domain/ports/segmenter_protocol.py
    - apps/email-listener/app/infrastructure/llm/anthropic_client.py
    - apps/email-listener/app/infrastructure/llm/segmentation_adapter.py
    - apps/email-listener/tests/test_segmentation_adapter.py
  modified:
    - apps/email-listener/app/infrastructure/llm/__init__.py

key-decisions:
  - "LLM transport = AWS Bedrock with IAM role auth (AsyncAnthropicBedrock); no ANTHROPIC_API_KEY anywhere"
  - "Segmenter failure mode = empty list, never an exception — ingestion must not fail because the LLM did"
  - "ProposeRegionsUseCase + container dispatch intentionally deferred: delivered later by gap plan 04-11 (UAT Gap 2)"

requirements-completed: []

duration: unknown (closed out retroactively)
completed: "2026-06-11"
---

# Phase 04 Plan 05: LLM Segmentation Pass Summary

**AnthropicSegmenter behind SegmenterProtocol — Claude (via Bedrock) proposes candidate entity regions as structured JSON with multi/overlapping/nested support, junk tolerance, retries, and structural prompt-injection defense**

> Close-out note: this SUMMARY was written retroactively by the orchestrator. The plan was
> executed via a trimmed/worktree path that committed code but never wrote a SUMMARY.md.
> Functionality was verified by UAT (04-UAT.md Test 4, pass) on 2026-06-12.

## Accomplishments

- `ProposedRegion` frozen dataclass + `SegmenterProtocol` port (domain layer)
- `AsyncAnthropicBedrock` factory with `lru_cache` — IAM role auth, region/model from settings
- `AnthropicSegmenter`: page content placed in the user turn inside `<document_content>` delimiters (D-14); instructions live only in the system prompt
- `segment_document` tool schema forces structured JSON output (no free-text parsing)
- Retry policy: 3 attempts with (2, 5, 15)s delays; returns `[]` on total failure so ingestion never crashes on LLM errors
- `_MAX_PAGE_CHARS=32000` guard caps token cost per page (T-04-17)
- 6 tests green: multi-entity, overlapping, nested, junk content, retry exhaustion, prompt-injection structural defense

## Task Commits

1. **Bedrock client + SegmenterProtocol + AnthropicSegmenter** - `4a5dd0b` (feat)
2. **Lint sync of merged 04-05 tests (deploy fix commit)** - `9a5fcfe` (fix, shared)

## Deviations from Plan

**1. [Scope reallocation] `propose_regions.py` use case + container wiring not delivered here**
- The plan's `app/application/use_cases/propose_regions.py` and `container.py` wiring were not implemented in this execution; the segmenter was left unit-tested but undispatched (UAT Gap 2, major).
- **Resolution:** gap plan **04-11** (checker-verified) builds `ProposeRegionsUseCase` and wires dispatch into the live `IngestInboundEmailUseCase`.

## Verification

- UAT 04-UAT.md Test 4 (segmentation adapter robustness): **pass** — unit-level only; dispatch gap tracked and planned.
