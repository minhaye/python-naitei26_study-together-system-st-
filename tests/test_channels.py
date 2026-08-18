import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.auth.dto.auth_dto import CurrentUser
from app.channels.entities.channel_entity import Channel, ChannelMember
from app.channels.routers import channel_router
from app.core import permissions
from app.db.enums import GroupMemberRole, MemberStatus
from app.db.session import get_db_session
from app.groups.entities.group_entity import GroupMember
from app.main import app

AUTH_HEADERS = {"Authorization": "Bearer testtoken"}


async def _fake_db_session():
    yield AsyncMock()


@pytest.fixture(autouse=True)
def override_db_session():
    app.dependency_overrides[get_db_session] = _fake_db_session
    yield
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
def fake_user():
    return CurrentUser(id=uuid.uuid4(), email="user@example.com", role="authenticated")


@pytest.fixture
def as_fake_user(fake_user):
    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_current_user_optional] = lambda: fake_user
    yield fake_user
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_optional, None)


def _make_channel(group_id=None, is_private: bool = False, created_by=None, deleted_at=None, deleted_by=None) -> Channel:
    return Channel(
        id=uuid.uuid4(),
        group_id=group_id or uuid.uuid4(),
        name="general",
        type="text",
        is_private=is_private,
        created_by=created_by or uuid.uuid4(),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        deleted_at=deleted_at,
        deleted_by=deleted_by,
    )


def _group_member(group_id, user_id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE) -> GroupMember:
    return GroupMember(
        id=uuid.uuid4(), group_id=group_id, user_id=user_id, role=role, status=status,
        joined_at=datetime.now(timezone.utc),
    )


def _channel_member(channel_id, user_id) -> ChannelMember:
    return ChannelMember(
        id=uuid.uuid4(), channel_id=channel_id, user_id=user_id, joined_at=datetime.now(timezone.utc)
    )


def _fake_session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    return session


def _mock_manager(monkeypatch, group_id, member: GroupMember | None):
    """channel_router.is_group_manager reads via permissions.groups_service.get_member --
    patch that, mirroring how test_study_rooms.py mocks permissions.study_rooms_service."""
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))


# --- Create: group owner/moderator only, created_by spoofing ignored ---


async def test_create_channel_requires_auth(async_client):
    response = await async_client.post(
        "/channels/", json={"group_id": str(uuid.uuid4()), "name": "general"}
    )
    assert response.status_code == 401


