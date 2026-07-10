# External Rename Runbook — nauta → polytoken

**Status:** User-executed. Nothing in this document has been run automatically. Phase 42
(plans 42-01 and 42-02) renamed the repo's internal code/config/docs/UI surface only
(`@nauta/*` → `@polytoken/*`); it deliberately changed **zero** live external resource
names. This runbook is the deferred half — RENM-02 — covering the four external renames a
human must perform deliberately, with billing, registrar, and cloud-console access this
agent does not have.

**Do not automate this document.** Every AWS/Terraform section below ends with `terraform
plan` (read-only) as the proof step. `terraform apply` is explicitly OUT OF SCOPE for phase
42 — running it is a separate, later, deliberate action the user takes only after reviewing
a plan output personally.

---

## 1. GitHub repo rename

Current repo: `pedromshin/nauta.services.email-listener` (confirmed via `git remote -v`,
2026-07-09).

**Steps:**

1. On GitHub, go to the repo's **Settings → General → Repository name**, rename
   `nauta.services.email-listener` to the polytoken-equivalent name (e.g.
   `polytoken.services.email-listener`, matching this repo's own root `package.json` name
   `"polytoken-services"` set in Plan 42-01).
2. GitHub automatically creates a redirect from the old URL to the new one for web traffic,
   `git clone`, `git fetch`, and `git push` — existing clones and CI integrations that
   reference the old URL keep working via the redirect, but should still be updated to avoid
   relying on it indefinitely.
3. Update the local remote so this machine points at the new URL directly (do not rely on
   the redirect long-term):
   ```bash
   git remote set-url origin https://github.com/pedromshin/<new-repo-name>.git
   git remote -v   # verify
   ```
4. If any other machine/CI runner has this repo cloned, repeat step 3 there, or confirm it
   is relying on the GitHub redirect intentionally.
5. Check for any hardcoded old-URL references outside git plumbing (issue templates, badge
   URLs in README, CI secrets referencing the repo by name) and update them in a follow-up
   commit — this is a separate, low-risk documentation cleanup, not part of this runbook's
   AWS/Terraform hazard set.

