# Phase 4: Email Intelligence - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 22 new/modified files
**Analogs found:** 19 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/email-listener/app/domain/entities/email.py` | model | CRUD | `apps/email-listener/app/domain/entities/inbound_email.py` | exact |
| `apps/email-listener/app/domain/entities/attachment.py` | model | CRUD | `apps/email-listener/app/domain/entities/inbound_email.py` (AttachmentMeta) | exact |
| `apps/email-listener/app/domain/entities/component.py` | model | CRUD | `apps/email-listener/app/domain/entities/inbound_email.py` | role-match |
| `apps/email-listener/app/domain/entities/entity_type.py` | model | CRUD | `apps/email-listener/app/domain/entities/inbound_email.py` | role-match |
| `apps/email-listener/app/domain/entities/extraction_record.py` | model | CRUD | `examples/acme-boards-main/src/acme_boards/structurers/types.py` (StructuredDeck) | role-match |
| `apps/email-listener/app/domain/ports/email_repository.py` | utility | CRUD | `apps/email-listener/app/container.py` (Protocol pattern referenced) | partial |
| `apps/email-listener/app/domain/ports/attachment_repository.py` | utility | CRUD | `apps/email-listener/app/container.py` (Protocol pattern referenced) | partial |
| `apps/email-listener/app/domain/ports/parser_protocol.py` | utility | transform | `apps/email-listener/app/container.py` (Protocol pattern referenced) | partial |
| `apps/email-listener/app/application/use_cases/decompose_email.py` | service | event-driven | `apps/email-listener/app/application/use_cases/receive_inbound_email.py` | exact |
| `apps/email-listener/app/application/use_cases/propose_regions.py` | service | request-response | `apps/email-listener/app/application/use_cases/receive_inbound_email.py` | role-match |
| `apps/email-listener/app/application/use_cases/autofill.py` | service | request-response | `examples/acme-boards-main/src/acme_boards/structurers/gemini.py` | role-match |
| `apps/email-listener/app/application/use_cases/confirm_region.py` | service | CRUD | `apps/email-listener/app/application/use_cases/receive_inbound_email.py` | role-match |
| `apps/email-listener/app/infrastructure/pdf/parser_registry.py` | utility | transform | `examples/acme-boards-main/src/acme_boards/extractors/docling.py` | role-match |
| `apps/email-listener/app/infrastructure/pdf/pdf_parser.py` | service | file-I/O | `examples/acme-boards-main/src/acme_boards/extractors/docling.py` | exact |
| `apps/email-listener/app/infrastructure/supabase/email_repository.py` | service | CRUD | `examples/acme-boards-main/src/acme_boards/writers/supabase.py` | exact |
| `apps/email-listener/app/infrastructure/supabase/client.py` | utility | request-response | `apps/email-listener/app/settings.py` + boards `DeckWriter.__init__` | role-match |
| `apps/email-listener/app/infrastructure/llm/segmentation_adapter.py` | service | request-response | `examples/acme-boards-main/src/acme_boards/structurers/gemini.py` | exact |
| `apps/email-listener/app/infrastructure/llm/embedding_adapter.py` | service | request-response | `examples/acme-boards-main/src/acme_boards/embedders/gemini.py` | role-match |
| `apps/email-listener/app/infrastructure/sns/ses_parser.py` (extend) | utility | transform | self — extend existing file | exact |
| `apps/email-listener/app/presentation/api/v1/emails.py` | controller | request-response | `apps/email-listener/app/presentation/api/v1/inbound_email.py` | exact |
| `apps/email-listener/app/container.py` (extend) | config | request-response | self — extend existing file | exact |
| `apps/email-listener/app/settings.py` (extend) | config | request-response | self — extend existing file | exact |
| `packages/db/supabase/migrations/001_extensions.sql` | migration | batch | `examples/acme-boards-main/migrations/001_board_emails.sql` | exact |
| `packages/db/supabase/migrations/002_core_schema.sql` | migration | batch | `examples/acme-boards-main/migrations/001_board_emails.sql` + `003_board_deck_structured.sql` | exact |
| `packages/db/supabase/migrations/003_pgvector_indexes.sql` | migration | batch | `examples/acme-boards-main/migrations/005_board_deck_chunks.sql` | exact |
| `packages/db/supabase/migrations/004_seed_entity_types.sql` | migration | batch | `examples/acme-boards-main/migrations/001_board_emails.sql` | role-match |
| `tests/` (new test files) | test | — | `apps/email-listener/tests/test_inbound_sns.py` + `examples/acme-boards-main/tests/test_docling_extractor.py` | exact |

---

## Pattern Assignments

### `apps/email-listener/app/domain/entities/email.py` (model, CRUD)

**Analog:** `apps/email-listener/app/domain/entities/inbound_email.py`

**Imports pattern** (lines 1-7):
```python
"""Domain entity for a persisted email row. No external dependencies."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
```

**Core domain entity pattern** (lines 8-31):
```python
# frozen=True is mandatory — all domain entities are immutable (CLAUDE.md)
@dataclass(frozen=True)
class AttachmentMeta:
    """Metadata describing a single email attachment (content not stored yet)."""

    filename: str
    content_type: str
    size_bytes: int


@dataclass(frozen=True)
class InboundEmail:
    """A raw inbound email as received, before any parsing or persistence."""

    sender: str
    recipients: tuple[str, ...]  # tuple not list — immutable
    subject: str
    raw_body: str
    headers: dict[str, str] = field(default_factory=dict)
    attachments: tuple[AttachmentMeta, ...] = ()

    @property
    def attachment_count(self) -> int:
        return len(self.attachments)
```

**New Email entity must add:** `id: str`, `importer_id: str`, `message_id: str`, `received_at: datetime`, `parse_status: str`, plus optional `body_html/body_text`. Mirror the schema from RESEARCH.md §3.2 exactly. Use `tuple[str, ...]` for all array fields (to_addresses, cc_addresses, references_ids). Use `str | None` for nullable columns.

---

### `apps/email-listener/app/domain/entities/attachment.py` (model, CRUD)

**Analog:** `apps/email-listener/app/domain/entities/inbound_email.py` (AttachmentMeta)

Same `@dataclass(frozen=True)` pattern. Fields map 1:1 to RESEARCH.md §3.3 schema: `id`, `email_id`, `importer_id`, `filename`, `content_type`, `file_ext`, `size_bytes`, `storage_key`, `parent_attachment_id: str | None`, `parse_status`.

---

### `apps/email-listener/app/domain/entities/component.py` (model, CRUD)

**Analog:** `examples/acme-boards-main/src/acme_boards/structurers/types.py`

**Core type pattern** (lines 17-46):
```python
# types.py shows how to model pipeline-stage domain objects
@dataclass(frozen=True)
class ExtractedDocument:
    """Raw output from DoclingExtractor before LLM structuring."""

    raw_markdown: str
    page_count: int
    has_tables: bool
    detected_language: str | None
    docling_version: str
    truncated: bool
```

**New Component entity adds:** `id`, `email_id`, `importer_id`, `attachment_id: str | None`, `source_type: str` (one of the component_source_type enum values), `location: dict[str, object]` (jsonb), `content_text: str`, `content_markdown: str | None`, `content_raw: dict[str, object] | None`, `embedding: tuple[float, ...] | None`, `sequence_index: int`, `extraction_status: str`. Keep `embedding` field here (not in a separate class) so it mirrors `StructuredDeck.embedding` pattern in types.py line 87.

---

### `apps/email-listener/app/domain/entities/entity_type.py` (model, CRUD)

**Analog:** `apps/email-listener/app/domain/entities/inbound_email.py`

Two frozen dataclasses: `EntityTypeField` (slug, label, data_type, is_identifier, is_required, description, sort_order) and `EntityType` (id, importer_id, slug, label, description, is_active, embedding). Nested as `fields: tuple[EntityTypeField, ...]` on `EntityType`.

---

### `apps/email-listener/app/domain/entities/extraction_record.py` (model, CRUD)

**Analog:** `examples/acme-boards-main/src/acme_boards/structurers/types.py` (StructuredDeck, lines 44-110)

**Core pattern** (lines 44-52):
```python
@dataclass(frozen=True)
class StructuredDeck:
    """Final structured output — 1:1 with board_deck_structured columns."""

    attachment_id: str

    # Core extraction
    company_name: str | None
    ...
    extraction_status: str
    processing_errors: str | None
    reprocess_count: int
    confidence: float | None
    ...
    processed_at: datetime | None
```

New `ExtractionRecord` maps 1:1 to RESEARCH.md §3.7. Keep `extracted_fields: dict[str, object]`, `confidence_score: float`, `status: str`, `corrected_fields: dict[str, object] | None`, `retrieval_context: dict[str, object] | None`. Use `datetime | None` for all timestamp fields.

---

### `apps/email-listener/app/domain/ports/parser_protocol.py` (utility, transform)

**Analog:** No direct analog exists in the codebase. Closest structural precedent is the `DeckWriter.__init__` constructor contract in `examples/acme-boards-main/src/acme_boards/writers/supabase.py` (line 40: `def __init__(self, supabase_client: Any) -> None`), combined with the Python Protocol pattern documented in `.claude/rules/python/patterns.md`.

**Use this pattern from rules:**
```python
from typing import Protocol

class ParserProtocol(Protocol):
    """Parse an attachment's bytes into a list of Components/Regions."""

    async def parse(
        self,
        *,
        file_bytes: bytes,
        content_type: str,
        attachment_id: str,
    ) -> list[Component]: ...
