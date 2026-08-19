import uuid

import httpx
import pytest

from app.core.config import settings
from app.resources.services.resource_storage_service import (
    ResourceStorageNotConfigured,
    ResourceStorageService,
)


class _FakeResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=httpx.Request("GET", "http://x"), response=self)

    def json(self):
        return self._json


# --- Server-side key resolution (Settings.supabase_storage_headers) ---


async def test_create_signed_upload_url_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", None)
    monkeypatch.setattr(settings, "supabase_service_role_key", None)
    service = ResourceStorageService()
    with pytest.raises(ResourceStorageNotConfigured):
        await service.create_signed_upload_url("some/path")


async def test_create_signed_upload_url_secret_key_sends_apikey_only(monkeypatch):
    """sb_secret_... is not a JWT -- must NOT be sent as Authorization: Bearer, only apikey.
    Also confirms it's preferred over a simultaneously-configured legacy key."""
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_fake")
    monkeypatch.setattr(settings, "supabase_service_role_key", "legacy-jwt-fake")
    captured_headers = {}

    async def fake_post(self, url, headers=None, json=None):
        captured_headers.update(headers or {})
        return _FakeResponse({"url": "/object/upload/sign/group-resources/some/path?token=abc123"})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    service = ResourceStorageService()
    result = await service.create_signed_upload_url("some/path")

    assert captured_headers["apikey"] == "sb_secret_fake"
    assert "Authorization" not in captured_headers
    assert result["token"] == "abc123"


async def test_create_signed_upload_url_legacy_fallback_sends_bearer_jwt(monkeypatch):
    """The legacy service_role key IS a JWT -- Storage still needs it as both apikey and
    Authorization: Bearer, same as before this change."""
    monkeypatch.setattr(settings, "supabase_secret_key", None)
    monkeypatch.setattr(settings, "supabase_service_role_key", "legacy-jwt-fake")
    captured_headers = {}

    async def fake_post(self, url, headers=None, json=None):
        captured_headers.update(headers or {})
        return _FakeResponse({"url": "/object/upload/sign/group-resources/some/path?token=abc123"})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    service = ResourceStorageService()
    await service.create_signed_upload_url("some/path")

    assert captured_headers["apikey"] == "legacy-jwt-fake"
    assert captured_headers["Authorization"] == "Bearer legacy-jwt-fake"


# --- create_signed_download_url: Open/Preview vs. explicit Download ---


async def test_create_signed_download_url_preview_mode_omits_download_param(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_fake")
    captured_body = {}

    async def fake_post(self, url, headers=None, json=None):
        captured_body.update(json or {})
        return _FakeResponse({"signedURL": "/object/sign/group-resources/some/path?token=xyz"})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    service = ResourceStorageService()
    result = await service.create_signed_download_url("some/path", expires_in=300)

    assert "download" not in captured_body
    assert result["url"].endswith("/object/sign/group-resources/some/path?token=xyz")


async def test_create_signed_download_url_download_mode_preserves_filename(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_fake")
    captured_body = {}

    async def fake_post(self, url, headers=None, json=None):
        captured_body.update(json or {})
        return _FakeResponse({"signedURL": "/object/sign/group-resources/some/path?token=xyz&download=Lesson%201.pdf"})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    service = ResourceStorageService()
    result = await service.create_signed_download_url("some/path", expires_in=300, download_filename="Lesson 1.pdf")

    assert captured_body["download"] == "Lesson 1.pdf"
    assert "download=" in result["url"]


# --- ResourceStorageService.validate_ownership (unchanged, quick sanity check) ---


def test_validate_ownership_accepts_matching_path():
    service = ResourceStorageService()
    group_id, user_id = uuid.uuid4(), uuid.uuid4()
    path = service.build_object_path(group_id, user_id, "lesson.pdf")
    assert service.validate_ownership(path, group_id, user_id)
