"use client";

/**
 * body-view.tsx — the email BODY as a first-class document (moved from
 * apps/web/src/app/emails/[id]/_components/email-body-pane.tsx so the inbox
 * preview carousel and the editor render the message through ONE component).
 *
 * The detail canvas was attachment-only: an email ingested with no attachment
 * bytes (e.g. Gmail-forwarded, body-only) auto-opened nothing, so the canvas
 * fell through to "No document open" and the message text — which IS the whole
 * email — was unreachable. This view renders that body, filling its container.
 *
 * Safety: HTML is DOMPurify-sanitized AFTER client hydration (mirrors the
 * original email-body-pane / T-05-10, CR-01) — the raw string is never written
 * to the DOM. Until the sanitized output is ready for an HTML-only email we
 * show a quiet loading state rather than flashing "no body".
 *
 * OPTIONAL overlay capability: when a `components` prop is passed, the prose
 * container is measured via ResizeObserver and a DISPLAY-ONLY `OverlayLayer`
 * renders the email_body-sourced region components (attachmentId null,
 * page_index 0) over it — the same region-mark language the PDF pages carry,
 * with no selection or edit affordances. Without the prop, behavior is
 * byte-identical to the original pane.
 *
 * DESIGN LAW: the message is the user's own words → serif + data-evidence
 * (law 2, the pair). Chrome stays in the ink/faded washes.
 */

import DOMPurify from "dompurify";
// Explicit React import — vitest's esbuild transform needs `React` in scope
// when a test mounts this component directly (see inbox-three-pane.tsx note).
import * as React from "react";
import { useEffect, useRef, useState } from "react";

import { OverlayLayer } from "~/components/regions/overlay-layer";

import type { ComponentRole } from "~/components/regions/region-overlay-box";

/** The subset of an emails.detail component row the overlay needs. */
export interface BodyViewRegionComponent {
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

interface EmailBodyViewProps {
  bodyText: string | null;
  bodyHtml: string | null;
  /**
   * OPTIONAL overlay capability: region components for this email. The view
   * filters to email_body-sourced ones (attachmentId === null) and renders
   * them display-only over the measured prose container. Omit the prop for
   * the plain (editor canvas fallback) rendering.
   */
  components?: ReadonlyArray<BodyViewRegionComponent>;
}

function hasText(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

const noop = (): void => undefined;

export function EmailBodyView({
  bodyText,
  bodyHtml,
  components,
}: EmailBodyViewProps) {
  const [safeHtml, setSafeHtml] = useState<string | null>(null);

  useEffect(() => {
    if (hasText(bodyHtml)) {
      setSafeHtml(DOMPurify.sanitize(bodyHtml));
    } else {
      setSafeHtml(null);
    }
  }, [bodyHtml]);

  // ---- OPTIONAL display-only overlay (email_body-sourced regions) ----
  const bodyComponents =
    components?.filter((c) => c.attachmentId === null) ?? [];
  const hasOverlay = components !== undefined && bodyComponents.length > 0;

  const measureRef = useRef<HTMLDivElement | null>(null);
  const [overlaySize, setOverlaySize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!hasOverlay) return;
    const el = measureRef.current;
    // jsdom has no ResizeObserver (and does no layout anyway) — the overlay
    // simply never measures there, and OverlayLayer renders null on a null
    // pageSize. Real browsers measure and render.
    if (el === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setOverlaySize({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasOverlay]);

  const rawHtml = hasText(bodyHtml);
  const rawText = hasText(bodyText);

  // Nothing to show — neither a body nor (per the caller) an attachment.
  if (!rawHtml && !rawText) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-faded">
        This email has no readable body or attachments.
      </div>
    );
  }

  const showHtml = hasText(safeHtml);
  // HTML-only email whose sanitized output is still pending: hold the frame
  // rather than flashing the empty state on the first paint.
  const sanitizing = rawHtml && !rawText && !showHtml;

  return (
    <div className="h-full overflow-auto p-panel">
      <div ref={measureRef} className="relative mx-auto max-w-prose">
        {showHtml ? (
          <div
            role="region"
            aria-label="Message"
            data-field="body"
            data-evidence
            className="prose prose-sm max-w-none font-serif text-ink [&_a]:text-ink [&_a]:underline"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: safeHtml is DOMPurify-sanitized after client hydration (T-05-10, CR-01)
            dangerouslySetInnerHTML={{ __html: safeHtml as string }}
          />
        ) : sanitizing ? (
          <p className="text-sm text-faded" aria-busy="true">
            Loading message…
          </p>
        ) : (
          <pre
            role="region"
            aria-label="Message"
            data-field="body"
            data-evidence
            className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-ink"
          >
            {bodyText}
          </pre>
        )}

        {/* Display-only region overlay: email_body-sourced components render
            at page_index 0 (currentPage 1). Read-only — no active id, no
            selection handlers. */}
        {hasOverlay && (
          <OverlayLayer
            components={[...bodyComponents]}
            currentPage={1}
            pageSize={overlaySize}
            activeComponentId={null}
            setActiveComponentId={noop}
          />
        )}
      </div>
    </div>
  );
}
