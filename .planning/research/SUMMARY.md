# Research Summary: Runtime Spec-First Generative-UI Engine

**Date:** 2026-06-26
**Sources synthesized:** PRIOR-ART.md, SPEC-RENDERER.md, GENERATION-AGENT.md, TEMPLATE-FLYWHEEL.md, SAFETY-PITFALLS.md, CURRENCY-2026.md
**Overall confidence:** HIGH (core architecture), MEDIUM (promotion thresholds, embedding model decision)

---

## 1. The Convergent Architecture: Catalog to Spec to Registry to Renderer

Every production system surveyed independently converged on the same four-layer separation:

| Layer | What it is | Who owns it |
|-------|-----------|-------------|
| **Catalog** | Machine-readable manifest: type key, Zod prop schema (.strict()), description, example, slots, acceptsChildren | Developer -- defined once in packages/genui-catalog |
| **Spec** | LLM-emitted nested JSON tree: { v: 1, root: SpecNode, state[], data{} } | LLM -- constrained by catalog schema via Bedrock structured output |
| **Registry** | Static { [typeKey]: ReactComponent } built from catalog entries | Developer -- maps type strings to @nauta/ui imports |
| **Renderer** | Recursive renderNode(): registry lookup -> Zod safeParse props -> ErrorBoundary -> createElement | System -- pure function, zero eval |

### Local Precedent

packages/ui/src/spreadsheet-grid/column-defs.ts is the proven local implementation of this exact pattern.
SchemaFieldType discriminated union -> getRendererAndEditor(col) -> { cellRenderer, cellEditor } is Registry -> Renderer.
For the generative-UI engine: substitute SchemaFieldType with SpecNodeType and ColDef with React.ReactElement.

### Spec Shape: Nested Discriminated-Union Tree (confirmed)

Use a nested discriminated-union tree, not a flat ID-reference map:
- Direct 1:1 mapping with React.createElement hierarchy
- LLMs generate recursive JSON naturally; flat maps require stable IDs which hallucinate
- Bedrock structured output cannot handle recursive Zod schemas -- use z.lazy() with explicit z.ZodType<SpecNode[]> annotation
- Small specs (< 5 KB) render atomically; progressive streaming adds complexity without v1 value

The flat-map approach is superior only for patch-based progressive streaming across large specs.
Revisit if spec sizes exceed ~5 KB or streaming latency becomes a hard requirement.

No eval. No dangerouslySetInnerHTML. No code emission in v1. The renderer is a trusted interpreter only.

---

## 2. Recommended Stack and Versions (as of 2026-06-26)

### AI SDK

| Package | Version | Notes |
|---------|---------|-------|
| ai | ~4.x (v6 branding) | generateObject/streamObject deprecated |
| @ai-sdk/amazon-bedrock | ^4.0.120 | Pin this version |
| zod | ^3.25.76 | Zod v4 INCOMPATIBLE -- issues #5682/#7189 open, unresolved 2026-06-26 |

Canonical API: generateText/streamText + Output.object({ schema: UISpecSchema }).
Client-side: useObject hook (exported as experimental_useObject from ai/react).
streamUI / RSC / createStreamableUI are confirmed dead. Do not use.

### Model Selection (CURRENCY-CORRECTED as of 2026-06-26)

| Role | Model | Bedrock ID | Notes |
|------|-------|-----------|-------|
| Runtime workhorse | Haiku 4.5 | anthropic.claude-haiku-4-5-20251001-v1:0 | us.* cross-region prefix may be needed |
| Escalation | Sonnet 4.6 | anthropic.claude-sonnet-4-6 | 1M context window; Sonnet 4.5 is LEGACY |
| Evaluation only | Opus 4.8 / Fable 5 | anthropic.claude-opus-4-8 / anthropic.claude-fable-5 | NOT runtime; Fable 5 GA June 9 2026 |

Transport: AWS Bedrock via IAM role (fromNodeProviderChain()). No ANTHROPIC_API_KEY. Converse API only.

### Bedrock Structured Outputs (GA Feb 4, 2026)

Requirements (failure = 400 error):
- additionalProperties: false on every Zod object (use .strict()) -- mandatory
- No recursive schemas -- use flat z.record(id, NodeSchema) maps if needed
- No min/max/minLength/maxLength/if/then/else in schema
- One stable UISpecSchema at module load -- dynamic schema breaks 24h grammar cache
- First field in schema: _plan: z.string() -- reasoning trace, strip before rendering
- Prompt caching: cachePoint type: default in providerOptions.amazonBedrock; 1-hour TTL on Haiku 4.5 and Sonnet 4.6

