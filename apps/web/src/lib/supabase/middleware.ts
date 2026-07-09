/**
 * apps/web/src/lib/supabase/middleware.ts — session-refresh helper for
 * Next.js middleware (Phase 43 Plan 01, T-43-P1-03).
 *
 * This helper ONLY refreshes the Supabase session (rewriting refreshed
 * auth cookies onto both the incoming request and the outgoing response,
 * the canonical @supabase/ssr middleware pattern) and reports the
 * server-verified user via `getUser()`. It deliberately contains NO
 * route-guard or redirect logic — Plan 02's `middleware.ts` consumes
 * `{ response, user }` to decide redirects (e.g. signed-out -> /login),
 * keeping "refresh the session" and "guard the route" as separate concerns.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import { env } from "~/lib/env";

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