```

Registry keyed by `file_ext` (str) → `ParserProtocol`. See D-10: `parse(attachment) -> list[Component/Region]`. The PDF parser is the first implementation; others register behind the same interface.

---

### `apps/email-listener/app/domain/ports/email_repository.py` + `attachment_repository.py` (utility, CRUD)

**Analog:** No repository class exists yet. Closest structural precedent:
- `app/container.py` (lines 1-15): shows how providers are registered for Protocol-typed dependencies
- `examples/acme-boards-main/src/acme_boards/writers/supabase.py` (DeckWriter): shows the concrete implementation shape

**Protocol pattern to follow (from `.claude/rules/python/patterns.md`):**
```python
from typing import Protocol

class EmailRepository(Protocol):
    async def save(self, email: Email) -> Email: ...
    async def find_by_message_id(self, importer_id: str, message_id: str) -> Email | None: ...
    async def find_by_id(self, email_id: str) -> Email | None: ...
```

Concrete implementations live in `app/infrastructure/supabase/`. Port lives in `app/domain/ports/`. This is the Clean Architecture boundary the import-linter enforces.

---

### `apps/email-listener/app/application/use_cases/decompose_email.py` (service, event-driven)

**Analog:** `apps/email-listener/app/application/use_cases/receive_inbound_email.py`

**Full pattern** (lines 1-33):
```python
"""Use case: receive a raw inbound email and log it. No parsing, no persistence yet."""

