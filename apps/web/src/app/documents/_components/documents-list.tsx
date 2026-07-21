"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import * as React from "react";

import { Skeleton } from "@polytoken/ui/skeleton";

import { api } from "~/trpc/react";

/**
 * documents-list.tsx — the /documents list surface (Phase 70 — DOCS-02).
 *
 * Reads the owner-scoped `documents.list` tRPC procedure (scoped through
 * ownership.ts server-side — this client never sends a user id). Each row is a
 * single-click reopen: the whole row is the link to `/documents/[id]`
 * (interaction-economy — the primary action of the surface is reachable in one
 * click from arrival). Secondary actions (print / PDF) live on the detail
 * surface, not crowded into every row.
 *
 * The empty state TEACHES the next action (taste contract) rather than showing
 * a bare "no documents" — a document is synthesised from a research run or a
 * mail thread, so it points there.
 */

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : dateFmt.format(d);
}

export function DocumentsList(): React.ReactElement {
  const query = api.documents.list.useQuery();

  if (query.isPending) {
    return (
      <ul className="flex flex-col gap-2" aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-md border border-rule bg-bright px-4 py-3"
          >
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="ml-auto h-3 w-20" />
          </li>
        ))}
      </ul>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-md border border-rule bg-bright p-panel text-sm text-ink">
        <p className="font-medium">Couldn’t load your documents.</p>
        <p className="mt-1 text-muted-foreground">
          {query.error.message}. Try again in a moment.
        </p>
      </div>
    );
  }

  const items = query.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-md border border-rule bg-bright p-panel text-center">
        <FileText
          className="mx-auto h-6 w-6 text-ink"
          aria-hidden
          strokeWidth={1.5}
        />
        <p className="mt-3 text-sm font-medium text-ink">No documents yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Documents are synthesised from a research run or a mail thread. Ask
          for a report in{" "}
          <Link href="/chat" className="text-ink underline underline-offset-2">
            chat
          </Link>{" "}
          and it lands here — stored, re-openable, and regenerable.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((doc) => (
        <li key={doc.id}>
          <Link
            href={`/documents/${doc.id}`}
            className="group flex items-center gap-3 rounded-md border border-rule bg-bright px-4 py-3 transition-colors hover:border-ink"
          >
            <FileText
              className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-ink"
              aria-hidden
              strokeWidth={1.5}
            />
            <span
              className="min-w-0 flex-1 truncate font-serif text-sm text-ink"
              data-evidence
            >
              {doc.title}
            </span>
            <time
              className="tabular shrink-0 text-2xs text-muted-foreground"
              dateTime={
                doc.createdAt instanceof Date
                  ? doc.createdAt.toISOString()
                  : String(doc.createdAt)
              }
            >
              {formatDate(doc.createdAt)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
