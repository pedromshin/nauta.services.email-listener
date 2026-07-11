---
status: partial
phase: 49-live-loop-gate-deploy-oauth-real-email
source: [49-VERIFICATION.md]
started: 2026-07-11T03:55:00Z
updated: 2026-07-11T03:55:00Z
---

## Current Test

[awaiting human testing — full runsheet: MORNING-CHECKLIST.md in this directory]

## Tests

### 1. OAuth gate — Google sign-in on the deployed app (LIVE-03)
expected: MORNING-CHECKLIST.md §A executed (console scopes, both redirect URIs, both dashboards, env vars); user signs in with real Google account at the deployed app; session persists across full reload; sign-out works; server-side check shows auth.identities gained a google row LINKED to the pre-created user (staging a829b79d-…, prod 179370cf-…) with NO duplicate user row
result: [pending]

### 2. Forwarding gate — SES apply + Gmail handshake + real message (LIVE-04)
expected: user reviews artifacts/forwarding-catchall-tfplan.txt (1 add/0 change/0 destroy) and runs `npm run infra:tf -- apply`; /settings/forwarding yields u-{token}@magnitudetech.com.br; Gmail verification code round-trips through the app inbox; a real forwarded message with attachment lands, threads group correctly, attachment stored (all confirmed by prod-DB queries, not logs)
result: [pending]

### 3. GitHub-rename decision (LIVE-07 final slice)
expected: user chooses Option 1 (rename + companion IAM terraform apply in the same sitting) or Option 2 (re-park, documented) — MORNING-CHECKLIST.md §C
result: [pending]

### 4. ECS deploy coverage-gate decision (LIVE-02 exception)
expected: user decides: approve documented ratchet of --cov-fail-under (80 → 65 with step-ups tracked in .planning/todos) or hold ECS image deploys until coverage recovers; lowering it was policy-denied for the autonomous run
result: [pending]

### 5. Hosted DB password refresh (housekeeping)
expected: .env.staging/.env.production POSTGRES_URL_NON_POOLING passwords refreshed from Supabase Dashboard → Database Settings; ten verify-00XX-live.ts scripts pass natively per host
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
