"use client";

/**
 * use-signed-attachment-url.ts — the signed-attachment-URL cache, extracted
 * verbatim from email-detail.tsx (WR-01/08) so the inbox preview carousel and
 * the editor share ONE fetch/cache/expiry behavior.
 *
 * Contract (unchanged from the inline original):
 *   - `fetch('/api/attachments/{id}')` returns `{ url }` — a signed Supabase
 *     Storage URL. Entries are cached per hook instance for 55 minutes
 *     (server signs for 60; the 5-minute margin absorbs clock skew and long
 *     page sessions).
 *   - Failures are silent — the download path surfaces its own errors.
 *   - Passing `null` fetches nothing and returns `undefined` (lazy by
 *     design: a slide that is not near-active never spends a request).
 */

import { useEffect, useRef, useState } from "react";

/** Signed URL entry with expiry tracking (WR-01). */
interface SignedUrlEntry {
  readonly url: string;
  readonly expiresAt: number;
}

type SignedUrlCache = Record<string, SignedUrlEntry>;

const SIGNED_URL_TTL_MS = 55 * 60 * 1000;

function getCachedUrl(cache: SignedUrlCache, id: string): string | undefined {
  const entry = cache[id];
  if (!entry) return undefined;
  return entry.expiresAt > Date.now() ? entry.url : undefined;
}

/**
 * Returns the signed URL for `attachmentId`, fetching it once per expiry
 * window. `undefined` while absent/expired/still-fetching or when
 * `attachmentId` is null.
 */
export function useSignedAttachmentUrl(
  attachmentId: string | null,
): string | undefined {
  const [cache, setCache] = useState<SignedUrlCache>({});
  const cacheRef = useRef<SignedUrlCache>({});
  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  // Fetch the signed URL for the requested attachment if absent/expired
  // (WR-01/08) — byte-for-byte the effect email-detail.tsx carried inline.
  useEffect(() => {
    if (!attachmentId) return;
    if (getCachedUrl(cacheRef.current, attachmentId)) return;
    let cancelled = false;
    async function fetchUrl() {
      try {
        const res = await fetch(`/api/attachments/${attachmentId}`);
        if (!res.ok) return;
        const json = (await res.json()) as { url?: string };
        if (!cancelled && json.url) {
          setCache((prev) => ({
            ...prev,
            [attachmentId as string]: {
              url: json.url as string,
              expiresAt: Date.now() + SIGNED_URL_TTL_MS,
            },
          }));
        }
      } catch {
        // Silently fail — the inbox/download path surfaces its own errors.
      }
    }
    void fetchUrl();
    return () => {
      cancelled = true;
    };
  }, [attachmentId]);

  return attachmentId ? getCachedUrl(cache, attachmentId) : undefined;
}
