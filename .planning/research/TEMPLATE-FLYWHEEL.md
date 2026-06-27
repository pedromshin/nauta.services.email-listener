# Template / Caching / Retrieval Flywheel

**Domain:** Runtime spec-first generative-UI engine — template reuse layer
**Researched:** 2026-06-26
**Overall confidence:** HIGH (stack evidence from codebase, MEDIUM on promotion signal thresholds)

---

## 1. Context: What This Plugs Into

The product already runs a **BlendedRAG + RRF(k=60)** retrieval flywheel
(`SupabaseRetrievalRepository`, `SupabaseEntityResolutionRepository`) over
**pgvector halfvec(1536) HNSW** indexes backed by **AWS Bedrock Titan embeddings**.
The template flywheel is a _second_ flywheel that lives one layer higher: instead of
retrieving training examples for the LLM, it retrieves _previously generated specs_ so
the LLM is never called at all.

Runtime stack in scope:
- Drizzle ORM + Supabase Postgres + pgvector (halfvec 1536, HNSW cosine)
- AWS Bedrock (Titan text-embedding-v2, Claude for generation)
- tRPC + Next.js frontend
- `@nauta/ui` component library as the component catalog/registry

---

## 2. Cache-Key / Content-Hash Design

### Why exact-match is the right Tier 1

