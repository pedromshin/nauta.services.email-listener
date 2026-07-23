"use client";

/**
 * use-email-preview.ts — data + slide model for the inbox inline preview.
 *
 * One `emails.detail` query (the SAME cheap, bounded query the hover
 * prefetch already warms — 3 queries server-side, no bytes) drives the
 * whole carousel:
 *   - slide 0 is ALWAYS the email body;
 *   - each attachment follows: a PDF contributes one slide per page (page
 *     count learned lazily from react-pdf's onLoadSuccess and reported back
 *     via `onDocumentLoad` — until then the PDF shows as a single page-1
 *     slide), an image contributes one <img> slide, anything else a
 *     download-card slide.
 *
 * staleTime 60s: selecting back and forth between rows re-renders from
 * cache instead of refetching a row the user just read.
 */

import { useCallback, useMemo, useState } from "react";

import { api } from "~/trpc/react";

import type { ComponentRole } from "~/components/regions/region-overlay-box";

/** The component projection the preview overlays need (emails.detail row). */
export interface EmailPreviewComponent {
  readonly id: string;
  readonly attachmentId: string | null;
  readonly sourceType: string;
  readonly contentText: string | null;
  readonly extractionStatus: string;
  readonly location: unknown;
  readonly entityTypeLabel: string | null;
  readonly entityTypeSlug: string | null;
  readonly extractedFields: unknown;
  readonly confidenceScore: unknown;
  readonly role?: ComponentRole;
  readonly parentComponentId?: string | null;
}

export type PreviewSlide =
  | { readonly kind: "body"; readonly key: string; readonly label: string }
  | {
      readonly kind: "pdf-page";
      readonly key: string;
      readonly label: string;
      readonly attachmentId: string;
      readonly filename: string;
      readonly contentType: string | null;
      /** 1-based page number. */
      readonly pageNumber: number;
    }
  | {
      readonly kind: "image" | "download";
      readonly key: string;
      readonly label: string;
      readonly attachmentId: string;
      readonly filename: string;
      readonly contentType: string | null;
    };

interface UseEmailPreviewResult {
  /** The detail payload for THIS email id (never a stale other-email row). */
  readonly data: {
    readonly email: {
      readonly id: string;
      readonly subject: string | null;
      readonly bodyText: string | null;
      readonly bodyHtml: string | null;
    };
    readonly attachments: ReadonlyArray<{
      readonly id: string;
      readonly filename: string;
      readonly contentType: string | null;
    }>;
    readonly components: ReadonlyArray<EmailPreviewComponent>;
  } | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly slides: ReadonlyArray<PreviewSlide>;
  /** Feed react-pdf's numPages back so a PDF expands to per-page slides. */
  readonly onDocumentLoad: (attachmentId: string, numPages: number) => void;
}

const BODY_SLIDE: PreviewSlide = { kind: "body", key: "body", label: "Body" };

export function useEmailPreview(emailId: string | null): UseEmailPreviewResult {
  const detailQuery = api.emails.detail.useQuery(
    // The empty-string id is never sent — `enabled` gates the fetch; it only
    // keeps the input shape valid for the disabled query's cache key.
    { id: emailId ?? "" },
    { enabled: emailId !== null, staleTime: 60_000 },
  );

  // Identity guard: only surface the payload when it is THIS email's row
  // (belt-and-braces against any cache-key mismatch surfacing another row).
  const raw = detailQuery.data;
  const data =
    emailId !== null && raw != null && raw.email.id === emailId
      ? (raw as unknown as NonNullable<UseEmailPreviewResult["data"]>)
      : null;

  // Per-attachment PDF page counts, learned lazily from onLoadSuccess.
  // Attachment ids are globally unique, so no reset on email change needed.
  const [pdfPageCounts, setPdfPageCounts] = useState<Record<string, number>>(
    {},
  );
  const onDocumentLoad = useCallback(
    (attachmentId: string, numPages: number) => {
      setPdfPageCounts((prev) =>
        prev[attachmentId] === numPages
          ? prev
          : { ...prev, [attachmentId]: numPages },
      );
    },
    [],
  );

  const slides = useMemo<ReadonlyArray<PreviewSlide>>(() => {
    const out: PreviewSlide[] = [BODY_SLIDE];
    for (const att of data?.attachments ?? []) {
      const filename = att.filename || "attachment";
      const contentType = att.contentType ?? null;
      if (contentType === "application/pdf") {
        const pageCount = pdfPageCounts[att.id] ?? 1;
        for (let page = 1; page <= pageCount; page++) {
          out.push({
            kind: "pdf-page",
            key: `${att.id}:${page}`,
            label: pageCount > 1 ? `${filename} · page ${page}` : filename,
            attachmentId: att.id,
            filename,
            contentType,
            pageNumber: page,
          });
        }
      } else if (contentType?.startsWith("image/")) {
        out.push({
          kind: "image",
          key: att.id,
          label: filename,
          attachmentId: att.id,
          filename,
          contentType,
        });
      } else {
        out.push({
          kind: "download",
          key: att.id,
          label: filename,
          attachmentId: att.id,
          filename,
          contentType,
        });
      }
    }
    return out;
  }, [data, pdfPageCounts]);

  return {
    data,
    isLoading: emailId !== null && detailQuery.isLoading,
    isError: emailId !== null && detailQuery.isError,
    slides,
    onDocumentLoad,
  };
}
