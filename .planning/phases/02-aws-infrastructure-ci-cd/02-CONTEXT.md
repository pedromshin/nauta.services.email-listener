# Phase 2: AWS infrastructure + CI/CD - Context

**Gathered:** 2026-06-10 (decisions locked during Phase 1 scaffold session)
**Status:** Ready for planning

<domain>
## Phase Boundary

The email-listener service deployed to AWS ECS Fargate with two live environments —
staging (dev branch) and production (main branch) — via GitHub Actions OIDC. The Terraform
and workflow FILES already exist (written and committed in Phase 1); this phase EXECUTES
them: create the GitHub repo, apply Terraform, wire secrets, and prove both deploy pipelines
end-to-end. Requirements: INFRA-01..04.
</domain>

<decisions>
## Implementation Decisions

### Compute & topology (locked, code already written)
- **D-01:** ECS Fargate (user-confirmed pattern), one cluster, two services:
  `nauta-services-email-listener` (prod, :latest) + `-staging` (:staging).
- **D-02:** Shared ALB — production listener :80, staging listener :8080. Move to :443
  host-routing later when domain + ACM cert exist.
- **D-03:** Single ECR repo, mutable tags, keep-last-20 lifecycle, scan-on-push.
- **D-04:** Public subnets with assign_public_ip (no NAT) — cost-minimal; revisit when
  outbound isolation matters.

### CI/CD (locked, code already written)
- **D-05:** Push to dev → deploy staging; push to main → deploy production. Independent
  pipelines, no staging gate on prod (user-specified branch model).
- **D-06:** Pipeline: test → docker build → Trivy (CRITICAL/HIGH blocks) → push ECR →
  `aws ecs update-service --force-new-deployment` → wait stable → /health smoke test.
- **D-07:** GitHub OIDC role (no long-lived AWS keys in GitHub). Secret AWS_DEPLOY_ROLE_ARN,
  vars STAGING_HEALTH_URL / PRODUCTION_HEALTH_URL.

### Execution specifics (this phase's actual work)
- **D-08:** AWS account 271369143207, region us-east-1, CLI profile default
  (already authenticated as user windows-desktop).
- **D-09:** GitHub account pedromshin — `gh auth login` must be completed by user first
  (token currently invalid). Repo name: nauta.services.email-listener.
- **D-10:** The GitHub OIDC provider (token.actions.githubusercontent.com) is referenced
  as a data source in iam.tf — verify it exists in the account; create it (terraform or
  CLI) if absent before apply.
- **D-11:** Local terraform state for now (S3 backend commented out — acceptable, noted).
- **D-12:** API_KEY secrets per environment in Secrets Manager created during this phase;
  ARNs passed via terraform.tfvars (file is gitignored).

### Claude's Discretion
- terraform.tfvars exact contents; secret naming convention (e.g. prod/nauta-services/API_KEY)
- Order of repo-push vs terraform-apply (only constraint: OIDC role must exist before
  first deploy workflow runs)
- Trivy/uv action versions if CI needs fixes on first run
</decisions>

<specifics>
## Specific Ideas

- "Anyone who clones the whole repo should be able to run the server" — already satisfied
  by `npm run dev`; don't regress it.
- Per-environment mailboxes (Phase 3): staging and prod ECS services will later get
  different IMAP secrets — keep the per-environment secrets mechanism general.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Infrastructure code to execute (already written)
- `infrastructure/aws/*.tf` — all resources (main, variables, locals, network, ecr, alb, ecs, iam, outputs)
- `infrastructure/aws/terraform.tfvars.example` — variables to fill
- `infrastructure/README.md` — provisioning runbook + GitHub secrets/vars to set
- `.github/workflows/deploy-email-listener.yml` + `deploy-email-listener-staging.yml` — pipelines to prove
- `.github/workflows/ci-email-listener.yml` — CI gate

### Project docs
- `.planning/ROADMAP.md` — phase 2 success criteria
- `.planning/REQUIREMENTS.md` — INFRA-01..04
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Terraform fully written; workflows fully written — this phase is execution + verification,
  not authoring (changes only if apply/CI surfaces errors)
- `aws` CLI authenticated; `terraform` installed via winget this session; `gh` installed
  but needs re-login

### Integration Points
- GitHub repo settings: secret AWS_DEPLOY_ROLE_ARN (from `terraform output
  github_deploy_role_arn`), vars from ALB DNS output
- ECS task definitions consume API_KEY via Secrets Manager ARNs (terraform vars)
</code_context>

<deferred>
## Deferred Ideas

- S3 backend for terraform state — when team grows
- ACM cert + 443 host-based routing — when domain decided
- IMAP secrets wiring — Phase 3
</deferred>

---

*Phase: 02-aws-infrastructure-ci-cd*
*Context gathered: 2026-06-10*
