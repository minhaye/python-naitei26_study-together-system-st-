import uuid
from unittest.mock import AsyncMock

import pytest

from app.auth.dependencies import get_current_user
from app.core import permissions
from app.db.enums import GroupMemberRole, MemberStatus
from app.db.session import get_db_session
from app.groups.entities.group_entity import GroupMember
from app.main import app
from app.resources.entities.resource_entity import Resource
from app.resources.routers import resource_router

AUTH_HEADERS = {"Authorization": "Bearer testtoken"}


async def _fake_db_session():
    yield AsyncMock()


@pytest.fixture(autouse=True)
def override_db_session():
    app.dependency_overrides[get_db_session] = _fake_db_session
    yield
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
def as_fake_user():
    from app.auth.dto.auth_dto import CurrentUser

    user = CurrentUser(id=uuid.uuid4(), email="user@example.com", role="authenticated")
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def _active_member(group_id, user_id):
    return GroupMember(group_id=group_id, user_id=user_id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE)


def _make_resource(group_id, name="lesson.pdf", file_path="groups/g/u/obj/lesson.pdf") -> Resource:
    return Resource(id=uuid.uuid4(), group_id=group_id, uploader_id=uuid.uuid4(), name=name, file_path=file_path)


# --- Download-url endpoint: preview vs. explicit download ---


async def test_download_url_defaults_to_preview_mode(async_client, monkeypatch, as_fake_user):
    """Open/Preview (no `download` query param) must not ask Storage to force a download --
    same plain signed URL as before this change."""
    group_id = uuid.uuid4()
    resource = _make_resource(group_id)
    monkeypatch.setattr(resource_router.service, "get_file_by_id", AsyncMock(return_value=resource))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(group_id, as_fake_user.id)))
    fake_create = AsyncMock(return_value={"url": "https://x/signed", "expires_in": 300})
    monkeypatch.setattr(resource_router.storage_service, "create_signed_download_url", fake_create)

    response = await async_client.get(f"/resources/files/{resource.id}/download-url", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json() == {"url": "https://x/signed", "expires_in": 300}
    fake_create.assert_awaited_once_with(resource.file_path, expires_in=300, download_filename=None)


async def test_download_url_download_mode_preserves_original_filename(async_client, monkeypatch, as_fake_user):
    """`?download=true` must ask Storage to force a real download, carrying the resource's
    original name through so the saved file keeps it (Content-Disposition filename)."""
    group_id = uuid.uuid4()
    resource = _make_resource(group_id, name="Bai Giang Chuong 1.pdf")
    monkeypatch.setattr(resource_router.service, "get_file_by_id", AsyncMock(return_value=resource))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(group_id, as_fake_user.id)))
    fake_create = AsyncMock(return_value={"url": "https://x/signed?download=Bai+Giang", "expires_in": 300})
    monkeypatch.setattr(resource_router.storage_service, "create_signed_download_url", fake_create)

    response = await async_client.get(
        f"/resources/files/{resource.id}/download-url", params={"download": "true"}, headers=AUTH_HEADERS
    )

    assert response.status_code == 200
    fake_create.assert_awaited_once_with(resource.file_path, expires_in=300, download_filename="Bai Giang Chuong 1.pdf")


async def test_download_url_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    resource = _make_resource(group_id)
    monkeypatch.setattr(resource_router.service, "get_file_by_id", AsyncMock(return_value=resource))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/resources/files/{resource.id}/download-url", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_download_url_requires_auth(async_client):
    response = await async_client.get(f"/resources/files/{uuid.uuid4()}/download-url")
    assert response.status_code == 401
