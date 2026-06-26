# Phase 4: Email Intelligence - Discussion Log

> **Audit trail only.** Not consumed by research/planning/execution agents.
> Decisions live in 04-CONTEXT.md.

**Date:** 2026-06-11
**Phase:** 04-email-intelligence
**Mode:** discuss (interactive, evolving scope)

## How the scope evolved

This discussion materially reshaped the phase. It began as STATE.md's one-liner
("Supabase schema + pipeline ingestion") and the research's sub-phase 4a
("decomposition + persistence, no LLM"). Through the conversation the user
expanded it into a region-selection + AI-autofill backend with robust PDF
processing. Key pivots, in order:

1. **Initial scope set:** Decomposition + persistence only; Supabase; discuss
   ingestion writer, worker topology, multi-tenancy.
2. **User redirect:** re-read the design case + research before locking the
   component-split / file-type questions.
3. **Test corpus surfaced:** user wants authentic logistics emails/attachments
   forwarded to agent@magnitudetech.com.br to test against real messiness.
   → Layered corpus, folded in as a Phase 4 deliverable.
4. **"No-LLM" rule waived:** follow full 04-RESEARCH.md including LLM segmentation.
5. **Depth-first redirect:** build ONE format (PDF) to full production robustness
   rather than shallow coverage of many. Scalable seam for the rest.
6. **Product model reframed:** PDF page can hold multiple/nested/junk entities;
   primary mechanism is human region-selection with AI-assisted autofill;
   confirmed values become future prefill context (S4–S6).
7. **Boundary confirmed:** auto-segment proposes + human overrides; backend +
   data model only (UI is next phase); extend email-listener service.
8. **UX detail captured:** inbox-like list → email detail with entity summary +
   process/reprocess buttons → attachment preview with entity overlay over the
   matching document region.
9. **Geometry settled by industry standard:** Textract/Document AI normalized
   polygon + text-anchor + per-region content + embedding.

## Decisions presented & selected

| Area | User selection |
|------|----------------|
| Phase scope | Decomposition + persistence only → later expanded to region/autofill backend |
| Persistence | Supabase (managed Postgres) |
| Component split | "No-LLM" waived → full research approach (LLM segmentation in) |
| File types | Depth-first: PDF only, full production robustness, scalable seam |
| PDF extraction | Adaptive text-layer + OCR fallback; handle screenshot/inline/table/nested/junk |
| Segmentation | Auto-propose + human override; region-selection is source of truth |
| Parser seam | Parser registry + Protocol interface |
| Mechanism | Both: auto-segment proposes, human overrides |
| UI in scope | Backend + data model only (UI next phase) |
| Placement | Extend email-listener service with new layers |
| Region geometry | Normalized polygon + text-anchor + per-region content + embedding (Textract/Document AI standard) |
| Cold-start autofill | Entity-type defaults: preset description + default KB + field schema |
| Confirmed context | Confirmed region = embedded few-shot child (S4–S6 hybrid retrieval) |
| Reprocessing | Versioned + supersede (immutable runs) |
| Account model | Map forwarding-sender → importer, no auth yet |
| Phase structure | One Phase 4, split into many plans |

## Research performed during discussion

- Read `context/0 - nauta_design_case.pdf` directly (7 hard problems; problem #1 file-type list).
- Re-read 04-RESEARCH.md §3.3 dispatch table, §11 sub-phase boundaries.
- Read `context/8 - architecture-intuition.md` (minimum working version, 3 core patterns).
- Searched test datasets: RVL-CDIP, DocLayNet, LogisticQA, format templates — found no
  public set covering multi-doc-PDF / zip / xlsm hard cases → layered + synthetic.
- Fetched S5 (Medium small-to-big) + S6 (RAGFlow) → child=region, parent=page/attachment/email.
- Searched document-AI overlay standard → normalized bbox/polygon + text-anchor
  (Textract / Document AI / Rossum convergent standard).

## Deferred (captured in CONTEXT.md)

Review UI, user auth, non-PDF formats, Nauta write-back, knowledge-node learning loop,
confidence auto-routing, generalized image OCR service.
