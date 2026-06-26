"""Tests for settings secrets extensions and Supabase client factory."""

# DevSettings(_env_file=None) verifies code defaults independent of the developer/CI .env (UAT Test 1 isolation)

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.settings import DevSettings, get_settings, parse_secret_value

# ---------------------------------------------------------------------------
# parse_secret_value: raw sb_secret_... key passthrough
# ---------------------------------------------------------------------------


def test_parse_secret_value_raw_sb_secret_passes_through() -> None:
    """A raw sb_secret_... value (non-JSON) must pass through unchanged."""
    raw_key = "sb_secret_abc123xyz"
    result = parse_secret_value(raw_key, "SUPABASE_SECRET_KEY", "production")
    assert result == raw_key


def test_parse_secret_value_empty_returns_empty() -> None:
    result = parse_secret_value("", "SUPABASE_SECRET_KEY", "production")
    assert result == ""


def test_parse_secret_value_none_returns_empty() -> None:
    result = parse_secret_value(None, "SUPABASE_SECRET_KEY", "production")
    assert result == ""


# ---------------------------------------------------------------------------
# BaseAppSettings: new fields present with correct defaults
# ---------------------------------------------------------------------------


def test_settings_has_supabase_url_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    settings = DevSettings(_env_file=None)
    assert hasattr(settings, "SUPABASE_URL")
    assert settings.SUPABASE_URL == ""


def test_settings_has_supabase_secret_key_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    settings = DevSettings(_env_file=None)
    assert hasattr(settings, "SUPABASE_SECRET_KEY")
    assert settings.SUPABASE_SECRET_KEY == ""


def test_settings_has_bedrock_region_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BEDROCK_REGION", raising=False)
    settings = DevSettings(_env_file=None)
    assert hasattr(settings, "BEDROCK_REGION")
    assert settings.BEDROCK_REGION == ""


def test_settings_has_bedrock_model_id_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BEDROCK_MODEL_ID", raising=False)
    settings = DevSettings(_env_file=None)
    assert hasattr(settings, "BEDROCK_MODEL_ID")
    assert settings.BEDROCK_MODEL_ID == ""


def test_settings_has_aws_textract_region_field(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.delenv("AWS_TEXTRACT_REGION", raising=False)
    settings = get_settings()
    assert hasattr(settings, "AWS_TEXTRACT_REGION")
    assert settings.AWS_TEXTRACT_REGION == "us-east-1"
    get_settings.cache_clear()


def test_settings_supabase_url_property(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    settings = get_settings()
    assert settings.supabase_url == "https://abc.supabase.co"
    get_settings.cache_clear()


def test_settings_supabase_secret_key_property(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    raw_key = "sb_secret_live_xyz123"
    monkeypatch.setenv("SUPABASE_SECRET_KEY", raw_key)
    settings = get_settings()
    assert settings.supabase_secret_key == raw_key
    get_settings.cache_clear()


def test_settings_bedrock_region_falls_back_to_textract_region(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.delenv("BEDROCK_REGION", raising=False)
    monkeypatch.setenv("AWS_TEXTRACT_REGION", "sa-east-1")
    settings = get_settings()
    assert settings.bedrock_region == "sa-east-1"
    get_settings.cache_clear()


def test_settings_bedrock_region_override(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("BEDROCK_REGION", "us-west-2")
    settings = get_settings()
    assert settings.bedrock_region == "us-west-2"
    get_settings.cache_clear()


def test_settings_bedrock_model_id_uses_default_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.settings import DEFAULT_BEDROCK_MODEL_ID

    monkeypatch.delenv("BEDROCK_MODEL_ID", raising=False)
    settings = DevSettings(_env_file=None)
    assert settings.bedrock_model_id == DEFAULT_BEDROCK_MODEL_ID


def test_settings_bedrock_model_id_override(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")
    settings = get_settings()
    assert settings.bedrock_model_id == "anthropic.claude-3-haiku-20240307-v1:0"
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# get_supabase_client: fail-closed and lru_cached
# ---------------------------------------------------------------------------


def test_get_supabase_client_raises_when_url_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.infrastructure.supabase.client import get_supabase_client

    get_supabase_client.cache_clear()
    get_settings.cache_clear()
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_abc")
    # DevSettings(_env_file=None) reads only OS env, bypassing the on-disk .env (UAT Test 1 isolation)
    with (
        patch("app.infrastructure.supabase.client.get_settings", side_effect=lambda: DevSettings(_env_file=None)),
        pytest.raises(RuntimeError, match="SUPABASE_URL"),
    ):
        get_supabase_client()
    get_supabase_client.cache_clear()
    get_settings.cache_clear()


def test_get_supabase_client_raises_when_key_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.infrastructure.supabase.client import get_supabase_client

    get_supabase_client.cache_clear()
    get_settings.cache_clear()
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    # DevSettings(_env_file=None) reads only OS env, bypassing the on-disk .env (UAT Test 1 isolation)
    with (
        patch("app.infrastructure.supabase.client.get_settings", side_effect=lambda: DevSettings(_env_file=None)),
        pytest.raises(RuntimeError, match="SUPABASE_SECRET_KEY"),
    ):
        get_supabase_client()
    get_supabase_client.cache_clear()
    get_settings.cache_clear()


def test_get_supabase_client_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    """Two calls return the same object (lru_cache)."""
    from app.infrastructure.supabase.client import get_supabase_client

    get_supabase_client.cache_clear()
    get_settings.cache_clear()
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_live_xyz")

    sentinel = MagicMock()
    with patch("app.infrastructure.supabase.client.create_client", return_value=sentinel):
        client1 = get_supabase_client()
        client2 = get_supabase_client()
    assert client1 is client2
    get_supabase_client.cache_clear()
    get_settings.cache_clear()


def test_get_supabase_client_returns_create_client_result(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.infrastructure.supabase.client import get_supabase_client

    get_supabase_client.cache_clear()
    get_settings.cache_clear()
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_live_xyz")

    sentinel = MagicMock()
    with patch("app.infrastructure.supabase.client.create_client", return_value=sentinel) as mock_create:
        result = get_supabase_client()
    mock_create.assert_called_once_with("https://abc.supabase.co", "sb_secret_live_xyz")
    assert result is sentinel
    get_supabase_client.cache_clear()
    get_settings.cache_clear()