### Embeddings / Flywheel Stack

- Model: Titan Text Embeddings V2 (amazon.titan-embed-text-v2:0) -- current as of 2026-06-26
- OPEN DECISION on dimension: see Section 6, OD-1
- Retrieval: BlendedRAG + RRF(k=60), HNSW cosine on halfvec + pg_trgm GIN on intent_text
- Reuse existing SupabaseRetrievalRepository._merge_rrf directly
- Store: Drizzle + Supabase Postgres + pgvector (HNSW indexes via custom SQL migration, not drizzle-kit)

---

## 3. Feature Map

### Table Stakes (must have for any v1 value)

- Component catalog: ManifestEntry per component with Zod prop schema (.strict()), description, example, slots, acceptsChildren
- Spec schema: discriminated union tree, v: 1, state declarations, data refs, action refs
- Bedrock generation: Haiku 4.5, Output.object, temperature: 0, max_tokens: 3000, system prompt cache point
- Zod safeParse at output boundary before any rendering -- SAFE_FALLBACK_SPEC on failure
- Three allowlists in Zod schema: component types (enum), tRPC procedures (enum/refine), action types (discriminated union)
- Trusted interpreter/renderer: registry lookup + ErrorBoundary per node + graceful unknown-type fallback
- Dual-LLM quarantine: raw email never reaches the generator LLM
- generated_specs audit table: every validated spec stored with email_id, prompt_hash, model_id
- max_tokens: 3000 on every Bedrock call -- never leave unset
- Spec versioning: specVersion literal field; stale specs trigger re-generation

### Differentiators (the flywheel -- why we build our own)

- Tier-1 exact cache: SHA-256(intent_canonical + data_shape_hash + registry_version + entity_type + importer_id) -- O(1), zero LLM cost
- Tier-2 semantic template retrieval: promoted specs via BlendedRAG + RRF with binding slot re-injection at retrieval
- Template promotion: validation_passed AND confirm_count >= 2 AND score >= 0.7 -> status promoted -> enters Tier-2 HNSW index
- Registry invalidation on deploy: promoted templates marked invalidated when registry_version changes
- Binding slots: parameterized spec templates with JSON Pointer paths (RFC 6901) for live data injection

### Should-Have (adds value, not day-1 blockers)

- _plan reasoning field in spec schema for improved reliability and debuggability
- Few-shot retrieval: top-3 similar specs in generation prompt (95% vs 70% task completion per ChatVis benchmark)
- Per-user rate limiting on generation (Redis sliding window)
- axe-core a11y checks in CI against spec fixture renders
- Eval suite: 20-50 fixture emails (including adversarial) run on PR merge
- Standalone /studio surface for spec preview and catalog exploration

### Anti-Features / Deferred (explicitly out of v1)

- Raw TSX/JSX code emission: unsafe without execution sandbox -- later sandboxed experiment only
- Full AG-UI 17-event protocol: overkill for single-agent v1
- Cross-importer template reuse: complex RLS implications
- LLM-authored useEffect/useState/router calls: model declares slots and refs; runtime resolves them
- streamUI / createStreamableUI: dead APIs

---

## 4. Build Order / Phaseable Components

Dependency-ordered. Each phase delivers a runnable, testable unit.

### Phase 1 -- Catalog + Registry Foundation

Delivers: The vocabulary contract. Everything else depends on this.
Features: ManifestEntry<TProps> interface, ComponentRegistry type, hand-authored catalog entries for initial @nauta/ui set
(start with 10-15: badge, button, card, stack, grid, key-value-list, data-table, status-badge, section-header, form-field).
ALLOWED_PROCEDURES and ALLOWED_MUTATIONS enumerations.
CI gate: Every manifest example passes its propsSchema.
Pitfalls: Do not use react-docgen-typescript as source of truth. No additionalProperties: true on any catalog schema.
Research flag: Standard -- no additional research needed.

### Phase 2 -- Spec Schema + Interpreter

Delivers: A runnable SpecRenderer that takes hardcoded spec JSON and renders real @nauta/ui components.
Features: SpecRootSchema (Zod, v: 1, state, data, root), SpecNodeSchema as discriminated union with z.lazy() children,
renderNode() recursive interpreter, useDeclaredState() with useReducer, ActionRegistryContext,
MAX_SPEC_NODES=200 / MAX_SPEC_DEPTH=8 via Zod .refine(), UnknownComponentPlaceholder fallback.
Tests: Snapshot tests against 5 fixture specs. ErrorBoundary isolation tests.
Pitfalls: z.discriminatedUnion + z.lazy needs explicit z.ZodType<SpecNode[]> annotation.
Do not ask LLM to generate node IDs; use structural position keys (root-0-1-2). ErrorBoundary must be class component.
Research flag: Standard.

