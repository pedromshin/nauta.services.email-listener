import type { Metadata } from "next";
import * as React from "react";

import { DocumentDetail } from "../_components/document-detail";

export const metadata: Metadata = {
  title: "Document — Polytoken",
  description: "Read a stored document, re-open it, or export it as a PDF.",
};

/**
 * /documents/[id] route — the DETAIL / RE-OPEN surface (Phase 70 — DOCS-02).
 *
 * A server-component shell (metadata + the id) over one "use client" detail
 * surface, mirroring the /files and /documents list shells. The detail surface
 * reads the owner-scoped `documents.byId` tRPC procedure (gated through
 * ownership.ts) and renders the stored spec, with one-click links out to the
 * typeset print route (../[id]/print) and the PDF export
 * (/api/documents/[id]/pdf) — building ON the Wave-1 pipeline, not duplicating
 * its typesetter.
 *
 * NOTE: this coexists with the sibling ../[id]/print/page.tsx subroute — Next's
 * App Router resolves `/documents/[id]` here and `/documents/[id]/print` there.
 */
export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <DocumentDetail id={id} />;
}
