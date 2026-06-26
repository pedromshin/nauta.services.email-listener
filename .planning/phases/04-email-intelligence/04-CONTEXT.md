# Phase 4: Email Intelligence - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn passively-logged inbound emails into a **coordinate-addressable, AI-assisted data-entry backend**. For a forwarded email containing a **PDF**, the system: ingests and persists the email + attachments, renders the PDF into a spatially-addressable representation, **auto-proposes candidate entity regions** (which a human can later accept/redraw/split/merge/nest/reject), supports **click-to-autofill** of entity field values from entity-type defaults, and turns **human-confirmed values into retrievable few-shot context** for future autofill (the learning flywheel).

**This phase is BACKEND + DATA MODEL ONLY.** The review UI (inbox, document preview with entity overlays, region selection, control buttons) is a **following phase** that consumes a defined API. Phase 4 delivers the schema, parser, autofill endpoints, retrieval, and the test corpus that proves it works.

**Scope anchor — what's IN:**
- Inbound email persistence (email + attachments + components) to Supabase
- **Robust PDF processing** — the ONLY file format built this phase, but built to full production quality (text-layer extraction, OCR fallback, LLM segmentation). No stubs, no shortcuts, no deferral for PDF.
- Region/entity/extraction data model (normalized geometry + text-anchor + content + embedding)
- Auto-segmentation that **proposes** candidate entity regions
- Click-to-autofill from entity-type defaults (preset description + default KB + field schema)
- Confirmed-region → embedded few-shot child → S4–S6 hybrid retrieval for future prefill
- Versioned/supersedable extraction records (first-class reprocessing)
- Multi-tenant by `importer_id` (forwarding-sender → importer mapping)
- Layered test corpus as a phase deliverable

**Scope anchor — what's OUT (future phases):**
- The review UI / frontend (inbox, preview, overlay rendering, region-draw interactions)
- User auth / login / account management (forwarding-sender mapping only, no auth)
- File formats other than PDF (xlsx, docx, zip, images) — but the parser seam must accept them without rework
- Writing extracted records back into Nauta (the Nauta adapter)
- Knowledge-node *learning loop* / nightly rule synthesis (research 4e) — the confirmed-context retrieval exists, but automated rule synthesis does not
- Confidence-based auto-confirm routing (everything is human-reviewed; no auto-act yet)

</domain>

<decisions>
## Implementation Decisions

### Phase scope & structure
- **D-01 [informational]:** Phase 4 = research sub-phase 4a (decomposition + persistence) **expanded** into a region-selection + AI-autofill backend. It is NOT the full 5-sub-phase system; extraction-to-Nauta, the learning loop, and confidence auto-routing are later phases. _(Scoping decision — realized by the 9-plan structure, not code-trackable.)_
- **D-02 [informational]:** Kept as a single Phase 4 with one coherent goal, decomposed into **many sequential plans** at plan-phase time (suggested order: schema → PDF parser → segmentation → autofill → retrieval → corpus). Do NOT re-split into multiple roadmap phases. _(Structural decision — realized by the 9-plan / 6-wave layout, not code-trackable.)_
- **D-03 [informational]:** ROADMAP.md currently stops at Phase 3 and never defined Phase 4. The planner/roadmap must record this phase's goal formally; STATE.md's "Supabase schema + pipeline ingestion" one-liner is obsolete and understates the phase. _(Meta-instruction — resolved during plan-phase by adding the Phase 4 entry to ROADMAP.md, not code-trackable.)_

### Persistence
- **D-04:** **Supabase** (managed Postgres) is the datastore. Use pgvector (`halfvec(1536)`, HNSW, cosine) and pg_trgm per research §3. Follow acme-os-dev Supabase migration conventions (`examples/acme-os-dev/supabase/migrations/`).
- **D-05:** Multi-tenant from day one: every domain row carries `importer_id`. The inbound email's **forwarding-sender address maps to an importer** record. No user auth this phase.

