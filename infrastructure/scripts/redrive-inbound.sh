#!/usr/bin/env bash
# Redrive an inbound email through the SNS → listener → Supabase pipeline.
#
# Reads the SNS topic ARN and S3 bucket from terraform outputs — never
# hardcode infra identifiers; keep ops commands in sync with declarations.
#
# Usage:
#   ./redrive-inbound.sh <env> <ses-message-id>   # republish one email
#   ./redrive-inbound.sh <env> --list             # list raw emails in S3 for env
#
#   env: prod | staging | local
#
# The ingestion use case re-parses the raw MIME from S3, so only the SES
# messageId is required in the synthetic notification. Ingestion is
# idempotent on (importer_id, message_id) — safe to redrive duplicates.

set -euo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../aws" && pwd)"

# Resolve terraform: PATH first, then the Windows winget install location
# (Git Bash does not inherit the PowerShell PATH entry for it).
TF_BIN="${TERRAFORM_BIN:-$(command -v terraform || command -v terraform.exe || echo "$LOCALAPPDATA/Microsoft/WinGet/Packages/Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe/terraform.exe")}"

ENVIRONMENT="${1:?usage: redrive-inbound.sh <prod|staging|local> <ses-message-id|--list>}"
MESSAGE_ID="${2:?usage: redrive-inbound.sh <prod|staging|local> <ses-message-id|--list>}"

TOPIC_ARN=$("$TF_BIN" -chdir="$TF_DIR" output -json ses_inbound_topic_arns | python -c "import json,sys; print(json.load(sys.stdin)['$ENVIRONMENT'])")
BUCKET=$("$TF_BIN" -chdir="$TF_DIR" output -raw ses_inbound_bucket)
REGION="${AWS_REGION:-us-east-1}"

if [[ "$MESSAGE_ID" == "--list" ]]; then
  aws s3 ls "s3://${BUCKET}/inbound/${ENVIRONMENT}/" --region "$REGION"
  exit 0
fi

S3_KEY="inbound/${ENVIRONMENT}/${MESSAGE_ID}"

# Fail fast if the raw email is not in S3 (30-day lifecycle).
aws s3api head-object --bucket "$BUCKET" --key "$S3_KEY" --region "$REGION" >/dev/null

aws sns publish \
  --region "$REGION" \
  --topic-arn "$TOPIC_ARN" \
  --message "{\"notificationType\":\"Received\",\"mail\":{\"messageId\":\"${MESSAGE_ID}\"}}" \
  --output json

echo "redrive published: env=${ENVIRONMENT} message_id=${MESSAGE_ID}"
