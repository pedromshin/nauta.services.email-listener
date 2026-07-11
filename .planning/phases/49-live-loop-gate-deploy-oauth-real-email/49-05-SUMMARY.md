---
phase: 49-live-loop-gate-deploy-oauth-real-email
plan: 05
subsystem: infra
tags: [oidc, vercel, github, terraform, jwt, supabase]

# Dependency graph
requires:
  - phase: 49-01
    provides: "Local Supabase project-id nauta->polytoken rename actualized, cited here as the local-project-id disposition"
provides:
  - "EXTERNAL-IDENTITY-DECISIONS.md — per-item disposition table for all five LIVE-07 external-identity leftovers + the GitHub-rename <-> OIDC deploy-trust coupling analysis + the Vercel rename attempt outcome"
  - "STATE.md Phase 49 Plan 05 History section recording AWS re-park, local project-id (closed), GitHub-held, Vercel-blocked-this-session"
  - "JWT-SIGNING-KEY-AUDIT.md folded into the tracked planning tree (was untracked)"
affects: [49-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decide-not-park discipline for external-identity leftovers: every item gets an explicit recorded disposition (executed / attempted-and-deferred / re-parked with named hazards), never a silent gap"

key-files:
  created:
    - .planning/phases/49-live-loop-gate-deploy-oauth-real-email/EXTERNAL-IDENTITY-DECISIONS.md
  modified:
    - .planning/STATE.md
    - .planning/milestones/v1.7-phases/43-auth-google-oauth-sessions-supabase-auth/JWT-SIGNING-KEY-AUDIT.md

key-decisions:
  - "AWS/Terraform resource renames RE-PARKED explicitly (Hazard A two unsynced sources of truth, Hazard B ECR force_delete=false destroy risk, Hazard C local-only tfstate) — recorded in STATE.md, not silently parked"
  - "GitHub repo rename decided EXECUTE but held for the 49-06 user checkpoint because of the GitHub-rename <-> OIDC deploy-trust coupling (iam.tf sub-claim condition breaks on rename until a companion IAM terraform apply lands, which sits inside the re-parked AWS surface)"
  - "Vercel project rename decided EXECUTE, attempted autonomously this session (CLI present + authenticated as pedromshin, contrary to a stale planning assumption), but denied by this session's own auto-mode safety classifier (DNS/Domain/Cert Changes boundary) — deferred to 49-06 with exact dashboard steps recorded"
  - "Local Supabase project-id nauta->polytoken rename recorded as already actualized (plans 49-01/49-03) — closed, not reopened"

requirements-completed: [LIVE-07]  # Partial: this plan closes the "decided, not parked" bar for the autonomous items; LIVE-07's GitHub-rename item is user-gated and not yet Complete (49-06)

# Metrics
duration: 20min
completed: 2026-07-11
---

# Phase 49 Plan 05: External-Identity Decisions (LIVE-07) Summary

**Decided-not-parked all five EXTERNAL-RENAME-RUNBOOK.md leftovers: AWS/Terraform re-parked with named hazards, local Supabase project-id closed, GitHub rename held for the 49-06 OIDC-gated checkpoint, and an autonomous Vercel-rename attempt that was correctly blocked by the session's own domain-change safety boundary rather than executed blindly.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-11T~02:55Z (approx, first file read)
- **Completed:** 2026-07-11T03:40Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `EXTERNAL-IDENTITY-DECISIONS.md` is the durable, per-item disposition dossier for all five
  LIVE-07 leftovers (GitHub, Vercel, AWS/Terraform, local Supabase project-id, domain/DNS), each
  with decision + rationale + executor + status, plus a dedicated section spelling out the
  GitHub-rename <-> OIDC deploy-trust coupling (`iam.tf:110-131`'s `sub = repo:${var.github_repository}:*`
  condition, `terraform.tfvars:4`'s current value, exactly what breaks, and the two safe user
  options for 49-06).
- Attempted the Vercel project rename autonomously via CLI (`vercel project rename nauta-web
  polytoken-web --non-interactive --scope team_V2cgPPeWDBTsSBVg3fwh1Jof`) after confirming the CLI
  was installed AND authenticated (`vercel whoami` -> `pedromshin`) — this contradicted a stale
  "no CLI/token" assumption carried into this session. The command was correctly denied by the
  session's own auto-mode safety classifier (DNS/Domain/Cert Changes category — a rename changes
  the live default `*.vercel.app` domain, an explicitly-bounded action). No mutation occurred.
  Exact copy-paste dashboard steps are recorded for 49-06, backed by a repo-wide grep confirming
  zero hardcoded `nauta-web`/`vercel.app` references in application code.
- `.planning/STATE.md` gained a "Phase 49 -- Live-Loop Gate -- Plan 05 History" section recording
  all four dispositions (AWS re-park with hazards, local project-id closed, GitHub held for 49-06,
  Vercel blocked-this-session) plus a cross-reference to plan 49-04's already-logged stale-Postgres-
  password item, kept strictly ASCII per this plan's acceptance criteria.
- `JWT-SIGNING-KEY-AUDIT.md` (previously untracked) is now git-tracked with a
  verified-2026-07-10-annotation; content (staging + prod both asymmetric ES256, local HS256)
  confirmed unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write EXTERNAL-IDENTITY-DECISIONS.md + attempt Vercel rename** - `3ba0d22` (docs)