### PDF processing (the one format, built for real)
- **D-06:** PDF is the **only** format implemented this phase, but to **full production robustness** — head of the file-type distribution. No excuses/shortcuts/stubs/deferral for PDF.
- **D-07:** **Adaptive text extraction:** detect a usable text layer (pdfminer/pypdf); if present use it; if absent/garbage (scanned, photographed, photo-of-screen) fall back to **OCR** (AWS Textract per research §12, or local Tesseract — researcher to recommend). Per-page decision. All three PDF realities from the design case [C1] must work.
- **D-08:** **LLM segmentation is IN scope** (the prior "no-LLM" constraint was explicitly waived). A single PDF/page may contain multiple, overlapping, or **nested** entities (e.g. a screenshot-of-an-invoice + an inline unstructured bill-of-lading + a chaotic container-status table on one page); many pages may be one entity; documents may be junk/irrelevant/corrupt. The system must handle all of this.
- **D-09:** **Auto-segment proposes, human overrides (region-selection is source of truth).** The LLM auto-proposes candidate entity regions; the (future) UI lets a human accept/redraw/split/merge/nest/reject. The data model must support arbitrary human-registered regions, not just auto-proposed ones, and must support **nested entities** (entity within entity).

### Parser extensibility seam
- **D-10:** **Parser registry + Protocol interface.** A `ParserProtocol` (`parse(attachment) -> list[Component/Region]`) with a registry keyed by file_ext/MIME. PDF is the first full implementation; xlsx/zip/docx/image register later **behind the same interface without touching existing parsers**. Respects Clean Architecture ports and the user's Protocol-based style.

### Region / child data model (S4–S6 small-to-big)
- **D-11:** **Child = a registered region; Parent = the page/attachment/email context.** Per S4–S6: search/embedding happens on the small child (region); synthesis/autofill assembles the larger parent context. Child references parent via attachment → email.
- **D-12:** **Region geometry = industry-standard document-AI model** (Google Document AI / AWS Textract / Azure DI / Rossum aligned): `page_index` + **normalized polygon** (axis-aligned bbox as the common case, 0–1 coordinates, resolution/zoom/rotation-independent) + **optional text-anchor char-span when a text layer exists** + per-region **extracted content** (`content_text` / image ref) + **halfvec embedding**. Normalized geometry is mandatory because overlays must render over screenshot/photo regions that have no text layer; it generalizes to future formats.

