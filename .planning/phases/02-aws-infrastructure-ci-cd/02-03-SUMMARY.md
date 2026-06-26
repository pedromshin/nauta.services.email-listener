---
phase: 02-aws-infrastructure-ci-cd
plan: 03
status: complete
completed: "2026-06-11"
---

# Plan 02-03: GitHub Secrets + Variables Wired

## What Was Built

- GitHub repo secret `AWS_DEPLOY_ROLE_ARN` set to the OIDC deploy role ARN
- GitHub repo variables `PRODUCTION_HEALTH_URL` and `STAGING_HEALTH_URL` set from ALB DNS

## Key Artifacts

| Name | Value |
|------|-------|
| Secret: AWS_DEPLOY_ROLE_ARN | `arn:aws:iam::271369143207:role/nauta-services-email-listener-github-deploy` |
| Var: PRODUCTION_HEALTH_URL | `http://nauta-services-email-listener-2115368239.us-east-1.elb.amazonaws.com/health` |
| Var: STAGING_HEALTH_URL | `http://nauta-services-email-listener-2115368239.us-east-1.elb.amazonaws.com:8080/health` |

## Self-Check: PASSED

- ✓ `gh secret list` includes `AWS_DEPLOY_ROLE_ARN`
- ✓ `gh variable list` shows `PRODUCTION_HEALTH_URL` with `:80` (default port)
- ✓ `gh variable list` shows `STAGING_HEALTH_URL` with `:8080`