2. **Task 2: Record LIVE-07 decisions in STATE.md + fold in the JWT audit** - `da6891b` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified
- `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/EXTERNAL-IDENTITY-DECISIONS.md` - Per-item disposition table + OIDC coupling analysis + Vercel attempt outcome + exact 49-06 dashboard steps
- `.planning/STATE.md` - New Phase 49 Plan 05 History section (ASCII-only per acceptance criteria)
- `.planning/milestones/v1.7-phases/43-auth-google-oauth-sessions-supabase-auth/JWT-SIGNING-KEY-AUDIT.md` - Verified-2026-07-10 annotation added, now git-tracked

## Decisions Made
- AWS/Terraform resource renames stay RE-PARKED — the three hazards (unsynced sources of truth,
  ECR destroy risk, local-only tfstate) named in the original Phase 42 runbook are still fully
  current; nothing has changed to reduce the risk or add user-facing value this milestone.
- GitHub repo rename stays a 49-06 user checkpoint, independent of `gh` CLI auth status. `gh auth
  status` this session showed a valid, active `pedromshin` login — contradicting the "gh unauthed"
  assumption carried into planning — but the decision is unaffected: the OIDC coupling means a
  blind rename breaks both deploy pipelines regardless of whether the CLI itself can perform the
  rename, so it stays gated on the user's informed choice (rename+companion-apply vs re-park).
- Vercel rename: attempted per the plan's own instruction, and the plan's own fallback branch
  ("if the CLI is unauthenticated or fails, do NOT block — record dashboard steps") was followed in
  spirit even though the actual blocking mechanism was a policy denial rather than an auth failure —
  the net outcome (deferred to 49-06, dashboard steps recorded) is identical to what the plan
  specified for the fallback case.

## Deviations from Plan

### Informational corrections (not auto-fixes — no code/doc defect, just stale assumptions surfaced and handled correctly)

**1. Vercel CLI/token reality differed from the overnight-mode brief**
- **Found during:** Task 1
- **Issue:** This session's brief stated "No Vercel CLI or token is available." Live verification
  (`vercel --version`, `vercel whoami`) showed CLI 54.18.0 installed and authenticated as
  `pedromshin`.
- **Handling:** Attempted the rename per the plan's Task 1 instruction (this is what an
  authenticated CLI enables). The attempt was independently denied by the session's own auto-mode
  safety classifier (a boundary the brief had also flagged: "document exact dashboard steps... do
  not attempt it blindly"). Net result matches the brief's intended outcome (deferred to 49-06,
  no mutation) even though the CLI-availability premise was stale. Recorded transparently in both
  `EXTERNAL-IDENTITY-DECISIONS.md` and `STATE.md` so a downstream reader isn't misled by the
  earlier "no CLI" assumption.
- **Files modified:** None beyond the plan's own deliverables (documented as part of Task 1/2).
- **Committed in:** `3ba0d22`, `da6891b`

**2. GitHub `gh` CLI auth reality differed from the plan's `<interfaces>` note**
- **Found during:** Task 1
- **Issue:** The plan's `<interfaces>` section stated "gh auth = INVALID (keyring token bad)."
  `gh auth status` this session showed a valid, active login.
- **Handling:** Did not change the GitHub-rename decision — the OIDC coupling (not CLI capability)
  is the reason the rename stays user-gated, and that reasoning is unaffected by `gh` auth status.
  Recorded the discrepancy for traceability so a downstream reader doesn't assume `gh` was
  unusable this session.
- **Files modified:** None beyond the plan's own deliverables.
- **Committed in:** `3ba0d22`

---

**Total deviations:** 0 auto-fixed (no Rule 1-4 triggers); 2 informational corrections to stale
session-context assumptions, both handled without altering scope or the decisions the plan
specified.
**Impact on plan:** None on scope, correctness, or the safety posture of the plan's own decisions.

## Issues Encountered
None beyond the two informational corrections above.

## User Setup Required

None from this plan directly — this plan is documentation only. The Vercel dashboard rename and
the GitHub rename + companion IAM `terraform apply` are both queued as 49-06 checkpoint items (not
part of this plan's own user-setup surface, since this plan performs no live user-facing gate
itself).

## Next Phase Readiness
- `EXTERNAL-IDENTITY-DECISIONS.md` is ready for plan 49-06 to consume directly into
  `MORNING-CHECKLIST.md` (its own `<context>` already references this file and cites the exact
  GitHub/OIDC coupling and Vercel fallback content this plan produced).
- LIVE-07 is NOT yet marked Complete in REQUIREMENTS.md — its literal text covers the full
  external-identity decision set, and the GitHub-rename item is explicitly a recorded-but-not-yet-
  executed user decision pending 49-06. Marking it Complete now would misrepresent status (same
  precedent 49-01's summary already established for this requirement).
- No blockers for 49-06. The Vercel dashboard steps and the GitHub rename + companion IAM apply
  are both fully specified and ready for the user to action at the checkpoint.

---
*Phase: 49-live-loop-gate-deploy-oauth-real-email*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: .planning/phases/49-live-loop-gate-deploy-oauth-real-email/EXTERNAL-IDENTITY-DECISIONS.md
- FOUND: .planning/milestones/v1.7-phases/43-auth-google-oauth-sessions-supabase-auth/JWT-SIGNING-KEY-AUDIT.md
- FOUND: .planning/STATE.md
- FOUND: 3ba0d22 (Task 1 commit)
- FOUND: da6891b (Task 2 commit)
- FOUND: 43cd0c1 (SUMMARY commit)
