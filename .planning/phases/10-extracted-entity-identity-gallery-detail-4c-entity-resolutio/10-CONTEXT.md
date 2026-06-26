# Phase 10: Extracted-entity identity, gallery & detail (4c entity resolution) - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Promote "extracted entity" from an *implicit* thing (today: `email_components` +
`extraction_records`) into a **first-class, cross-email identity** — the deferred
**"4c entity resolution"** backend — then build the browseable entities **gallery**
(`/entities`, table ⟷ mosaic toggle) and the **individual-entity page**
(`/entities/[id]` with details + related emails/components/fields). Realizes Phase 9
request-6 **R3 (gallery) + R4 (detail)**.

**In scope:** the resolution/matching pipeline that dedupes occurrences into one
identity; the identity store; the `entityInstances` tRPC router (`list` + `byId`);
the gallery and detail pages; the human confirm/reject/unmerge loop that the
suggest-only model requires.

**Out of scope:** knowledge-node graph (R6 → Phase 11); the Nauta→Supabase entity
sync (the `source='nauta_sync'` mirror stays empty); a cross-encoder reranker;
auto-confirm / system-decided merges.
</domain>

<decisions>
## Implementation Decisions

### Entity identity & promotion
- **D-01:** **One row = one resolved real-world entity, cross-email.** `PO-1234`
  appearing in 3 emails is ONE gallery row with 3 occurrences — not three rows. This
  is the entire point of "4c entity resolution" and makes the detail page's "related
  emails" meaningful.
- **D-02:** **Promotion = confirmed + candidate (flagged).** Both human-confirmed
  entity regions AND candidate (machine-guessed) entity regions become identities, but
  candidates are **visually flagged and hidden by default** behind a status filter
  (D-14). Keeps the gallery populated for demo while never passing a machine guess off
  as curated truth.
- **D-03:** **Identity store = repurpose the existing `entity_instances` table**, NOT a
  new `extracted_entities` table. Rationale: `component_entity_candidate_links` already
  FKs `entity_instance_id`, and the HNSW (embedding) + pg_trgm (`identifiers::text`)
  indexes and the `display_name`/`identifiers`/`aliases`/`embedding`/`summary_text`
  columns are an exact fit — all built, just unread. A new table would duplicate every
  index and add a parallel occurrence-link column for zero functional gain.
- **D-04:** **Migration cost of D-03:** make `nauta_id` **nullable** (email-extracted
  entities have no Nauta record yet) and **relax the `(importer_id, entity_type_id,
  nauta_id)` unique constraint** accordingly; add a **`source` discriminator** column
  (`email_extracted` | `nauta_sync`). Every Phase-10 query filters/writes
  `source='email_extracted'`; the same query naturally covers `nauta_sync` rows if the
  Nauta sync is ever built. (Exact column type/enum-vs-text and constraint reshaping is
  planner discretion.)

