"""
Application settings hierarchy.

BaseAppSettings -> DevSettings / StagingSettings / ProdSettings
AWS Secrets Manager JSON envelope parsing preserved for production.
"""

from __future__ import annotations

import json
import os
from enum import StrEnum
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Default Bedrock Claude model id (overridable via BEDROCK_MODEL_ID env var).
# Uses the inference-profile id for Claude on Bedrock; pin/upgrade via env.
# claude-sonnet-4-6 is the active profile verified on account 271369143207;
# the prior claude-sonnet-4-20250514 id is legacy.
DEFAULT_BEDROCK_MODEL_ID = "us.anthropic.claude-sonnet-4-6"


def parse_secret_value(value: str | None, key: str, environment: str) -> str:
    """Extract a value from an AWS Secrets Manager JSON envelope.

    Always strips leading/trailing whitespace to prevent mismatches
    caused by trailing newlines in .env files or Docker secrets.
    """
    if not value:
        return ""
    value = value.strip()
    if environment.lower() in ("production", "staging") and value.startswith("{"):
        try:
            extracted = json.loads(value).get(key, value)
            return extracted.strip() if isinstance(extracted, str) else str(extracted)
        except json.JSONDecodeError:
            pass
    return value


class Environment(StrEnum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class BaseAppSettings(BaseSettings):
    """Shared settings for all environments."""

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # --- Application ---
    APP_NAME: str = "Nauta Email Listener"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Environment = Environment.DEVELOPMENT
    DEBUG: bool = False

    # --- Server ---
    HOST: str = "0.0.0.0"  # nosec B104 — container requires binding to all interfaces
    PORT: int = 8000

    # --- Logging ---
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False

    # --- Security ---
    API_KEY: str = ""
    API_KEY_HEADER: str = "X-API-Key"

    # --- Supabase ---
    SUPABASE_URL: str = ""
    SUPABASE_SECRET_KEY: str = ""  # new-format sb_secret_... key injected by ECS from Secrets Manager

    # --- AWS Bedrock (Claude transport; auth via ECS task IAM role, no secret) ---
    BEDROCK_REGION: str = ""  # defaults to the task region via property; e.g. us-east-1
    BEDROCK_MODEL_ID: str = ""  # overridable; defaults to current Claude model on Bedrock

    # --- AWS ---
    AWS_TEXTRACT_REGION: str = "us-east-1"

    # --- SES inbound (raw MIME store; auth via IAM role / default chain) ---
    SES_S3_BUCKET: str = "nauta-services-ses-inbound-emails"
    SES_S3_REGION: str = ""  # defaults to AWS_TEXTRACT_REGION

    # --- Attachments (Supabase Storage) ---
    ATTACHMENTS_BUCKET: str = "email-attachments"

    # --- Tenant (single-tenant for now; D-05 keeps rows importer-scoped) ---
    DEFAULT_IMPORTER_ID: str = "00000000-0000-0000-0000-000000000001"

    @property
    def api_key(self) -> str:
        return parse_secret_value(self.API_KEY, "API_KEY", self.ENVIRONMENT.value)

    @property
    def supabase_url(self) -> str:
        return parse_secret_value(self.SUPABASE_URL, "SUPABASE_URL", self.ENVIRONMENT.value)

    @property
    def supabase_secret_key(self) -> str:
        return parse_secret_value(self.SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY", self.ENVIRONMENT.value)

    @property
    def bedrock_region(self) -> str:
        """Region for Bedrock InvokeModel calls; falls back to the Textract region."""
        return (self.BEDROCK_REGION or self.AWS_TEXTRACT_REGION).strip()

    @property
    def ses_s3_region(self) -> str:
        """Region for the SES inbound S3 bucket; falls back to the Textract region."""
        return (self.SES_S3_REGION or self.AWS_TEXTRACT_REGION).strip()

    @property
    def ses_s3_prefix(self) -> str:
        """Object key prefix SES writes under for this environment (see infrastructure/aws/ses.tf)."""
        prefixes = {
            Environment.DEVELOPMENT: "inbound/local/",
            Environment.STAGING: "inbound/staging/",
            Environment.PRODUCTION: "inbound/prod/",
        }
        return prefixes[self.ENVIRONMENT]

    @property
    def bedrock_model_id(self) -> str:
        """Bedrock Claude model id; overridable via env, sensible default otherwise."""
        return (self.BEDROCK_MODEL_ID or DEFAULT_BEDROCK_MODEL_ID).strip()


class DevSettings(BaseAppSettings):
    ENVIRONMENT: Environment = Environment.DEVELOPMENT
    DEBUG: bool = True


class StagingSettings(BaseAppSettings):
    ENVIRONMENT: Environment = Environment.STAGING
    LOG_JSON: bool = True


class ProdSettings(BaseAppSettings):
    ENVIRONMENT: Environment = Environment.PRODUCTION
    LOG_JSON: bool = True


_SETTINGS_BY_ENV: dict[str, type[BaseAppSettings]] = {
    "development": DevSettings,
    "staging": StagingSettings,
    "production": ProdSettings,
}


@lru_cache
def get_settings() -> BaseAppSettings:
    environment = os.getenv("ENVIRONMENT", "development").lower()
    settings_cls = _SETTINGS_BY_ENV.get(environment, DevSettings)
    return settings_cls()
