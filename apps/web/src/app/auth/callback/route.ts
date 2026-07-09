/**
 * apps/web/src/app/auth/callback/route.ts — PKCE code exchange (Phase 43
 * Plan 02, AUTH-01). Both `code` and `next` return from the OAuth
 * provider/Supabase round-trip and are attacker-influenceable
 * (T-43-P2-01/T-43-P2-02): `next` is only ever consumed through
 * `safeNextPath`, and `exchangeCodeForSession` performs the PKCE
 * code_verifier check + session rotation server-side. A missing or failed
 * exchange redirects to /login without echoing the upstream error detail
 * (T-43-P2-06).
 */

import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "~/lib/auth/redirect";
import { createClient } from "~/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", request.url));
}
