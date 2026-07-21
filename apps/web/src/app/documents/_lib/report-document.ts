/**
 * apps/web/src/app/documents/_lib/report-document.ts
 *
 * DOCS-01 (Phase 70 floor) — the DOCUMENT domain model + a store-agnostic
 * loader seam.
 *
 * The negative-space plan of record (Phase 70, acceptance 1): "PDF export is
 * typeset on the locked identity; a human reads the PDF (not the HTML) and it
 * is not a screenshot of a web page." That requires a real document MODEL —
 * a structured report/message, not an opaque HTML blob — so the typeset print
 * route (../[id]/print) and the export handler (../../api/documents/[id]/pdf)
 * both consume the SAME shape.
 *
 * ## The provenance-mark contract (DOCS-01: "provenance marks preserved")
 *
 * Every inline claim in a report body carries its tier as DATA
 * ({@link ProvSpan.tier}), never as ad-hoc styling. The renderer maps a
 * `confirmed` span to the locked `pmark pmark-confirmed` utility and a
 * `suggested` span to `pmark pmark-suggested` (globals.css "SIGNATURE
 * ELEMENT" — solid border = a human verified it, dashed border =
 * machine-inferred). Because the mark is data on the model, the PDF, the
 * on-screen HTML, and any future regenerate-from-spec (INV-7 / Phase 70
 * acceptance 3) all reproduce identical provenance with zero divergence.
 *
 * ## The store seam (INV-7 / DOCS-02)
 *
 * {@link loadReportDocument} is deliberately a lookup, not a query. Phase 70's
 * FLOOR ships the typeset-PDF PIPELINE; the first-class document STORE
 * (documents list, re-open, owner-scoped rows — DOCS-02/DOCS-03) is a later
 * slice that swaps the in-module registry below for a DB-backed, ownership-
 * gated read (mirroring the `assertImporterOwnership` pattern the attachments
 * route already uses). Keeping the loader a single async function means that
 * swap is an implementation change here, never a change at either consumer.
 */

/** A provenance tier — the two marks the locked "signature element" defines. */
export type ProvenanceTier = "confirmed" | "suggested";

/**
 * A provenance-marked inline span. Renders as the locked `pmark` utility so a
 * cited value inside a report body reads with the SAME mark language as an
 * entity chip or a cited span in a chat answer (globals.css §"SIGNATURE
 * ELEMENT"). `source` is the optional human-readable origin shown on hover /
 * in a future citation panel (Phase 70 acceptance 2's 3-tier disclosure).
 */
export interface ProvSpan {
  readonly text: string;
  readonly tier: ProvenanceTier;
  readonly source?: string;
}

/**
 * One run of body text: either a plain string (chrome-free prose) or a
 * provenance-marked span. A paragraph/evidence block is an ordered list of
 * these, so marks sit INLINE inside sentences exactly where the claim is made.
 */
export type Inline = string | ProvSpan;

/** A heading inside the document body (levels 1–3; the doc title is separate). */
export interface HeadingBlock {
  readonly kind: "heading";
  readonly level: 1 | 2 | 3;
  readonly text: string;
}

/** A paragraph of the report body — serif evidence prose with inline marks. */
export interface ParagraphBlock {
  readonly kind: "paragraph";
  readonly runs: readonly Inline[];
}

/**
 * A pulled-out evidence quotation (e.g. a verbatim excerpt a claim rests on).
 * Rendered as a serif blockquote with a hairline rule — the reading register.
 */
export interface EvidenceBlock {
  readonly kind: "evidence";
  readonly runs: readonly Inline[];
  /** Optional attribution line (source/citation), shown in sans chrome. */
  readonly cite?: string;
}

/** A bulleted or numbered list; each item is itself a run of inlines. */
export interface ListBlock {
  readonly kind: "list";
  readonly ordered: boolean;
  readonly items: readonly (readonly Inline[])[];
}

/** The closed set of body blocks a typeset report can contain. */
export type ReportBlock =
  | HeadingBlock
  | ParagraphBlock
  | EvidenceBlock
  | ListBlock;

/**
 * A report/message ready to be typeset. This is the unit DOCS-01 exports: a
 * titled, dated, provenance-bearing document — NOT a web page. `source`
 * describes where the document was synthesised from (a research run, a mail
 * thread) and appears in the running header/footer as chrome.
 */
export interface ReportDocument {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  /** ISO-8601 timestamp the document was generated/last regenerated. */
  readonly generatedAt: string;
  /** Human-readable provenance of the whole document (shown as chrome). */
  readonly source?: string;
  readonly blocks: readonly ReportBlock[];
}

/**
 * The FLOOR's built-in document. It exists so the whole typeset-PDF path is
 * demonstrably end-to-end on a real, provenance-bearing report the moment this
 * slice lands — before the DB-backed store (DOCS-02) exists. It doubles as the
 * fixture a rendered-geometry test drives (MEMORY: measure is verified on the
 * rendered PNG, never from source — jsdom does no layout).
 */
export const SAMPLE_REPORT_DOCUMENT: ReportDocument = {
  id: "sample",
  title: "Q2 Supplier Exposure — Synthesised Report",
  subtitle: "Assembled from 14 inbound documents across 3 suppliers",
  generatedAt: "2026-07-20T09:00:00.000Z",
  source: "Research run · thread “Q2 logistics reconciliation”",
  blocks: [
    {
      kind: "paragraph",
      runs: [
        "Across the quarter, invoiced freight from ",
        { text: "Meridian Forwarding", tier: "confirmed", source: "Invoice #MF-4471 (verified)" },
        " rose against contract, while ",
        { text: "an estimated 11% of line items", tier: "suggested", source: "inferred from OCR totals" },
        " could not be reconciled to a purchase order. The confirmed figures below rest on human-verified documents; suggested figures are machine-inferred and await a second look.",
      ],
    },
    {
      kind: "heading",
      level: 2,
      text: "Confirmed exposure",
    },
    {
      kind: "paragraph",
      runs: [
        "Total verified over-billing for the quarter is ",
        { text: "$48,220.14", tier: "confirmed", source: "reconciled against 6 invoices" },
        ", concentrated in two shipments cleared in June.",
      ],
    },
    {
      kind: "evidence",
      runs: [
        "“Fuel surcharge applied at 18.5% versus the 12% ceiling in Schedule B.”",
      ],
      cite: "Meridian Forwarding — Invoice #MF-4471, line 7",
    },
    {
      kind: "heading",
      level: 2,
      text: "Open questions",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        [
          { text: "Three demurrage charges", tier: "suggested", source: "inferred from arrival dates" },
          " lack a matching gate-out record and may be duplicates.",
        ],
        [
          "The ",
          { text: "Q2 rebate of $6,900", tier: "confirmed", source: "credit memo CM-208" },
          " has been received and applied.",
        ],
      ],
    },
  ],
};

/**
 * Resolve a report document by id — the store seam (see file header). Returns
 * `null` for an unknown id so the print route can `notFound()` and the export
 * handler can 404, fail-closed, with no existence oracle.
 *
 * DOCS-02 replaces the in-module registry with an owner-scoped DB read; every
 * caller keeps calling exactly this signature.
 */
const registry: ReadonlyMap<string, ReportDocument> = new Map([
  [SAMPLE_REPORT_DOCUMENT.id, SAMPLE_REPORT_DOCUMENT],
]);

export async function loadReportDocument(
  id: string,
): Promise<ReportDocument | null> {
  return registry.get(id) ?? null;
}
