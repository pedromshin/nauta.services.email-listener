"use client";

/**
 * apps/web/src/app/login/_components/google-signin-button.tsx — the single
 * sign-in affordance on /login (Phase 43 Plan 02, AUTH-01). Google-only per
 * the locked CONTEXT decision: no email/password, no magic link input.
 * Reads the inbound `redirectTo` query param (set by the middleware's
 * route-guard redirect) and forwards it as the callback's `next` param —
 * both hops are validated through `safeNextPath` (T-43-P2-01).
 */

import { useSearchParams } from "next/navigation";

import { Button } from "@polytoken/ui/button";

import { safeNextPath } from "~/lib/auth/redirect";
import { createClient } from "~/lib/supabase/client";

export function GoogleSigninButton(): React.ReactElement {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("redirectTo"));

  const handleSignIn = async (): Promise<void> => {
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", nextPath);

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });
  };

  return (
    <Button type="button" className="w-full" onClick={handleSignIn}>
      Continue with Google
    </Button>
  );
}
