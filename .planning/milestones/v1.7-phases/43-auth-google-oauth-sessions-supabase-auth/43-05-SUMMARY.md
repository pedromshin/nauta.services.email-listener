---
phase: 43-auth-google-oauth-sessions-supabase-auth
plan: 05
subsystem: auth
tags: [supabase, google-oauth, config-toml, runbook, playwright, env-vars]

# Dependency graph
requires:
  - phase: 43-02
    provides: "middleware.ts route guard + /login + /auth/callback + resolveAuthRedirect/safeNextPath — the code the runbook documents and the Playwright spec exercises"
provides:
  - "GOOGLE-OAUTH-RUNBOOK.md — user runbook for Google Cloud Console + per-environment Supabase provider config"
  - "supabase/config.toml [auth.external.google] — local provider block reading client id/secret from env(), plus the local app callback added to additional_redirect_urls"
  - ".env.example — NEXT_PUBLIC_SUPABASE_URL/ANON_KEY + SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID/_SECRET documented as placeholders"
  - "apps/web/e2e/auth-redirect.spec.ts — authored-not-run signed-out-to-/login Playwright smoke spec"
  - "43-USER-SETUP.md — checklist form of the runbook's external actions"
affects: [phase-44-tenancy-rls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runbook + config.toml env() reference + .env.example placeholder triad as the standing pattern for any future external-OAuth-provider addition"

key-files:
  created:
    - .planning/phases/43-auth-google-oauth-sessions-supabase-auth/GOOGLE-OAUTH-RUNBOOK.md
    - .planning/phases/43-auth-google-oauth-sessions-supabase-auth/43-USER-SETUP.md
    - apps/web/e2e/auth-redirect.spec.ts
  modified:
    - supabase/config.toml
    - .env.example

key-decisions:
  - "[auth.external.google] block placed immediately after [auth.external.apple] (the CLI-generated template's existing external-provider section) rather than appended at file end, keeping all external-provider config grouped — the plan only required 'append, do not restructure other sections', which this satisfies while staying readable"
  - "Runbook documents a single Google OAuth client with 3 redirect URIs (local + staging + prod) as the default recommendation, while noting the 3-separate-clients alternative is equally valid — matches STACK.md's 'decide at implementation time' framing without forcing a choice the user hasn't made yet"

patterns-established:
  - "External-provider setup runbooks live at .planning/phases/{phase}/ alongside the plan, cross-linked from a companion {phase}-USER-SETUP.md checklist — the runbook holds narrative detail, the USER-SETUP.md holds the checkbox-trackable summary"

requirements-completed: [AUTH-05]

# Metrics
duration: ~12min
completed: 2026-07-09
---

# Phase 43 Plan 05: Google OAuth Runbook, Local Provider Config & Redirect Smoke Spec Summary

**A six-section Google Cloud + Supabase runbook, a `supabase/config.toml` provider block that reads client id/secret exclusively via `env(...)`, four new placeholder vars in `.env.example`, and an authored-not-run Playwright signed-out→`/login` redirect spec — zero external OAuth clients created, zero secrets committed.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-09T21:33:24-03:00 (first task commit)
- **Completed:** 2026-07-09T21:35:29-03:00 (last task commit)
- **Tasks:** 3 completed
- **Files modified:** 5 (3 created, 2 modified) + 1 USER-SETUP.md companion doc

## Accomplishments

- `GOOGLE-OAUTH-RUNBOOK.md` — six sections exactly as specified: (1) Google Cloud Console consent screen + Web-application client creation; (2) a redirect-URI table naming all three environments explicitly, including both live Supabase project refs (`fyfwkjvbcrmjqjysdyqw` staging, `dazyccjijdahxyciptkp` prod) so Pitfall 10 (per-environment drift) can't be missed; (3) Supabase provider config for both the local `config.toml` path and the two hosted Dashboards, done *separately* per project; (4) an env-var table naming public-vs-secret status and per-environment value source for all four new vars; (5) the open-signup policy note plus the Supabase Auth-Hook allowlist option for later restriction; (6) the Phase-44 JWT signing-key-mode prerequisite (check Dashboard → Settings → API → JWT Keys for both hosted projects before Phase 44 planning).
- `supabase/config.toml` — appended `[auth.external.google]` with `enabled = true` and both `client_id`/`secret` as `env(...)` references (no literal value anywhere), placed alongside the existing `[auth.external.apple]` template block; `additional_redirect_urls` gained `"http://127.0.0.1:3000/auth/callback"` alongside the pre-existing `"https://127.0.0.1:3000"` entry. `git diff` confirms only these two edits — no other section touched.
- `.env.example` — four new lines documented as commented placeholders (matching the file's existing commented-value style) directly under the existing Supabase section: `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` marked public, `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`/`_SECRET` marked never-`NEXT_PUBLIC_`, each pointing at the runbook.
- `apps/web/e2e/auth-redirect.spec.ts` — mirrors `code-island-isolation.spec.ts`'s authored-but-unrun header-comment convention (Playwright not installed, enable command documented); asserts a signed-out `page.goto("/chat")` lands on `/login` with `redirectTo=%2Fchat`, matching `resolveAuthRedirect`'s actual encoding (`encodeURIComponent("/chat")` → `%2Fchat`, decoded by `URLSearchParams` back to `/chat` for the assertion). Lives under `apps/web/e2e/`, excluded from both `tsconfig.json` (`"e2e"` in `exclude`) and `vitest.config.ts` (`include: ["src/**/*.test.{ts,tsx}"]` never matches it) — confirmed by direct read of both config files, not assumed.
- `43-USER-SETUP.md` — a checkbox-trackable companion to the runbook (env vars, account setup, dashboard config, verification commands), generated per the plan's `user_setup` frontmatter field, cross-linking back to `GOOGLE-OAUTH-RUNBOOK.md` for full detail rather than duplicating its content.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the Google OAuth user runbook** - `6d5fad1` (docs)
2. **Task 2: Add the local Google provider config block + document env vars in .env.example** - `63d7b54` (feat)
3. **Task 3: Author the signed-out → /login Playwright redirect smoke spec** - `7503045` (test)

**Plan metadata:** (this SUMMARY.md commit, following)

## Files Created/Modified

- `.planning/phases/43-auth-google-oauth-sessions-supabase-auth/GOOGLE-OAUTH-RUNBOOK.md` - Six-section Google Cloud + Supabase setup runbook
- `.planning/phases/43-auth-google-oauth-sessions-supabase-auth/43-USER-SETUP.md` - Checklist companion to the runbook (generated per plan frontmatter `user_setup`)
- `supabase/config.toml` - `[auth.external.google]` provider block (env-sourced) + local app callback added to `additional_redirect_urls`
- `.env.example` - Four new placeholder auth env vars documented with public/secret comments
- `apps/web/e2e/auth-redirect.spec.ts` - Authored-not-run signed-out → `/login` redirect Playwright spec

## Decisions Made

- Placed the new `[auth.external.google]` block next to the existing `[auth.external.apple]` template block (both are Supabase-CLI-generated external-provider stubs) instead of at the file's end — keeps all external-provider config visually grouped for future maintainers without violating the plan's "append, don't restructure other sections" constraint (verified via `git diff` showing only the two intended edits).
- Runbook recommends one Google OAuth client with three registered redirect URIs (simplest operationally) while explicitly noting the three-separate-clients alternative is equally valid, per `STACK.md`'s own "decide at implementation time" framing — did not force a choice the user hasn't made.
- Generated `43-USER-SETUP.md` as a checklist-form companion to the runbook (per the plan's `user_setup` frontmatter and the standard executor workflow) rather than skipping it because the runbook already exists — the two serve different purposes (narrative detail vs. trackable checkboxes) and cross-link rather than duplicate.

## Deviations from Plan

None - plan executed exactly as written. All three tasks, their file targets, and their verification gates matched the plan's `<action>`/`<verify>`/`<acceptance_criteria>` text with no bugs, missing-critical-functionality gaps, or blockers encountered.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** See [GOOGLE-OAUTH-RUNBOOK.md](./GOOGLE-OAUTH-RUNBOOK.md) (detailed) and [43-USER-SETUP.md](./43-USER-SETUP.md) (checklist) for:
- Google Cloud Console OAuth consent screen + client creation
- Per-environment (local/staging/prod) authorized redirect URIs — both hosted Supabase project refs named explicitly
- Supabase Dashboard Google provider enablement for staging and production (done separately, each project has independent settings)
- The four new environment variables and where each value comes from

This is expected — per `43-CONTEXT.md`, autonomous execution never creates external OAuth clients or touches dashboards; this plan's job was exactly to produce the artifacts that make the manual steps a checklist instead of tribal knowledge.

## Next Phase Readiness

- AUTH-05 is now fully closed across both plans: 43-01 shipped the env-var fail-fast validation half; 43-05 ships the runbook + config-wiring + documentation half.
- Phase 43 (auth) is code-complete: Google OAuth sign-in, session middleware, route protection, sign-out, tRPC identity context, and FastAPI identity forwarding (43-01 through 43-04) all ship with unit/typecheck verification; only the live OAuth round-trip needs human UAT once this plan's runbook is followed by the user.
- Phase 44 (tenancy/RLS) has an explicit, written prerequisite waiting for it: determine each hosted Supabase project's JWT signing-key mode (legacy HS256 vs asymmetric ES256) before FastAPI-side JWT verification design begins — recorded in the runbook's Section 6, not left as tribal knowledge.
- No blockers. This was the last plan in Phase 43's wave 3.

---
*Phase: 43-auth-google-oauth-sessions-supabase-auth*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: .planning/phases/43-auth-google-oauth-sessions-supabase-auth/GOOGLE-OAUTH-RUNBOOK.md
- FOUND: .planning/phases/43-auth-google-oauth-sessions-supabase-auth/43-USER-SETUP.md
- FOUND: supabase/config.toml (auth.external.google block present)
- FOUND: .env.example (NEXT_PUBLIC_SUPABASE_ANON_KEY present)
- FOUND: apps/web/e2e/auth-redirect.spec.ts
- FOUND: commit 6d5fad1 (docs(43-05): author Google OAuth setup runbook)
- FOUND: commit 63d7b54 (feat(43-05): wire local Google provider config + document auth env vars)
- FOUND: commit 7503045 (test(43-05): author signed-out to /login redirect Playwright smoke spec)
- FOUND: Task 1 grep gate — auth/v1/callback + fyfwkjvbcrmjqjysdyqw + SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET all present in runbook
- FOUND: Task 2 grep gate — auth.external.google + env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET) in config.toml + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.example
- FOUND: Task 2 acceptance criterion — `git diff supabase/config.toml` shows only the appended provider block + redirect-url addition
- FOUND: Task 3 acceptance criterion — spec file exists under apps/web/e2e/, excluded from tsconfig.json and vitest.config.ts