from __future__ import annotations

import structlog

from app.domain.entities.inbound_email import InboundEmail

logger = structlog.get_logger(__name__)


class ReceiveInboundEmailUseCase:
    """Logs the raw inbound email. Future stages add parsing, persistence, storage."""

    async def execute(self, email: InboundEmail) -> None:
        logger.info(
            "inbound_email_received",
            sender=email.sender,
            ...
        )
```

**Decompose use-case pattern:**
- Constructor takes repository and parser registry via dependency injection (matches dishka `Provider.provide` in container.py)
- Single `async def execute(self, *, s3_key: str, message_id: str, importer_id: str) -> None` method
- Structured log every stage with `structlog.get_logger(__name__)`
- Broad `except Exception` at the top level logs to structlog then re-raises (no silent swallowing)
- Use `logger.exception("decompose_error", ...)` not `logger.error` when catching exceptions

---

### `apps/email-listener/app/application/use_cases/autofill.py` (service, request-response)

**Analog:** `examples/acme-boards-main/src/acme_boards/structurers/gemini.py`

**Two-pass LLM pattern** (lines 164-198):
```python
async def classify_doc_type(self, markdown: str) -> tuple[str, float]:
    """Pass 1: classify the document type from the first 3000 chars."""
    prompt = DOC_TYPE_PROMPT.format(text=markdown[:_PASS1_CHAR_BUDGET])
    result = await self._generate(prompt, response_schema=_PASS1_SCHEMA)
    label = result.get("doc_type", "unknown")
    if label not in VALID_DOC_TYPES:
        return "unknown", 0.0
    return label, _clamp_unit(result.get("confidence"))