### Phase 3 -- Generation Layer on Bedrock

Delivers: tRPC procedure accepting { emailId, intent }, calling Bedrock Haiku 4.5 with Output.object, returning SpecRoot.
Features: buildSystemPrompt(registry, examples), streamUISpec() with Output.object, generateUISpec() with repair loop
(max 3 attempts), experimental_repairText, cachePoint on system prompt, generated_specs INSERT,
protectedProcedure + rate limiter, 15-second AbortController timeout.
Pitfalls: Never omit explicit max_tokens. Verify us.* cross-region prefix for Haiku 4.5.
One stable UISpecSchema module -- dynamic generation breaks 24h grammar cache. Zod v3 only.
Research flag: Standard for Bedrock wiring. Repair loop heuristics need validation.

### Phase 4 -- Dual-LLM Quarantine + Validation / Guardrails

Delivers: Safe generation pipeline. Raw email never reaches the generator LLM.
Features: Quarantine extraction step (separate Bedrock call, enum-constrained entity extraction schema only).
Generator receives structured data in delimited section only. specVersion mismatch rejection.
Navigate href validation (relative paths only). UUID-pattern rejection in binding params.
CSP headers. ESLint rule blocking eval/Function/dangerouslySetInnerHTML in renderer files.
Pitfalls: Quarantine LLM output must use enum-constrained entity types -- free strings bleed injection values into generator.
Bindings must never embed literal IDs.
Research flag: Needs validation of quarantine schema + delimiter pattern against adversarial email samples.

### Phase 5 -- Exact Cache + Template Store (Tier-1 + DB Schema)

Delivers: SHA-256 exact-match cache. Every generated spec persisted as candidate template.
Features: ui_spec_templates Drizzle schema (id, importer_id, entity_type_id, cache_key, intent_text,
embedding halfvec, registry_version, spec_json, binding_slots, status, promotion signals),
HNSW index custom SQL migration, GIN index migration, find_exact() repository method,
binding slot extraction, INSERT ... ON CONFLICT (cache_key) DO NOTHING, deploy hook for invalidation.
Pitfalls: OD-1 (embedding dimension) must be resolved before this migration. Normalize intent before hashing.
HNSW + GIN indexes must be separate SQL migration files.
Research flag: Standard. OD-1 is a hard blocker.

### Phase 6 -- Semantic Template Retrieval + Promotion (Tier-2 + Flywheel)

Delivers: Full three-tier retrieval. Promoted templates serve repeat intents without LLM calls.
Features: match_templates_by_embedding and match_templates_by_trgm Postgres RPCs,
TemplateRetrievalRepository.find_similar_promoted() with RRF(k=60), cosine distance threshold < 0.15,
binding slot re-injection at retrieval, promotion engine background job (score >= 0.7 AND confirm_count >= 2),
binding slot coverage check on Tier-2 hits, 30-day TTL sweep.
Pitfalls: Never retrieve across entity types. Never retrieve invalidated templates.
Embedding cost must be async. Promotion thresholds are initial guesses -- instrument from day 1.
Research flag: Standard. Threshold calibration requires 2-4 weeks production data.

### Phase 7 -- Standalone /studio Surface

Delivers: Browseable catalog, spec preview, template management, generation sandbox.
Features: Catalog browser, Spec preview panel (renders via SpecRenderer), Template manager, Generation sandbox.
Pitfalls: Studio must share the same COMPONENT_REGISTRY and SpecRenderer as production.
Research flag: Needs scoping (see OD-3).

### Phase 8 -- Evals + Regression Harness

Delivers: CI gate catching prompt regressions and a11y failures before merge.
Features: 20-50 fixture emails (multilingual, adversarial injection, PDF-heavy, empty),
structural spec assertions, axe-core on rendered fixtures, temperature: 0, weekly drift detection run.
Research flag: Needs phase-specific research on eval rubric design.

---

## 5. Top Guardrails / Pitfalls

### CRITICAL -- System is broken without these

