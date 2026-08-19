import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.db.session import get_db_session
from app.main import app
from app.profiles.entities.profile_entity import Profile
from app.profiles.routers import profile_router

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
    user = CurrentUser(id=uuid.uuid4(), email="user@example.com", role="authenticated")
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def _profile(user_id: uuid.UUID) -> Profile:
    now = datetime.now(timezone.utc)
    return Profile(
        id=user_id,
        username="study_user",
        display_name="Study User",
        avatar_url=None,
        bio=None,
        created_at=now,
        updated_at=now,
    )


def _create_payload(user_id: uuid.UUID) -> dict[str, str]:
    return {"id": str(user_id), "username": "study_user", "display_name": "Study User"}


async def test_create_profile_requires_auth(async_client):
    response = await async_client.post("/profiles/", json=_create_payload(uuid.uuid4()))
    assert response.status_code == 401


async def test_create_profile_rejects_another_users_id(async_client, monkeypatch, as_fake_user):
    create_mock = AsyncMock()
    monkeypatch.setattr(profile_router.service, "create", create_mock)

    response = await async_client.post("/profiles/", json=_create_payload(uuid.uuid4()), headers=AUTH_HEADERS)

    assert response.status_code == 403
    create_mock.assert_not_awaited()


async def test_create_profile_allows_current_user(async_client, monkeypatch, as_fake_user):
    profile = _profile(as_fake_user.id)
    monkeypatch.setattr(profile_router.service, "create", AsyncMock(return_value=profile))

    response = await async_client.post("/profiles/", json=_create_payload(as_fake_user.id), headers=AUTH_HEADERS)

    assert response.status_code == 201
    assert response.json()["id"] == str(as_fake_user.id)


async def test_update_profile_requires_auth(async_client):
    response = await async_client.put(f"/profiles/{uuid.uuid4()}", json={"display_name": "Changed"})
    assert response.status_code == 401


async def test_update_profile_rejects_another_user(async_client, monkeypatch, as_fake_user):
    get_mock = AsyncMock()
    monkeypatch.setattr(profile_router.service, "get_by_id", get_mock)

    response = await async_client.put(
        f"/profiles/{uuid.uuid4()}", json={"display_name": "Changed"}, headers=AUTH_HEADERS
    )

    assert response.status_code == 403
    get_mock.assert_not_awaited()


async def test_update_profile_allows_current_user(async_client, monkeypatch, as_fake_user):
    profile = _profile(as_fake_user.id)
    monkeypatch.setattr(profile_router.service, "get_by_id", AsyncMock(return_value=profile))
    monkeypatch.setattr(profile_router.service, "update", AsyncMock(return_value=profile))

    response = await async_client.put(
        f"/profiles/{as_fake_user.id}", json={"display_name": "Changed"}, headers=AUTH_HEADERS
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(as_fake_user.id)


async def test_delete_profile_requires_auth(async_client):
    response = await async_client.delete(f"/profiles/{uuid.uuid4()}")
    assert response.status_code == 401


async def test_delete_profile_rejects_another_user(async_client, monkeypatch, as_fake_user):
    get_mock = AsyncMock()
    delete_mock = AsyncMock()
    monkeypatch.setattr(profile_router.service, "get_by_id", get_mock)
    monkeypatch.setattr(profile_router.service, "delete", delete_mock)

    response = await async_client.delete(f"/profiles/{uuid.uuid4()}", headers=AUTH_HEADERS)

    assert response.status_code == 403
    get_mock.assert_not_awaited()
    delete_mock.assert_not_awaited()


async def test_delete_profile_allows_current_user(async_client, monkeypatch, as_fake_user):
    profile = _profile(as_fake_user.id)
    monkeypatch.setattr(profile_router.service, "get_by_id", AsyncMock(return_value=profile))
    monkeypatch.setattr(profile_router.service, "delete", AsyncMock(return_value=None))

    response = await async_client.delete(f"/profiles/{as_fake_user.id}", headers=AUTH_HEADERS)

    assert response.status_code == 204