async def extract(self, *, markdown: str, doc_type: str, detected_type: str) -> dict[str, Any]:
    """Pass 2: type-specific structured extraction over the FULL markdown."""
    ...
    return await self._generate(prompt)
```

**Retry pattern** (lines 113-161):
```python
_MAX_RETRIES = 3
_RETRY_DELAYS = (2.0, 5.0, 15.0)

for attempt in range(_MAX_RETRIES):
    try:
        response = await self._client.aio.models.generate_content(...)
        ...
    except Exception as exc:
        last_exc = exc
        if attempt < _MAX_RETRIES - 1:
            await asyncio.sleep(_RETRY_DELAYS[attempt])

_log.error("gemini_failed_all_retries: %r", last_exc)
return {}
```

**Security: content in user turn only (D-14)** — the `autofill` use-case must structure Claude API calls so email/attachment content is always in the `user` message inside `<document_content>` delimiters. The system prompt contains only the entity-type description, field schema, and knowledge-node context. This is the structural defense per RESEARCH.md §6.

---

### `apps/email-listener/app/infrastructure/pdf/parser_registry.py` (utility, transform)

**Analog:** `examples/acme-boards-main/src/acme_boards/extractors/docling.py` (lines 28-36, MIME-type gating)

**MIME-type dispatch pattern:**
```python
# docling.py lines 28-36
_SUPPORTED_MIME_TYPES: frozenset[str] = frozenset({
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ...
})

# In extract():
if mime_type not in _SUPPORTED_MIME_TYPES:
    raise UnsupportedMimeTypeError(mime_type)
```

**Registry pattern for Phase 4:**
```python
# parser_registry.py — keyed by file_ext, returns ParserProtocol
_REGISTRY: dict[str, ParserProtocol] = {}

def register(file_ext: str, parser: ParserProtocol) -> None:
    """Register a parser for a file extension. Idempotent, raises on conflict."""
    ...

def get_parser(file_ext: str) -> ParserProtocol | None:
    """Return the registered parser or None if unsupported."""
    return _REGISTRY.get(file_ext.lower())
```

Define a custom exception: `class UnsupportedFileTypeError(ValueError)` mirroring `UnsupportedMimeTypeError` in `types.py` lines 112-117.

---

### `apps/email-listener/app/infrastructure/pdf/pdf_parser.py` (service, file-I/O)

**Analog:** `examples/acme-boards-main/src/acme_boards/extractors/docling.py`

**Async-over-sync executor pattern** (lines 92-102):
```python
async def extract(self, *, file_bytes: bytes, mime_type: str) -> ExtractedDocument:
    """Convert raw bytes to markdown. Raises UnsupportedMimeTypeError for ZIP/image/etc."""
    if mime_type not in _SUPPORTED_MIME_TYPES:
        raise UnsupportedMimeTypeError(mime_type)

    loop = asyncio.get_event_loop()
    raw_markdown, page_count, has_tables, detected_language = await loop.run_in_executor(
        self._executor,
        self._sync_extract,
        file_bytes,
    )
    ...
```

**Constructor pattern** (lines 40-76):
```python
def __init__(
    self,
    *,
    use_cuda: bool = True,
    batch_size: int = 8,
    max_workers: int = 1,
    do_ocr: bool = True,
    do_table_structure: bool = True,
) -> None:
    ...
    self._executor = ThreadPoolExecutor(max_workers=max_workers)
```

**Adaptive text-extraction logic (D-07):** implement `_detect_text_layer(doc) -> bool` — if the PDF has a usable text layer (non-garbage, >N chars per page), use pdfminer/pypdf; otherwise dispatch to OCR (Textract or Tesseract). This is new logic but the `_sync_extract` wrapper pattern is copied exactly from docling.py lines 112-136.

---

### `apps/email-listener/app/infrastructure/supabase/email_repository.py` (service, CRUD)

**Analog:** `examples/acme-boards-main/src/acme_boards/writers/supabase.py`

**Client injection + upsert pattern** (lines 33-42, 101-109):
```python
class DeckWriter:
    def __init__(self, supabase_client: Any) -> None:
        self._c = supabase_client

    def upsert_structured(self, deck: StructuredDeck) -> str:
        """Upsert a board_deck_structured row; returns the parent id."""
        payload = self._serialize_deck(deck)
        resp = (
            self._c.table("board_deck_structured")
            .upsert(payload, on_conflict="attachment_id", returning="representation")
            .execute()
        )
        structured_id: str = resp.data[0]["id"]
        return structured_id
