# Infrastructure

## Architecture

```
infrastructure/
└── aws/    → Terraform: VPC, ECR, ECS Fargate (prod + staging), ALB, IAM (GitHub OIDC)
```

## Environments

| Environment | Branch | ECS Service                             | Image tag  | Endpoint        |
| ----------- | ------ | --------------------------------------- | ---------- | --------------- |
| Production  | `main` | `nauta-services-email-listener`         | `:latest`  | ALB `:80`       |
| Staging     | `dev`  | `nauta-services-email-listener-staging` | `:staging` | ALB `:8080`     |

Both services run in one ECS cluster behind a shared ALB. Once a domain + ACM certificate
exist, move both listeners to `:443` with host-based routing.

## Deployment flow

```
push to branch (main or dev)
  └─ apps/email-listener/** changed?
       ├── CI: ruff, mypy, import-linter, bandit, pytest (80% coverage)
       └── Deploy:
            ├── OIDC auth → ECR login
            ├── docker build + Trivy scan (CRITICAL/HIGH blocks)
            ├── push to ECR (:latest prod, :staging staging)
            ├── aws ecs update-service --force-new-deployment
            ├── aws ecs wait services-stable
            └── smoke test → GET /health
```

## Provisioning

```bash
cd infrastructure/aws
cp terraform.tfvars.example terraform.tfvars   # fill in github_repository etc.
terraform init
terraform plan
terraform apply
```

Then set in GitHub:

- Secret `AWS_DEPLOY_ROLE_ARN` ← `terraform output github_deploy_role_arn`
- Variable `PRODUCTION_HEALTH_URL` ← `http://<alb_dns_name>/health`
- Variable `STAGING_HEALTH_URL` ← `http://<alb_dns_name>:8080/health`

Prerequisite: a GitHub OIDC provider (`token.actions.githubusercontent.com`) must already
exist in the AWS account (referenced via data source, not created here).

## Roadmap

- Stage 3 (email connection): SES inbound for agent@magnitudetech.com.br → S3 + SNS/SQS in
  front of the service; the generic webhook stays for testing and alternate providers.
