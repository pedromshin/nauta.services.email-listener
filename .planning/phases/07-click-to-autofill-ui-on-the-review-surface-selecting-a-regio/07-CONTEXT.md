# Phase 7: Click-to-autofill UI on the review surface - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous run; defaults from Phase 4 backend contracts, Phase 5/6 UI architecture, mission brief)

<domain>
## Phase Boundary

Close the learning-flywheel loop from the browser: selecting a region component
triggers AI autofill, shows candidate extracted fields with per-field confidence,
and lets the human confirm with optional corrections.

1. **Autofill flow:** region (status `candidate`) → "Autofill Fields" action →
   entity-type picker → POST /v1/components/{id}/autofill (backend shipped 04-07/08)
   → candidate `extracted_fields` + `confidence_score` + `confidence_breakdown`
   rendered in a fields panel.
2. **Confirm flow:** editable field values (corrections) → POST /v1/components/{id}/confirm
   with `corrected_fields` → status confirmed; component becomes a few-shot example
   (D-15). UI reflects confirmed state.
3. **Process/reprocess controls** on the email detail page (deferred from Phase 5):
   POST /v1/emails/{id}/reprocess via proxy with confirmation dialog (supersedes
   prior extractions, D-16 — copy must say so).

Out of scope: key_terms extraction (Phase 8), region geometry edits (done, Phase 6).
</domain>

<decisions>
## Implementation Decisions

- **Reuse the Phase 6 proxy pattern exactly:** tRPC mutations in
  packages/api-client (server-side fetch to FastAPI with EMAIL_LISTENER_URL +
  EMAIL_LISTENER_API_KEY via the existing getListenerConfig). New mutations:
  `autofillComponent` ({componentId, entityTypeSlug}), `confirmComponent`
  ({componentId, correctedFields?}), `reprocessEmail` ({emailId}).
- **Entity-type picker needs data:** add tRPC query `entityTypes.list` (Drizzle
  read on entity_types, is_active=true, system defaults importer_id IS NULL plus
  any importer-scoped rows; expose slug, label, description, fields with labels/
  data_type/is_required for the fields panel).
- **Fields panel UI:** when a region is selected and has an extraction record,
  show fields in the entities sidebar detail area (Sheet or expanding card —
  prefer inline expanding card under the selected region row, consistent with
  the existing list idiom). Candidate values rendered as inputs (editable =
  corrections); per-field confidence as a subtle percentage badge; overall
  confidence in the header. Confirm Fields button (primary) + Discard.
- **Status surfacing:** extraction record status chips (candidate / confirmed /
  superseded) per UI-SPEC token rules; confirmed fields render read-only with a
  "Confirmed" badge.
- **BEDROCK REALITY:** live autofill fails until the human submits the Bedrock
  use-case form (404 from the adapter — surfaced as 502/500 by FastAPI). The UI
  MUST: (a) toast a friendly "AI autofill is unavailable — model access is
  pending" on failure, (b) leave the region untouched, (c) remain fully testable
  via mocked tRPC in vitest and mocked FastAPI in Python endpoint tests. Note:
  commit 5d59b57 (IAM region wildcard) suggests unblocking is in progress —
  design for success path working without code changes once access lands.
- **Reprocess control:** button on the detail page header (destructive-adjacent,
  outline variant) with AlertDialog: "Reprocess this email?" explaining prior
  extractions are superseded, never deleted (D-16). On success: invalidate
  emails.detail; toast.
- **detail.ts exposure check:** ensure emails.detail returns extracted_fields,
  corrected_fields, confidence_score, confidence_breakdown, status, entity type
  slug/label for each component's active extraction record (extend the select if
  missing — CR-03's superseded filter already applies).
- **Tests:** vitest for new tRPC routers (mock fetch/db per Phase 6 idiom) +
  fields-panel state helpers; Python: none required (backend shipped) unless the
  proxy surfaces a missing endpoint gap; gates: tsc + vitest + next build.
</decisions>

<code_context>
## Existing Code Insights

- POST /v1/components/{id}/autofill + /confirm: apps/email-listener/app/presentation/api/v1/components.py
  (request: {entity_type_slug} / {corrected_fields?}; ValueError → 404; D-18
  tenant from component row — Phase 4 gap closure).
- AutofillResultView: extracted_fields, confidence_score, confidence_breakdown.
- Phase 6 artifacts (once merged): packages/api-client/src/router/emails/mutations.ts
  (getListenerConfig proxy idiom), use-region-edit hook, action-toolbar (add the
  Autofill action there for candidate regions), sonner toasts, AlertDialog idiom.
- packages/db/src/schema/entity-types.ts — EntityTypes + EntityTypeFields tables.
- packages/api-client/src/router/emails/detail.ts — extraction record join.
</code_context>

<specifics>
## Specific Ideas

- Autofill button only enabled for regions with status candidate (accepted) —
  pending regions prompt "Accept the region first" tooltip.
- Keep per-field confidence rendering simple: text-xs muted percentage; red-ish
  (destructive token) below 0.5.
- Loading state on autofill: spinner in the fields panel + disabled actions
  (LLM call latency seconds-scale).
</specifics>

<deferred>
## Deferred Ideas

- key_terms extractor (Phase 8).
- Entity-instance matching UI (nauta_id display) — backend match_type exists in
  research §8 but no backend implementation yet; defer.
- Bulk autofill (all regions at once); auto_confirmed routing rules.
</deferred>