```

**Idempotency pattern** (lines 1-12 docstring + lines 157-159):
```python
# Force-reprocess-safe: deletes existing rows first
self._c.table("board_deck_chunks").delete().eq(
    "structured_id", structured_id
).execute()
```

**New email_repository methods:**
- `async def save(self, email: Email) -> Email` — upsert on `(importer_id, message_id)` unique constraint
- `async def find_by_id(self, email_id: str) -> Email | None`
- `async def update_parse_status(self, email_id: str, status: str, error: str | None) -> None`

Use `asyncpg` or the async supabase client. Serialization helper `_to_row(entity) -> dict[str, object]` mirrors `_serialize_deck` (lines 178-208).

---

### `apps/email-listener/app/infrastructure/supabase/client.py` (utility, request-response)

**Analog:** `apps/email-listener/app/settings.py` (startup secret surfacing pattern)

**Secret surfacing at startup pattern** (lines 18-33, 97-101):
```python
def parse_secret_value(value: str | None, key: str, environment: str) -> str:
    """Extract a value from an AWS Secrets Manager JSON envelope."""
    if not value:
        return ""
    value = value.strip()
    if environment.lower() in ("production", "staging") and value.startswith("{"):
        try:
            extracted = json.loads(value).get(key, value)
            return extracted.strip() if isinstance(extracted, str) else str(extracted)
        except json.JSONDecodeError:
            pass
    return value

@lru_cache
def get_settings() -> BaseAppSettings:
    environment = os.getenv("ENVIRONMENT", "development").lower()
    ...
```

**Supabase client factory pattern:**
```python
from functools import lru_cache

@lru_cache
def get_supabase_client() -> Client:
    """Return a cached Supabase service-role client. Fails closed if secrets missing."""
    url = get_settings().SUPABASE_URL
    key = get_settings().SUPABASE_SERVICE_ROLE_KEY
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return create_client(url, key)
```

New settings fields to add to `app/settings.py`: `SUPABASE_URL: str = ""`, `SUPABASE_SERVICE_ROLE_KEY: str = ""`, `ANTHROPIC_API_KEY: str = ""`, `AWS_TEXTRACT_REGION: str = "us-east-1"`.

---

### `apps/email-listener/app/infrastructure/llm/segmentation_adapter.py` (service, request-response)

**Analog:** `examples/acme-boards-main/src/acme_boards/structurers/gemini.py`

**_generate wrapper with retry** (lines 96-161): Copy this pattern exactly, substituting the Anthropic SDK for Gemini. The `_generate` method returns `dict[str, Any]`, logs timing, retries up to 3 times, returns `{}` on total failure (never raises — caller decides what a blank response means).

**Security boundary** (D-14): The `_call_anthropic` method must separate system and user turns:
```python
# CORRECT: content in user turn inside delimiters
messages = [
    {
        "role": "user",
        "content": f"<document_content>{attachment_text}</document_content>\n\nSegment this document.",
    }
]
```
Never pass email/attachment text in `system` parameter.

**Structured output**: Use Anthropic's `tool_use` or `response_format` (JSON mode) — same pattern as Gemini's `response_mime_type="application/json"` + `response_schema` in lines 101-109. Return validated JSON only; fall back to `{}` on any `json.JSONDecodeError`.

---

### `apps/email-listener/app/presentation/api/v1/emails.py` (controller, request-response)

**Analog:** `apps/email-listener/app/presentation/api/v1/inbound_email.py`

**Full router pattern** (lines 1-69):
```python
from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.presentation.api.response import ApiResponse
from app.presentation.middleware.auth import require_api_key

router = APIRouter(prefix="/v1/emails", tags=["emails"], dependencies=[Depends(require_api_key)])