| Guardrail | What it prevents | Enforcement point |
|-----------|-----------------|------------------|
| GR-01: No eval | Browser RCE, XSS, SSRF | ESLint rule on renderer files; renderer is pure createElement |
| GR-02: Component type allowlist | LLM hallucinating unregistered components | z.enum(Object.keys(COMPONENT_REGISTRY)) in spec schema |
| GR-03: tRPC procedure allowlist | LLM binding to arbitrary backend endpoints | z.enum(ALLOWED_PROCEDURES) in DataBindingSchema |
| GR-04: Action allowlist + relative-href-only | javascript: URI injection, external nav | ActionSchema discriminated union; href must start with / |
| GR-05: Dual-LLM quarantine | Direct prompt injection from email content | Quarantine Bedrock call; generator never sees raw email prose |
| GR-06: Zod safeParse before render | Malformed spec reaching DOM | SpecSchema.safeParse() in tRPC output; SAFE_FALLBACK_SPEC on failure |
| GR-07: Depth + node count limits | DoS via oversized spec | countNodes() + depth in Zod .refine(); MAX_SPEC_NODES=200, MAX_SPEC_DEPTH=8 |
| GR-08: Explicit max_tokens: 3000 | Unbounded token quota burn | Set on every generateText/streamText call |

### HIGH -- Serious production issues without these

| Guardrail | What it prevents | Enforcement point |
|-----------|-----------------|------------------|
| GR-09: temperature: 0 | Non-deterministic specs; cache misses; flaky evals | Generation call parameter |
| GR-10: Spec versioning | Stale cached specs against new registry | specVersion literal field |
| GR-11: generated_specs audit table | Debuggability | INSERT after safeParse success |
| GR-12: Per-user rate limiting | Cost DoS | Redis sliding window; HTTP 429 |
| GR-13: AbortController + 15s timeout | Hung Bedrock requests | Wrap every Bedrock call |
| GR-14: Binding params reject literal IDs | Cross-user data leakage | Zod rejects UUID-pattern strings in params |
| GR-15: a11y props required | Machine-authored UI inaccessible | Required label/caption/alt in prop schemas |
| GR-16: Cache-Control: private | CDN serving cross-user specs | Next.js response headers |

### MODERATE -- Operational quality

- Eval suite with adversarial fixtures (Morse/Base64 encoding attacks -- real $175k attack vector documented)
- Prompt hash in cache key: prompt changes naturally invalidate spec cache
- New allowlist entry review gate: written threat model + code review required per entry
- LlamaFirewall PromptGuard 2 as optional Layer 0: 97.5% recall, ~50-100ms latency
- Semantic cache poisoning defense (arXiv:2601.23088): binding slot coverage check + data_shape_hash in cache key

---

## 6. Open Decisions

| # | Decision | Options | Stakes |
|---|----------|---------|--------|
| OD-1 | **Embedding dimension for UI spec templates** | (A) 1024-dim Titan V2 -- halfvec(1024) new column; (B) adopt model producing 1536-dim to match existing halfvec(1536); (C) use existing 1536 columns with Titan V1-compatible model. NOT a bug -- an architecture decision. Titan V2 max output = 1024. | DB migration column type, vector index. Hard blocker for Phase 5. |
| OD-2 | **Spec scope for v1: single component vs full-page** | Single-component first vs full multi-component page spec. 10-component catalog naturally yields simpler specs. | Generation reliability, prompt complexity |
| OD-3 | **Where does /studio live?** | (A) Route in existing Next.js app; (B) standalone Next.js app in monorepo; (C) separate Vercel deployment. | Deployment complexity, DX, integration seams |
| OD-4 | **Integration seam with existing Nauta product** | Triggered by user action vs automatic per email vs parallel surface. | Product UX, data flow, rollout risk |
| OD-5 | **Template promotion thresholds** | confirm_count >= 2 AND score >= 0.7 are initial guesses. Need production data to calibrate. | Template quality vs cold-generation frequency |
| OD-6 | **Code emission scope for later phases** | When (if ever) to introduce sandboxed TSX emission. Should be a separate milestone. | Security surface, implementation complexity |
| OD-7 | **tRPC procedure allowlist initial scope** | Which procedures are in scope for v1? Narrower = smaller security surface. | Generation quality, security surface |

---

## 7. Ranked References to Study Deepest

1. **vercel-labs/json-render** (v0.19.0, 14.8k stars) -- Closest open-source implementation. Study @json-render/core for Catalog/Spec/Registry separation. Adopt the Zod-first catalog pattern directly.

2. **Airbnb Ghost Platform** (medium.com/airbnb-engineering SDUI deep dive) -- Canonical SDUI production pattern at scale. Study SectionComponentType registry key pattern and sections-as-data-complete-self-contained-units principle.

