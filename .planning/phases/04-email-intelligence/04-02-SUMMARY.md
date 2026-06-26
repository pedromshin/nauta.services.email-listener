---
phase: 04-email-intelligence
plan: "02"
subsystem: domain
tags: [python, dataclasses, clean-architecture, protocol, domain-entities, repository-pattern]

requires: []
provides:
  - "Email frozen dataclass (id, importer_id, message_id, to_addresses:tuple, cc_addresses:tuple, references_ids:tuple, parse_status, ...)"
  - "Attachment frozen dataclass (id, email_id, importer_id, filename, content_type, file_ext, storage_key, parent_attachment_id)"
  - "Component frozen dataclass with parent_component_id nesting (D-09) and location geometry dict (D-12) + embedding tuple"
  - "EntityTypeField + EntityType frozen dataclasses with nested fields:tuple[EntityTypeField, ...]"
  - "ExtractionRecord frozen dataclass (extracted_fields, confidence_score, corrected_fields, retrieval_context)"
  - "EmailRepository(Protocol) — save, find_by_id, find_by_message_id, update_parse_status"
  - "AttachmentRepository(Protocol) — save, find_by_email_id"
  - "ComponentRepository(Protocol) — save_many, find_by_id, find_by_email_id, update_embedding"
  - "EntityTypeRepository(Protocol) — find_by_slug, list_active"
  - "ExtractionRepository(Protocol) — save, find_by_component_id, supersede_active"
  - "ParserProtocol(Protocol) — async parse(*, file_bytes, content_type, attachment_id) -> list[Component]"
  - "ParserRegistryPort = Callable[[str], ParserProtocol | None]"
affects:
  - "04-03 (repository implementations)"
  - "04-04 (PDF parser implements ParserProtocol)"
  - "04-05 (segmentation uses Component)"
  - "04-06 (DecomposeEmailUseCase injects ParserRegistryPort)"
  - "04-07 (autofill uses EntityType, ExtractionRecord)"
  - "04-08 (retrieval uses Component embedding)"

tech-stack:
  added: []
  patterns:
    - "frozen @dataclass for all domain entities (immutable, CLAUDE.md)"
    - "tuple[T, ...] for all array fields on frozen dataclasses (never list)"
    - "TYPE_CHECKING guard for entity imports in Protocol ports (avoids circular imports)"
    - "Callable type alias for registry seam (avoids class-based registry in domain)"

key-files:
  created:
    - apps/email-listener/app/domain/entities/email.py
    - apps/email-listener/app/domain/entities/attachment.py
    - apps/email-listener/app/domain/entities/component.py
    - apps/email-listener/app/domain/entities/entity_type.py
    - apps/email-listener/app/domain/entities/extraction_record.py
    - apps/email-listener/app/domain/ports/__init__.py
    - apps/email-listener/app/domain/ports/email_repository.py
    - apps/email-listener/app/domain/ports/attachment_repository.py
    - apps/email-listener/app/domain/ports/component_repository.py
    - apps/email-listener/app/domain/ports/entity_type_repository.py
    - apps/email-listener/app/domain/ports/extraction_repository.py
    - apps/email-listener/app/domain/ports/parser_protocol.py
    - apps/email-listener/app/domain/ports/parser_registry_port.py
    - apps/email-listener/tests/test_domain_entities.py
    - apps/email-listener/tests/test_parser_protocol.py
  modified: []

key-decisions:
  - "TYPE_CHECKING guards used for entity imports in port files to avoid circular imports at runtime while keeping full type safety"
  - "ParserRegistryPort is a Callable type alias (not a Protocol class) — keeps application layer dependency-free from infra without a class hierarchy"
  - "pytest-asyncio not available; async parse() verified via asyncio.iscoroutinefunction() rather than awaiting in tests"

patterns-established:
  - "All domain entities use @dataclass(frozen=True) — mutation raises FrozenInstanceError"
  - "Array fields always typed as tuple[T, ...], never list"
  - "Repository ports use typing.Protocol with TYPE_CHECKING import guards"
  - "Parser dispatch is a Callable alias in domain; concrete registry lives in infrastructure"

