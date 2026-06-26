---
phase: 02-aws-infrastructure-ci-cd
plan: 02
status: complete
completed: "2026-06-11"
---

# Plan 02-02: Terraform Apply — ECR/ECS/ALB/IAM

## What Was Built

- GitHub OIDC provider created in account 271369143207 (was absent)
- `infrastructure/aws/terraform.tfvars` filled and gitignored
- `terraform apply` provisioned 30 resources — all green
- Two bug fixes applied to existing tf files:
  - `locals.tf`: added `tg_prefix = "nauta-el"` + `tg_name` fields (ALB TG names capped at 32 chars)
  - `network.tf`: replaced em-dash in SG description with ASCII hyphen (AWS API rejects non-ASCII)

## Key Artifacts

| Artifact | Value |
|----------|-------|
| ECR repo URL | `271369143207.dkr.ecr.us-east-1.amazonaws.com/nauta-services-email-listener` |
| ALB DNS name | `nauta-services-email-listener-2115368239.us-east-1.elb.amazonaws.com` |
| GitHub deploy role ARN | `arn:aws:iam::271369143207:role/nauta-services-email-listener-github-deploy` |
| ECS cluster | `nauta-services-email-listener` |
| ECS service (prod) | `nauta-services-email-listener` |
| ECS service (staging) | `nauta-services-email-listener-staging` |

## Self-Check: PASSED

- ✓ `terraform apply` exits 0
- ✓ `github_deploy_role_arn` → `arn:aws:iam::271369143207:role/nauta-services-email-listener-github-deploy`
- ✓ `alb_dns_name` → `nauta-services-email-listener-2115368239.us-east-1.elb.amazonaws.com`
- ✓ `ecs_cluster_name` → `nauta-services-email-listener`
- ✓ Both ECS services ACTIVE (tasks cycling pending first image push — expected per plan)
- ✓ terraform.tfvars gitignored; no secret values in any committed file
