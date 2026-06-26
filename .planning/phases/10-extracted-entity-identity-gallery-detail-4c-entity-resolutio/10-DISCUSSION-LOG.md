# Phase 10: Extracted-entity identity, gallery & detail (4c entity resolution) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 10-extracted-entity-identity-gallery-detail-4c-entity-resolutio
**Areas discussed:** Identity & promotion, Resolution & matching, Gallery UX (R3), Detail page (R4)

---

## Identity & promotion

| Option | Description | Selected |
|--------|-------------|----------|
| One resolved entity | PO-1234 in 3 emails = ONE row with 3 occurrences | ✓ |
| One per extraction | Each confirmed entity region = its own row, no cross-email merge | |

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmed-only | Only human-confirmed entity regions become identities | |
| Confirmed + candidate (flagged) | Candidates also appear, flagged + hidden by default | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Repurpose entity_instances | Reuse table + candidate-links FK + HNSW/pg_trgm indexes; nauta_id nullable + source column | ✓ |
| New extracted_entities table | Clean separation; duplicated indexes + new link column | |
| You decide (planner) | Mark discretion, leaning repurpose | |

**User's choice:** one resolved entity · confirmed+candidate (flagged) · repurpose entity_instances
**Notes:** On the store choice the user asked to understand the tradeoff first ("help me
understand this better"). Explained that `entity_instances` was built as an *external Nauta
mirror* keyed by a NOT-NULL/unique `nauta_id`, but is empty; email-extracted entities have no
`nauta_id`. After the candidate-links-FK + existing-indexes + exact-column-fit argument, user
chose repurpose. → D-03/D-04.

---

## Resolution & matching

| Option | Description | Selected |
|--------|-------------|----------|
| Confidence-banded + review | high→auto-link, middle→review, low→new | |
| Binary auto/new | single threshold auto-link else new | |
| Suggest-only (never auto) | every match a human-confirmed suggestion | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Identifiers (exact+fuzzy), then name | identifiers primary, semantic secondary | ✓ (refined → parallel+RRF) |
| Identifiers exact only | deterministic, under-merges typo'd IDs | |
| Name/semantic only | ignores the key numbers | |

| Option | Description | Selected |
|--------|-------------|----------|
| Prior extractions + backfill | resolve vs source='email_extracted' + re-runnable backfill | ✓ |
| Backfill / manual only | nothing on confirm | |
| Against Nauta mirror too (now) | pointless — mirror empty | |

**Then (architecture refinement after re-reading context folder):**

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel BlendedRAG + RRF | dense + lexical in parallel, RRF k=60 | ✓ |
| Sequential fallback | identifier→name chain, no RRF reinforcement | |

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm writes back learning | confirmed merge → alias (+ optional knowledge node) | ✓ |
| Link only, no learning | flywheel never spins | |

| Option | Description | Selected |
|--------|-------------|----------|
| Defer — RRF-only now | no reranker installed; future enhancement | ✓ |
| Include reranker now | new model/dependency, scope expansion | |

**User's choice:** suggest-only never auto · parallel BlendedRAG+RRF(k=60) · prior extractions +
backfill · confirm writes back aliases · reranker deferred
**Notes:** Pivotal turn. User asked to re-read the whole `context/` folder, flagging the Nauta
design-case PDF and the "blended RAG / reciprocal ranked fusion" memory. Re-reading confirmed:
(1) design-case §3/§4 mandate fuzzy identifier matching + human-in-the-loop ("being wrong is
expensive, route to reviewers"); (2) `context/6`+`context/4` document BlendedRAG + RRF(k=60) as
the house architecture, specifically argued for logistics entity resolution (BM25 beats dense on
IDs; +580% recall hybrid). User's stated philosophy: "suggest as strongly as possible, but do not
decide — liability is the client's; the flywheel grows confidence so humans confirm more at a
time; whether we ever auto-confirm is unclear." User explicitly wants a defensible architecture
to argue in person. Corrected the Q2 read from sequential fallback → parallel+RRF. → D-05..D-13.

---

## Gallery UX (R3)

| Option | Description | Selected |
|--------|-------------|----------|
| Table default | dense/sortable; mosaic toggle | ✓ |
| Mosaic default | card grid first | |
| You decide | planner picks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full ops set | name/type/identifiers/#occurrences/last-seen/status/duplicates | ✓ |
| Minimal | name/type/count only | |
| You decide | planner picks field set | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full + review filter | type+status filter, pg_trgm search, sort, "needs review" triage | ✓ |
| Basic only | type filter + name search | |
| You decide | planner picks | |

**User's choice:** table default · full ops row set · full filters + review filter
**Notes:** Gallery doubles as the merge-suggestion triage surface (the suggest-only review
workload). Search kept Bedrock-free (pg_trgm). → D-14..D-17.

---

## Detail page (R4)

| Option | Description | Selected |
|--------|-------------|----------|
| Full set | occurrences + values + knowledge nodes + duplicate suggestions | ✓ |
| Occurrences + values only | leaner, drops flywheel context | |
| You decide | planner picks panels | |

| Option | Description | Selected |
|--------|-------------|----------|
| Show all + flag, human picks | every value w/ source+date+status, flag conflicts, no auto-canonical | ✓ |
| Show all + auto-canonical | system elects truth — contradicts suggest-only | |
| Latest value only | drops conflicting evidence | |

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm/reject + unmerge | confirm/reject suggestions + undo wrong merge; rename deferred | ✓ |
| + edit identity | also rename/edit identifiers inline | |
| Confirm/reject only | no unmerge — risky | |

**User's choice:** full relations · conflicting values shown+flagged (human picks) · confirm/reject + unmerge
**Notes:** Conflicting-value handling deliberately mirrors the suggest-only stance — the system
never elects a canonical value. Unmerge required because silent-corruption cost demands in-product
undo. → D-18..D-21.

---

## Claude's Discretion

`source` enum-vs-text; entity_instances unique-constraint reshape; is_identifier jsonb→column
promotion; RRF k/weighting/top-N; byId join shape; occurrence recompute on supersede; backfill
command form/idempotency; gallery index columns; mosaic layout; empty-state copy; whether
confirm-merge writes a knowledge node now; display-name derivation.

## Deferred Ideas

Auto-confirm / system-decided merges; cross-encoder reranker after RRF; Nauta→Supabase entity
sync (`source='nauta_sync'` + reconcile against real Nauta records); rename/edit identifiers &
aliases on detail; knowledge-node graph (R6 → Phase 11); negative learning from rejected merges;
bulk cross-entity merge.
