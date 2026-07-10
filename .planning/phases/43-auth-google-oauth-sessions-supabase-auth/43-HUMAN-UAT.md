---
status: partial
phase: 43-auth-google-oauth-sessions-supabase-auth
source: [43-VERIFICATION.md]
started: 2026-07-10T01:15:00Z
updated: 2026-07-10T01:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live Google OAuth round-trip
expected: After completing GOOGLE-OAUTH-RUNBOOK.md (create Google Cloud OAuth client, set SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID/_SECRET, restart local Supabase), clicking "Continue with Google" on /login completes the PKCE flow via /auth/callback and lands signed-in on the app.
result: [pending]

### 2. Session persistence across refresh
expected: After signing in, a full browser refresh (and a new tab) keeps the session — no redirect to /login; middleware refreshes the token transparently.
result: [pending]

### 3. Sign-out loop end-to-end
expected: Sidebar sign-out button POSTs to /auth/signout, clears the session, and lands on /login; visiting any protected route afterward redirects back to /login.
result: [pending]

### 4. Playwright auth-redirect smoke spec
expected: Once Playwright is installed (deferred — milestone's one-new-dependency budget spent on @supabase/ssr), `apps/web/e2e/auth-redirect.spec.ts` passes: signed-out visit to / redirects to /login.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
