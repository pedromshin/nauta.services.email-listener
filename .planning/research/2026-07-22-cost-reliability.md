# Cost-optimization + reliability/scalability review — polytoken (2026-07-22)

Derived **entirely from repo artifacts** (`infrastructure/aws/*.tf`, `vercel.json`, `supabase/config.toml`,
`packages/db/src/schema/chat-cost-ledger.ts`, `apps/email-listener/app/domain/services/cost_circuit_breaker.py`,
`.planning/research/2026-07-22-META-AUDIT.md`) plus one live-facts snapshot
(`scratchpad/aws-facts.json`: SES account status, deployed receipt rules, forwarder Lambda). **No cloud API access**
was used; where deployed reality could diverge from Terraform, that is labeled.

Companion docs: `.planning/research/2026-07-22-META-AUDIT.md` (infra drift), `.planning/research/2026-07-22-ecosystem/app-packages.md`
(storage/versioning research this doc leans on for the 500 GB plan).

---

## 1. What the Terraform actually provisions

From `infrastructure/aws/` (region `us-east-1`, `variables.tf`):

- **ECS Fargate**, one cluster, two services (`ecs.tf`, `locals.tf`):
  - `production`: 512 CPU units (0.5 vCPU) / 1024 MB, `desired_count = 1` (default, `prod_desired_count`), image `:latest`, **always-on**.
  - `staging`: 256 CPU / 512 MB, `desired_count = 0` by default ("scaled down to save cost", `variables.tf:43`).
  - Container Insights **disabled** (deliberate, `ecs.tf:7-12`); log retention 7 days; deployment circuit breaker with rollback on.
- **ALB** (`alb.tf`): one internet-facing ALB across **2 public subnets/AZs**; listeners on **:80 (HTTP, prod)** and **:8080 (HTTP, staging)**. No 443/ACM cert yet (comment says "until a domain + ACM cert is attached").
- **VPC** (`network.tf`): 2 public subnets only. **No NAT gateway, no private subnets** — Fargate tasks get `assign_public_ip = true` ("required for ECR pulls", `ecs.tf:104`). This is the cheap topology: zero NAT hourly/processing cost.
- **SES inbound** (`ses.tf`): domain identity `magnitudetech.com.br`, receipt rule set with 4 rules → S3 bucket `nauta-services-ses-inbound-emails` (30-day expiry lifecycle) + **SNS topics (prod/staging/local)** → **HTTP subscriptions to the ALB** (`http://<alb>/v1/emails/inbound-sns`, `:8080` for staging), plus optional ngrok sub for local.
- **ECR** (`ecr.tf`): single repo, mutable `:latest`/`:staging`, keep-last-20 lifecycle, scan-on-push.
- **IAM** (`iam.tf`): task role scoped to Bedrock `InvokeModel*` for `anthropic.claude-*` + `amazon.titan-embed-*` (cross-region inference profiles), S3 read of `inbound/*`; execution role reads up to **4 Secrets Manager secrets**; GitHub OIDC deploy role.
- **Budget** (`budget.tf`): account-wide **$30/month** cost budget (`budget_monthly_limit_usd` default), alerts at 80%/100% actual + 100% forecasted → `pedro@magnitudetech.com.br`. Alert only, no hard stop.
- **Terraform state**: S3 backend is **commented out** (`main.tf:11-17`) — state is local.

Deployed-but-not-in-Terraform (from `aws-facts.json` + META-AUDIT §2 "Infra drift"): `polytoken-ses-forwarder` Lambda
(python3.12, 256 MB) and the `personal-forward` / deployed `forwarding-catchall` receipt rules. SES account is **in sandbox**
(`ProductionAccessEnabled: false`), send quota **200/24h, 1 msg/sec**, sending enabled, 4 sent in last 24h.

---

## 2. Cost-driver table (tf-derived estimates, current published pricing)

Assumptions: 730 hr/month; staging at its default `desired_count = 0`; near-idle traffic (single-operator product).
Pricing sources cited per row; unit prices for us-east-1 verified against 2026 pricing pages.

