import type { Metadata } from "next";
import * as React from "react";

import { DocumentsList } from "./_components/documents-list";

export const metadata: Metadata = {
  title: "Documents — Polytoken",
  description:
    "Your synthesised documents: stored, re-openable, and regenerable from spec.",
};

/**
 * /documents route — server-component shell (Phase 70 — DOCS-02).
 *
 * Shell SHAPE from `files/page.tsx` (server component for metadata + the frame,
 * one "use client" surface below it) and its identity classes (`text-ink`,
 * `border-rule`, `bg-shelf`) — chrome is monochrome (law 1). NO HERO: a document
 * store is a registry; the characteristic thing on the page is the rows, so a
 * banner introducing the interface to someone who came to find a document is
 * noise (taste contract — the vault/registry precedent).
 *
 * `api.documents.list` is wired into root.ts, so the list surface reads it
 * directly through the app-wide tRPC provider — no temporary API-provider seam.
 */
export default function DocumentsPage(): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col bg-shelf">
      <div className="flex h-12 shrink-0 items-center border-b border-rule px-4">
        <h1 className="text-sm font-semibold text-ink">Documents</h1>
      </div>

      <div className="min-h-0 flex-1 p-4">
        <DocumentsList />
      </div>
    </main>
  );
}
