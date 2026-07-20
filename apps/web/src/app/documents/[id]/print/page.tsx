import { notFound } from "next/navigation";

import { loadReportDocument } from "../../_lib/report-document";
import { PrintChromeReset } from "./print-chrome-reset";
import { TypesetDocument } from "./typeset-document";

/**
 * apps/web/src/app/documents/[id]/print/page.tsx
 *
 * DOCS-01 — the PRINT ROUTE. A server component that loads a
 * {@link ReportDocument} by id and renders it typeset (serif evidence body,
 * 45–75ch measure, paper/ink palette, provenance marks preserved). This is the
 * page playwright navigates to and captures as a PDF
 * (../../../api/documents/[id]/pdf) — the PDF is a typeset document, not a
 * screenshot of the app, because PrintChromeReset + print.css strip the shell.
 *
 * `notFound()` on an unknown id: fail-closed, no existence oracle (matches the
 * attachments route's posture). The document STORE + ownership gate is DOCS-02
 * — see loadReportDocument's seam.
 *
 * Rendered dynamically: the doc read is per-request, not build-time.
 */
export const dynamic = "force-dynamic";

export default async function DocumentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await loadReportDocument(id);
  if (!doc) notFound();

  return (
    <>
      <PrintChromeReset />
      <TypesetDocument doc={doc} />
    </>
  );
}