**Note:** local absolute clone paths (e.g. `COMMANDS.MD`'s `C:\Users\pc\Desktop\
nauta.services.email-listener\...` references) describe *this machine's folder name*, not a
code identifier — renaming the GitHub repo does not require renaming the local folder, and
renaming the local folder (if desired) is a separate, purely-local action with no bearing on
any of the AWS/Terraform/Vercel sections below.

---

## 2. AWS / Terraform resources (the load-bearing section)

This is the section with real destructive-action risk. Read all three hazards below in full
**before** running `terraform plan`, and do not run `terraform apply` as part of this
runbook — `apply` is a separate, later, deliberate action gated on your own review of the
plan's output.

### 2.1 Every live AWS/Terraform resource name in this repo today

| Resource / string | Exact value | File:line | What it controls |
|---|---|---|---|
| Terraform `var.project` default | `"nauta-services"` | `infrastructure/aws/variables.tf:16` | Flows into `locals.service_name` (`"${var.project}-email-listener"`), which names the ECR repo, both ECS cluster/service pairs (prod + `-staging`), and the CloudWatch log group |
| Terraform `tg_prefix` local | `"nauta-el"` | `infrastructure/aws/locals.tf:4` | ALB target-group name prefix (`nauta-el-prod` / `nauta-el-staging`) — capped at 32 chars by AWS, so the replacement prefix must stay short |
| GitHub Actions env block (production) | `ECR_REPOSITORY: nauta-services-email-listener`<br>`ECS_CLUSTER: nauta-services-email-listener`<br>`ECS_SERVICE: nauta-services-email-listener` | `.github/workflows/deploy-email-listener.yml:13-15` | Hardcoded strings the production deploy job uses to find the ECR repo / ECS cluster / ECS service at deploy time — **independent of Terraform's `var.project`, not derived from it** |
| GitHub Actions env block (staging) | `ECR_REPOSITORY: nauta-services-email-listener`<br>`ECS_CLUSTER: nauta-services-email-listener`<br>`ECS_SERVICE: nauta-services-email-listener-staging` | `.github/workflows/deploy-email-listener-staging.yml:13-15` | Same class, staging variant |
| Terraform commented S3 backend | `#   bucket = "nauta-services-terraform-state"` | `infrastructure/aws/main.tf:13` | Currently commented out — this repo's tfstate is **local-only** (see 2.3); this line is dormant, not live, but documents the bucket name that would be used if remote state were ever enabled |
| `terraform.tfstate` (local file) | gitignored, not git-tracked | `infrastructure/aws/terraform.tfstate` | Contains the live ALB DNS name, ECR registry URL, ECS cluster/service names, IAM role ARN, S3 bucket name, and 3 SNS topic ARNs — the actual current state of every deployed resource |
| `README.md` deploy-target table | `nauta-services-email-listener` / `nauta-services-email-listener-staging` | `README.md:56-57` | Documentation only, but the same live resource names as above — must be updated in lockstep with an actual infra rename, never independently |
| S3 bucket (SES inbound storage) | `SES_S3_BUCKET: str = "nauta-services-ses-inbound-emails"` | `apps/email-listener/app/settings.py:97` | A Python config value that must match the real S3 bucket name; the running service uses this string to read/write inbound email attachments — changing it in code without renaming the actual bucket breaks ingestion silently |

### 2.2 Hazard A — TWO UNSYNCED SOURCES OF TRUTH

Terraform's `var.project` (`infrastructure/aws/variables.tf:16`) and the GitHub Actions
workflow YAML's hardcoded `ECR_REPOSITORY`/`ECS_CLUSTER`/`ECS_SERVICE` env vars
(`deploy-email-listener.yml:13-15` and `deploy-email-listener-staging.yml:13-15`) are **two
independent strings today** — confirmed both still say `nauta-services-email-listener` as of
2026-07-09. Terraform does not read the workflow YAML, and the workflow YAML does not read
Terraform's variables file. **You must change both in the same PR.** If you rename only
Terraform's `var.project` and apply it, the next CI deploy will try to find an ECS
cluster/service by the OLD hardcoded name in the workflow YAML — which Terraform just
renamed away from — and the deploy will fail (or, worse, silently target a stale resource if
one still exists under the old name).

**Reconciliation checklist for the same PR:**
- [ ] `infrastructure/aws/variables.tf:16` — `var.project` default
- [ ] `.github/workflows/deploy-email-listener.yml:13-15` — all three env vars
- [ ] `.github/workflows/deploy-email-listener-staging.yml:13-15` — all three env vars
- [ ] `apps/email-listener/app/settings.py:97` — `SES_S3_BUCKET` (only if you are also
      renaming the S3 bucket itself — see 2.4)
- [ ] `README.md:56-57` — deploy-target table cells

### 2.3 Hazard B — ECR `force_delete=false` (destroy + recreate risk)

ECR repository names (like most AWS resource names referenced by `name =` rather than
`name_prefix =`) are **immutable** — Terraform cannot rename a resource in place by changing
its `name` argument. Changing `var.project` (which feeds the ECR repo's name) makes Terraform
plan a **destroy of the old ECR repo + create of a new one** under the new name.

This repo's ECR resource does **not** set `force_delete = true` (confirmed — the default in
the AWS provider is `force_delete = false`). That means:

- `terraform apply` will **fail loudly** if the ECR repo being destroyed is non-empty (has
  any pushed images in it). This is a *safety feature*, not a bug — a loud failure is safer
  than a silent success that deletes production images.
- **Do NOT casually flip `force_delete = true`** to make the apply succeed — that would let
  Terraform silently delete every pushed image in the old repo as part of the destroy, with
  no separate confirmation step.
- **Do NOT attempt `terraform state mv`** to try to preserve the existing ECR repo under a
  new logical name without first confirming, from the AWS provider's own documentation for
  the exact provider version pinned in `infrastructure/aws/main.tf` (`~> 5.0`), whether
  `aws_ecr_repository` supports any rename-in-place mechanism. As of this research, it does
  not — a `state mv` only renames Terraform's *tracking* of the resource, it does not rename
  the resource itself in AWS, and the resource's `name` argument would still not match its
  actual state after the move, causing `terraform plan` to immediately want to destroy+
  recreate anyway on the next run.
- The same destroy+recreate class of risk applies to ECS cluster/service names and the ALB
  target groups (`tg_prefix`), which are also named by literal string, not `name_prefix`.

**Safe path:** before any `apply` that touches these names, confirm (a) the ECR repo you are
about to destroy+recreate is either empty or you have a rebuild pipeline that will
immediately repopulate it (this repo's own CI does — the `deploy` job pushes a fresh image
on every run), and (b) you have reviewed the full `terraform plan` output line by line for
every resource marked `# forces replacement`, not just the ones you expected.

### 2.4 Hazard C — LOCAL-ONLY tfstate

`infrastructure/aws/terraform.tfstate` is gitignored (`.gitignore:24-25`, pattern
`*.tfstate*`) and not committed anywhere. The S3 remote-backend block in `main.tf:11-16` is
commented out. This means **the only copy of current infrastructure state lives on whichever
machine last ran `terraform apply`.**

- **Before running any rename-triggered `apply`, confirm which machine/runner currently
  holds the authoritative `terraform.tfstate`.** If you run `apply` from a different machine
  with a stale or missing local state file, Terraform will either (a) fail to find the
  existing resources and try to create duplicates, or (b) if it has no state at all, attempt
  to create everything from scratch while the old resources still exist and cost money
  un-tracked.
- **Never hand-edit `terraform.tfstate`.** Any state surgery (e.g. `terraform state mv`,
  `terraform state rm`) must go through the Terraform CLI's own state subcommands, never a
  text editor — the file's internal resource-dependency graph and serial counter are easy to
  corrupt by hand, and a corrupted state file can make Terraform lose track of real live
  resources (leaving them un-managed and un-billed-for-in-plan, but still running and still
  billing your AWS account).
- Strongly consider uncommenting and configuring the S3 remote backend (`main.tf:11-16`,
  bucket name currently stubbed `nauta-services-terraform-state` — rename to match if you
  proceed) **before** doing the rename-triggered apply, so state has a durable, shared home
  going forward. This is optional but recommended; it is out of scope for this specific
  rename runbook to mandate it.

### 2.5 What `SES_S3_BUCKET`, the GitHub Actions env vars, and `terraform.tfstate` have in common

All three name the **same live resources** from different angles:
`SES_S3_BUCKET` (Python config) names the S3 bucket that actually holds inbound email
attachments; the GitHub Actions env vars name the ECR repo / ECS cluster / ECS service that
actually run the deployed container; `terraform.tfstate` is Terraform's own record of what
it believes it created and is tracking. **Renaming one without the others breaks something:**
renaming the S3 bucket in AWS without updating `SES_S3_BUCKET` breaks email ingestion
(writes/reads 404 against the old bucket name); renaming the ECS service in AWS without
updating the workflow YAML breaks the next deploy; and any AWS-side rename without updating
Terraform's own configuration (`var.project`, `tg_prefix`) makes the next `terraform plan`
show a diff that fights the manual change (Terraform will try to revert it back to what the
`.tf` files say, since it doesn't know about out-of-band console renames).

### 2.6 Proof step — `terraform plan` (read-only)

After updating `variables.tf`, `locals.tf` (if renaming `tg_prefix`), both workflow YAML
files, `README.md`'s table, and `settings.py`'s `SES_S3_BUCKET` (if renaming the bucket) —
but **before** running `apply`:

```bash
npm run infra:tf -- plan
# equivalent to: terraform -chdir=infrastructure/aws plan
```

Review the full output. Confirm:
- Every resource marked `# forces replacement` is one you expected (ECR repo, ECS
  cluster/service, ALB target groups, CloudWatch log group — the resources whose names
  derive from `var.project`/`tg_prefix`).
- No resource you did NOT intend to rename shows a diff (if something unexpected shows up,
  stop and investigate before proceeding — it likely means a `.tf` file was edited beyond
  the intended rename, or the local state is stale/mismatched).
- The ECR repo `force_delete` hazard (2.3) — if the plan shows the ECR repo being destroyed
  and it currently holds images, decide your rebuild strategy before applying.

**`terraform apply` is explicitly OUT OF SCOPE for phase 42 and for this runbook.** Applying
is the user's own, later, deliberate action — taken only after personally reviewing the
`plan` output above line by line, on the machine confirmed (2.4) to hold the authoritative
state, at a time when a brief service interruption (ECS destroy+recreate is not
zero-downtime by default) is acceptable.

---

## 3. Vercel project rename

1. Rename the Vercel project via the [Vercel dashboard](https://vercel.com/dashboard)
   (**Project Settings → General → Project Name**) or the CLI:
   ```bash
   vercel project rename <new-name>
   ```
2. `.vercel/project.json` (which would contain `"projectName":"nauta-web"` if it exists
   locally) is **gitignored** (`.gitignore:43`) and not a committed surface — it is a local
   CLI-linking artifact regenerated automatically the next time `vercel link` runs (or the
   next `vercel` CLI command that needs the project link). No manual edit or commit is
   needed for this file; if it's stale locally, delete `.vercel/` and re-run `vercel link` to
   regenerate it against the renamed project.
3. `vercel.json`'s `buildCommand` (`infrastructure`-adjacent, actually at repo root) already
   reads `npm run build -w @polytoken/web` as of Plan 42-01 — no further change needed here;
   this section is Vercel-project-identity only, not build-command content.
4. If any custom domain is currently attached to the Vercel project under the old project
   name, confirm the domain attachment survives the rename (Vercel project renames do not
   detach domains) before moving on to Section 4.

---

## 4. Domain purchase / DNS

This section is **user-only** — it requires billing access (domain registrar) and DNS
console access this agent does not have and should not be given.

1. Purchase the polytoken domain (e.g. `polytoken.ai`, per VISION.md's product naming) from
   a registrar of choice.
2. Point DNS at Vercel for the web app: add the domain in the Vercel dashboard
   (**Project Settings → Domains**) and follow Vercel's own DNS instructions (either
   nameserver delegation to Vercel, or A/CNAME records at your registrar/DNS host).
3. Update SES/MX records for the new domain if inbound email (the `agent@` address this
   service listens on) is to move to the new domain:
   - Verify the new domain in SES (domain verification via a TXT record, plus DKIM CNAME
     records SES provides).
   - Add an MX record pointing at SES's inbound endpoint for the region in use
     (`us-east-1` per `infrastructure/aws/variables.tf:1-5`).
   - Only after the new domain's SES receipt rule is confirmed working (test email round
     trip), update the SNS subscription / webhook configuration this service relies on to
     also (or instead) watch the new domain's inbound mailbox.
4. Do not decommission the old `magnitudetech.com.br`-based inbound address (referenced
   throughout `README.md`/`PROJECT.md` as `agent@magnitudetech.com.br`) until the new
   domain's inbound path has been live-verified — this is the same "prove before you retire"
   discipline as the AWS rename hazards above, applied to email routing instead of compute.

---

## Summary — order of operations

1. **GitHub repo rename** (Section 1) — low risk, GitHub redirects old URLs automatically.
2. **AWS/Terraform** (Section 2) — highest risk; requires updating Terraform config AND the
   GitHub Actions workflow YAML in the same PR (Hazard A), understanding the ECR
   `force_delete=false` destroy+recreate behavior (Hazard B), and confirming which machine
   holds the authoritative local tfstate before any apply (Hazard C). `terraform plan` is
   the mandatory read-only proof step; `terraform apply` is a separate, later, user-only
   action outside this phase's and this runbook's scope.
3. **Vercel project rename** (Section 3) — low risk, dashboard/CLI action; the local
   `.vercel/project.json` link artifact self-regenerates.
4. **Domain purchase / DNS** (Section 4) — user-only (billing + registrar), do last, and
   verify the new inbound-email path works before retiring the old one.

None of the above has been executed by this plan. This document changes zero live
resource-name strings in the repo — it exists purely to make the later, deliberate execution
of these four renames safe.