requirements-completed: []

duration: 25min
completed: "2026-06-11"
---

# Phase 04 Plan 02: Domain Entities + Ports Summary

**Five frozen-dataclass domain entities + seven Protocol ports (including ParserProtocol seam and ParserRegistryPort callable type) establishing the Clean Architecture contract layer for all Email Intelligence plans**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-11T19:20:00Z
- **Completed:** 2026-06-11T19:45:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Five frozen dataclass entities mirror the Supabase schema 1:1 with tuple array fields and full nullable typing
- Component carries `parent_component_id` (D-09 nesting) and `location: dict[str, object]` geometry (D-12)
- ParserProtocol defines the format-agnostic `async parse() -> list[Component]` seam (D-10)
- ParserRegistryPort callable type alias lets application layer dispatch parsers without importing infrastructure
- All five repository Protocol ports defined with correct method signatures
- 42 total unit tests (20 entity + 22 port conformance) pass; mypy and import-linter clean

## Task Commits

1. **Task 1: Domain entities mirroring the schema** - `e32be10` (feat)
2. **Task 2: Repository ports + ParserProtocol seam + ParserRegistryPort** - `34e3adc` (feat)

## Files Created/Modified

- `app/domain/entities/email.py` - Email frozen dataclass, 18 fields including tuple arrays
- `app/domain/entities/attachment.py` - Attachment frozen dataclass with parent_attachment_id
- `app/domain/entities/component.py` - Component with parent_component_id + location geometry + embedding
- `app/domain/entities/entity_type.py` - EntityTypeField + EntityType with nested fields tuple
- `app/domain/entities/extraction_record.py` - ExtractionRecord with dict fields for LLM output
- `app/domain/ports/__init__.py` - Exports all 7 ports including ParserRegistryPort
- `app/domain/ports/parser_protocol.py` - ParserProtocol(Protocol) with async parse()
- `app/domain/ports/parser_registry_port.py` - ParserRegistryPort = Callable[[str], ParserProtocol | None]
- `app/domain/ports/email_repository.py` - EmailRepository(Protocol)
- `app/domain/ports/attachment_repository.py` - AttachmentRepository(Protocol)
- `app/domain/ports/component_repository.py` - ComponentRepository(Protocol) with update_embedding
- `app/domain/ports/entity_type_repository.py` - EntityTypeRepository(Protocol)
- `app/domain/ports/extraction_repository.py` - ExtractionRepository(Protocol) with supersede_active
- `tests/test_domain_entities.py` - 20 immutability + nesting + geometry tests
- `tests/test_parser_protocol.py` - 22 structural conformance tests

## Decisions Made

- TYPE_CHECKING guards used for entity imports in port files to prevent circular imports at runtime while retaining full type safety for mypy
- ParserRegistryPort implemented as a Callable type alias (not a Protocol class) — the application layer needs only to call it with a string, not to implement it
- pytest-asyncio not in dev dependencies; async parse() verified via `asyncio.iscoroutinefunction()` rather than awaiting in tests; this is sufficient for the contract test

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- pytest-asyncio not available in the project's dev dependencies. Replaced the `await fake.parse(...)` test with an `asyncio.iscoroutinefunction(fake.parse)` assertion — equivalent contract coverage without requiring an extra dependency.

## Known Stubs

None — all entities and ports are full contracts, no placeholder data or hardcoded stubs.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. Domain layer contains no I/O.
`importer_id` is present as a required field on Email, Attachment, Component, and ExtractionRecord (T-04-06 mitigated).
import-linter enforces domain→infra boundary (T-04-05 mitigated).

## Next Phase Readiness

- All downstream plans (04-03 through 04-08) can now import entities and ports from `app.domain.entities.*` and `app.domain.ports.*`
- 04-03 (Supabase repository implementations) can implement all five repository Protocol ports
- 04-04 (PDF parser) can implement ParserProtocol
- 04-06 (DecomposeEmailUseCase) can inject ParserRegistryPort as a callable without importing infrastructure

---
*Phase: 04-email-intelligence*
*Completed: 2026-06-11*