### Autofill
- **D-13:** **Cold-start autofill = entity-type defaults.** When a region is registered and autofill clicked with zero prior confirmed examples ("the first email matches against nothing"), the LLM prompt uses: region content + the entity type's **preset description** + its **default knowledge base** text + **field schema** (label/type/identifier/required flags) from the seed catalog (research §3.5, §10). No retrieval at cold start.
- **D-14:** **Content stays in the user turn** inside explicit delimiters — never in the system prompt — as the structural prompt-injection defense (research §6, [S14/S15]). Input is untrusted (design case problem #6).

### Confirmed context & retrieval (the flywheel)
- **D-15:** **Confirmed region = embedded few-shot child.** On human confirmation that autofilled values are correct, the region + confirmed field values are embedded (halfvec, HNSW) and indexed. Future autofill for a same-type region runs **S4–S6 hybrid retrieval** (vector + identifier/trigram match, RRF merge per research §4) over confirmed regions, injecting top-N as **few-shot examples** into the prompt-cache extension (research §4.3).

### Reprocessing
- **D-16:** **Versioned + supersede (immutable runs).** Each reprocess creates a new extraction generation; prior ones marked `superseded` (research §3.7 enum). Reprocessing an **old** email after newer corrections must improve it retroactively, must be **auditable** (show accuracy improving over time), and must **never silently overwrite a human-confirmed value**.

### Test corpus (phase deliverable)
- **D-17:** **Layered corpus** is a Phase 4 deliverable + a fixtures/forwarding harness: (a) real scan noise — RVL-CDIP invoice subset + DocLayNet pages; (b) logistics vocabulary — LogisticQA + 1–2 format templates per type (BL, commercial invoice, packing list, booking); (c) **hand-assembled hard cases** with controlled ground truth — multi-invoice-in-one-PDF, nested entities on one page, junk/corrupt PDF, photo-of-screen. The pipeline must be tested against authentic messiness before the phase is "done." (xlsx/.xlsm/zip cases belong to the corpus conceptually but only PDF is parsed this phase.)

### Claude's Discretion
- Exact OCR engine (Textract vs Tesseract) — researcher recommends against cost/accuracy.
- Embedding model + hosting (research §12 open question 2): worker-side vs HuggingFace API vs Supabase pgmq Edge Function.
- Polygon-vs-rectangle precision tradeoff specifics, exact pgvector/halfvec column types.
- Worker topology (inline vs separate ECS worker vs pgmq) — placement of the heavy PDF/OCR/LLM work; the user selected "extend email-listener service with new layers" for code placement, but whether decomposition runs in a separate worker process is a planning decision.
- LangGraph-vs-plain-orchestration for the segmentation→autofill flow.

</decisions>

<specifics>
## Specific Ideas

- **The chaotic single page** (user's words): "inside a single pdf page there can be one screenshot of an invoice, an inline (pdf itself content, not screenshot) bill of lading unstructured format, and a technically structured but still chaotic and indeterministic table of containers and their statuses... maybe there are entities inside entities, maybe many pages are only one entity, maybe documents are junk, irrelevant or corrupted." This is the robustness bar for PDF.
- **The autofill loop** (user's words): "I should be able to select any area, content, text, image, coordinates of the document and register it as an entity. Then inside that entity user will be able to click to autofill field values for that entity based of the system entity default configurations (they will have a preset description, a default knowledge base to complement just entity value name). If values inside entity are correct, it marks them as able to fetch in future entity prefill request as context."
- **The inbox UX** (constrains the API shape, built next phase): emails the user forwarded from their account email appear in an inbox-like list → click → detail page with email body + attachments + **summary of detected entities and values** + **process/reprocess control buttons** → attachment preview with **entity overlay drawn over the corresponding part of the document** (PDF now, generalizes later).
- **Reprocessing intent:** "user can reprocess an old one after processing new ones and correcting — manually created better dataset — and increase accuracy for earlier ones."
- "No excuses, shortcuts, stubs, deference, testing [stubs]. First filetype processing must be for real."

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase architecture & schema (read first)
- `.planning/phases/04-email-intelligence/04-RESEARCH.md` — Full architecture: Supabase schema (§3), retrieval (§4), confidence (§5), security boundary (§6), review/learning loop (§7), UI data shape (§8), what already exists in acme-os (§9), seed migration (§10), sub-phase boundaries (§11), open questions (§12). **The primary spec for this phase.**
- `context/8 - architecture-intuition.md` — The reasoning behind the design; "The Minimum Working Version" and the three core patterns (parent-child chunking, hybrid retrieval, learning from corrections). Read before the schema.

### Problem definition (the bar to clear)
- `context/0 - nauta_design_case.pdf` — The 7 hard problems. Problem #1 (ingest anything: PDF clean/scanned/photo-of-screen, multi-doc-in-one-PDF), #3 (entity named ten ways), #6 (untrusted input). Defines what "robust" means.

### Retrieval pattern (explicitly requested implementation)
- S4 — Modular RAG, arXiv 2407.21059 (`https://arxiv.org/pdf/2407.21059`) §3–4 — parent-child / small-to-big chunking, canonical.
- S5 — Advanced RAG 01: Small-to-Big Retrieval (`https://medium.com/data-science/advanced-rag-01-small-to-big-retrieval-172181b396d4`) — child references parent via metadata `index_id`; retrieve on small, synthesize on large.
- S6 — RAGFlow, From RAG to Context (`https://ragflow.io/blog/rag-review-2025-from-rag-to-context`) — decouple "Search" (small pure units) from "Retrieve" (aggregated context). **Child = region, Parent = page/attachment/email.**

### Hybrid retrieval & geometry (for the planner/researcher)
- S1 BlendedRAG (`https://arxiv.org/html/2404.07220v1`), S7/S8/S9 RRF (k=60) — research §4 cites these for the confirmed-context retrieval.
- Document-AI geometry standard: AWS Textract `BoundingBox` (normalized), Google Document AI `boundingPoly.normalizedVertices` + `textAnchor.textSegments`. The region model (D-12) mirrors these. Production overlay-rendering refs: react-pdf-highlighter, EmbedPDF Layout Analysis plugin, React PDF Kit.

### Existing-code conventions
- `examples/acme-os-dev/supabase/migrations/` + `examples/acme-os-dev/packages/db/` — Supabase migration + Drizzle conventions to mirror.
- `apps/email-listener/app/infrastructure/sns/ses_parser.py` — the current SES→SNS ingestion entry point Phase 4 extends (today extracts only message_id/sender/recipients/subject; raw email already lands in S3).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`apps/email-listener` Clean Architecture skeleton** (domain/application/infrastructure/presentation, import-linter enforced) — Phase 4 adds new layers here (D-09 placement). New domain entities (Email, Attachment, Component/Region, EntityType, ExtractionRecord), use-cases (decompose, propose-regions, autofill, confirm), infra (PDF parser registry, Supabase repos, OCR, embedding/retrieval).
- **SES→S3 raw email path** already live (raw inbound email stored in S3 due to the 150KB SNS limit fix). Phase 4 reads the raw email from S3 rather than from the SNS payload.
- **`ses_parser.py`** — extend from metadata-only to full email + attachment extraction.
- **`packages/db`** — currently an empty placeholder (README only). Becomes the Supabase schema/migrations home, mirroring `examples/acme-os-dev/packages/db`.

### Established Patterns
- Protocol-based interfaces + dependency injection via `app/container.py` — the parser registry (D-10) and repositories follow this.
- Quality gates locked: `uv`, `ruff` (120 cols), `mypy`, `import-linter`, `bandit`, `pytest ≥80%`. New parser/retrieval code must pass all.
- Immutable-only, named-exports, type-everything, Pydantic validation at boundaries (user CLAUDE.md).

### Integration Points
- SNS handler (`presentation/api/v1/sns_inbound.py`) → reads raw email from S3 → new decomposition use-case → Supabase persistence.
- Supabase is a NEW external dependency (no DB exists today) — connection/secrets via AWS Secrets Manager, surfaced at startup (fails closed).
- Claude (segmentation + autofill LLM calls) is a NEW dependency, reached via **AWS Bedrock** using the ECS task IAM role's `bedrock:InvokeModel` permission — NOT the Anthropic direct API. Decision (2026-06-11): the stack is all-AWS, so Bedrock avoids a new long-lived secret and keeps document content inside the AWS account boundary. Embeddings (04-08) likewise use Bedrock (Amazon Titan, 1536-dim). Model selection per `claude-api` reference; default to latest capable Claude available on Bedrock. The earlier `ANTHROPIC_API_KEY`-via-Secrets-Manager wiring was an unreviewed planner default, now superseded.

</code_context>

<deferred>
## Deferred Ideas

- **Review UI / frontend** (inbox, document preview, entity overlay rendering, region-draw interactions) — next phase; will need `/gsd:ui-phase`. Phase 4 must expose an API shaped for it (research §8 `EmailView`/`EmailComponentView`).
- **User auth / accounts** — next phase; Phase 4 uses forwarding-sender → importer mapping only.
- **Other file formats** (xlsx/.xlsm per-sheet, docx per-heading, zip recursion depth≤3, image OCR) — register behind the parser Protocol (D-10) in later phases. Corpus includes them conceptually; only PDF is parsed now.
- **Nauta write-back adapter** (idempotent PATCH/create into Nauta) — later phase.
- **Knowledge-node learning loop** — nightly correction→rule synthesis with human approval (research §7, 4e). Confirmed-context retrieval exists this phase; automated rule synthesis does not.
- **Confidence-based auto-confirm routing** (research §5) — everything is human-reviewed this phase; no auto-act until a track record exists.
- **Scanned-PDF/image OCR as a shared service** — OCR is in scope *for PDF*; a generalized OCR service for images-as-attachments is later.

</deferred>

---

*Phase: 04-email-intelligence*
*Context gathered: 2026-06-11*