3. **SpecifyUI + APD-Agents** (arxiv:2509.07334, arxiv:2511.14101) -- The only rigorous academic treatment of the template flywheel. RAG-against-spec-pairs + edit triplets (op, path, value) maps directly to template promotion + spec mutation.

4. **Tambo** (tambo-ai/tambo, v1.0 GA, SOC2/HIPAA) -- Best reference for name + description + propsSchema + component manifest entry shape, and for partial props streaming as generation progresses.

5. **OWASP LLM Prompt Injection Cheat Sheet + arxiv:2506.08837** -- Dual-LLM quarantine pattern in section 3.2 is the specific design to implement. OWASP provides XML delimiter pattern and structural defense rationale.

6. **AWS Bedrock Structured Output docs** -- Read JSON Schema constraint list in full before finalizing spec schema. No recursive schemas, additionalProperties: false required everywhere -- these constraints shape the spec schema design.

7. **AI SDK v6 provider source** (vercel/ai: amazon-bedrock-chat-language-model.ts) -- Read useNativeStructuredOutput check logic directly. Understand what triggers synthetic JSON tool fallback (Path B) to avoid it.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Catalog to Spec to Registry to Renderer pattern | HIGH | Validated by 5+ independent production systems; local precedent in column-defs.ts |
| Spec schema shape (nested discriminated union, Zod) | HIGH | Multiple sources; SPEC-RENDERER.md has detailed implementation with known pitfalls addressed |
| Bedrock generation layer (Haiku 4.5, Output.object) | HIGH | Provider source read directly; CURRENCY-2026.md confirmed GA status and current model IDs |
| AI SDK API (generateText + Output.object, Zod v3 required) | HIGH | Confirmed current 2026-06-26; Zod v4 incompatibility is a hard fact |
| Dual-LLM quarantine safety pattern | HIGH | OWASP-anchored; validated by arxiv:2506.08837 |
| Flywheel cache architecture | HIGH | GPTCache, Portkey, AWS production studies converge; RRF pattern reuses existing code |
| Promotion signal weights / thresholds | MEDIUM | Initial guesses requiring calibration on production data |
| Embedding dimension decision | MEDIUM | Titan V2 max 1024 confirmed; 1024 vs 1536 is an open architecture decision |
| /studio surface design | MEDIUM | Pattern understood; scoping and placement require product input |

---

## Sources (Aggregated)

### Primary (read directly)
- vercel-labs/json-render -- GitHub source + json-render.dev/docs
- airbnb-engineering SDUI deep dive -- medium.com
- tambo-ai/tambo -- GitHub source + docs.tambo.co
- assistant-ui -- assistant-ui.com/docs/tools/generative-ui
- AWS Bedrock structured outputs -- docs.aws.amazon.com/bedrock
- AI SDK v6 -- ai-sdk.dev/docs, vercel/ai GitHub source
- OWASP LLM Prompt Injection Prevention Cheat Sheet
- Portkey semantic caching thresholds -- portkey.ai/blog
- GPTCache -- github.com/zilliztech/GPTCache

### Research Grade (peer-reviewed)
- SpecifyUI (arxiv:2509.07334)
- APD-Agents (arxiv:2511.14101)
- GenCache NeurIPS 2025 (microsoft.com/research)
- Design Patterns for Securing LLM Agents (arxiv:2506.08837)
- A11YN (arxiv:2510.13914)
- Semantic cache poisoning (arxiv:2601.23088)
- LlamaFirewall (arxiv:2505.03574)

### Currency-Verified (June 2026)
- @ai-sdk/amazon-bedrock v4.0.120 -- npmjs.com (2026-06-26)
- Claude model lineup -- platform.claude.com/docs/en/about-claude/models/overview (2026-06-26)
- A2UI v0.9.1 / v1.0 Candidate -- a2ui.org/specification (2026-06-26)
- Tambo 1.0 GA -- tambo.co/blog (2026-06-26)
- Bedrock structured output GA Feb 2026 -- aws.amazon.com/about-aws/whats-new/2026/02

### Local Codebase
- packages/ui/src/spreadsheet-grid/column-defs.ts -- primary local precedent for registry dispatch
- SupabaseRetrievalRepository._merge_rrf -- RRF(k=60) implementation to reuse for template retrieval
- 0002_hnsw_halfvec_indexes.sql, 0009_retrieval_rpcs.sql -- migration file precedent to follow
