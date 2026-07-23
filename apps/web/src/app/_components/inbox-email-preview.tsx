"use client";

/**
 * inbox-email-preview.tsx — the inline email preview pane (replaces the
 * text-only ReadingPreview and kills the inbox→editor two-step).
 *
 * The selected row now shows the WHOLE email in place: serif subject +
 * From/To meta (unchanged from ReadingPreview), the MAIL-01 rule-review slot
 * passed through UNCHANGED, then the PreviewCarousel — body first, then each
 * attachment page — with display-only region overlays. Editing still lives
 * on /emails/[id]; the footer link is the ONE remaining hop, for editing.
 *
 * Data: `useEmailPreview` runs the same cheap `emails.detail` query the row
 * hover already prefetches, so the carousel's critical path is usually a
 * cache hit. The header and body fall back to the emails.list projection the
 * parent already holds, so the pane paints instantly even on a cold cache.
 *
 * pdfjs never loads with the inbox shell: the react-pdf-bearing slide view
 * is next/dynamic'd (ssr: false) inside PreviewCarousel and only mounts when
 * an attachment slide becomes near-active.
 */

// Explicit React import — vitest's esbuild transform needs `React` in scope
// when a test mounts this component (see inbox-three-pane.tsx's note).
import * as React from "react";
import Link from "next/link";

import { PreviewCarousel } from "~/components/email-preview/preview-carousel";
import { useEmailPreview } from "~/components/email-preview/use-email-preview";

import type { InboxEmailItem } from "./inbox-three-pane";

interface InboxEmailPreviewProps {
  /** The emails.list projection the parent already resolved (instant paint). */
  readonly email: InboxEmailItem | null;
  /**
   * MAIL-01: the suggest-only rule-review panel for THIS email, rendered
   * between the meta line and the carousel — in-context during triage (HEY
   * Screener model), never a settings destination. Pre-built by the parent
   * so this pane stays presentational. Passed through UNCHANGED.
   */
  readonly ruleReview?: React.ReactNode;
}

export function InboxEmailPreview({
  email,
  ruleReview,
}: InboxEmailPreviewProps): React.ReactElement {
  const preview = useEmailPreview(email?.id ?? null);

  if (!email) {
    return (
      <div
        data-pane="reading"
        className="flex h-full flex-col items-center justify-center gap-2 bg-leaf p-12 text-center"
      >
        <p className="text-sm font-semibold text-ink">No email selected</p>
        <p className="text-sm text-faded">
          Select a message from the list to preview it here.
        </p>
      </div>
    );
  }

  const sender = email.senderName
    ? `${email.senderName} <${email.senderAddress}>`
    : email.senderAddress;

  const detailEmail = preview.data?.email ?? null;
  // Prefer the detail row (it carries bodyHtml); fall back to the list
  // projection's bodyText so the body slide paints before detail resolves.
  const bodyText = detailEmail?.bodyText ?? email.bodyText;
  const bodyHtml = detailEmail?.bodyHtml ?? null;

  return (
    <div
      data-pane="reading"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-leaf p-panel"
    >
      {/* .rp-head: the subject is the user's own material (law 2) — a serif
          h2, not muted chrome. */}
      <h2
        data-field="subject"
        data-evidence
        className="min-w-0 font-serif text-xl text-ink"
      >
        {email.subject ?? "(no subject)"}
      </h2>

      {/* .rp-meta: From/To are the user's material but they are metadata,
          not prose — sans, under a ruled boundary. */}
      <div className="mt-2.5 shrink-0 border-b border-hair pb-3.5 text-xs text-faded">
        From: {sender} · To: {email.toAddresses.join(", ") || "—"}
      </div>

      {ruleReview}

      {preview.isError ? (
        <div role="alert" className="mt-4 border border-rule p-panel text-center">
          <p className="text-sm font-semibold text-ink">
            Unable to load this email&rsquo;s preview.
          </p>
          <p className="mt-1 text-xs text-faded">
            Please try refreshing the page.
          </p>
        </div>
      ) : (
        <PreviewCarousel
          key={email.id}
          slides={preview.slides}
          bodyText={bodyText}
          bodyHtml={bodyHtml}
          components={preview.data?.components}
          onDocumentLoad={preview.onDocumentLoad}
        />
      )}

      {/* The one remaining hop — editing (regions, confirm/deny, reprocess)
          lives on the editor surface. */}
      <div className="mt-2 shrink-0 border-t border-hair pt-2.5">
        <Link
          href={`/emails/${email.id}`}
          className="text-xs font-semibold text-ink underline underline-offset-2"
        >
          Open in editor →
        </Link>
      </div>
    </div>
  );
}