| # | Driver | Source in repo | Unit price (us-east-1) | Est. $/mo | Notes |
|---|--------|----------------|------------------------|-----------|-------|
| 1 | Fargate prod task (0.5 vCPU / 1 GB, 24×7) | `locals.tf` cpu=512/mem=1024, count 1 | $0.04048/vCPU-hr + $0.004445/GB-hr ([AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/), [Vantage breakdown](https://www.vantage.sh/blog/fargate-pricing)) | **~$18.0** | 0.5×0.04048×730 = $14.78 + 1×0.004445×730 = $3.24 |
| 2 | ALB hourly | `alb.tf` | $0.0225/hr + $0.008/LCU-hr ([ELB pricing](https://aws.amazon.com/elasticloadbalancing/pricing/), [CloudZero guide](https://www.cloudzero.com/blog/aws-alb-pricing/)) | **~$17.5** | $16.43 hourly + ≲$1 LCU at current volume. LCU grows with traffic; ≤1 LCU adds up to $5.84 |
| 3 | Public IPv4 addresses (3) | ALB in 2 AZs = 2 IPs + 1 prod task public IP (`ecs.tf:104`) | $0.005/IP-hr ≈ $3.65/IP-mo ([AWS IPv4 charge](https://aws.amazon.com/blogs/networking-and-content-delivery/identify-and-optimize-public-ipv4-address-usage-on-aws/)) | **~$11.0** | Often invisible in mental budgets; +$3.65 whenever staging scales up |
| 4 | Secrets Manager (up to 4 secrets) | `iam.tf` / `variables.tf` ARN vars | $0.40/secret/mo ([Secrets Manager pricing via costbench](https://costbench.com/software/secrets-management/aws-secrets-manager/)) | **~$1.6** | Assumes all 4 ARNs populated in tfvars |
| 5 | CloudWatch Logs | `ecs.tf` awslogs, 7-day retention | $0.50/GB ingested ([CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/)) | **<$1** | JSON app logs at single-user volume; Container Insights already disabled |
| 6 | ECR storage | `ecr.tf`, keep last 20 images | $0.10/GB-mo | **~$0.5–2** | 20 retained images of a Python app image; dedup by layer. Assumption: 5–20 GB unique layers |
| 7 | SES receiving + S3 raw store + SNS | `ses.tf`; sandbox quotas in `aws-facts.json` | SES receiving ~$0.10/1k emails + $0.10/1k 256KB chunks ([SES pricing 2026 breakdown](https://www.emailplatformreview.com/blog/amazon-ses-pricing-official-2026/)); SNS HTTP $0.60/M after 100k free ([SNS pricing guide](https://www.cloudzero.com/blog/aws-sns-pricing/)); S3 $0.023/GB-mo | **~$0** | Volumes today are tens of emails/day; S3 objects expire at 30 days |
| 8 | Lambda `polytoken-ses-forwarder` | aws-facts.json (NOT in tf) | Free tier: 1M req + 400k GB-s/mo | **$0** | 256 MB × 30 s worst case × personal-mail volume ≪ free tier |
| 9 | Data transfer out | public-subnet tasks via IGW | $0.09/GB after 100 GB/mo free | **~$0** | Traffic to Supabase/Bedrock: Bedrock same-region calls; responses to SNS/ALB tiny. Watch this line if the app starts serving large payloads |
| 10 | **Bedrock (Claude + Titan embeddings)** | `iam.tf` task policy; pay-per-use | Per-token, model-dependent | **variable: $0 → cap** | The only unbounded line. Gated app-side by the cost circuit breaker (§4) and account-side only by the $30 budget *alert* |
| 11 | Staging Fargate (when scaled up) | `locals.tf` 0.25 vCPU/0.5 GB | as row 1 | **+$9.0 + $3.65 IP** | Default 0 — keep it that way |
| | **AWS baseline total (staging down, negligible Bedrock)** | | | **≈ $49–52/mo** | |

### The headline: baseline ≈ $50/mo vs a $30/mo budget

The Terraform's own default budget (`budget_monthly_limit_usd = "30"`) is **below the steady-state floor of the
infrastructure it provisions**. ALB ($17.5) + Fargate ($18) + IPv4 ($11) alone exceed $30 before a single Bedrock token.
Expect the 100%-actual alert to fire every month, which trains alert fatigue — the worst possible outcome for the one
guardrail that exists. Either cut the floor (see §6) or raise the budget to ~$60 and add a separate Bedrock-specific
cost-category alarm.

### Non-AWS lines

| Driver | Source | Est. $/mo | Notes |
|---|---|---|---|
| Vercel (apps/web) | `vercel.json` (npm build of `@polytoken/web`) | **$0 (Hobby) or $20/seat (Pro)** | **Assumption:** plan unknown from repo. Hobby prohibits commercial use and caps ~100 GB bandwidth ([Vercel pricing](https://vercel.com/pricing)); any monetization plan (`.planning/research/business/`) forces Pro |
| Supabase — 2 hosted projects | prod `dazyccjijdahxyciptkp`, staging `fyfwkjvbcrmjqjysdyqw` (`locals.tf`) | **$0 (Free) or $25/project (Pro)** | **Assumption:** tier unknown from repo. Free tier: 500 MB DB, 1 GB storage, 5 GB egress, **auto-pause after 7 days inactivity**, 2-project cap ([Supabase pricing](https://supabase.com/pricing), [2026 limits summary](https://uibakery.io/blog/supabase-pricing)) |

---

## 3. Single points of failure (verified in tf / repo)

1. **One prod ECS task** (`prod_desired_count = 1`). A task crash = full email-ingest and chat-backend outage until ECS
   replaces it (minutes). Deploys are safe (`minimum_healthy_percent = 100`, circuit breaker + rollback), but steady-state
   is a single container. No `aws_appautoscaling_target`/policy anywhere in `infrastructure/aws/` (verified — no autoscaling resources exist).
2. **SNS → HTTP with no DLQ — confirmed.** Neither `aws_sns_topic_subscription` in `ses.tf` sets a `redrive_policy`, and no
   SQS queue exists in the tf. SNS's default HTTP retry policy is **3 retries ~20 s apart, then the message is discarded**
   unless a DLQ is attached ([AWS SNS delivery retries](https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html)).
   Consequence: any listener downtime > ~1 minute (deploy gone wrong, task crash, Supabase outage causing 5xx) **silently
   drops inbound-email notifications**. Mitigation exists but is manual: raw MIME persists in S3 for 30 days and
   `infrastructure/scripts/redrive-inbound.sh` can republish by message-id — but nothing *detects* the gap.
3. **ALB is plain HTTP** (ports 80/8080, no ACM cert, `alb.tf`). Both a security and a reliability issue: SNS `http://`
   subscriptions can't be moved to `https` until a cert lands, and the SNS-signature check in the listener is the only
   authenticity guard on the ingest endpoint (which is open to `0.0.0.0/0`).
4. **Supabase project = the state SPOF.** All app state (emails, entities, chat, cost ledger, vault files) lives in one
   Supabase project. If on Free tier: 7-day inactivity auto-pause, no PITR, and per the ecosystem research
   **Supabase Storage has no S3 versioning — deletes are permanent** (`2026-07-22-ecosystem/app-packages.md:72`, citing the
   [S3 compatibility matrix](https://supabase.com/docs/guides/storage/s3/compatibility)). No off-provider replica exists.
5. **Terraform state is local** (`main.tf` backend commented out). Losing the laptop = losing the ability to safely evolve
   the infra; two operators applying = state divergence.
6. **Terraform ↔ reality drift** (confirmed by `aws-facts.json` vs `ses.tf`): the `personal-forward` rule + forwarder Lambda
   exist only in AWS. A `terraform apply` of the receipt rule set from a clean state could clobber or reorder deployed
   rules (rule order is load-bearing — see the long warning comment in `ses.tf:173-187`).
7. **SES sandbox** (`ProductionAccessEnabled: false`): **outbound** capped at 200 msgs/24h, 1/sec, and recipients must be
   verified. Inbound receiving is unaffected, but every reply/forward path (including the personal-forward Lambda) runs
   through this cap. META-AUDIT notes production access request is pending.
8. **Mutable `:latest` deploys** (`ecr.tf` + "CI forces new deployment" comment in `ecs.tf`): a bad push overwrites the
   only prod tag; rollback requires finding the previous digest by hand.
9. **Single-region everything** (us-east-1). Acceptable at this stage; noted for completeness — SES *receiving* is only
   available in a handful of regions anyway.

---

## 4. Cost-control design already in place (good, keep)

- **`chat_cost_ledger`** (`packages/db/src/schema/chat-cost-ledger.ts`): every adapter writes a usage row (server AND
  $0 browser rows), `cost_usd numeric(12,6)`, indexed for per-importer-per-day and per-conversation sums; ledger rows
  deliberately **survive conversation deletion** (`ON DELETE SET NULL`) so accounting can't be erased by content deletion.
- **`CostCircuitBreaker`** (`app/domain/services/cost_circuit_breaker.py`): fail-closed pre-turn gate with per-turn /
  per-session / per-day caps from settings only (no per-call override), mid-stream abort at per-turn cap, per-round cap
  (default $0.15), and **ledger-sum failure ⇒ block** (T-22-14). This is a genuinely strong app-level guard for the only
  unbounded AWS cost line (Bedrock).
- Residual gap: the breaker only guards **chat turns**. The email-ingest pipeline's Bedrock/Titan calls (segmentation,
  classification, embeddings — see META-AUDIT §3) are not behind these caps; a mail-bomb to the catch-all address is an
  unmetered Bedrock spend vector (see §5.2).

---

## 5. Scalability cliffs

### 5.1 The 500 GB drive migration (vision: OneDrive → polytoken, `.planning/prompts/2026-07-22-vision-and-handoff.md:177`)

| Cliff | Where it bites | Number |
|---|---|---|
| Supabase Free storage cap | 1 GB | Hit at 0.2% of the migration. **Pro is mandatory** before starting |
| Supabase Pro storage | 100 GB included, then ~$0.021/GB | 500 GB ≈ $25 + ~$8.4/mo overage ([Supabase pricing](https://supabase.com/pricing)) — cheap; storage cost is NOT the problem |
| Per-file size limit | `supabase/config.toml` local sets 50 MiB; hosted default is also 50 MB until raised | Any video/archive in the OneDrive dump fails upload until the project setting is raised |
| Egress | Pro includes 250 GB, then $0.09/GB | One full re-download of the drive ≈ $22.5+; sync-style clients multiply this |
| **No versioning / permanent deletes** | Supabase Storage ≠ S3 versioning (`app-packages.md:72`) | A bug or bad RLS rule during migration can irrecoverably destroy the only copy. The vision explicitly demands catastrophe-proofing **before** this migration |
| DB bloat from file metadata + embeddings | Free 500 MB / Pro 8 GB disk then paid | If files get indexed/embedded (halfvec columns already exist for entities), Postgres size grows far faster than expected |

Verdict: the 500 GB plan is **blocked on (a) Supabase Pro upgrade, (b) the content-addressed-storage + off-provider
versioned-S3 replica design already specced in `2026-07-22-ecosystem/app-packages.md` §(72-78)**. Do not migrate first.

### 5.2 Rising email volume

| Cliff | Trigger | Failure mode |
|---|---|---|
| SNS push vs one 0.5-vCPU task | Burst of N inbound emails ⇒ N concurrent HTTP posts | FastAPI task saturates; SNS gets timeouts; after 3 retries/20 s, **notifications silently discarded** (no DLQ). The higher the volume, the more the drop-rate compounds |
| No autoscaling | Sustained volume growth | Manual `desired_count` bumps only (and `lifecycle.ignore_changes` on it means tf won't manage it either) |
| Per-email Bedrock calls unguarded | Catch-all domain rule (`forwarding-catchall`) accepts mail for the whole domain | Spam flood ⇒ unmetered segmentation/classification/embedding spend; only the monthly budget *alert* notices, days later |
| SES sandbox outbound 200/day, 1/sec | Any feature that replies/forwards at volume | Sends start failing mid-day; personal-forward Lambda shares the same quota |
| SES receiving cost | ~$0.10/1k emails + $0.10/1k 256 KB chunks ([SES 2026 pricing](https://www.emailplatformreview.com/blog/amazon-ses-pricing-official-2026/)) | Linear, cheap — not a cliff, listed to show it's fine |
| ALB LCU | >1 GB/hr processed or >25 conn/s | Linear $0.008/LCU-hr — fine |
| `chat_cost_ledger` growth | Unbounded append | Indexed for the hot sums; fine for years at this scale. Revisit partitioning only past ~10⁷ rows |
| Ingest error-swallowing | Volume × ~60 `except Exception` sites (META-AUDIT §3) | "Received but never analyzed" emails scale linearly with volume, invisibly — reliability cliff more than cost |

---

## 6. Prioritized actions

### Cost (est. savings on a ~$50/mo AWS baseline)

1. **Re-architect ingest to SNS → SQS → poller and drop the ALB entirely** (biggest lever, also the #1 reliability fix).
   The ALB exists solely to receive SNS HTTP posts + health checks; an SQS queue consumed by the same Fargate task
   removes the ALB ($17.5), its 2 public IPs ($7.3), and the public ingress surface — **saves ~$25/mo (≈50% of baseline)**
   while gaining native retries + DLQ for ~$0 (SQS free tier 1M req/mo). The task keeps its own public IP for egress
   ($3.65 ≪ NAT's $32.85/mo + $0.045/GB — do NOT "fix" public subnets with a NAT gateway).
2. **Move Fargate to ARM64 (Graviton)**: ~20% cheaper compute ($0.03238/vCPU-hr, $0.00356/GB-hr per
   [Fargate pricing](https://aws.amazon.com/fargate/pricing/)) — prod task $18.0 → ~$14.4, **saves ~$3.6/mo** for a
   one-line `runtime_platform` + multi-arch image build.
3. **Right-size the budget**: raise `budget_monthly_limit_usd` to match the chosen architecture (≈$30 post-ALB-removal,
   ≈$60 as-is) so alerts regain meaning; optionally add a second, small Bedrock-only budget (service-filtered) as the
   real spend tripwire.
4. **Secrets Manager → SSM Parameter Store (standard tier, free)** for the 4 secrets: **saves $1.6/mo**; ECS supports
   `valueFrom` SSM ARNs with the same mechanism.
5. **Keep** the existing discipline: staging at `desired_count 0`, Container Insights off, 7-day log retention,
   30-day S3 expiry, keep-last-20 ECR — all already correct.
6. If the stack stays on Fargate long-term: a 1-year Compute Savings Plan trims another ~20% off row 1 — only after the
   architecture stabilizes.

### Reliability (ordered)

1. **Attach DLQs now** (if not doing action 1 immediately): add `redrive_policy` + an SQS DLQ per SNS subscription in
   `ses.tf`, plus a CloudWatch alarm on DLQ depth and on SNS `NumberOfNotificationsFailed`. Without this, every deploy
   window is a silent-mail-loss window ([SNS retry docs](https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html)).
2. **Reconciliation job**: periodic task comparing S3 `inbound/*` objects vs ingested `message_id`s, auto-invoking the
   existing idempotent redrive (`infrastructure/scripts/redrive-inbound.sh` logic) — converts the 30-day S3 buffer from
   a manual recovery tool into an actual guarantee.
3. **Enable the S3 Terraform backend** (`main.tf`) with state locking; then **codify the drifted resources**
   (forwarder Lambda, `personal-forward` rule, deployed `forwarding-catchall`) before any future `apply` — META-AUDIT
   already flags this as an early, independent task.
4. **ACM cert + 443 listener**, move SNS subscriptions to `https`, redirect 80→443. Free (public ACM certs cost nothing),
   removes the plaintext ingest path.
5. **Supabase prod hardening before the 500 GB migration**: upgrade to Pro (no auto-pause, PITR add-on available), raise
   the per-file upload limit, and implement the CAS + nightly `rclone` replica to a **versioned, Object-Locked real S3
   bucket** exactly as specced in `2026-07-22-ecosystem/app-packages.md`.
6. **Extend cost-cap coverage to the ingest pipeline**: route the per-email Bedrock/Titan calls through the same
   ledger + a per-day ingest cap (the breaker class is already generic enough), closing the mail-bomb spend vector.
7. **Deploy by immutable digest**: have CI pass the image digest into the task definition (or tag per-commit) so prod
   rollback is `terraform apply`-able; keep `:latest` only as a convenience alias.
8. **(Cheap insurance)** alarm on ALB `HealthyHostCount < 1` (or, post-SQS, on queue age) — today nothing pages when the
   single prod task is down; SNS just quietly burns its 3 retries.

---

## Sources

- AWS Fargate pricing: https://aws.amazon.com/fargate/pricing/ (rates cross-checked via https://www.vantage.sh/blog/fargate-pricing — $0.04048/vCPU-hr, $0.004445/GB-hr x86 us-east-1)
- ELB/ALB pricing: https://aws.amazon.com/elasticloadbalancing/pricing/ ($0.0225/hr + $0.008/LCU-hr; guide: https://www.cloudzero.com/blog/aws-alb-pricing/)
- Public IPv4 charge ($0.005/IP-hr since 2024-02-01): https://aws.amazon.com/blogs/networking-and-content-delivery/identify-and-optimize-public-ipv4-address-usage-on-aws/
- SES pricing (2026 receiving rates): https://www.emailplatformreview.com/blog/amazon-ses-pricing-official-2026/ (canonical: https://aws.amazon.com/ses/pricing/)
- SNS pricing (HTTP $0.60/M after 100k free): https://www.cloudzero.com/blog/aws-sns-pricing/
- SNS HTTP retry/discard + DLQ behavior: https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html
- CloudWatch pricing ($0.50/GB ingest): https://aws.amazon.com/cloudwatch/pricing/
- Secrets Manager ($0.40/secret/mo): https://costbench.com/software/secrets-management/aws-secrets-manager/
- Supabase pricing/limits: https://supabase.com/pricing (2026 tier summary: https://uibakery.io/blog/supabase-pricing)
- Supabase Storage S3-compat (no versioning): https://supabase.com/docs/guides/storage/s3/compatibility
- Vercel pricing: https://vercel.com/pricing
- S3 versioning/Object Lock: https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html

**Labeled assumptions:** 730 hr/mo; staging stays at `desired_count = 0`; near-idle traffic (≤1 ALB LCU); all 4 secret
ARNs populated; Vercel plan and Supabase tier unknown from repo (both modeled at both tiers); ECR unique-layer footprint
5–20 GB; Bedrock spend treated as variable/gated rather than estimated (no usage data in repo).
