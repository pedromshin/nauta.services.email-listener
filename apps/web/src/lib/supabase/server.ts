/**
 * apps/web/src/lib/supabase/server.ts — server (cookie-bound) Supabase
 * client for use in Server Components, Route Handlers, and Server Actions
 * (Phase 43 Plan 01, T-43-P1-03).
 *
 * AUTHORIZATION CONTRACT: any code that needs to know "who is the current
 * user" for an authorization decision MUST call `supabase.auth.getUser()`,
 * NEVER `supabase.auth.getSession()` alone. `getSession()` reads the
 * session directly out of cookies without contacting the Supabase Auth
 * server — the user object it returns is an unverified cookie parse and is
 * attacker-influenceable (T-43-P1-03). `getUser()` revalidates the token
 * against the Auth server (or local JWKS) on every call and is the only
 * server-verified source of identity.
 *
 * `setAll` is wrapped in try/catch because Server Components cannot write
 * cookies — this is expected and safe as long as middleware.ts is refreshing
 * the session on every request (Plan 02 wires the middleware guard).
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "~/lib/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookies cannot be written
            // here. Safe to ignore as long as middleware.ts refreshes the
            // session on every request.
          }
        },
      },
    },
  );
}