GPTCache, AWS production studies, and Portkey all converge on the same architecture:
**Tier 1 = deterministic SHA-256 exact-match, Tier 2 = semantic vector search**.
50–70% of real-world LLM traffic consists of exact-repeat queries where a hash lookup
is O(1) and costs zero embedding tokens. For a generative-UI engine, this is even more
pronounced because the same intent + same data shape (e.g. "render invoice for a 3-line
line-items array") will recur constantly across emails from the same sender profile.

### Cache key components

The key must be deterministic and scoped to prevent cross-tenant or cross-version
collisions:

```
cache_key = SHA-256(
  intent_canonical,           // lowercased, whitespace-normalized user intent string
  data_shape_hash,            // SHA-256 of sorted JSON Schema of the bound data
  registry_version,           // semver of @nauta/ui component catalog in use
  entity_type_slug,           // which entity type this spec is for
  importer_id                 // tenant isolation (mirrors T-04-28 pattern)
)
```

`intent_canonical` should be normalized before hashing (lowercase, trim, collapse
whitespace) so minor rephrasing differences don't fragment the exact cache.

`data_shape_hash` captures the _schema_ of the data bound to the spec (field names +
types), not the actual values. Two invoices with different amounts but the same fields
should hit the same cache entry — the template re-binds the data at render time.

`registry_version` is the critical invalidation lever (see §6).

### When exact-match is safe

Exact-match is safe when:
- The intent is a normalized string (not a conversation thread)
- The data shape has not changed
- The registry version in the cache key matches the current deployed version

Exact-match is NOT safe when:
- The spec includes runtime state (timestamps, IDs — these must be binding slots)
- The prompt was conversational / context-dependent

---

## 3. Semantic Template Retrieval

### Two-tier retrieval flow

```
REQUEST (intent, data_shape, entity_type, importer_id)
    |
    v
[TIER 1] Exact cache lookup by SHA-256 key
    |-- HIT  --> return spec (embedding cost: zero)
    |-- MISS
         |
         v
[TIER 2] Semantic retrieval from ui_spec_templates
    |   - embed(intent + entity_type_label) via Bedrock Titan
    |   - vector arm:  match_templates_by_embedding (HNSW cosine)
    |   - lexical arm: match_templates_by_trgm (pg_trgm on intent_text)
    |   - RRF(k=60) fusion → top-3 candidate templates
    |   - Score filter: cosine distance < 0.15 (similarity > 0.85) to accept
    |-- CANDIDATE above threshold
    |       |
    |       v
    |   Re-bind template binding slots with current data → return candidate spec
    |   (mark as "template_hit" in retrieval_context for auditing)
    |-- NO CANDIDATE above threshold
         |
         v
[TIER 3] Cold LLM generation
    - Generate spec via Claude on Bedrock
    - Validate against registry schema
    - Embed intent + store in exact cache (pending promotion to template)
```

### Similarity threshold

Production benchmarks (Portkey, AWS studies) converge on:
- Strict domains (structured UI spec): start at cosine distance < 0.10 (similarity > 0.90)
- Fallback band 0.10–0.15: serve with lower confidence, flag for review
- Above 0.15 distance: cold generation

The existing retrieval flywheel already uses confirmed/auto_confirmed status as a quality
gate. Templates follow the same pattern: only promoted templates appear in Tier 2 results.

### Embedding what

Embed a concatenation of:
```
"{entity_type_label}: {intent_canonical} — fields: {sorted field slugs}"
```

This captures both the document type and the field shape in one vector, mirroring how
`entity_types.embedding` stores the entity description for type-matching.

### RRF fusion mirrors existing pattern

The lexical arm uses `pg_trgm` on `intent_text` (same as `match_components_by_trgm`).
The vector arm uses HNSW cosine on the template embedding. RRF(k=60) merges both.
This is the **same code pattern** as `SupabaseRetrievalRepository._merge_rrf` — reuse
that helper directly.

---

## 4. Template Store Schema

### Core table: `ui_spec_templates`

```sql
CREATE TABLE ui_spec_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importer_id     uuid NOT NULL REFERENCES importers(id) ON DELETE CASCADE,
  entity_type_id  uuid NOT NULL REFERENCES entity_types(id) ON DELETE RESTRICT,

  -- Cache key for exact-match Tier 1
  cache_key       text NOT NULL,  -- SHA-256 hex of (intent+shape+registry+entity+importer)

  -- Semantic retrieval fields
  intent_text     text NOT NULL,  -- canonical intent used to generate this spec
  embedding       halfvec(1536),  -- Bedrock Titan embedding of intent_text

  -- The spec itself
  registry_version text NOT NULL, -- semver of @nauta/ui when spec was generated
  spec_json       jsonb NOT NULL, -- the full component spec (parameterized with binding slots)
  binding_slots   jsonb NOT NULL DEFAULT '{}', -- map: slot_name -> { path: string, type: string }

  -- Lifecycle / promotion
  status          text NOT NULL DEFAULT 'candidate',
  -- 'candidate'   = generated, not yet validated or promoted
  -- 'promoted'    = passes validation + promotion criteria, appears in Tier 2
  -- 'invalidated' = registry version changed; removed from Tier 2

  -- Promotion signals
  validation_passed     boolean NOT NULL DEFAULT false,
  schema_validated_at   timestamptz,
  promotion_score       numeric(5, 4),  -- composite score at promotion time
  use_count             integer NOT NULL DEFAULT 0,
  confirm_count         integer NOT NULL DEFAULT 0,  -- user kept/accepted
  regenerate_count      integer NOT NULL DEFAULT 0,  -- user discarded/regenerated
  feedback_score        numeric(5, 4),  -- explicit 0-1 feedback if collected

  -- Invalidation tracking
  invalidated_at        timestamptz,
  invalidation_reason   text,

  -- Audit
  source_extraction_id  uuid,  -- which extraction_record triggered this spec
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Exact-match index (Tier 1)
CREATE UNIQUE INDEX idx_ui_spec_templates_cache_key
  ON ui_spec_templates (cache_key)
  WHERE status != 'invalidated';

-- HNSW for Tier 2 semantic search (halfvec_cosine_ops, mirrors existing pattern)
CREATE INDEX idx_ui_spec_templates_embedding_hnsw
  ON ui_spec_templates USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- pg_trgm GIN for lexical arm
CREATE INDEX idx_ui_spec_templates_intent_trgm
  ON ui_spec_templates USING gin (intent_text gin_trgm_ops);

-- Scoping indexes
CREATE INDEX idx_ui_spec_templates_importer_entity
  ON ui_spec_templates (importer_id, entity_type_id);

CREATE INDEX idx_ui_spec_templates_status
  ON ui_spec_templates (status);
```

### Drizzle schema (TypeScript)

```typescript
// packages/db/src/schema/ui-spec-templates.ts
import { boolean, index, integer, jsonb, numeric, pgTable,
         text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { halfvec } from "./_halfvec";
import { Importers } from "./importers";
import { EntityTypes } from "./entity-types";

export const UiSpecTemplates = pgTable(
  "ui_spec_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importerId: uuid("importer_id").notNull().references(() => Importers.id, { onDelete: "cascade" }),
    entityTypeId: uuid("entity_type_id").notNull().references(() => EntityTypes.id, { onDelete: "restrict" }),

    cacheKey: text("cache_key").notNull(),
    intentText: text("intent_text").notNull(),
    embedding: halfvec("embedding", { dimensions: 1536 }),

    registryVersion: text("registry_version").notNull(),
    specJson: jsonb("spec_json").notNull().default({}),
    // e.g. { "invoice_number": { "path": "/fields/invoice_number", "type": "string" } }
    bindingSlots: jsonb("binding_slots").notNull().default({}),

    status: text("status").notNull().default("candidate"),

    validationPassed: boolean("validation_passed").notNull().default(false),
    schemaValidatedAt: timestamp("schema_validated_at", { withTimezone: true }),
    promotionScore: numeric("promotion_score", { precision: 5, scale: 4 }),
    useCount: integer("use_count").notNull().default(0),
    confirmCount: integer("confirm_count").notNull().default(0),
    regenerateCount: integer("regenerate_count").notNull().default(0),
    feedbackScore: numeric("feedback_score", { precision: 5, scale: 4 }),

    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    invalidationReason: text("invalidation_reason"),
    sourceExtractionId: uuid("source_extraction_id"),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    cacheKeyUnique: uniqueIndex("idx_ui_spec_templates_cache_key").on(t.cacheKey),
    importerEntityIdx: index("idx_ui_spec_templates_importer_entity").on(t.importerId, t.entityTypeId),
    statusIdx: index("idx_ui_spec_templates_status").on(t.status),
    // HNSW + trgm added via custom SQL migration (halfvec_cosine_ops not emittable by drizzle-kit)
  }),
);

export type UiSpecTemplateRow = typeof UiSpecTemplates.$inferSelect;
export type InsertUiSpecTemplate = typeof UiSpecTemplates.$inferInsert;
```

### Binding slots: parameterization pattern

A "binding slot" is a named hole in the spec JSON where live data is injected at
render time. The slot map records where each hole is (JSON Pointer path within `spec_json`)
and its expected type:

```json
{
  "binding_slots": {
    "invoice_number":    { "path": "/elements/header/props/subtitle", "type": "string" },
    "line_items":        { "path": "/elements/table/props/rows",       "type": "array"  },
    "total_amount":      { "path": "/elements/footer/props/total",     "type": "number" }
  }
}
```

Generation prompt instructs the LLM to emit placeholder tokens (e.g.
`"{{invoice_number}}"`) for dynamic values. A post-processing step:
1. Walks the generated spec JSON
2. Finds all `{{slot_name}}` tokens
3. Records their JSON Pointer paths in `binding_slots`
4. Replaces tokens with `null` in the stored `spec_json`

At render/retrieval time: iterate `binding_slots`, resolve each path in `spec_json`
using [RFC 6901 JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901), set to
the live data value. This is analogous to how json-render's
`{ "$state": "/user/name" }` bindings work, but stored explicitly in the DB for
template-level introspection.

---

## 5. Promotion + "What Is Good"

### Promotion loop design

```
NEW SPEC GENERATED
    |
    v
[AUTO] Schema validation against @nauta/ui registry manifest
    |-- FAIL  → status = 'candidate' (never promoted), log validation_error
    |-- PASS  → validation_passed = true, schema_validated_at = now()
         |
         v
[ASYNC] Accumulate interaction signals (async, non-blocking)
    On user KEPT/confirmed spec    → confirm_count++
    On user DISCARDED/regenerated  → regenerate_count++
    On explicit thumbs-up feedback → feedback_score = user_score

    promotion_score = weighted composite:
      0.5 * (confirm_count / (confirm_count + regenerate_count + 1))  // acceptance rate
    + 0.3 * validation_passed                                           // schema OK
    + 0.2 * min(confirm_count / 5.0, 1.0)                             // volume signal
         |
         v
[TRIGGER] Background job / webhook: when promotion_score >= 0.7 AND confirm_count >= 2
    → status = 'promoted'
    → embed intent_text via Bedrock Titan → store embedding
    → now visible in Tier 2 semantic retrieval
```

### Signal semantics

| Signal | Trigger | Weight |
|--------|---------|--------|
| Schema validation pass | Immediate on generation | Required gate (0 if fails) |
| User confirmed/accepted spec | User clicks "accept" / proceeds | 50% |
| User discarded / hit "regenerate" | User dismisses spec | Reduces acceptance rate |
| Volume (use_count) | Template retrieved and used | 20% |
| Explicit feedback | Optional thumbs up/down | 30% (overrides if present) |

### LLM-eval / offline eval signal (future)

A background LLM judge (Claude Haiku on Bedrock — cheap) can score generated specs
against a rubric:
- Does the spec use only components from the current registry?
- Are all required binding slots present?
- Is the layout appropriate for the entity type?

Score from this judge can feed `feedback_score` before any human sees the spec,
acting as a pre-filter that blocks low-quality specs from ever entering Tier 2.
This is the "offline eval" arm of the LLM-eval practice described in production
monitoring guides (W&B, Confident AI).

### Cold-start handling

First N=5 generated specs for a (entity_type, importer) pair: always call LLM (no
Tier 2 templates to retrieve). Track `use_count` on the cold-start path. Once 2+
specs are promoted for a given entity type, Tier 2 becomes useful.

---

## 6. Invalidation / Drift

### Versioned cache keys (primary mechanism)

Since `registry_version` is part of the SHA-256 cache key, bumping the `@nauta/ui`
semver automatically causes ALL existing exact-match cache keys to stop matching.
New generations get the new registry version embedded in their key and spec.

This is the pattern recommended by production caching guides: "include a version
identifier as part of your cache key so old keys stop matching on deploy — no manual
flush needed."

### Promoted template invalidation on registry bump

On deploy of a new `@nauta/ui` version, a migration/deploy hook runs:

```sql
UPDATE ui_spec_templates
SET status = 'invalidated',
    invalidated_at = now(),
    invalidation_reason = 'registry_version_bump: ' || $new_version
WHERE status = 'promoted'
  AND registry_version != $new_version;
```

This removes invalidated templates from Tier 2 (HNSW index only covers
`status = 'promoted'` via filtered index or WHERE clause in the RPC).

### Partial invalidation (slot-compatible changes)

If a `@nauta/ui` bump only adds new components (backward-compatible), templates that
use no removed/changed components can be kept. This requires a compatibility check:

```
for each promoted template:
  if all component types in spec_json exist in new registry manifest
    AND all component prop types are unchanged
  → keep as 'promoted' (update registry_version to new)
  else
  → invalidate
```

This is a LOW-priority optimization; full invalidation is safe and simple for v1.

### Data shape drift

If the entity type fields change (a new required field added, a field removed), existing
templates' `binding_slots` may be stale. Track this by comparing the entity type's
field slugs against the binding slots on retrieval. If slots don't cover all required
fields: fall through to Tier 3 (cold LLM generation) and treat the retrieval as a miss.

### TTL as safety net

Add a 30-day TTL on promoted templates as a defense against long-lived stale entries
that slip through version checks. Implemented as a cron job or Postgres `pg_cron`
task, not as the primary invalidation mechanism.

---

## 7. Retrieval RPCs

Two Postgres functions (mirrors 0009_retrieval_rpcs.sql pattern):

```sql
-- Semantic arm
CREATE OR REPLACE FUNCTION match_templates_by_embedding(
  query_embedding halfvec(1536),
  match_importer_id uuid,
  match_entity_type_id uuid,
  match_count int
)
RETURNS TABLE (id uuid, intent_text text, spec_json jsonb, binding_slots jsonb, distance real)
LANGUAGE sql STABLE AS $$
  SELECT id, intent_text, spec_json, binding_slots,
         (embedding <=> query_embedding) AS distance
  FROM ui_spec_templates
  WHERE importer_id = match_importer_id
    AND entity_type_id = match_entity_type_id
    AND status = 'promoted'
    AND embedding IS NOT NULL
  ORDER BY (embedding <=> query_embedding)
  LIMIT match_count;
$$;

-- Lexical arm
CREATE OR REPLACE FUNCTION match_templates_by_trgm(
  query_text text,
  match_importer_id uuid,
  match_entity_type_id uuid,
  match_count int
)
RETURNS TABLE (id uuid, intent_text text, spec_json jsonb, binding_slots jsonb, sim real)
LANGUAGE sql STABLE AS $$
  SELECT id, intent_text, spec_json, binding_slots,
         similarity(intent_text, query_text) AS sim
  FROM ui_spec_templates
  WHERE importer_id = match_importer_id
    AND entity_type_id = match_entity_type_id
    AND status = 'promoted'
    AND query_text <> ''
    AND similarity(intent_text, query_text) > 0
  ORDER BY similarity(intent_text, query_text) DESC
  LIMIT match_count;
$$;
```

Python repository class:

```python
class TemplateRetrievalRepository:
    """Two-tier template lookup. Tier 1 = exact cache. Tier 2 = BlendedRAG RRF."""

    def find_exact(self, *, cache_key: str) -> dict | None:
        result = self._client.table("ui_spec_templates") \
            .select("*") \
            .eq("cache_key", cache_key) \
            .neq("status", "invalidated") \
            .single().execute()
        return result.data or None

    async def find_similar_promoted(
        self,
        *,
        intent_embedding: tuple[float, ...],
        intent_text: str,
        entity_type_id: str,
        importer_id: str,
        top_n: int = 3,
    ) -> list[TemplateCandidate]:
        vector_rows = self._vector_query(intent_embedding, entity_type_id, importer_id)
        trgm_rows = self._trgm_query(intent_text, entity_type_id, importer_id)
        if not vector_rows and not trgm_rows:
            return []
        # RRF(k=60) — reuse _merge_rrf from retrieval_repository
        merged = _merge_rrf([
            [r["id"] for r in vector_rows],
            [r["id"] for r in trgm_rows],
        ])[:top_n]
        # ... build TemplateCandidate list from merged IDs
```

---

## 8. Prior Art Survey

### GPTCache (Zilliz)
Architecture: Exact hash → semantic vector search (FAISS/pgvector) → LLM fallback.
Configurable similarity threshold; default recommended 0.8 for general text, 0.9+ for
structured domain outputs. Supports pgvector as a backend vector store.
Source: https://github.com/zilliztech/GPTCache, https://gptcache.readthedocs.io/en/latest/

### Portkey semantic cache
Production guidance: start at 0.90–0.95 cosine similarity, test against 5,000 queries,
target <3-5% false positive rate. Notes that 0.75 vs 0.99 threshold barely affects
accuracy (<1%) but changes cost savings from 15.8% to 86.3%.
Source: https://portkey.ai/blog/semantic-caching-thresholds/

### AWS production study
Recommends combining exact-match + semantic caching simultaneously. Endorses TTL jitter
to prevent synchronized expiration spikes. Versioned cache keys as the primary
invalidation mechanism. pgvector / OpenSearch as the vector backend.
Source: https://aws.amazon.com/blogs/database/optimize-llm-response-costs-and-latency-with-effective-caching/

### json-render (Vercel Labs)
Implements "Catalog Definition → AI Generates JSON → Renderer" pattern. Components
have typed props + children slots. Specs are validated against catalog schema at
generation time. Does not expose an explicit caching or template reuse system — that
gap is exactly what this flywheel fills.
Source: https://github.com/vercel-labs/json-render

### A2UI (Google)
Framework-agnostic protocol for LLM-generated UIs. Uses DynamicString/DynamicNumber as
data binding primitives (equivalent to binding slots). ChildList template + path binding
for list instantiation. Three-step loop: prompt → generate JSON → validate against schema.
Source: https://a2ui.org/specification/v0.9-a2ui/

### v0.dev (Vercel)
Generates React/Tailwind/shadcn components from prompts. Not open source. Based on
public behavior: generates fresh on each prompt, no observable template reuse/promotion
system. The approach here (spec-first + flywheel) is architecturally differentiated.

### LLM cache invalidation best practices
Consensus: include version tag in cache key; use event-driven flush on deploy; segment
namespaces to control blast radius. Never rely on TTL as the primary mechanism for
structured-output caches.
Source: https://www.buildmvpfast.com/blog/llm-response-caching-cache-keys-invalidation-strategies-2026

---

## 9. Architecture Summary

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TIER 1: Exact Cache (ui_spec_templates, cache_key = SHA-256)            │
│    → 0ms embedding cost, O(1) lookup, ~50-70% hit rate in steady state   │
└──────────────────────────────────────────────────────────────────────────┘
           miss ↓
┌──────────────────────────────────────────────────────────────────────────┐
│  TIER 2: Semantic Template Retrieval (BlendedRAG + RRF k=60)             │
│    → HNSW cosine on halfvec(1536) + pg_trgm on intent_text              │
│    → Only 'promoted' templates; threshold: cosine distance < 0.15        │
│    → Re-bind binding_slots with live data before returning               │
└──────────────────────────────────────────────────────────────────────────┘
           miss ↓
┌──────────────────────────────────────────────────────────────────────────┐
│  TIER 3: Cold LLM Generation (Claude on Bedrock)                         │
│    → Generate spec with binding slot placeholders                        │
│    → Validate against @nauta/ui registry manifest                        │
│    → Store in ui_spec_templates (status='candidate')                     │
│    → Embed intent_text asynchronously                                    │
└──────────────────────────────────────────────────────────────────────────┘
           promotion loop ↓ (async, non-blocking)
┌──────────────────────────────────────────────────────────────────────────┐
│  PROMOTION ENGINE                                                         │
│    validation_passed=true AND confirm_count >= 2 AND score >= 0.7       │
│    → status='promoted' → enters Tier 2 index                             │
│    → Optional: LLM Haiku judge as offline eval pre-filter                │
└──────────────────────────────────────────────────────────────────────────┘
           registry bump ↓
┌──────────────────────────────────────────────────────────────────────────┐
│  INVALIDATION                                                             │
│    registry_version in cache_key → old keys stop matching automatically  │
│    Deploy hook: UPDATE status='invalidated' WHERE registry_version!=new  │
│    Data shape drift: slot coverage check on Tier 2 hit                   │
│    TTL: 30-day background sweep as safety net only                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Pitfalls

### Pitfall 1: Over-eager Tier 2 threshold
**Problem:** Low cosine distance threshold (e.g. 0.30) serves wrong specs confidently.
**Prevention:** Use 0.15 max distance for domain-specific structured UI specs. Benchmark
with real intents before loosening. Monitor `regenerate_count` as a lagging indicator.

### Pitfall 2: Binding slots not covering all required fields
**Problem:** Template was generated when entity type had 5 fields; entity type now has 7.
Template gets retrieved, re-bound, but 2 fields are missing.
**Prevention:** On Tier 2 hit, validate that `binding_slots` covers all `is_required`
fields of the current entity type. If not, treat as miss and fall to Tier 3.

### Pitfall 3: Embedding intent without entity type context
**Problem:** "show the header" matches templates from completely different entity types.
**Prevention:** Always embed "{entity_type_label}: {intent}" and filter both RPCs by
`entity_type_id`. Never do cross-entity-type retrieval.

### Pitfall 4: Exact cache key includes raw intent (not canonical)
**Problem:** "Show invoice" vs "show Invoice" miss each other; cache fragments.
**Prevention:** Normalize intent before hashing: `intent.trim().toLowerCase()` + collapse
internal whitespace to single space.

### Pitfall 5: Promoting too aggressively without schema validation gate
**Problem:** Malformed spec enters Tier 2 and is served to all future requests.
**Prevention:** `validation_passed = true` is a HARD prerequisite for promotion (not
just a factor in the score). Never set status='promoted' if schema validation failed.

### Pitfall 6: Not invalidating on registry version bump
**Problem:** Spec references a component that was renamed or removed. Frontend crashes.
**Prevention:** Deploy hook is mandatory, not optional. Test it in CI by bumping a test
registry version and asserting that all promoted templates for the old version are
invalidated.

### Pitfall 7: Drizzle-kit cannot emit halfvec_cosine_ops HNSW indexes
**Problem:** Running `drizzle-kit push` or `migrate` will not create the HNSW or GIN
indexes on `ui_spec_templates`.
**Prevention:** Add these as custom SQL in a separate migration file, following the
precedent set by `0002_hnsw_halfvec_indexes.sql` and `0009_retrieval_rpcs.sql`.

---

## 11. Gaps / Open Questions

1. **Concurrent writes**: If two requests miss Tier 1 simultaneously and both go to cold
   generation, they may both store slightly different specs for the same cache key.
   Add an `INSERT ... ON CONFLICT (cache_key) DO NOTHING` pattern to handle this safely.

2. **Cross-importer template reuse**: System-default entity types (importer_id = NULL)
   could share templates across importers. Deferred: complex RLS implications. For now,
   scope all templates to a specific importer_id (even for system-default entity types,
   use the importer_id of the requesting tenant).

3. **Embedding cost at cold generation**: Every cold-generate path calls Bedrock Titan
   for embeddings. Consider batching embeddings asynchronously (background job after
   spec is stored) to avoid adding Bedrock latency to the synchronous path.

4. **Promotion threshold calibration**: The 0.7 score / 2 confirms thresholds are initial
   guesses. Requires 2-4 weeks of production data to calibrate. Instrument `promotion_score`
   at every candidate creation so histograms are available.

5. **LLM judge integration**: The Haiku-as-evaluator pattern is described but not yet
   specced as a concrete task. Phase-specific research needed when implementing.

---

## Sources

- [GPTCache GitHub](https://github.com/zilliztech/GPTCache)
- [GPTCache Docs](https://gptcache.readthedocs.io/en/latest/)
- [Portkey: Semantic Caching Thresholds](https://portkey.ai/blog/semantic-caching-thresholds/)
- [AWS: Optimize LLM response costs with caching](https://aws.amazon.com/blogs/database/optimize-llm-response-costs-and-latency-with-effective-caching/)
- [Spheron: Semantic Cache for LLM Inference](https://www.spheron.network/blog/semantic-cache-llm-inference-gpu-cloud/)
- [json-render (Vercel Labs)](https://github.com/vercel-labs/json-render)
- [A2UI v0.9 Specification](https://a2ui.org/specification/v0.9-a2ui/)
- [LLM Cache Invalidation Strategies (buildmvpfast)](https://www.buildmvpfast.com/blog/llm-response-caching-cache-keys-invalidation-strategies-2026)
- [Semantic Caching for LLMs in Production (tianpan.co)](https://tianpan.co/blog/2026-04-09-semantic-caching-llm-production)
- [Drizzle ORM pgvector docs](https://orm.drizzle.team/docs/guides/vector-similarity-search)
- [pgvector-node](https://github.com/pgvector/pgvector-node)
