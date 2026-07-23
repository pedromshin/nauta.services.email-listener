"use client";

/**
 * email-body-pane.tsx — the email BODY as a first-class document in the canvas
 * zone (fixes "body-only emails show nothing to read").
 *
 * The detail canvas was attachment-only: an email ingested with no attachment
 * bytes (e.g. Gmail-forwarded, body-only) auto-opened nothing, so the canvas
 * fell through to "No document open" and the message text — which IS the whole
 * email — was unreachable. This pane renders that body, filling the canvas.
 *
 * Safety: HTML is DOMPurify-sanitized AFTER client hydration (mirrors
 * body-card.tsx / T-05-10, CR-01) — the raw string is never written to the DOM.
 * Until the sanitized output is ready for an HTML-only email we show a quiet
 * loading state rather than flashing "no body".
 *
 * DESIGN LAW: the message is the user's own words → serif + data-evidence
 * (law 2, the pair). Chrome stays in the ink/faded washes.
 */

import DOMPurify from "dompurify";
import { useEffect, useState } from "react";

interface EmailBodyPaneProps {
  bodyText: string | null;
  bodyHtml: string | null;
}

function hasText(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

export function EmailBodyPane({ bodyText, bodyHtml }: EmailBodyPaneProps) {
  const [safeHtml, setSafeHtml] = useState<string | null>(null);

  useEffect(() => {
    if (hasText(bodyHtml)) {
      setSafeHtml(DOMPurify.sanitize(bodyHtml));
    } else {
      setSafeHtml(null);
    }
  }, [bodyHtml]);

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
      <div className="mx-auto max-w-prose">
        {showHtml ? (
          <div
            role="region"
            aria-label="Message"
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
            data-evidence
            className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-ink"
          >
            {bodyText}
          </pre>
        )}
      </div>
    </div>
  );
}
