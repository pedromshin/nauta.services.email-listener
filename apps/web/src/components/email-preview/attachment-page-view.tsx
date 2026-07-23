"use client";

/**
 * attachment-page-view.tsx — ONE read-only attachment slide for the inbox
 * preview carousel.
 *
 * PDF: a react-pdf Document/Page rendered at fit-width (container width via
 * ResizeObserver), with the shared display-only `OverlayLayer` on top so the
 * regions the pipeline found are visible right in the inbox — no navigation
 * to the editor needed to SEE what was detected (editing still lives on
 * /emails/[id]).
 *
 * Non-PDF: image content types render an <img> from the signed URL; any
 * other format renders a flat filename + download card (hairline border,
 * --bright surface, no shadow — design law).
 *
 * This file is the react-pdf-bearing module: it must ONLY ever be imported
 * via next/dynamic (ssr: false) from preview-carousel.tsx, so pdfjs never
 * loads with the inbox shell and never runs on the server.
 *
 * Signed URLs are fetched lazily PER SLIDE via useSignedAttachmentUrl — a
 * slide that never becomes near-active never spends a request.
 */

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { Skeleton } from "@polytoken/ui/skeleton";

import { OverlayLayer } from "~/components/regions/overlay-layer";
import { useSignedAttachmentUrl } from "~/hooks/use-signed-attachment-url";

import type { EmailPreviewComponent } from "./use-email-preview";

interface AttachmentPageViewProps {
  readonly attachmentId: string;
  readonly filename: string;
  readonly contentType: string | null;
  /** 1-based PDF page number; ignored for images/downloads. */
  readonly pageNumber: number;
  /** All of the email's components — filtered to this attachment here. */
  readonly components?: ReadonlyArray<EmailPreviewComponent>;
  /** Reports the PDF's page count so the carousel can grow per-page slides. */
  readonly onDocumentLoad?: (attachmentId: string, numPages: number) => void;
}

const noop = (): void => undefined;

export function AttachmentPageView({
  attachmentId,
  filename,
  contentType,
  pageNumber,
  components = [],
  onDocumentLoad,
}: AttachmentPageViewProps) {
  const signedUrl = useSignedAttachmentUrl(attachmentId);

  // Initialize pdfjs worker inside useEffect so import.meta.url resolves
  // to a browser URL rather than a file:// SSR path (IN-03 — mirrors
  // pdf-preview-pane.tsx).
  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }, []);

  // Fit-width: measure the slide's available width and hand it to <Page>.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (el === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) setContainerWidth(width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Rendered page size (at the fitted width) — the overlay's coordinate frame.
  const [pageSize, setPageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loadError, setLoadError] = useState(false);

  const isPdf = contentType === "application/pdf";
  const isImage = contentType?.startsWith("image/") ?? false;

  // ---- Image slide ----
  if (isImage) {
    return (
      <div className="flex h-full items-start justify-center overflow-auto p-panel">
        {signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Storage URL; next/image cannot optimize it
          <img
            src={signedUrl}
            alt={filename}
            className="max-w-full rounded-sm border border-hair"
          />
        ) : (
          <Skeleton className="h-64 w-full rounded-md" />
        )}
      </div>
    );
  }

  // ---- Download-card slide (formats we don't render inline) ----
  if (!isPdf) {
    return (
      <div className="flex h-full items-center justify-center p-panel">
        <div
          data-field="download-card"
          className="w-full max-w-sm rounded-md border border-hair bg-bright p-panel text-center"
        >
          <p
            data-evidence
            className="truncate font-serif text-sm text-ink"
            title={filename}
          >
            {filename}
          </p>
          <p className="mt-1 text-xs text-faded">
            {contentType ?? "Unknown format"} — no inline preview
          </p>
          {signedUrl ? (
            <a
              href={signedUrl}
              download={filename}
              className="mt-3 inline-block text-xs font-semibold text-ink underline underline-offset-2"
            >
              Download
            </a>
          ) : (
            <p className="mt-3 text-xs text-pencil">Preparing download…</p>
          )}
        </div>
      </div>
    );
  }

  // ---- PDF page slide ----
  if (!signedUrl) {
    return (
      <div className="p-panel">
        <Skeleton className="h-96 w-full rounded-md" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-panel text-center text-sm text-faded">
        Couldn&rsquo;t render this document. Open the editor to try again.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto p-panel">
      <div
        className="relative mx-auto w-fit"
        aria-label={`${filename}, page ${pageNumber}`}
      >
        <Document
          file={signedUrl}
          onLoadSuccess={({ numPages }: { numPages: number }) =>
            onDocumentLoad?.(attachmentId, numPages)
          }
          onLoadError={() => setLoadError(true)}
          loading={<Skeleton className="h-96 w-full rounded-md" />}
        >
          <Page
            pageNumber={pageNumber}
            width={containerWidth ?? undefined}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            onRenderSuccess={({
              width,
              height,
            }: {
              width: number;
              height: number;
            }) => setPageSize({ width, height })}
            loading={<Skeleton className="h-96 w-full rounded-md" />}
          />
        </Document>

        {/* Display-only overlay — the regions found on THIS attachment page.
            Read-only: no active id, no selection handlers, no draw. */}
        <OverlayLayer
          components={components.filter(
            (c) => c.attachmentId === attachmentId,
          )}
          currentPage={pageNumber}
          pageSize={pageSize}
          activeComponentId={null}
          setActiveComponentId={noop}
        />
      </div>
    </div>
  );
}