@router.post("/inbound", status_code=202)
@inject
async def receive_inbound_email(
    payload: InboundEmailIn,
    use_case: FromDishka[ReceiveInboundEmailUseCase],
) -> ApiResponse[InboundEmailAck]:
    """Accept a raw inbound email, log it, and acknowledge receipt."""
    email = payload.to_entity()
    await use_case.execute(email)
    return ApiResponse.ok(InboundEmailAck(received=True, ...))
```

**New endpoints in Phase 4:**
- `GET /v1/emails` — list with importer_id filter → `ApiResponse[list[EmailView]]`
- `GET /v1/emails/{email_id}` → `ApiResponse[EmailView]`
- `POST /v1/emails/{email_id}/reprocess` → `ApiResponse[ReprocessAck]`
- `POST /v1/components/{component_id}/autofill` → `ApiResponse[AutofillResult]`
- `POST /v1/components/{component_id}/confirm` → `ApiResponse[ConfirmAck]`

All endpoints use `dependencies=[Depends(require_api_key)]` on the router (not per-endpoint). All return `ApiResponse[T]` envelope from `app/presentation/api/response.py`.

---

### `apps/email-listener/app/infrastructure/sns/ses_parser.py` (extend existing, utility, transform)

**Analog:** self — `apps/email-listener/app/infrastructure/sns/ses_parser.py`

**Current pattern** (lines 1-32):
```python
"""SES notification parser — extracts email metadata from the SNS Message field."""

from __future__ import annotations

import json
from typing import TypedDict

import structlog

logger = structlog.get_logger(__name__)


class EmailMeta(TypedDict):
    message_id: str
    sender: str
    recipients: list[str]
    subject: str


def parse_ses_notification(sns_message_str: str) -> EmailMeta:
    """Parse SES notification JSON from the SNS Message field."""
    data: dict[str, object] = json.loads(sns_message_str)
    mail: dict[str, object] = data.get("mail", {})  # type: ignore[assignment]
    ...
    return EmailMeta(...)
```

**Extension approach:** Add a new `parse_ses_notification_full(sns_message_str: str) -> FullEmailMeta` that also extracts `in_reply_to`, `references_ids`, `received_at`, `body_html`, `body_text`, and `s3_object_key`. Keep the existing `parse_ses_notification` function unchanged (backward compat). Use a new `FullEmailMeta(TypedDict)` with all fields from RESEARCH.md §3.2. The `body_html`/`body_text` come from S3 (not the SNS payload) — this function only extracts metadata from SNS; actual S3 fetch happens in the use-case.

---

### `apps/email-listener/app/container.py` (extend existing, config, request-response)

**Analog:** self — `apps/email-listener/app/container.py`

**Full current pattern** (lines 1-15):
```python
"""Dishka dependency injection container."""

from __future__ import annotations

from dishka import AsyncContainer, Provider, Scope, make_async_container

from app.application.use_cases.receive_inbound_email import ReceiveInboundEmailUseCase


def create_container() -> AsyncContainer:
    provider = Provider(scope=Scope.APP)
    provider.provide(ReceiveInboundEmailUseCase)
    return make_async_container(provider)
```

**Extension pattern:** Add `provider.provide(SupabaseEmailRepository, provides=EmailRepository)` etc. for each new use-case and repository. All new providers use `Scope.APP` for stateless/connection-pooled objects, `Scope.REQUEST` only if the dependency is genuinely request-scoped. The `parser_registry` is a singleton (Scope.APP) built once at startup with the PDF parser registered.

---

## Shared Patterns

### Immutable domain entities
**Source:** `apps/email-listener/app/domain/entities/inbound_email.py` (all lines)
**Apply to:** All new domain entity files
```python
@dataclass(frozen=True)
class MyEntity:
    id: str
    some_field: str
    nullable_field: str | None
    array_field: tuple[str, ...]  # tuple, not list — immutable
```
Never use `list` for array fields on frozen dataclasses. Use `tuple[T, ...]`.

### Logging
**Source:** `apps/email-listener/app/application/use_cases/receive_inbound_email.py` (lines 1-10)
**Apply to:** All use-case and infra service files
```python
import structlog

logger = structlog.get_logger(__name__)

