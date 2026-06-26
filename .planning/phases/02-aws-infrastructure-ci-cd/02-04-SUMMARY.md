---
phase: 02-aws-infrastructure-ci-cd
plan: 04
status: complete
completed: "2026-06-11"
---

# Plan 02-04: CI/CD End-to-End Verification

## What Was Built

- Triggered staging pipeline (dev push) and production pipeline (main merge)
- Fixed Trivy container scan failures caused by two HIGH CVEs in Python tooling
- Fixed ALB security group gap that blocked port 8080 smoke test traffic
- Confirmed both pipelines green with live /health 200 responses from ALB

## Fixes Applied

### CVE-2026-23949 / CVE-2026-24049 — Trivy scan failures

`jaraco.context 5.3.0` (path traversal) and `wheel 0.45.1` (privilege escalation) had HIGH
severity findings with available fixes. Both were present as direct deps and as setuptools
vendored packages. Fixed in `apps/email-listener/Dockerfile` by upgrading in both build and
runtime stages:

```dockerfile
RUN pip3 install --no-cache-dir --upgrade "setuptools>=79.0.1" "wheel>=0.46.2"
```

Committed as: `fix(security): upgrade setuptools and wheel to patch CVE-2026-23949, CVE-2026-24049`

### ALB port 8080 security group gap

`aws_security_group_rule.alb_staging_port` was declared in `alb.tf` but was never applied
(partial apply failure in Wave 2 due to em-dash bug). The rule was applied via AWS CLI:

```
sgr-0791694527ab7b257  tcp  8080  sg-02a160158f4c62b5a
```

> **Terraform drift note**: this rule exists in AWS but not in Terraform state.
> Sync before next `terraform apply`: `terraform import aws_security_group_rule.alb_staging_port sgr-0791694527ab7b257`

## Pipeline Run Results

| Run | Branch | Status | Duration |
|-----|--------|--------|----------|
| `27321926576` | dev (staging) | ✓ Green | 3m 23s |
| `27322114244` | main (production) | ✓ Green | 2m 1s |

All steps passed in both runs: Test → Build image → Trivy scan → Push image → Deploy to ECS → Wait for service stability → Smoke test.

## Key Artifacts

| Name | Value |
|------|-------|
| ALB DNS | `nauta-services-email-listener-2115368239.us-east-1.elb.amazonaws.com` |
| Production health URL | `http://nauta-services-email-listener-2115368239.us-east-1.elb.amazonaws.com/health` |
| Staging health URL | `http://nauta-services-email-listener-2115368239.us-east-1.elb.amazonaws.com:8080/health` |
| ALB SG ID | `sg-02a160158f4c62b5a` |
| Port 8080 SG rule | `sgr-0791694527ab7b257` |

## Self-Check: PASSED

- ✓ Production /health → HTTP 200 `{"success":true,"data":{"status":"alive"},"error":null}`
- ✓ Staging /health → HTTP 200 `{"success":true,"data":{"status":"alive"},"error":null}`
- ✓ Trivy scan clean (no CRITICAL/HIGH with available fixes)
- ✓ ECS services stable (both environments)
