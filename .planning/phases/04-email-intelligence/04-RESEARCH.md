# Phase 4: Email Intelligence — Architecture Research

**Researched:** 2026-06-11  
**Domain:** Email decomposition, document extraction, entity matching, HITL feedback loop  
**Confidence:** HIGH (all patterns are production-proven; specific tool choices carry MEDIUM risk)

---

## Source Index

All claims in this document are traceable to one of the following sources.

| #   | Source file                                            | What it covers                                                                    |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| C1  | `context/0 - nauta_design_case.pdf`                    | Problem statement: importer inbox → structured Nauta records; the 7 hard problems |
| C2  | `context/1 - os-dev.md`                                | acme-os phase-by-phase mapping; what exists vs. what to build                   |
| C3  | `context/2 - emails-main.md`                           | acme-boards reference implementation (Phase 1–3); two-pass LLM extraction       |
| C4  | `context/3 - web-claude-part-1.md`                     | Podcast landscape: Decagon/Jesse Zhang episodes on per-importer rules, HITL       |
| C5  | `context/4 - web-claude-part-2.md`                     | Production RAG capstone (aiengineeringfromscratch); 5-phase end-to-end breakdown  |
| C6  | `context/5 - walkthrough.md`                           | Original 3-step project walkthrough; AWS ECS deployment target                    |
| C7  | `context/6 - email-processing-pipeline-part-1.md`      | Full sourced data architecture: schema, retrieval, security, learning loop        |
| S1  | [BlendedRAG — IBM Research, 2024](https://arxiv.org/html/2404.07220v1) | Hybrid retrieval: BM25 + dense + sparse outperforms any single method |
| S2  | [RAGFlow 2024 Year-in-Review](https://ragflow.io/blog/the-rise-and-evolution-of-rag-in-2024-a-year-in-review) | Confirms three-way hybrid is optimal |
| S3  | [Hybrid Dense-Sparse Retrieval — ResearchGate 2026](https://www.researchgate.net/publication/399428523_Hybrid_Dense-Sparse_Retrieval_for_High-Recall_Information_Retrieval) | 580% recall improvement from hybrid over dense-only |
| S4  | [Modular RAG — arXiv 2407.21059](https://arxiv.org/pdf/2407.21059) | Small-to-Big / parent-child chunking pattern |
| S5  | [Advanced RAG 01: Small-to-Big Retrieval — Medium/TDS](https://medium.com/data-science/advanced-rag-01-small-to-big-retrieval-172181b396d4) | Small chunks for retrieval precision, parent chunks for LLM context |
| S6  | [RAGFlow: From RAG to Context, Dec 2025](https://ragflow.io/blog/rag-review-2025-from-rag-to-context) | Decouple "Search" (small units) from "Retrieve" (aggregated context) |
| S7  | [RRF — Elasticsearch docs](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion) | Canonical RRF formula; k=60 default |
| S8  | [RRF — Microsoft Azure AI Search](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking) | RRF as production standard; k=60 validated by experiments |
| S9  | [Hybrid retrieval with RRF — Serghei's Blog](https://blog.serghei.pl/posts/reciprocal-rank-fusion-explained/) | All major search engines use RRF in production |
| S10 | [Semantic Entity Resolution — Towards Data Science](https://towardsdatascience.com/the-rise-of-semantic-entity-resolution/) | Blocking → matching → merging with LLMs; replaces string-distance ETL |
| S11 | [Active Learning for Entity Resolution — CIKM 2017](https://www.researchgate.net/publication/320885784_Active_Learning_for_Large-Scale_Entity_Resolution) | Human corrections → labeled pairs → model update (learning loop) |
| S12 | [Supabase Automatic Embeddings Guide](https://supabase.com/docs/guides/ai/automatic-embeddings) | pgmq + pg_net + pg_cron trigger pattern for async embedding generation |
| S13 | [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector) | halfvec(1536), HNSW index, cosine distance operator `<=>` |
| S14 | [OWASP LLM Prompt Injection Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) | System/user separation; structured output gating as defense |
| S15 | [Prompt injection — vectra.ai](https://www.vectra.ai/topics/prompt-injection) | Architectural separation (metadata-only evaluator); action gating |
| S16 | [BM25 vs financial documents — arXiv 2604.01733](https://arxiv.org/html/2604.01733v1) | BM25 outperforms dense retrieval on financial/logistics docs with precise IDs |

---

## 1. Core Mental Model

The system you described independently matches three established, production-proven patterns. **[C7]**

### 1.1 Pattern Mapping

| What you described                                                            | Established name                                     | Source  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| "Break each email into components"                                            | **Parent-child hierarchical chunking**               | S4–S6   |
| "Each component searches similar prior components, knowledge nodes, entities" | **Hybrid semantic + lexical retrieval (BlendedRAG)** | S1–S3   |
| "Strongly related entities prefilled → confirmed → used as future reference"  | **Semantic entity resolution with active learning**  | S10, S11|

The design case **[C1]** names seven hard problems. Each maps to a pattern:

| Hard problem from design case **[C1]**         | Pattern                               | Phase |
| ----------------------------------------------- | ------------------------------------- | ----- |
| Ingest anything (PDF, xlsx, xlsm, zip, images)  | Unstructured/ColPali + zip recursion  | 4a    |
| Per-importer rules                              | Prompt cache header per importer      | 4b    |
| Entity named ten ways                           | Hybrid retrieval + reranker           | 4c    |
| Being wrong is expensive                        | Composite confidence gate             | 4b–4c |
| Rules aren't given to you                       | Correction → knowledge node loop      | 4e    |
| Untrusted input                                 | User-turn isolation + structured gate | 4b    |
| Scale + reliability                             | Queue-first + idempotency key         | 4a    |

### 1.2 Why Hybrid Retrieval Is Non-Negotiable for Logistics

Pure vector search is insufficient. Container numbers like `MSCU1234567`, PO numbers like `PO-4422`, and BL numbers are exact identifiers — the semantic distance between `MSCU1234567` and `MSCU1234568` is negligible to an embedding model but the difference is enormous in reality. **[S3]** demonstrated up to 580% improvement in recall from hybrid over dense-only retrieval. **[S16]** showed that for financial and logistics documents with precise numeric identifiers, BM25 _outperforms_ state-of-the-art dense retrieval outright. **[S1]** confirmed that the three-way combination — BM25 full-text + dense vector + sparse encoder — achieves the highest recall of any tested configuration. **[C5]** uses the same conclusion in the production RAG capstone: pgvector for dense, Tantivy/BM25 for sparse, bge-reranker for final ranking.

### 1.3 Why Parent-Child Chunking Fits Here

**[S4]** names the pattern explicitly: "Small-to-Big separates the chunks used for retrieval from those used for synthesis. Smaller chunks enhance retrieval accuracy, while larger chunks provide more context." **[S6]** frames it as decoupling the "Search" stage (small, semantically pure units) from the "Retrieve" stage (aggregated, coherent context passed to the LLM). In the Nauta context: `email_components` rows are the small units for retrieval; the parent `emails` + `email_attachments` records are the larger context available to the extraction LLM.

acme-boards **[C3]** implements this pattern in production: `board_email_attachments` → `board_deck_chunks` with HNSW-indexed embeddings. The difference from Nauta is that acme-boards handles one document type (board decks); Nauta handles 8+ logistics document types, requiring classification before extraction.

### 1.4 Why Entity Resolution Needs Active Learning

The "Acme" vs "Acme Inc." problem is the classical entity resolution challenge. **[S10]** describes the modern approach: representation learning (embeddings) replaces string-distance ETL. The blocking → matching → merging pipeline with confidence scoring and provenance is exactly the `extraction_records` lifecycle. What makes Nauta's version tractable is the **learning loop**: **[S11]** (Qian et al., CIKM 2017) showed that human-labeled corrections fed back into the model significantly reduce the labeling burden — each correction reduces the need for future corrections of the same type.

The Decagon episodes **[C4]** describe the identical loop in customer support: "We measure accuracy from customer corrections rather than upfront labeling." The reviewer queue output is the labeled dataset.

---

## 2. Architecture Overview

Derived from the 5-phase end-to-end breakdown in **[C5]** and the acme-os phase mapping in **[C2]**:

```
Email arrives in importer inbox (AWS SES or Gmail forwarding — see walkthrough [C6])
         ↓
[4a] Decomposition Worker (ECS — matches acme-os deployment [C2, C6])
     └─ ZIP recursion → Unstructured/ColPali → parent-child chunks
     └─ INSERT emails, email_attachments, email_components
         ↓
[4b] Classification + Extraction Agent (LangGraph [C2, C5])
     └─ Llama Guard 4 on raw email content [C5, S14]
     └─ Hybrid retrieval: knowledge nodes + similar confirmed components [S1–S3, S7–S9]
     └─ Claude (prompt cached per importer) → doc type + structured fields [C5]
     └─ NeMo Guardrails sender policy [C5]
     └─ Composite confidence gate → auto-confirm or review_pending [C5]
         ↓
[4c] Entity Resolution (pgvector + pg_trgm [S10, S13])
     └─ Dense cosine similarity + trigram fuzzy match on identifiers
     └─ RRF merge → top-N candidates with scores [S7–S9]
         ↓
[4d] Review UI + Confirmation
     └─ Reviewer sees email, components (hover-highlight by location), candidates
     └─ Confirm → write to Nauta (idempotent PATCH) [C5]
     └─ Correct → trigger knowledge node synthesis [S11]
         ↓
[4e] Knowledge Node Learning (nightly batch [C5])
     └─ Correction triples → proposed rules → human approval
     └─ Approved rules → UPDATE knowledge_nodes → retrieval improves
```

The acme-os repo **[C2]** has the LangGraph graph, HITL interrupt(), pgvector search, and Procrastinate async worker already built. The gaps for Nauta are: inbound email pipeline, Nauta adapter, chunk-level citation model, and hybrid BM25 retrieval.

---

## 3. Supabase Schema

Enable extensions:

```sql
create extension if not exists "uuid-ossp";
create extension if not exists "vector";    -- pgvector [S13]
create extension if not exists "pg_trgm";   -- trigram fuzzy match for identifiers [S10]
create extension if not exists "unaccent";  -- normalise accented supplier names
create extension if not exists "pgmq";      -- async job queue [S12]
create extension if not exists "pg_net";    -- async HTTP from triggers [S12]
create extension if not exists "pg_cron";   -- scheduled queue processing [S12]
```

### 3.1 Tenant / Importer

```sql
create table importers (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  config     jsonb not null default '{}',  -- importer-level rule hints
  created_at timestamptz not null default now()
);
```

### 3.2 Raw Email Storage

Append-only. Nothing here is ever mutated after insert. **[C7]**

```sql
create table emails (
  id             uuid primary key default gen_random_uuid(),
  importer_id    uuid not null references importers(id) on delete cascade,

  -- Envelope
  message_id     text not null,              -- RFC 5322 Message-ID; idempotency key [C5]
  in_reply_to    text,
  references_ids text[],
  received_at    timestamptz not null,
  sender_address text not null,
  sender_name    text,
  to_addresses   text[] not null,
  cc_addresses   text[],
  subject        text,

  -- Body
  body_html      text,
  body_text      text,
  body_text_tsv  tsvector generated always as
                   (to_tsvector('english', coalesce(body_text,''))) stored,

  -- Raw bytes in Supabase Storage / S3
  raw_storage_key text,

  -- Pipeline state
  parse_status   text not null default 'pending'
                 check (parse_status in ('pending','processing','done','error')),
  parse_error    text,
  parsed_at      timestamptz,

  created_at     timestamptz not null default now(),
  unique (importer_id, message_id)
);

create index on emails (importer_id, received_at desc);
create index on emails using gin (body_text_tsv);
```

### 3.3 Attachments

```sql
create table email_attachments (
  id                   uuid primary key default gen_random_uuid(),
  email_id             uuid not null references emails(id) on delete cascade,
  importer_id          uuid not null references importers(id) on delete cascade,

  filename             text,
  content_type         text not null,           -- MIME type
  file_ext             text,                    -- .pdf, .xlsx, .docx, .xlsm, .zip, etc.
  size_bytes           bigint,
  storage_key          text not null,           -- Supabase Storage path

  -- ZIP attachments: unpack and create child rows
  parent_attachment_id uuid references email_attachments(id),

  parse_status         text not null default 'pending'
                       check (parse_status in ('pending','processing','done','error','unsupported')),
  parse_error          text,
  created_at           timestamptz not null default now()
);

create index on email_attachments (email_id);
create index on email_attachments (importer_id, created_at desc);
```

**File type → parser dispatch** **[C5, C7]**:

| Extension                | Parser                     | Component granularity                                              |
| ------------------------ | -------------------------- | ------------------------------------------------------------------ |
| `.pdf` (text layer)      | pdfminer / pypdf           | One component per logical document section (LLM segmentation pass) |
| `.pdf` (scanned)         | AWS Textract / pytesseract | One component per page, then optional merge                        |
| `.xlsx`, `.xlsm`, `.xls` | openpyxl / xlrd            | One component per sheet (or row-range blocks for >200-row manifests)|
| `.docx`                  | python-docx → markdown     | One component per top-level heading section                        |
| `.pptx`                  | python-pptx                | One component per slide                                            |
| `.csv`, `.tsv`           | pandas                     | One component per file (chunked by row blocks for large files)     |
| `.txt`                   | chardet + utf-8            | One component per file                                             |
| `.zip`                   | unpack → recurse (depth≤3) | Child attachments created; each parsed by its own type             |
| `.jpg`, `.png`, `.tiff`  | Textract / Tesseract OCR   | One component per image                                            |

### 3.4 Email Components

The most important table. The "child chunk" in the small-to-big pattern **[S4, S5]** — the unit used for retrieval precision. **[C7]**

```sql
create type component_source_type as enum (
  'email_body',
  'attachment_page',     -- page or page-range within PDF/image
  'attachment_sheet',    -- single sheet in xlsx/xlsm
  'attachment_section',  -- heading section in docx/pptx
  'attachment_whole'     -- whole small file (txt, csv, etc.)
);

create table email_components (
  id               uuid primary key default gen_random_uuid(),
  email_id         uuid not null references emails(id) on delete cascade,
  importer_id      uuid not null references importers(id) on delete cascade,
  attachment_id    uuid references email_attachments(id) on delete cascade,

  source_type      component_source_type not null,

  -- Location within source (for UI hover-highlight [C1])
  -- PDF:  {"page_start": 1, "page_end": 2}
  -- xlsx: {"sheet": "Sheet1", "row_start": 1, "row_end": 47}
  -- docx: {"paragraph_start": 0, "paragraph_end": 12}
  -- body: {"char_start": 0, "char_end": 842}
  location         jsonb not null default '{}',

  -- Extracted content
  content_text     text not null,
  content_markdown text,
  content_raw      jsonb,                -- tables as structured JSON

  -- Full-text search (BM25 side of hybrid retrieval) [S1, S7, S16]
  content_tsv      tsvector generated always as
                     (to_tsvector('english', content_text)) stored,

  -- Semantic search (vector side of hybrid retrieval) [S13]
  -- halfvec saves ~50% space vs vector(1536); same accuracy [S13]
  embedding        halfvec(1536),

  sequence_index   int not null default 0,

  extraction_status text not null default 'pending'
                    check (extraction_status in
                      ('pending','retrieving','extracting','review','confirmed','ignored','error')),

  created_at       timestamptz not null default now()
);

create index on email_components (email_id);
create index on email_components (attachment_id);
create index on email_components (importer_id, created_at desc);
create index on email_components (importer_id, extraction_status);
create index on email_components using gin (content_tsv);

-- HNSW index — add after initial data load, not at schema creation [S13]
-- create index on email_components
--   using hnsw (embedding halfvec_cosine_ops) with (m = 16, ef_construction = 64);
```

**Embedding generation** follows the Supabase Automatic Embeddings pattern **[S12]**: an `AFTER INSERT` trigger enqueues a job into `pgmq`; `pg_cron` polls the queue every 10 seconds; a Supabase Edge Function calls the embedding API and writes back. Same pattern for `knowledge_nodes`, `entity_types`, and `entity_instances` — all use the same model so cosine distances are comparable across tables **[S13]**.

### 3.5 Entity Types and Fields

The preset logistics nouns. Seeded with system defaults; importers can extend. **[C1, C7]**

```sql
create table entity_types (
  id          uuid primary key default gen_random_uuid(),
  importer_id uuid references importers(id) on delete cascade,
              -- null = system default; non-null = importer override
  slug        text not null,
  label       text not null,
  description text,              -- fed to the LLM as type context
  is_active   bool not null default true,
  embedding   halfvec(1536),     -- embed (label + description) for type classification
  created_at  timestamptz not null default now(),
  unique (importer_id, slug)
);

create table entity_type_fields (
  id             uuid primary key default gen_random_uuid(),
  entity_type_id uuid not null references entity_types(id) on delete cascade,
  slug           text not null,
  label          text not null,
  data_type      text not null default 'string'
                 check (data_type in ('string','number','date','boolean','array','object')),
  is_identifier  bool not null default false,  -- true = used for entity resolution (PO#, BL#)
  is_required    bool not null default false,
  description    text,                         -- per-field extraction guidance for the LLM
  sort_order     int not null default 0,
  unique (entity_type_id, slug)
);
```

### 3.6 Knowledge Nodes

A knowledge node is a named chunk of context attached to entity types, specific entity instances, or senders. Encodes importer-specific rules — either written manually or synthesised automatically from reviewer corrections. **[C5, C7, S11]**

```sql
create type knowledge_node_scope as enum (
  'entity_type',      -- applies when this entity type is involved
  'entity_instance',  -- applies when a specific Nauta record is involved
  'sender',           -- applies when email is from this address
  'importer_global'   -- importer-wide rule
);

create table knowledge_nodes (
  id             uuid primary key default gen_random_uuid(),
  importer_id    uuid not null references importers(id) on delete cascade,

  title          text not null,
  content        text not null,
  -- Examples:
  -- "Emails from freight@quickline.com are status noise — never create records."
  -- "Supplier 'Fabrica Textil Omega' writes PO number in filename, not document body."
  -- "Document titled 'Purchase Order' from this supplier is actually a Proforma Invoice."

  scope          knowledge_node_scope not null,
  scope_ref_id   uuid,
  scope_ref_type text,

  source         text not null default 'manual'
                 check (source in ('manual','learned_from_correction','learned_from_confirmation')),
  confidence     float not null default 1.0 check (confidence between 0 and 1),

  embedding      halfvec(1536),

  is_active      bool not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on knowledge_nodes (importer_id, scope);
create index on knowledge_nodes (importer_id, is_active);
```

### 3.7 Extraction Records

When the pipeline matches a component to an entity type, it creates an `extraction_record`. This holds the candidate field values, confidence score, routing decision, and — once confirmed — the pointer to the written Nauta entity. **[C5, C7]**

```sql
create type extraction_status_enum as enum (
  'candidate',      -- auto-generated, not yet reviewed
  'auto_confirmed', -- confidence above threshold, auto-written to Nauta
  'review_pending', -- below threshold, in human review queue
  'confirmed',      -- human confirmed (or corrected + confirmed)
  'rejected',       -- human rejected
  'superseded'      -- replaced by a newer extraction of the same component
);

create table extraction_records (
  id                   uuid primary key default gen_random_uuid(),
  importer_id          uuid not null references importers(id) on delete cascade,
  component_id         uuid not null references email_components(id) on delete cascade,
  entity_type_id       uuid not null references entity_types(id),

  extracted_fields     jsonb not null default '{}',   -- {field_slug: value}
  confidence_score     float not null check (confidence_score between 0 and 1),
  confidence_breakdown jsonb,                         -- per-field scores, retrieval scores
  routing_reason       text,                          -- why review vs auto-confirm

  status               extraction_status_enum not null default 'candidate',
  reviewed_by          uuid,
  reviewed_at          timestamptz,
  review_notes         text,

  -- Correction tracking (what the human changed)
  corrected_fields     jsonb,
  correction_notes     text,

  -- Nauta write result
  nauta_entity_id      text,
  nauta_entity_type    text,
  nauta_write_status   text default 'pending'
                       check (nauta_write_status in ('pending','written','failed','skipped')),
  nauta_write_error    text,
  nauta_written_at     timestamptz,

  -- Retrieval audit trail
  retrieval_context    jsonb,  -- {knowledge_node_ids: [], similar_component_ids: []}

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index on extraction_records (importer_id, status);
create index on extraction_records (component_id);
create index on extraction_records (entity_type_id);
create index on extraction_records (nauta_entity_id) where nauta_entity_id is not null;
```

### 3.8 Entity Instances (Nauta Entity Mirror)

A lightweight sync of Nauta's entities into Supabase — not a second source of truth, just enough to power entity resolution and serve as a retrieval target. **[C2, C5, C7, S10]**

```sql
create table entity_instances (
  id             uuid primary key default gen_random_uuid(),
  importer_id    uuid not null references importers(id) on delete cascade,
  entity_type_id uuid not null references entity_types(id),

  nauta_id       text not null,
  display_name   text not null,
  identifiers    jsonb not null default '{}',  -- {po_number: "PO-1234", invoice_number: "INV-99"}
  aliases        text[],                       -- known alternate spellings / typos / OCR variants
  summary_text   text,

  embedding      halfvec(1536),  -- embed (display_name + summary_text + key identifiers)

  last_synced_at timestamptz,
  is_active      bool not null default true,
  unique (importer_id, entity_type_id, nauta_id)
);

create index on entity_instances (importer_id, entity_type_id);
```

### 3.9 Retrieval Trace Tables

Record what retrieval found for each component — full audit trail for every extraction decision. **[C7]**

```sql
create table component_knowledge_node_links (
  id                uuid primary key default gen_random_uuid(),
  component_id      uuid not null references email_components(id) on delete cascade,
  knowledge_node_id uuid not null references knowledge_nodes(id) on delete cascade,
  similarity_score  float not null,
  retrieval_method  text,        -- 'vector', 'bm25', 'hybrid_rrf'
  used_in_extraction bool not null default false,
  created_at        timestamptz not null default now(),
  unique (component_id, knowledge_node_id)
);

create table component_entity_candidate_links (
  id                 uuid primary key default gen_random_uuid(),
  component_id       uuid not null references email_components(id) on delete cascade,
  entity_instance_id uuid not null references entity_instances(id) on delete cascade,
  entity_type_id     uuid not null references entity_types(id),
  similarity_score   float not null,
  match_type         text,       -- 'semantic', 'identifier_exact', 'identifier_fuzzy', 'alias'
  was_selected       bool not null default false,
  created_at         timestamptz not null default now(),
  unique (component_id, entity_instance_id)
);
```

### 3.10 Sender Profiles

```sql
create table sender_profiles (
  id                        uuid primary key default gen_random_uuid(),
  importer_id               uuid not null references importers(id) on delete cascade,
  email_address             text not null,
  display_name              text,
  category                  text,  -- 'supplier','freight_forwarder','customs_broker','maritime_line','internal'
  is_noise                  bool not null default false,  -- never create records
  notes                     text,
  linked_entity_instance_id uuid references entity_instances(id),
  created_at                timestamptz not null default now(),
  unique (importer_id, email_address)
);
```

---

## 4. Retrieval Architecture

### 4.1 Four-Way Hybrid Search (BlendedRAG / RRF)

For each component in `extraction_status = 'pending'`, run four searches **in parallel** — based on the BlendedRAG finding **[S1, S2]** that three-way hybrid retrieval outperforms any two-way combination:

```
1. Vector (semantic) search — cosine via pgvector [S13]
   email_components WHERE importer_id = ? AND extraction_status IN ('confirmed','auto_confirmed')
   ORDER BY embedding <=> $component_embedding LIMIT 20

2. Full-text (BM25-equivalent) search [S16]
   same table, content_tsv @@ plainto_tsquery($key_terms)
   key_terms = PO/BL/container codes from a fast regex pre-pass

3. Entity instance resolution — vector + fuzzy identifier [S10]
   entity_instances ORDER BY embedding <=> $component_embedding LIMIT 10
   + pg_trgm trigram match on identifiers::text for exact numeric codes

4. Knowledge node retrieval
   knowledge_nodes WHERE importer_id = ? AND is_active
   ORDER BY embedding <=> $component_embedding LIMIT 10
   + sender filter: scope='sender' AND scope_ref_id = $sender_profile_id
```

Results merged with **Reciprocal Rank Fusion (k=60)** **[S7, S8, S9]**:

```python
# RRF formula — Elasticsearch, Azure AI Search, OpenSearch all use this [S7, S8, S9]
def rrf_score(rank: int, k: int = 60) -> float:
    return 1.0 / (k + rank)

# Merge result lists from all four searches.
# Documents appearing in multiple lists get summed scores.
# k=60 is the production-validated constant [S8].
```

RRF is preferred over weighted score combination because BM25 scores and cosine similarity scores exist in incompatible spaces — naive normalization degrades results **[S9]**.

### 4.2 Entity Type Classification

Before field extraction, classify which entity type(s) the component contains **[C3, C5, C7]**:

```
Input:  component.content_text
        + top-3 knowledge nodes (from RRF step)
        + sender_profile.category

System prompt:  "You are classifying logistics documents.
                 Given the following document text, identify which entity type(s)
                 it represents. Choose from: [entity_type slug + description list].
                 Return JSON: [{entity_type_slug, confidence, reasoning}]"

User turn:  "<document_content>{{component.content_text}}</document_content>"
```

Email content is always in the `user` turn, inside explicit delimiters — never in the system prompt. This is the structural defense against prompt injection **[S14, S15]**.

acme-boards **[C3]** implements an equivalent two-pass shape: Pass 1 classifies doc type on the first 3k characters; Pass 2 routes to the correct extraction prompt based on classification. Nauta's version adds retrieved context (knowledge nodes + entity candidates) to both passes.

If confidence < 0.6 → route to `review_pending` immediately. Do not attempt field extraction on an ambiguously-typed component.

### 4.3 Field Extraction (Prompt Caching)

The prompt caching structure from **[C5]** is the cost and latency lever — same architecture applies to Nauta:

```
[CACHE HEADER — stable across all emails for this importer]
  system prompt
  entity_type.description + entity_type_fields
  top-5 knowledge nodes (importer rules)
  entity catalog summary (known suppliers, forwarders, aliases)

[CACHE EXTENSION — changes per retrieval result set]
  top-3 confirmed prior components of same entity type (few-shot examples)
  top-N entity instance candidates

[UNCACHED SUFFIX — changes every request]
  "<document_content>{{component.content_text}}</document_content>"
```

At 60-80% cache hit rate (achievable because importer rules are static across thousands of emails **[C5]**), per-email cost drops 3-5x. The few-shot prior components are the active learning signal — the LLM sees previous confirmed extractions from the same importer and adapts to their quirks without explicit rule programming **[S11]**.

---

## 5. Confidence Scoring & Routing

Auto-confirm when **all** of **[C5, C7]**:

- Entity type classification confidence ≥ 0.80
- All `is_required` fields extracted with confidence ≥ 0.75
- At least one `is_identifier` field has either: a resolved `entity_instance` match, OR is a new identifier with confidence ≥ 0.85 (unambiguous new entity)
- No active `knowledge_node` with `scope='sender'` has `is_noise=true` for this sender

Otherwise → `review_pending`. The `routing_reason` column records exactly which condition failed, so the review UI can surface it immediately.

The composite confidence gate from **[C5]**:
```
entity_resolution_score   # top reranker score for linked records
field_completeness        # fraction of required fields present
rule_match_count          # how many importer rules fired cleanly
model_self_confidence     # what the model returned
conflict_flags            # any detected contradictions
```

Action type matters for thresholds **[C5]**: creating a new invoice is riskier than updating an ETA — the threshold should differ accordingly.

---

## 6. Security Boundary

The design case **[C1]** explicitly flags untrusted input. The architecture handles this structurally, not probabilistically **[S14, S15]**:

1. **Content stays in the user turn** — email content is always framed inside `<document_content>` delimiters in the `user` message. The system prompt contains only the extraction schema and retrieved knowledge nodes (which were written by humans or a separate, isolated LLM call — never from raw email text).

2. **Knowledge nodes are never derived directly from email content** — the correction-to-knowledge-node synthesis call receives only `corrected_fields` diff + field schema, not the original email. This isolates the rule-learning surface from the attack surface **[S15]**.

3. **Actions gate on structured output** — the LLM outputs a validated JSON object; the decision to write to Nauta is made by deterministic code checking confidence thresholds, not by following any natural-language instruction from the email **[S14]**.

4. **Llama Guard 4 on input** catches prompt injection attempts before the extraction agent sees anything **[C5]**.

5. **NeMo Guardrails** adds sender-level policy as declarative rules evaluated outside the LLM — email content physically cannot override them because they run before and after the model, not inside it **[C5]**.

---

## 7. Human Review Loop & Learning

From **[C5]** and **[S11]**:

```sql
-- On confirm (no changes):
UPDATE extraction_records
  SET status = 'confirmed', reviewed_by = $user, reviewed_at = now()
WHERE id = $id;
-- The confirmed component now participates in future retrieval as a few-shot example.

-- On correct + confirm:
UPDATE extraction_records
  SET corrected_fields = $changes,
      status = 'confirmed',
      reviewed_by = $user,
      reviewed_at = now()
WHERE id = $id;
-- Trigger: corrected_fields IS NOT NULL → spawn knowledge_node synthesis task.
-- The synthesis call (separate LLM, isolated from email content) receives:
--   original extracted_fields, corrected_fields, entity_type schema
-- → generates a rule: "For invoices from this supplier, field X is in the filename"
-- → INSERT INTO knowledge_nodes (source='learned_from_correction', scope=..., ...)
```

The correction loop from **[C5]**:
```
corrections accumulate
→ nightly rule extraction agent
→ proposed rules queue (human approval)
→ approved rules → UPDATE knowledge_nodes
→ cache invalidated for that importer
→ next email for that importer sees new rules
```

Rules never auto-apply without approval. The loop accelerates learning without allowing the system to reprogram itself **[C5]**.

The Decagon benchmark **[C4]**: Week 1 might be 40% auto-act. Month 3 should be 85%+. The system earns its automation rate through the correction loop, not through upfront rule engineering.

---

## 8. UI Data Shape

The design case **[C1]** specifies the email view with hover-highlight per component. **[C7]**

```typescript
interface EmailView {
  email: {
    id: string;
    subject: string;
    sender: string;
    received_at: string;
    body_text: string;
    body_html?: string;
  };
  attachments: Array<{
    id: string;
    filename: string;
    content_type: string;
    storage_url: string;
  }>;
  components: Array<EmailComponentView>;
}

interface EmailComponentView {
  id: string;
  source_type:
    | "email_body"
    | "attachment_page"
    | "attachment_sheet"
    | "attachment_section"
    | "attachment_whole";
  attachment_id?: string;
  location: ComponentLocation;  // used for hover-highlight in UI [C1]
  content_text: string;
  extraction_status: string;

  entity_type_candidate?: {
    entity_type_slug: string;
    entity_type_label: string;
    confidence: number;
  };
  extraction_record?: {
    id: string;
    status: string;
    extracted_fields: Record<string, unknown>;
    confidence_score: number;
    entity_instance_match?: {
      nauta_id: string;
      display_name: string;
      match_type: string;  // 'identifier_exact', 'semantic', 'alias'
    };
  };
  related_knowledge_nodes?: Array<{
    id: string;
    title: string;
    content: string;
    similarity_score: number;
  }>;
}

// Location union — drives highlighting per file type
type ComponentLocation =
  | { type: "email_body"; char_start: number; char_end: number }
  | { type: "pdf_pages"; page_start: number; page_end: number }
  | { type: "xlsx_sheet"; sheet: string; row_start: number; row_end: number }
  | { type: "docx_paragraphs"; paragraph_start: number; paragraph_end: number }
  | { type: "whole_file" };
```

---

## 9. What Already Exists (acme-os / acme-boards)

From **[C2]** (acme-os) and **[C3]** (acme-boards):

| Nauta need                        | Existing in acme-os / acme-boards       | Gap                            |
| --------------------------------- | ------------------------------------------- | ------------------------------ |
| Durable queue                     | Procrastinate worker (acme-os)            | —                              |
| Document parsing (PDF, xlsx)      | LandingAI adapter + file processing subgraph| —                              |
| pgvector + HNSW indexes           | Production-ready (acme-os)                | Need halfvec + HNSW tuning     |
| LangGraph orchestration           | 10 nodes in acme-os                       | Extraction subgraph not built  |
| HITL interrupt()                  | LangGraph + mobile approval UX              | —                              |
| Fuzzy/exact entity matching       | MergeService + matcher registry             | No BM25 or reranker layer      |
| Two-pass LLM classify+extract     | Gemini 2-pass in acme-boards              | No retrieved context injection |
| Idempotency pattern               | webhook_events table + HMAC                 | —                              |
| Per-tenant isolation              | data_source_id + RLS                        | —                              |
| Inbound email pipeline            | **Absent**                                  | Full build required            |
| Nauta adapter                     | **Absent**                                  | Full build required            |
| Knowledge nodes / rule learning   | agent_feedback_log (partial)                | No rule synthesis loop         |
| Citation / bounding-box tracing   | **Absent**                                  | Full build required            |
| BM25 + reranker retrieval         | **Absent**                                  | Full build required            |

---

## 10. Migration Seed

```sql
-- System defaults (importer_id = null = available to all importers)
insert into entity_types (importer_id, slug, label, description) values
  (null, 'order',          'Purchase Order',
   'A purchase order from importer to supplier. Key identifiers: PO number.'),
  (null, 'invoice',        'Invoice',
   'A commercial invoice from supplier or forwarder. Key identifiers: invoice number, PO number.'),
  (null, 'bill_of_lading', 'Bill of Lading',
   'Transport document from maritime line. Key identifiers: BL number, booking number, container numbers.'),
  (null, 'container',      'Container',
   'A shipping container. Key identifiers: container number (4 letters + 7 digits, e.g. MSCU1234567).'),
  (null, 'booking',        'Booking Confirmation',
   'Booking confirmation from maritime line or forwarder. Key identifiers: booking number.'),
  (null, 'shipment',       'Shipment',
   'A shipment grouping containers. Key identifiers: shipment reference, BL number.'),
  (null, 'supplier',       'Supplier',
   'A vendor. Key identifiers: supplier name, tax ID.'),
  (null, 'maritime_line',  'Maritime Line',
   'A container shipping carrier. Key identifiers: SCAC code, carrier name.');
```

---

## 11. Phase Boundary Recommendation

| Sub-Phase | Goal | Deliverable | Key sources |
| --------- | ---- | ----------- | ----------- |
| **4a: Decomposition** | Email → components in DB | ECS worker, `email_components` table, text extraction | C2, C5, C6 |
| **4b: Classification + Extraction** | Components → typed + fields | Claude integration, `extraction_records`, confidence gate | C3, C5, S14, S15 |
| **4c: Entity Resolution** | Fields → entity candidates | `entity_instances`, pgvector + pg_trgm hybrid search | S1–S3, S7–S11 |
| **4d: Review UI + Confirmation** | Humans approve/correct | Review tasks, UI endpoints, idempotent Nauta writes | C1, C5 |
| **4e: Knowledge Graph** | Confirmed extractions → nodes | `knowledge_nodes`, nightly synthesis, retrieval improvement | S11, C5 |

**Minimum viable loop (4a + 4b + 4c + 4d):** Email arrives → broken into components → fields extracted → entity candidates shown in UI → human confirms. This is a working product.

**4e (Knowledge Nodes) is the moat** **[C4]**: Once you have 500+ confirmed extractions per importer, the system starts getting significantly better than a cold-start LLM. The Decagon episodes describe this exact flywheel for customer support.

---

## 12. Open Questions (RESOLVED)

1. **AWS Textract vs. Claude vision:** For scanned PDFs, Textract is more reliable for layout extraction. Claude vision is better for semantic context. Consider Textract for text extraction + Claude for classification/extraction in 4a. **[C5, C6]**
   - **RESOLVED (Phase 4):** AWS Textract is the chosen OCR engine behind `OCRProtocol` for per-page text/layout extraction (04-04-PLAN.md, CONTEXT.md D-07). Claude is used for semantic segmentation (04-05) and autofill (04-07), not for OCR.

2. **Embedding model hosting:** Options: (a) call from Python worker on ECS (add torch dep), (b) HuggingFace Inference API, (c) Supabase Edge Function via pgmq pattern **[S12]**. The Supabase pattern is the simplest and keeps everything in one service.
   - **RESOLVED (Phase 4):** Embeddings are generated by calling the embedding API from the Python worker (option-b-style API call, no torch dep, no pgmq Edge Function), inline in the email-listener service (04-08-PLAN.md, CONTEXT.md "Claude's Discretion").

3. **Knowledge Node activation:** Nightly batch job is simplest **[C5]**. Real-time trigger is more responsive but more complex. Start with nightly batch.
   - **RESOLVED: DEFERRED** — the knowledge-node learning loop / nightly rule synthesis (research 4e) is out of scope for Phase 4 (CONTEXT.md `<deferred>`). Confirmed-context retrieval exists this phase; automated rule synthesis does not. Moot for Phase 4 planning.

4. **Entity creation flow:** When reviewer says "no match — create new entity," create it immediately to reduce friction and index it so the second email from the same supplier resolves automatically. **[C5]**
   - **RESOLVED: DEFERRED** — the reviewer entity-creation flow belongs to the review UI, explicitly deferred to a following phase (CONTEXT.md `<deferred>`). Phase 4 delivers the backend/API only. Moot for Phase 4 planning.

5. **Rule conflicts:** Two rules for the same importer that contradict each other on overlapping cases. The rule extraction agent should flag conflicts before proposing. Resolution: more specific rule wins **[C5]**.
   - **RESOLVED: DEFERRED** — rule extraction/synthesis is part of the deferred knowledge-node learning loop (CONTEXT.md `<deferred>`). No rules are synthesized in Phase 4, so no conflicts arise. Moot for Phase 4 planning.

---

_Last updated: 2026-06-11 | Architecture version 0.3 — all 8 context files sourced_