# In methods:
logger.info("event_name", key=value, ...)
logger.exception("error_event", context_key=value)  # auto-attaches exc_info
```

### API response envelope
**Source:** `apps/email-listener/app/presentation/api/response.py` (lines 1-21)
**Apply to:** All new presentation/api/v1/ endpoint handlers
```python
from app.presentation.api.response import ApiResponse

# Success:
return ApiResponse.ok(SomeResponseModel(...))

# Error (caught at handler level):
return ApiResponse.fail("human-friendly message")
```

### Authentication guard
**Source:** `apps/email-listener/app/presentation/middleware/auth.py` (lines 1-27)
**Apply to:** All new API routers (not sns_inbound which has no auth by design)
```python
router = APIRouter(
    prefix="/v1/emails",
    tags=["emails"],
    dependencies=[Depends(require_api_key)],  # router-level, not per-endpoint
)
```

### DI injection pattern
**Source:** `apps/email-listener/app/presentation/api/v1/inbound_email.py` (lines 1-15, 60-68)
**Apply to:** All new controller handlers that depend on use-cases
```python
from dishka.integrations.fastapi import FromDishka, inject

@router.post("/endpoint", status_code=202)
@inject
async def handler(
    payload: PayloadModel,
    use_case: FromDishka[MyUseCase],
) -> ApiResponse[ResponseModel]:
    ...
```

### Pydantic boundary validation
**Source:** `apps/email-listener/app/presentation/api/v1/inbound_email.py` (lines 20-52)
**Apply to:** All new request models at presentation layer
```python
class MyRequestIn(BaseModel):
    """Validated input payload — system boundary."""

    field: str = Field(min_length=1, max_length=998)
    optional_field: str = Field(default="", max_length=998)
    items: list[ItemIn] = Field(default_factory=list)

    def to_entity(self) -> MyDomainEntity:
        return MyDomainEntity(...)
```

### Error handling in use-cases
**Source:** `apps/email-listener/app/presentation/api/v1/sns_inbound.py` (lines 40-53)
**Apply to:** All use-cases and controllers handling external calls
```python
try:
    meta = parse_ses_notification(str(payload["Message"]))
except Exception:
    logger.exception("sns_parse_error", payload_keys=list(payload.keys()))
    return Response(status_code=status.HTTP_200_OK)  # fail-safe for SNS
```
Use-cases that fail must log server-side detail, return user-friendly errors upward.

### Settings / secret surfacing at startup
**Source:** `apps/email-listener/app/settings.py` (lines 18-33, 42-73)
**Apply to:** `app/infrastructure/supabase/client.py`, any new external-service adapters
```python
class BaseAppSettings(BaseSettings):
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    @property
    def supabase_url(self) -> str:
        return parse_secret_value(self.SUPABASE_URL, "SUPABASE_URL", self.ENVIRONMENT.value)
```
Empty string in production → fail at startup, not at request time.

### Async-over-sync executor (for CPU-heavy/blocking work)
**Source:** `examples/acme-boards-main/src/acme_boards/extractors/docling.py` (lines 92-101)
**Apply to:** `app/infrastructure/pdf/pdf_parser.py`, any OCR adapter
```python
loop = asyncio.get_event_loop()
result = await loop.run_in_executor(
    self._executor,  # ThreadPoolExecutor(max_workers=1)
    self._sync_extract,
    file_bytes,
)
```

### Supabase upsert / idempotency
**Source:** `examples/acme-boards-main/src/acme_boards/writers/supabase.py` (lines 101-109)
**Apply to:** All `app/infrastructure/supabase/` repository implementations
```python
resp = (
    self._c.table("emails")
    .upsert(payload, on_conflict="importer_id,message_id", returning="representation")
    .execute()
)
row_id: str = resp.data[0]["id"]
```

---

## Migration Patterns

### SQL migration file conventions
**Source:** `examples/acme-boards-main/migrations/001_board_emails.sql`
**Apply to:** All `packages/db/supabase/migrations/` files

Key conventions from the boards migrations:
1. Each type creation wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;`
2. Foreign key constraints also wrapped (lines 86-96 in 001_board_emails.sql)
3. RLS enabled on every table with explicit `DENY ALL` for `anon` and `authenticated` roles (service_role bypasses by design)
4. HNSW index creation is a separate migration file (005_board_deck_chunks.sql) — **add AFTER initial data load**, not in the schema creation migration (comment in RESEARCH.md §3.4)
5. `CREATE INDEX IF NOT EXISTS` with descriptive names like `idx_{table}_{column}`