### Entity resolution architecture (the defensible core — BlendedRAG + RRF)
- **D-05:** **Suggest-only — the system never auto-decides a merge.** Every cross-email
  match is a **strongly-ranked suggestion** a human confirms; liability for a wrong
  merge stays with the human ("we suggest as strongly as possible, but do not decide").
  Grounded in design-case §4 ("being wrong is expensive… route to reviewers when
  unsure") and §3 ("resolving a name to the wrong ID silently corrupts a shipment's
  record").
- **D-06:** **Flywheel intent (why suggest-only is acceptable):** the goal is to make
  suggestions *progressively stronger* (via knowledge nodes + confirmed references) so
  humans can **confirm more at a time** with less effort over time. Whether the product
  ever crosses into auto-confirm is **explicitly left open** — not decided here.
- **D-07:** **Candidate generation = parallel BlendedRAG, fused by Reciprocal Rank
  Fusion.** Run BOTH arms in parallel, then merge with **RRF (k=60, no score
  normalization)** — NOT a sequential identifier-then-name fallback. RRF lets a weak
  identifier hit + a strong name hit reinforce into a top-ranked suggestion.
  - **Dense arm:** HNSW cosine on `embedding` (display_name + summary + key
    identifiers) — catches name variants ("Acme" ≈ "Acme Inc.", "COSCO" ≈ "COSCO
    Shipping").
  - **Lexical arm:** pg_trgm (Phase 8) on `identifiers::text` + `display_name` for
    **exact AND fuzzy** identifier match — fuzzy is **mandatory** because design-case §3
    says identifiers carry typos/OCR/prefixes ("writes the container number with a typo
    every time — still the same container").
- **D-08:** **Matching key = the `is_identifier` fields** (PO#, invoice#, container#,
  BoL#, booking# — the design-case backbone identifiers) as primary signal, with
  semantic on name/aliases as the complementary arm. `is_identifier` lives in
  `entity_type_fields` (jsonb config today per Phase 9 D-27) — promoting it to a real
  column is planner discretion.
- **D-09:** **Per-arm provenance is recorded.** Each surfaced candidate writes a
  `component_entity_candidate_links` row with `match_type`
  (`semantic | identifier_exact | identifier_fuzzy | alias`), `similarity_score`, and
  `was_selected=true` once a human confirms. This is the audit trail for every
  resolution decision.
- **D-10:** **Resolution target + trigger:** resolve a newly-confirmed entity against
  **prior email-extracted identities** (`source='email_extracted'`); run **on-confirm
  incrementally** PLUS a **re-runnable backfill command** (essential — the identity +
  link tables are empty today and Bedrock may 404, so the corpus must be
  (re)buildable). Do NOT attempt to resolve against the empty `nauta_sync` mirror now.
- **D-11:** **Flywheel write-back on confirm:** confirming a merge stores the variant
  spelling as an **alias** on the surviving identity (so future `identifier_fuzzy` /
  `alias` arms match it directly) and may spawn a scoped knowledge node. Each
  confirmation makes the next suggestion stronger.
- **D-12:** **Graceful degradation:** the lexical arm is Bedrock-free (pg_trgm, live
  since Phase 8) and per source S16 is the *stronger* arm for logistics IDs. If Bedrock
  embeddings are unavailable, resolution **degrades to lexical-only** rather than
  failing. Search (D-17) is likewise pg_trgm-based so it always works.
- **D-13:** **Reranker deferred.** Ship RRF-fused suggestions this phase; the
  cross-encoder reranker named in `context/4` is **not installed** anywhere and is a
  documented future enhancement, not Phase-10 scope.

### Gallery (`/entities` — R3)
- **D-14:** **Both views ship; TABLE is the default**, mosaic is the toggle. Back-office
  ops scan identifier numbers (PO/container/BoL), which read and sort best as table
  columns.
- **D-15:** **Row/card content = full ops set:** display name · entity-type badge · key
  identifier(s) · # occurrences (distinct emails) · last-seen date · status
  (confirmed vs candidate-flagged) · a "N possible duplicates" indicator when
  merge-suggestions are pending.
- **D-16:** **Filters + search + sort, with a review filter:** filter by entity type
  AND status (`confirmed` / `candidate` / `has-pending-duplicates`); **search over
  `display_name` + `identifiers` + `aliases` via pg_trgm** (Bedrock-free); sort by
  last-seen / name / occurrence count. The **"needs review" filter makes the gallery
  double as the merge-suggestion triage surface** (where the suggest-only review
  workload lives).
- **D-17:** **`entityInstances.list`** uses `limit+1` pagination (the `emails.list`
  idiom) and is importer-scoped from the data row (D-18 below). A gallery-query index on
  the chosen path (e.g. `entity_instances(importer_id, entity_type_id, source)`) is
  required.

### Detail page (`/entities/[id]` — R4)
- **D-18:** **Full related-objects set:** (a) **occurrences** — each source email + the
  region/component it came from, deep-linking back to `/emails/[id]`; (b) the entity's
  **field values aggregated across occurrences**; (c) **scoped knowledge nodes**
  (`knowledge_nodes WHERE scope='entity_instance' AND scope_ref_id = :id`); (d) **pending
  duplicate-merge suggestions**. `entityInstances.byId` returns all four.
- **D-19:** **Conflicting values are shown + flagged; the human picks — no
  auto-canonical.** When the same property has different values across emails (e.g. ETA
  per design-case §2), list **every distinct value with its source email + date +
  confirmed/candidate status** and **visibly flag the disagreement**. The system does
  NOT auto-elect a canonical value (consistent with D-05).
- **D-20:** **Curation = confirm/reject + unmerge.** The human can **confirm or reject**
  a suggested duplicate-merge (required — suggest-only means nothing merges otherwise)
  and **unmerge** a wrong confirmed merge (required — silent-corruption cost means undo
  must exist in-product). **Rename / edit-identifiers/aliases are deferred** to a later
  iteration.
- **D-21:** **Writes go through FastAPI** (browser never holds `X-API-Key`), proxied by
  new tRPC mutations following the `getListenerConfig` + server-side env-guard idiom
  (Phases 6/7/9); **tenant isolation derives importer_id from the data row, never the
  caller** (D-18 from Phase 9). Optimistic updates reuse the `use-region-edit.ts`
  snapshot/revert idiom.

### Claude's Discretion
- `source` as a pgEnum vs text; exact reshaping of the `entity_instances` unique
  constraint; whether `is_identifier` is promoted from `entity_type_fields.config` jsonb
  to a real column now.
- RRF `k` tuning beyond the documented 60; per-arm weighting; candidate top-N cutoff
  before fusion; similarity thresholds that set suggestion *ordering* (not auto-action).
- Exact shape of `entityInstances.byId` joins; how occurrences recompute when a
  component is superseded/rejected (D-16 lineage from Phase 6).
- Backfill command form (CLI/management endpoint) and idempotency strategy.
- Gallery index exact columns; mosaic card layout; empty/sparse-state copy.
- Whether confirm-merge also writes a knowledge node now or just an alias (D-11).
- Display-name derivation for an extracted entity (entity region value vs first
  confirmed field vs identifier).
</decisions>

<specifics>
## Specific Ideas

- **"Suggest as strongly as possible, but do not decide."** The product's stance: the
  system increasingly automates *suggestion strength* and makes confirming faster/bulkier
  over time, but mistakes remain the client's, not ours — until/unless a future decision
  crosses into auto-confirm.
- **The architecture must be defensible against counter-arguments** (this is a design-case
  deliverable). The defense: BlendedRAG three-way hybrid + RRF is the documented
  production standard, logistics IDs *require* the lexical arm (semantic distance between
  `MSCU1234567` and `MSCU1234568` is ~0 to an embedding but they're different containers),
  and "assume every extraction is completely unpredictable" → never trust a single signal,
  fuse multiple weak ones, always route to a human.
- **The gallery is also the triage queue** — the "needs review" filter is where the
  suggest-only workload gets worked down.
- "Your boxes never disappear; the AI's guesses do" (Phase 9 D-18 origin-aware mantra)
  generalizes here: candidate identities are flagged/hidden, confirmed ones are truth.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design intent & resolution architecture (READ FIRST)
- `context/0 - nauta_design_case.pdf` — §3 "same entity named ten different ways" (the
  entity-resolution problem, fuzzy identifiers, new-vs-known distinction), §4 "being wrong
  is expensive" (confidence + human review), the named key identifiers, the four ops
  (understand/extract/reconcile/decide). The doc this phase's architecture must defend.
- `context/6 - email-processing-pipeline-part-1.md` — §1.2 "why hybrid retrieval is
  non-negotiable for logistics"; BlendedRAG (S1), RRF k=60 (S7/S8), BM25-beats-dense on
  logistics IDs (S16), +580% recall (S3); the `retrieval_method='hybrid_rrf'` lineage.
- `context/4 - web-claude-part-2.md` — L180/L294–301/L474: hybrid entity resolution
  shape (filter → parallel dense+BM25 → RRF → [reranker] → threshold), "Acme"→"Acme Inc."
  worked example, reranker role (deferred here).
- `context/1 - os-dev.md` — Index A (Nauta entities) + Index B (confirmed past emails),
  hybrid dense+sparse + reranker + `importer_id` isolation framing.

### Phase 9 split decision & this phase's mandate
- `.planning/phases/09-entity-field-region-relationships-canvas/09-SCOPE-PROPOSAL.md` —
  R3/R4 hard blockers, the repurpose-vs-new-table fork (resolved here = repurpose),
  reuse inventory (`groupEntityTypeRows`, dedupe-preferring-confirmed, `email-detail.tsx`
  template).
- `.planning/phases/09-entity-field-region-relationships-canvas/09-CONTEXT.md` — Phase 9
  decisions this builds on: `role`/`entity_type_id`/`entity_type_field_id` columns
  (D-02/03/04), inbox entity-chip deep-link `href` (D-24 — Phase 10 makes it real),
  glass aesthetic (D-22), FastAPI-proxy + tenant-from-row (D-15/D-18/D-26).
- `.planning/ROADMAP.md` — Phase 10 entry (goal, hard prerequisites, depends-on Phase 9).

### Prior-phase context the planner must honor
- `.planning/phases/04-email-intelligence/04-CONTEXT.md` — Phase 4 backend contracts:
  `entity_instances` purpose, `component_entity_candidate_links`/`component_knowledge_node_links`
  design (RESEARCH §3.8/§3.9), embedding-on-confirm flywheel, importer isolation.
- `.planning/phases/08-...` (trgm key_terms) — the live pg_trgm arm the lexical matcher
  reuses (Bedrock-free).
- `.planning/phases/05-...` & `06-...` CONTEXT — tRPC+Drizzle data path, supersede-never-mutate
  lineage that occurrence-recompute (D-16 discretion) must respect.

### Schema (verified, packages/db/src/schema/)
- `entity-instances.ts` — the identity store to repurpose (D-03/D-04): `nauta_id`,
  `display_name`, `identifiers` jsonb, `aliases` text[], `summary_text`, `embedding`
  halfvec(1536), the unique + index to reshape.
- `component-links.ts` — `component_entity_candidate_links` (occurrence/provenance edges,
  `match_type`, `was_selected`) + `component_knowledge_node_links`.
- `knowledge-nodes.ts` — `scope='entity_instance'` + `scope_ref_id` for the detail
  knowledge panel (D-18c).
- `components.ts` / `entity-types.ts` / `extractions.ts` — `role`/`entity_type_id`
  (Phase 9), `is_identifier` (in `entity_type_fields`), extraction values for occurrences.

No external (non-planning) specs/ADRs beyond the `context/` design docs above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Identity store + edges, BUILT & INDEXED but EMPTY/UNREAD:** `entity_instances`
  (HNSW embedding + pg_trgm `identifiers::text`), `component_entity_candidate_links`
  (FK → entity_instance, `match_type`, `was_selected`). Phase 10's job is to populate
  and read them.
- **Lexical arm:** the Phase-8 `pg_trgm` GIN index + retrieval is live and Bedrock-free
  — the fuzzy/exact identifier matcher reuses it.
- **Data path / join idioms:** `packages/api-client/src/router/emails/detail.ts`
  (`groupEntityTypeRows`, dedupe-preferring-`confirmed`, superseded filter),
  `emails/entity-summary.ts` (per-`email_id` entity-type rollup — the cross-email
  aggregation precedent), `emails/mutations.ts` (FastAPI proxy + `getListenerConfig`
  env-guard).
- **Frontend templates:** Phase 9's glassy three-pane inbox (`@nauta/ui` `table` +
  `card` + `resizable`, `backdrop-blur` + `bg-background/70`); `email-detail.tsx`
  header+grid structural template for the entity detail layout; `entity-type-picker.tsx`
  / badges for type chips; inbox entity chip whose `href` flips to `/entities/[id]`
  here (Phase 9 D-24).
- **Optimistic-update idiom:** `use-region-edit.ts` snapshot/revert for the
  confirm/reject/unmerge mutations.

### Established Patterns (constraints)
- **Writes via FastAPI; browser never holds `X-API-Key`; tRPC mutation proxy.**
- **Tenant isolation from the data row, never the caller** (Phase 9 D-18).
- **Supersede, never mutate** (Phase 6) — occurrence recompute on component
  supersede/reject must follow lineage, not in-place edit.
- **Bedrock may 404** — every path must degrade (resolution → lexical-only; search →
  pg_trgm; detail/gallery render whatever exists).
- **`@nauta/ui` (shadcn) only; glass aesthetic; no second accent hue.**

### Integration Points
- Migration in `packages/db`: `entity_instances` (`nauta_id` nullable, unique reshape,
  `source` column) + gallery index → regenerate types.
- New backend: resolution use case (parallel dense+lexical + RRF), confirm/reject/unmerge
  use cases (alias write-back), backfill command; new FastAPI endpoints.
- New tRPC `entityInstances` router (`list` + `byId`) + confirm/reject/unmerge mutations.
- New routes `apps/web/src/app/entities/` (gallery) + `entities/[id]/` (detail) under the
  Phase-9 app shell; flip the inbox entity-chip `href` to `/entities/[id]`.
</code_context>

<deferred>
## Deferred Ideas

- **Auto-confirm / system-decided merges** — philosophically open (D-06); not this phase.
- **Cross-encoder reranker (bge-reranker) after RRF** (D-13) — no model installed; future.
- **Nauta → Supabase entity sync** to populate `source='nauta_sync'` and reconcile
  extracted entities against real Nauta records (the design-case "reconcile against Nauta"
  step). Phase 10 builds only the email-extracted side.
- **Rename / edit identifiers & aliases** on the detail page (D-20) — later iteration.
- **Knowledge-node graph view (R6) → Phase 11.**
- **Negative learning from rejected merges** (beyond not re-suggesting) and
  **bulk cross-entity merge** tooling.

None of these are required to deliver the Phase 10 identity + gallery + detail.
</deferred>

---

*Phase: 10-extracted-entity-identity-gallery-detail-4c-entity-resolutio*
*Context gathered: 2026-06-14*
