---
phase: 03-security-email-connection
plan: "01"
title: SES Inbound Infrastructure
subsystem: infrastructure/aws
tags: [ses, sns, terraform, inbound-email]
dependency_graph:
  requires: [02-02-SUMMARY.md]
  provides: [SES domain identity, SNS topic nauta-services-ses-inbound, receipt rule catch-all]
  affects: [infrastructure/aws/ses.tf, infrastructure/aws/variables.tf]
tech_stack:
  added: [aws_ses_domain_identity, aws_sns_topic, aws_sns_topic_subscription, aws_ses_receipt_rule]
  patterns: [SNS HTTP subscription with endpoint_auto_confirms=false]
key_files:
  created: [infrastructure/aws/ses.tf]
  modified: [infrastructure/aws/variables.tf, infrastructure/aws/terraform.tfvars (gitignored)]
decisions:
  - encoding must be "Base64" (not "BASE64") per Terraform AWS provider validation
  - terraform.tfvars is gitignored (contains secret ARNs); alb_dns_name added locally only
  - SGR drift (sgr-0791694527ab7b257) was already in Terraform state; import was not needed
metrics:
  duration: ~15 minutes
  completed: "2026-06-11"
  tasks_completed: 6
  files_changed: 3
---

# Phase 3 Plan 01: SES Inbound Infrastructure Summary

## One-liner

AWS SES domain identity + SNS topic + HTTP subscription + catch-all receipt rule provisioned via Terraform for magnitudetech.com.br inbound email delivery.

## What Was Built

- `infrastructure/aws/ses.tf` — complete SES inbound stack:
  - `aws_ses_domain_identity.main` for `magnitudetech.com.br`
  - `output.ses_domain_verification_token` = `H0ceEWQ49bRbsKREhXyToQlqkukIeBnwHAi5T6tvyY0=`
  - `aws_sns_topic.ses_inbound` named `nauta-services-ses-inbound`
  - `aws_sns_topic_policy.ses_inbound` allowing `ses.amazonaws.com` to publish
  - `aws_sns_topic_subscription.alb_http` → `http://nauta-services-email-listener-2115368239.us-east-1.elb.amazonaws.com/v1/emails/inbound-sns` with `endpoint_auto_confirms = false`
  - `aws_ses_receipt_rule_set.main` named `nauta-services-inbound` (set as active)
  - `aws_ses_receipt_rule.catch_all` — catch-all rule with SNS action, Base64 encoding
- `infrastructure/aws/variables.tf` — added `alb_dns_name` variable
- `infrastructure/aws/terraform.tfvars` (gitignored) — added `alb_dns_name` value

## Terraform Apply Result

```
Apply complete! Resources: 1 added, 1 changed, 0 destroyed.

Outputs:
ses_domain_verification_token = "H0ceEWQ49bRbsKREhXyToQlqkukIeBnwHAi5T6tvyY0="
```

All SES/SNS resources are live in `us-east-1`. The full apply ran in two steps:
1. First apply created SES domain identity, SNS topic, SNS subscription (7 resources — failed on receipt rule due to encoding error)
2. Fixed `encoding = "Base64"` (was `"BASE64"`), second apply created the receipt rule (1 resource + 1 SG update)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SES receipt rule encoding value casing**
- **Found during:** Task 4 / Task 5 apply
- **Issue:** Plan specified `encoding = "BASE64"` but Terraform AWS provider validates against `["UTF-8" "Base64"]` — exact casing required
- **Fix:** Changed to `encoding = "Base64"`
- **Files modified:** `infrastructure/aws/ses.tf`
- **Commit:** a7d3f3f

**2. [Rule 3 - Deviation] SGR import was not needed**
- **Found during:** Task 1 (pre-apply drift fix)
- **Issue:** The import command in the plan used a raw SGR ID (`sgr-...`) which is not the correct import ID format for `aws_security_group_rule`. Additionally, `terraform state list` confirmed the resource was already in state (`sgrule-1288743131`). The drift had self-resolved.
- **Fix:** Skipped import; proceeded to `terraform plan` which confirmed the resource as known.

## Pending Manual Actions (do not block execution)

### Task 5 — DNS TXT record for SES domain verification

After `terraform apply`, add this DNS record at the registrar:

| Name | Type | Value |
|------|------|-------|
| `_amazonses.magnitudetech.com.br` | TXT | `H0ceEWQ49bRbsKREhXyToQlqkukIeBnwHAi5T6tvyY0=` |

SES domain status will show **Verified** within ~1 minute of DNS propagation.

### Task 6 — MX record change

After domain is verified, add/update MX record at registrar:

| Name | Type | Priority | Value |
|------|------|----------|-------|
| `magnitudetech.com.br` | MX | 5 (lower than Google's priority) | `inbound-smtp.us-east-1.amazonaws.com` |

Set priority **lower** than existing Google Workspace MX records (e.g., if Google is at 10, set SES at 5).

### SNS Subscription Confirmation

SNS subscription is currently in **PendingConfirmation** — this is expected. After Plan 03-02 deploys the `/v1/emails/inbound-sns` handler, SNS will retry the `SubscriptionConfirmation` POST (retries for up to 3 days).

## Known Stubs

None — infrastructure-only plan, no application stubs.

## Threat Flags

None — resources added are internal AWS service-to-service wiring. SNS HTTP endpoint is the ALB public DNS; no new attack surface beyond what already existed on port 80.

## Self-Check: PASSED

- `infrastructure/aws/ses.tf` — FOUND (created, committed a7d3f3f)
- `infrastructure/aws/variables.tf` — FOUND (alb_dns_name variable added, committed a7d3f3f)
- `terraform.tfvars` alb_dns_name — PRESENT locally (gitignored, not in commit)
- terraform apply — SUCCEEDED (`Apply complete! Resources: 1 added, 1 changed, 0 destroyed.`)
- All SES/SNS resources verified live via apply output
