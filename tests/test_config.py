from app.core.config import settings


def test_supabase_server_key_prefers_secret_key(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_new")
    monkeypatch.setattr(settings, "supabase_service_role_key", "legacy-jwt")
    assert settings.supabase_server_key == "sb_secret_new"


def test_supabase_server_key_falls_back_to_legacy_service_role_key(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", None)
    monkeypatch.setattr(settings, "supabase_service_role_key", "legacy-jwt")
    assert settings.supabase_server_key == "legacy-jwt"


def test_supabase_server_key_none_when_neither_configured(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", None)
    monkeypatch.setattr(settings, "supabase_service_role_key", None)
    assert settings.supabase_server_key is None


def test_supabase_storage_headers_secret_key_sends_apikey_only(monkeypatch):
    """sb_secret_... is not a JWT -- must not be sent as Authorization: Bearer."""
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_new")
    monkeypatch.setattr(settings, "supabase_service_role_key", "legacy-jwt")
    assert settings.supabase_storage_headers == {"apikey": "sb_secret_new"}


def test_supabase_storage_headers_legacy_fallback_sends_bearer_jwt(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", None)
    monkeypatch.setattr(settings, "supabase_service_role_key", "legacy-jwt")
    assert settings.supabase_storage_headers == {"apikey": "legacy-jwt", "Authorization": "Bearer legacy-jwt"}


def test_supabase_storage_headers_none_when_neither_configured(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", None)
    monkeypatch.setattr(settings, "supabase_service_role_key", None)
    assert settings.supabase_storage_headers is None