async def test_create_channel_group_not_found(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(channel_router.groups_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(
        "/channels/", json={"group_id": str(uuid.uuid4()), "name": "general"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 404


async def test_create_channel_allowed_for_owner_and_created_by_spoofing_ignored(
    async_client, monkeypatch, as_fake_user
):
    from app.groups.entities.group_entity import Group

    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=as_fake_user.id, is_public=True)
    monkeypatch.setattr(channel_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))

    captured = {}
    spoofed_creator = uuid.uuid4()

    async def fake_create(session, data, created_by):
        captured["created_by"] = created_by
        return _make_channel(group_id=group_id, created_by=created_by)

    monkeypatch.setattr(channel_router.service, "create", fake_create)

    # ChannelCreate has no created_by field at all -- a stray one in the body must be ignored.
    response = await async_client.post(
        "/channels/",
        json={"group_id": str(group_id), "name": "general", "created_by": str(spoofed_creator)},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 201
    assert captured["created_by"] == as_fake_user.id
    assert response.json()["created_by"] == str(as_fake_user.id)
    assert response.json()["created_by"] != str(spoofed_creator)


async def test_create_channel_allowed_for_moderator(async_client, monkeypatch, as_fake_user):
    from app.groups.entities.group_entity import Group

    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=uuid.uuid4(), is_public=True)
    monkeypatch.setattr(channel_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR))
    monkeypatch.setattr(
        channel_router.service, "create", AsyncMock(return_value=_make_channel(group_id=group_id))
    )

    response = await async_client.post(
        "/channels/", json={"group_id": str(group_id), "name": "general"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201


async def test_create_channel_forbidden_for_member(async_client, monkeypatch, as_fake_user):
    from app.groups.entities.group_entity import Group

    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=uuid.uuid4(), is_public=True)
    monkeypatch.setattr(channel_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(
        "/channels/", json={"group_id": str(group_id), "name": "general"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_channel_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    from app.groups.entities.group_entity import Group

    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=uuid.uuid4(), is_public=True)
    monkeypatch.setattr(channel_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_manager(monkeypatch, group_id, None)

    response = await async_client.post(
        "/channels/", json={"group_id": str(group_id), "name": "general"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


# --- Discovery stays public ---


async def test_get_channel_remains_public(async_client, monkeypatch):
    channel = _make_channel()
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))

    response = await async_client.get(f"/channels/{channel.id}")
    assert response.status_code == 200


async def test_list_channels_remains_public(async_client, monkeypatch):
    monkeypatch.setattr(channel_router.service, "list_by_group", AsyncMock(return_value=[]))

    response = await async_client.get("/channels/", params={"group_id": str(uuid.uuid4())})
    assert response.status_code == 200


# --- Update/Delete: group owner or moderator, checked against the channel's *actual* group ---


async def test_update_channel_requires_auth(async_client):
    response = await async_client.put(f"/channels/{uuid.uuid4()}", json={"name": "new"})
    assert response.status_code == 401


async def test_update_channel_allowed_for_owner(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(channel_router.service, "update", AsyncMock(return_value=channel))

    response = await async_client.put(f"/channels/{channel.id}", json={"name": "new"}, headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_update_channel_allowed_for_moderator(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR))
    monkeypatch.setattr(channel_router.service, "update", AsyncMock(return_value=channel))

    response = await async_client.put(f"/channels/{channel.id}", json={"name": "new"}, headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_update_channel_forbidden_for_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.put(f"/channels/{channel.id}", json={"name": "new"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_update_channel_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, None)

    response = await async_client.put(f"/channels/{channel.id}", json={"name": "new"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_update_channel_uses_channels_own_group_not_a_different_group_the_caller_manages(
    async_client, monkeypatch, as_fake_user
):
    """Caller is a moderator of group B, but the channel actually belongs to group A --
    authorization must follow the channel's stored group_id, not incorrectly succeed
    because the caller has authority somewhere else."""
    real_group_id = uuid.uuid4()
    other_group_id_caller_manages = uuid.uuid4()
    channel = _make_channel(group_id=real_group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))

    async def fake_get_member(session, group_id, user_id):
        if group_id == other_group_id_caller_manages:
            return _group_member(group_id, user_id, role=GroupMemberRole.MODERATOR)
        return None

    monkeypatch.setattr(permissions.groups_service, "get_member", fake_get_member)

    response = await async_client.put(f"/channels/{channel.id}", json={"name": "new"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_delete_channel_requires_auth(async_client):
    response = await async_client.delete(f"/channels/{uuid.uuid4()}")
    assert response.status_code == 401


async def test_delete_channel_not_found_for_missing_channel(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.delete(f"/channels/{uuid.uuid4()}", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_delete_channel_is_soft_delete_not_physical(async_client, monkeypatch, as_fake_user):
    """DELETE must call ChannelsService.soft_delete (sets deleted_at/deleted_by), never
    session.delete/service.delete -- the Channel row, its Conversation, and its historical
    Messages must remain in the database."""
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    soft_delete_mock = AsyncMock(return_value=channel)
    monkeypatch.setattr(channel_router.service, "soft_delete", soft_delete_mock)

    response = await async_client.delete(f"/channels/{channel.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204
    soft_delete_mock.assert_awaited_once()


async def test_delete_channel_deleted_by_derived_from_authenticated_caller_not_client(
    async_client, monkeypatch, as_fake_user
):
    """deleted_by must always be the bearer-token identity -- there is no field on this
    endpoint's request at all for a client to spoof it through."""
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    captured = {}

    async def fake_soft_delete(session, channel, deleted_by):
        captured["deleted_by"] = deleted_by
        return channel

    monkeypatch.setattr(channel_router.service, "soft_delete", fake_soft_delete)

    response = await async_client.delete(f"/channels/{channel.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204
    assert captured["deleted_by"] == as_fake_user.id


async def test_delete_channel_allowed_for_owner(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(channel_router.service, "soft_delete", AsyncMock(return_value=channel))

    response = await async_client.delete(f"/channels/{channel.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_delete_channel_allowed_for_moderator(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR))
    monkeypatch.setattr(channel_router.service, "soft_delete", AsyncMock(return_value=channel))

    response = await async_client.delete(f"/channels/{channel.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_delete_channel_forbidden_for_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.delete(f"/channels/{channel.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_delete_channel_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, None)

    response = await async_client.delete(f"/channels/{channel.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_delete_channel_forbidden_for_banned_owner(async_client, monkeypatch, as_fake_user):
    """An owner who has been banned from their own group (status != active) must not be
    able to delete the channel -- is_group_manager re-checks active status, not just role."""
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(
        monkeypatch,
        group_id,
        _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER, status=MemberStatus.BANNED),
    )

    response = await async_client.delete(f"/channels/{channel.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_delete_channel_forbidden_for_left_moderator(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(
        monkeypatch,
        group_id,
        _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR, status=MemberStatus.LEFT),
    )

    response = await async_client.delete(f"/channels/{channel.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_delete_channel_already_deleted_returns_404(async_client, monkeypatch, as_fake_user):
    """An already soft-deleted channel behaves as not-found for DELETE too -- there is no
    "already deleted" 4xx distinct from "not found"; both are the same "doesn't exist for
    normal operations" outcome (see docs/db/STUDY_PLATFORM_DATABASE_SPEC.md § 9)."""
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, deleted_at=datetime.now(timezone.utc), deleted_by=uuid.uuid4())
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    manager_mock = AsyncMock()
    monkeypatch.setattr(permissions.groups_service, "get_member", manager_mock)
    soft_delete_mock = AsyncMock()
    monkeypatch.setattr(channel_router.service, "soft_delete", soft_delete_mock)

    response = await async_client.delete(f"/channels/{channel.id}", headers=AUTH_HEADERS)
    assert response.status_code == 404
    # Denied before any authorization/mutation is attempted at all.
    manager_mock.assert_not_awaited()
    soft_delete_mock.assert_not_awaited()


# --- Reads: a deleted channel behaves as if it does not exist ---


async def test_get_channel_already_deleted_returns_404(async_client, monkeypatch):
    channel = _make_channel(deleted_at=datetime.now(timezone.utc), deleted_by=uuid.uuid4())
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))

    response = await async_client.get(f"/channels/{channel.id}")
    assert response.status_code == 404


async def test_update_channel_already_deleted_returns_404(async_client, monkeypatch, as_fake_user):
    """Cannot update a deleted channel -- denied before authorization even runs, same as a
    missing channel."""
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    manager_mock = AsyncMock()
    monkeypatch.setattr(permissions.groups_service, "get_member", manager_mock)

    response = await async_client.put(f"/channels/{channel.id}", json={"name": "new"}, headers=AUTH_HEADERS)
    assert response.status_code == 404
    manager_mock.assert_not_awaited()


async def test_list_channels_excludes_deleted(async_client, monkeypatch):
    """ChannelsService.list_by_group is the single source of truth for the list endpoint's
    filtering (see its own deleted_at IS NULL WHERE clause) -- this test pins the router's
    contract with that service method, matching this file's existing list-endpoint style."""
    group_id = uuid.uuid4()
    active_channel = _make_channel(group_id=group_id)
    list_mock = AsyncMock(return_value=[active_channel])
    monkeypatch.setattr(channel_router.service, "list_by_group", list_mock)

    response = await async_client.get("/channels/", params={"group_id": str(group_id)})
    assert response.status_code == 200
    assert [c["id"] for c in response.json()] == [str(active_channel.id)]


async def test_add_channel_member_already_deleted_channel_returns_404(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, is_private=True, deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    manager_mock = AsyncMock()
    monkeypatch.setattr(permissions.groups_service, "get_member", manager_mock)

    response = await async_client.post(
        f"/channels/{channel.id}/members", json={"user_id": str(uuid.uuid4())}, headers=AUTH_HEADERS
    )
    assert response.status_code == 404
    manager_mock.assert_not_awaited()


async def test_list_channel_members_already_deleted_channel_returns_404(async_client, monkeypatch):
    channel = _make_channel(is_private=False, deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))

    response = await async_client.get(f"/channels/{channel.id}/members")
    assert response.status_code == 404


async def test_remove_channel_member_already_deleted_channel_returns_404_even_for_self_leave(
    async_client, monkeypatch, as_fake_user
):
    channel = _make_channel(is_private=True, deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    get_member_mock = AsyncMock()
    monkeypatch.setattr(channel_router.service, "get_member", get_member_mock)

    response = await async_client.delete(f"/channels/{channel.id}/members/{as_fake_user.id}", headers=AUTH_HEADERS)
    assert response.status_code == 404
    get_member_mock.assert_not_awaited()


# --- Channel membership: manager-only add/remove-others, self-leave allowed ---


async def test_add_channel_member_requires_auth(async_client):
    response = await async_client.post(
        f"/channels/{uuid.uuid4()}/members", json={"user_id": str(uuid.uuid4())}
    )
    assert response.status_code == 401


async def test_add_channel_member_allowed_for_manager(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, is_private=True)
    target_id = uuid.uuid4()
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(channel_router.service, "get_member", AsyncMock(return_value=None))
    monkeypatch.setattr(
        channel_router.service, "add_member", AsyncMock(return_value=_channel_member(channel.id, target_id))
    )

    response = await async_client.post(
        f"/channels/{channel.id}/members", json={"user_id": str(target_id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201


async def test_add_channel_member_forbidden_for_non_manager(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, is_private=True)
    target_id = uuid.uuid4()
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(
        f"/channels/{channel.id}/members", json={"user_id": str(target_id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_remove_channel_member_self_leave_allowed(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, is_private=True)
    own_member = _channel_member(channel.id, as_fake_user.id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(channel_router.service, "get_member", AsyncMock(return_value=own_member))
    monkeypatch.setattr(channel_router.service, "remove_member", AsyncMock(return_value=None))

    response = await async_client.delete(f"/channels/{channel.id}/members/{as_fake_user.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_remove_channel_member_forbidden_for_non_manager_non_self(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, is_private=True)
    target_id = uuid.uuid4()
    target_member = _channel_member(channel.id, target_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(channel_router.service, "get_member", AsyncMock(return_value=target_member))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.delete(f"/channels/{channel.id}/members/{target_id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_remove_channel_member_allowed_for_manager(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, is_private=True)
    target_id = uuid.uuid4()
    target_member = _channel_member(channel.id, target_id)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(channel_router.service, "get_member", AsyncMock(return_value=target_member))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(channel_router.service, "remove_member", AsyncMock(return_value=None))

    response = await async_client.delete(f"/channels/{channel.id}/members/{target_id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


# --- Private-channel member list read authorization ---


async def test_list_channel_members_public_channel_open(async_client, monkeypatch):
    channel = _make_channel(is_private=False)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(channel_router.service, "list_members", AsyncMock(return_value=[]))

    response = await async_client.get(f"/channels/{channel.id}/members")
    assert response.status_code == 200


async def test_list_channel_members_private_channel_requires_auth(async_client, monkeypatch):
    channel = _make_channel(is_private=True)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))

    response = await async_client.get(f"/channels/{channel.id}/members")
    assert response.status_code == 401


async def test_list_channel_members_private_channel_forbidden_for_outsider(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, is_private=True)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, None)
    monkeypatch.setattr(channel_router.service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/channels/{channel.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_list_channel_members_private_channel_allowed_for_channel_member(
    async_client, monkeypatch, as_fake_user
):
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, is_private=True)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, None)
    monkeypatch.setattr(
        channel_router.service, "get_member", AsyncMock(return_value=_channel_member(channel.id, as_fake_user.id))
    )
    monkeypatch.setattr(channel_router.service, "list_members", AsyncMock(return_value=[]))

    response = await async_client.get(f"/channels/{channel.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_list_channel_members_private_channel_allowed_for_group_manager(
    async_client, monkeypatch, as_fake_user
):
    """A group manager can see a private channel's roster even without an explicit
    channel_members row of their own (e.g. right after creating the channel)."""
    group_id = uuid.uuid4()
    channel = _make_channel(group_id=group_id, is_private=True)
    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(channel_router.service, "list_members", AsyncMock(return_value=[]))

    response = await async_client.get(f"/channels/{channel.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 200
