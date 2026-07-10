# Phase 43: User Setup Required

**Generated:** 2026-07-09
**Phase:** 43-auth-google-oauth-sessions-supabase-auth
**Status:** Incomplete

Complete these items for Google sign-in to function. Claude authored the full runbook,
the local Supabase config, and the env-var documentation — these items require human
access to the Google Cloud Console and the Supabase Dashboard, which Claude cannot
reach autonomously.

**Full step-by-step instructions:** see
[GOOGLE-OAUTH-RUNBOOK.md](./GOOGLE-OAUTH-RUNBOOK.md) in this same directory — this file
is the checklist; the runbook is the detail.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (local: `http://127.0.0.1:54321`; staging/prod: Dashboard → Project Settings → API → Project URL) | `.env.local` / `.env.staging` / `.env.production` |
| [ ] | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key (local: `npm run sb:status`; staging/prod: Dashboard → Project Settings → API) | `.env.local` / `.env.staging` / `.env.production` |
| [ ] | `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID | `.env.local` / `.env.staging` / `.env.production` |
| [ ] | `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` | Google Cloud Console → same OAuth client → client secret | `.env.local` / `.env.staging` / `.env.production` |

## Account Setup

- [ ] **Create a Google Cloud OAuth 2.0 Web application client**
  - URL: https://console.cloud.google.com/apis/credentials
  - Skip if: a client already exists for this app

## Dashboard Configuration

- [ ] **Register authorized redirect URIs on the Google OAuth client**
  - Location: Google Cloud Console → OAuth client → Authorized redirect URIs
  - Set to (all three): `http://127.0.0.1:54321/auth/v1/callback` (local),
    `https://fyfwkjvbcrmjqjysdyqw.supabase.co/auth/v1/callback` (staging),
    `https://dazyccjijdahxyciptkp.supabase.co/auth/v1/callback` (prod)
  - Notes: this is the Supabase-hosted callback, NOT the app's own `/auth/callback` route

- [ ] **Enable Google provider + paste client id/secret — staging project**
  - Location: Supabase Dashboard (`fyfwkjvbcrmjqjysdyqw`) → Authentication → Providers → Google

- [ ] **Enable Google provider + paste client id/secret — production project**
  - Location: Supabase Dashboard (`dazyccjijdahxyciptkp`) → Authentication → Providers → Google
  - Notes: done SEPARATELY from staging — settings do not carry over between projects

## Verification

After completing setup:

```bash
# Check local env vars are set (run from repo root)
grep -E "SUPABASE_AUTH_EXTERNAL_GOOGLE|NEXT_PUBLIC_SUPABASE" .env.local

# Restart local Supabase so config.toml + env changes are picked up
npm run sb:stop && npm run sb:start

# Verify the web app still builds with the real env vars present
npm run build -w @polytoken/web
```

Expected results:
- Local Supabase stack restarts cleanly with the Google provider enabled
- `npm run build` succeeds
- Manually visiting `/login` and clicking "Continue with Google" completes the OAuth
  round-trip and lands back on the app, signed in (full manual UAT — no automated
  check exists for the live provider without real Google credentials)

---

**Once all items complete:** Mark status as "Complete" at top of file.
