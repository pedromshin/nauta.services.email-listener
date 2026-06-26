/**
 * _listener-config.ts — shared server-side proxy helpers for every tRPC
 * mutation that calls the FastAPI email-listener service.
 *
 * Security contract (T-06-07 / T-07-01 / T-09-30): EMAIL_LISTENER_API_KEY is
 * read ONLY inside getListenerConfig(), which runs server-side at call time.
 * The key never appears in client-importable code and is never NEXT_PUBLIC_.
 *
 * T-06-10: env vars are read at call time (not module init) so the Next.js
 *          build succeeds without the env vars present.
 *
 * Extracted from emails/mutations.ts (Phase 9, 09-04) so the new component
 * mutations and the entity-type write mutations reuse one definition instead
 * of duplicating the env guard + error parser.
 */

// ---------------------------------------------------------------------------
// Server-side env guard — read at call time, not module init (T-06-10)
// ---------------------------------------------------------------------------

export function getListenerConfig(): { url: string; apiKey: string } {
  const url = process.env.EMAIL_LISTENER_URL;
  const apiKey = process.env.EMAIL_LISTENER_API_KEY;
  if (!url || !apiKey) {
    throw new Error(
      "EMAIL_LISTENER_URL or EMAIL_LISTENER_API_KEY is not configured",
    );
  }
  return { url, apiKey };
}

// ---------------------------------------------------------------------------
// Helper — parse error detail from a non-2xx FastAPI response
// ---------------------------------------------------------------------------

export async function parseErrorDetail(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    return body.detail ?? fallback;
  } catch {
    return fallback;
  }
}