```sql
-- Type creation pattern (001_board_emails.sql lines 1-5):
DO $$ BEGIN
 CREATE TYPE "public"."my_enum" AS ENUM('value1', 'value2');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- RLS deny-all pattern (001_board_emails.sql lines 110-118):
ALTER TABLE "my_table" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_my_table_anon" ON "my_table"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_my_table_authenticated" ON "my_table"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
```

### Extension enablement pattern
**Source:** `examples/acme-os-dev/supabase/migrations/20260313000000_initial_schema.sql`
```sql
-- Run before all other migrations:
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "vector";  -- make available in public schema path
```
Phase 4 adds: `pg_trgm`, `unaccent`, `pgmq`, `pg_net`, `pg_cron` per RESEARCH.md §3.

### moddatetime trigger pattern (for `updated_at`)
**Source:** `examples/acme-boards-main/migrations/003_board_deck_structured.sql` (lines 88-91)
```sql
CREATE EXTENSION IF NOT EXISTS moddatetime;
...
CREATE TRIGGER "my_table_updated_at"
  BEFORE UPDATE ON "my_table"
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```
Apply to tables with `updated_at`: `extraction_records`, `knowledge_nodes`.

---

## Test Patterns

### Controller/handler tests
**Source:** `apps/email-listener/tests/test_inbound_sns.py`

```python
"""Tests for POST /v1/endpoint handler."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def test_happy_path_returns_expected_status(client: TestClient) -> None:
    resp = client.post("/v1/endpoint", content=json.dumps(VALID_PAYLOAD), ...)
    assert resp.status_code == 202
```

Always test: happy path, malformed input, missing required fields, error path. SNS endpoints test for 200 on all paths (retry-storm prevention).

### Adapter unit tests (contract + integration gating)
**Source:** `examples/acme-boards-main/tests/test_docling_extractor.py`

```python
import importlib.util
import pytest

_HAS_DOCLING = importlib.util.find_spec("docling") is not None


# Contract tests — run without heavy deps installed:
@pytest.mark.asyncio
async def test_unsupported_type_raises() -> None:
    extractor = MyExtractor.__new__(MyExtractor)
    with pytest.raises(UnsupportedFileTypeError):
        await extractor.parse(file_bytes=b"...", content_type="application/zip", ...)


# Integration tests — gated on dep availability:
@pytest.mark.skipif(not _HAS_DOCLING, reason="dep not installed")
@pytest.mark.asyncio
async def test_real_pdf_produces_components() -> None:
    ...
```

Use `__new__` to construct partial objects for contract tests without triggering heavy `__init__`. Use `unittest.mock.patch.object(loop, "run_in_executor", ...)` for async-executor tests.

### conftest.py
**Source:** `apps/email-listener/tests/conftest.py`
```python
from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import get_settings


@pytest.fixture
def client() -> Iterator[TestClient]:
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
    get_settings.cache_clear()
```

All test fixtures extend this conftest. Clear `lru_cache` on `get_settings` before and after each test.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/email-listener/app/infrastructure/ocr/textract_adapter.py` | service | file-I/O | No OCR adapter exists; use `docling.py` executor pattern + `UnsupportedMimeTypeError` pattern as structural guide; actual Textract SDK call is new |
| `apps/email-listener/app/infrastructure/llm/retrieval_adapter.py` | service | request-response | No vector search / RRF merge exists; RESEARCH.md §4 is the spec; Supabase PostgREST RPC calls are new |
| `apps/email-listener/app/infrastructure/s3/email_storage.py` | service | file-I/O | S3 download path exists conceptually (SNS references S3 key) but no S3 adapter class exists; use `httpx.AsyncClient` pattern from `confirmation.py` as structural guide for async I/O |

---

## Metadata

**Analog search scope:** `apps/email-listener/`, `examples/acme-boards-main/`, `examples/acme-os-dev/supabase/`, `examples/acme-os-dev/packages/db/`
**Files scanned:** 31 source files read
**Pattern extraction date:** 2026-06-11
