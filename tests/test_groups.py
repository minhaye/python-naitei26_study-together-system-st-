import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.auth.dto.auth_dto import CurrentUser
from app.core import permissions
from app.db.enums import GroupMemberRole, MemberStatus
from app.db.session import get_db_session
from app.groups.dto.group_dto import GroupCreate
from app.groups.entities.group_entity import Group, GroupMember
from app.groups.routers import group_router
from app.groups.services.group_service import GroupsService
from app.main import app
from app.profiles.entities.profile_entity import Profile

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


def _make_group(is_public: bool = True, owner_id: uuid.UUID | None = None) -> Group:
    return Group(
        id=uuid.uuid4(),
        name="Group",
        owner_id=owner_id or uuid.uuid4(),
        is_public=is_public,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def _profile(user_id, display_name: str | None = "Test User") -> Profile:
    return Profile(id=user_id, username=None, display_name=display_name, avatar_url=None)


def _group_member(
    group_id, user_id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE
) -> GroupMember:
    member = GroupMember(
        id=uuid.uuid4(),
        group_id=group_id,
        user_id=user_id,
        role=role,
        status=status,
        joined_at=datetime.now(timezone.utc),
    )
    # GroupMemberResponse.user is required (see app/groups/dto/group_dto.py) -- every
    # fixture returned through a response must carry it, mirroring how the real service
    # eager-loads/assigns it (see GroupsService.get_member/add_member).
    member.user = _profile(user_id)
    return member


def _fake_session() -> AsyncMock:
    """`Session.add` is synchronous even on SQLAlchemy's AsyncSession -- override the
    auto-mocked async attribute so it isn't left as an un-awaited coroutine."""
    session = AsyncMock()
    session.add = MagicMock()
    return session


# --- Create: auth required, caller becomes owner, owner_id spoofing ignored ---


async def test_create_group_requires_auth(async_client):
    response = await async_client.post("/groups/", json={"name": "Group"})
    assert response.status_code == 401


async def test_create_group_caller_becomes_owner_even_if_owner_id_spoofed(async_client, monkeypatch, as_fake_user):
    spoofed_owner_id = uuid.uuid4()
    captured = {}

    async def fake_create(session, data, owner_id):
        captured["owner_id"] = owner_id
        return _make_group(owner_id=owner_id)

    monkeypatch.setattr(group_router.service, "create", fake_create)

    # GroupCreate no longer has an owner_id field at all -- a stray one in the JSON body
    # must be silently ignored, never taken as identity.
    response = await async_client.post(
        "/groups/",
        json={"name": "Group", "owner_id": str(spoofed_owner_id)},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 201
    assert response.json()["owner_id"] == str(as_fake_user.id)
    assert captured["owner_id"] == as_fake_user.id
    assert captured["owner_id"] != spoofed_owner_id


async def test_service_create_does_not_insert_owner_membership_itself():
    """Regression test for the group_members_group_id_user_id_key UniqueViolation:
    a live DB trigger (groups_add_owner -> add_group_owner(), AFTER INSERT ON groups)
    already inserts the owner's group_members row for every group insert. The service
    must add exactly one object to the session (the Group itself) and must never also
    construct/add a GroupMember for the owner -- doing so races the trigger and hits the
    unique constraint on (group_id, user_id). See GroupsService.create's docstring."""
    session = _fake_session()
    owner_id = uuid.uuid4()

    async def fake_flush():
        # The trigger runs server-side as part of the `groups` INSERT that this flush
        # sends; simulate it having assigned the server-generated id.
        for call in session.add.call_args_list:
            obj = call.args[0]
            if isinstance(obj, Group) and obj.id is None:
                obj.id = uuid.uuid4()

    session.flush = fake_flush

    service = GroupsService()
    group = await service.create(session, GroupCreate(name="Group"), owner_id=owner_id)

    assert session.add.call_count == 1
    added = session.add.call_args_list[0].args[0]
    assert isinstance(added, Group)
    assert added.owner_id == owner_id
    assert not any(isinstance(call.args[0], GroupMember) for call in session.add.call_args_list)
    assert group is added


# --- Discovery stays public ---


async def test_get_group_remains_public(async_client, monkeypatch):
    group = _make_group()
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.get(f"/groups/{group.id}")
    assert response.status_code == 200


async def test_list_groups_remains_public(async_client, monkeypatch):
    monkeypatch.setattr(group_router.service, "list_public", AsyncMock(return_value=[]))

    response = await async_client.get("/groups/", params={"public_only": "true"})
    assert response.status_code == 200


# --- My Groups: active membership, independent of is_public ---


async def test_list_my_groups_requires_auth(async_client):
    response = await async_client.get("/groups/mine")
    assert response.status_code == 401


async def test_list_my_groups_returns_active_memberships_public_and_private(
    async_client, monkeypatch, as_fake_user
):
    """A Private Group must stay in "My Groups" for an active member -- is_public governs
    discoverability, not whether an active member keeps seeing their own Group."""
    public_group = _make_group(is_public=True)
    private_group = _make_group(is_public=False)
    list_mock = AsyncMock(return_value=[public_group, private_group])
    monkeypatch.setattr(group_router.service, "list_by_member", list_mock)

    response = await async_client.get("/groups/mine", headers=AUTH_HEADERS)
    assert response.status_code == 200
    ids = {g["id"] for g in response.json()}
    assert ids == {str(public_group.id), str(private_group.id)}
    assert list_mock.await_args.args[1] == as_fake_user.id


async def test_list_my_groups_route_not_shadowed_by_group_id_route(async_client, monkeypatch, as_fake_user):
    """"/groups/mine" must resolve to list_my_groups, not be captured by the "/{group_id}"
    route with group_id="mine" -- route registration order matters here."""
    get_by_id_mock = AsyncMock()
    monkeypatch.setattr(group_router.service, "get_by_id", get_by_id_mock)
    monkeypatch.setattr(group_router.service, "list_by_member", AsyncMock(return_value=[]))

    response = await async_client.get("/groups/mine", headers=AUTH_HEADERS)
    assert response.status_code == 200
    get_by_id_mock.assert_not_awaited()


# --- Update/Delete: owner-only ---


async def test_update_group_requires_auth(async_client):
    response = await async_client.put(f"/groups/{uuid.uuid4()}", json={"name": "New"})
    assert response.status_code == 401


async def test_update_group_allowed_for_owner(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=as_fake_user.id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "update", AsyncMock(return_value=group))

    response = await async_client.put(f"/groups/{group.id}", json={"name": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_update_group_forbidden_for_moderator(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=uuid.uuid4())
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.put(f"/groups/{group.id}", json={"name": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_update_group_forbidden_for_member(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=uuid.uuid4())
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.put(f"/groups/{group.id}", json={"name": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_update_group_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=uuid.uuid4())
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.put(f"/groups/{group.id}", json={"name": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_update_group_not_found(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.put(f"/groups/{uuid.uuid4()}", json={"name": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_update_group_rejects_empty_name(async_client, monkeypatch, as_fake_user):
    """GroupUpdate.name has min_length=1 -- an empty string must be rejected by request
    validation before it ever reaches the owner-authority check or the service layer."""
    group = _make_group(owner_id=as_fake_user.id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.put(f"/groups/{group.id}", json={"name": ""}, headers=AUTH_HEADERS)
    assert response.status_code == 422


async def test_delete_group_requires_auth(async_client):
    response = await async_client.delete(f"/groups/{uuid.uuid4()}")
    assert response.status_code == 401


async def test_delete_group_allowed_for_owner(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=as_fake_user.id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "delete", AsyncMock(return_value=None))

    response = await async_client.delete(f"/groups/{group.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_delete_group_forbidden_for_moderator(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=uuid.uuid4())
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.delete(f"/groups/{group.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Public self-join ---


async def test_join_public_group_requires_auth(async_client):
    response = await async_client.post(f"/groups/{uuid.uuid4()}/members", json={})
    assert response.status_code == 401


async def test_join_public_group_allowed_and_forced_to_member(async_client, monkeypatch, as_fake_user):
    group = _make_group(is_public=True)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=None))

    captured = {}

    async def fake_add_member(session, group_id, user_id):
        captured["user_id"] = user_id
        return _group_member(group_id, user_id)

    monkeypatch.setattr(group_router.service, "add_member", fake_add_member)

    # Even though the client sends role=owner in the body, GroupMemberCreate has no role
    # field at all -- it must be silently ignored, and the caller must still end up MEMBER.
    response = await async_client.post(
        f"/groups/{group.id}/members", json={"role": "owner"}, headers=AUTH_HEADERS
    )

    assert response.status_code == 201
    assert captured["user_id"] == as_fake_user.id
    assert response.json()["user_id"] == str(as_fake_user.id)
    assert response.json()["role"] == "member"


async def test_join_public_group_cannot_self_join_as_another_user(async_client, monkeypatch, as_fake_user):
    """Caller A sends user_id=B (a real, different user) -- this must not join B, and A
    (a non-manager) has no authority to add another user either, so it is rejected."""
    group = _make_group(is_public=True)
    other_user_id = uuid.uuid4()
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/groups/{group.id}/members", json={"user_id": str(other_user_id)}, headers=AUTH_HEADERS
    )

    assert response.status_code == 403


async def test_join_private_group_self_join_denied(async_client, monkeypatch, as_fake_user):
    group = _make_group(is_public=False)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.post(f"/groups/{group.id}/members", json={}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_join_group_already_member_denied(async_client, monkeypatch, as_fake_user):
    group = _make_group(is_public=True)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(
        group_router.service, "get_member", AsyncMock(return_value=_group_member(group.id, as_fake_user.id))
    )

    response = await async_client.post(f"/groups/{group.id}/members", json={}, headers=AUTH_HEADERS)
    assert response.status_code == 400


async def test_join_group_not_found(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/groups/{uuid.uuid4()}/members", json={}, headers=AUTH_HEADERS)
    assert response.status_code == 404


# --- Manager-driven add of another user ---


async def test_manager_can_add_another_user_to_private_group(async_client, monkeypatch, as_fake_user):
    group = _make_group(is_public=False, owner_id=as_fake_user.id)
    target_id = uuid.uuid4()
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=None))
    # is_group_manager reads via permissions.py's own GroupsService instance, not the
    # router's -- both must reflect the same membership data (mirrors the Study Room precedent).
    monkeypatch.setattr(
        permissions.groups_service,
        "get_member",
        AsyncMock(return_value=_group_member(group.id, as_fake_user.id, role=GroupMemberRole.OWNER)),
    )
    monkeypatch.setattr(
        group_router.service, "add_member", AsyncMock(return_value=_group_member(group.id, target_id))
    )

    response = await async_client.post(
        f"/groups/{group.id}/members", json={"user_id": str(target_id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201


async def test_non_manager_cannot_add_another_user(async_client, monkeypatch, as_fake_user):
    group = _make_group(is_public=False, owner_id=uuid.uuid4())
    target_id = uuid.uuid4()
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/groups/{group.id}/members", json={"user_id": str(target_id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_inactive_moderator_cannot_add_another_user(async_client, monkeypatch, as_fake_user):
    """is_group_manager requires status == ACTIVE -- a moderator who has left/been banned
    must not retain manager authority just because their row's role is still 'moderator'."""
    group = _make_group(is_public=False, owner_id=uuid.uuid4())
    target_id = uuid.uuid4()
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=None))
    monkeypatch.setattr(
        permissions.groups_service,
        "get_member",
        AsyncMock(
            return_value=_group_member(
                group.id, as_fake_user.id, role=GroupMemberRole.MODERATOR, status=MemberStatus.LEFT
            )
        ),
    )

    response = await async_client.post(
        f"/groups/{group.id}/members", json={"user_id": str(target_id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


# --- Role changes: owner-only, no self-promotion, no ownership transfer ---


async def test_update_member_role_requires_auth(async_client):
    response = await async_client.put(
        f"/groups/{uuid.uuid4()}/members/{uuid.uuid4()}/role", params={"role": "moderator"}
    )
    assert response.status_code == 401


async def test_update_member_role_allowed_for_owner(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=as_fake_user.id)
    target_id = uuid.uuid4()
    member = _group_member(group.id, target_id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=member))
    monkeypatch.setattr(group_router.service, "update_member_role", AsyncMock(return_value=member))

    response = await async_client.put(
        f"/groups/{group.id}/members/{target_id}/role", params={"role": "moderator"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 200


async def test_update_member_role_forbidden_for_moderator(async_client, monkeypatch, as_fake_user):
    """A moderator (not the owner) must not be able to change anyone's role -- spec §6.2
    reserves member<->moderator changes for the owner only."""
    group = _make_group(owner_id=uuid.uuid4())
    target_id = uuid.uuid4()
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.put(
        f"/groups/{group.id}/members/{target_id}/role", params={"role": "moderator"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_update_member_role_forbidden_for_member(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=uuid.uuid4())
    target_id = uuid.uuid4()
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.put(
        f"/groups/{group.id}/members/{target_id}/role", params={"role": "moderator"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_update_member_role_cannot_self_promote(async_client, monkeypatch, as_fake_user):
    """A plain member cannot promote themselves to moderator -- they are not the owner."""
    group = _make_group(owner_id=uuid.uuid4())
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.put(
        f"/groups/{group.id}/members/{as_fake_user.id}/role", params={"role": "moderator"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_update_member_role_rejects_owner_role(async_client, monkeypatch, as_fake_user):
    """Ownership transfer is not supported by this task -- role=owner must be rejected
    even when requested by the real owner."""
    group = _make_group(owner_id=as_fake_user.id)
    target_id = uuid.uuid4()
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.put(
        f"/groups/{group.id}/members/{target_id}/role", params={"role": "owner"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 400


async def test_update_member_role_cannot_change_owners_role(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=as_fake_user.id)
    owner_member = _group_member(group.id, as_fake_user.id, role=GroupMemberRole.OWNER)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=owner_member))

    response = await async_client.put(
        f"/groups/{group.id}/members/{as_fake_user.id}/role", params={"role": "moderator"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 400


# --- Self-leave vs. ban/reactivate/remove (owner-only conservative policy) ---


async def test_self_leave_allowed(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=uuid.uuid4())
    member = _group_member(group.id, as_fake_user.id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=member))
    monkeypatch.setattr(group_router.service, "update_member_status", AsyncMock(return_value=member))

    response = await async_client.put(
        f"/groups/{group.id}/members/{as_fake_user.id}/status",
        params={"member_status": "left"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200


async def test_member_cannot_change_another_members_status(async_client, monkeypatch, as_fake_user):
    """A normal member must not be able to remove/ban another member."""
    group = _make_group(owner_id=uuid.uuid4())
    target_id = uuid.uuid4()
    target_member = _group_member(group.id, target_id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=target_member))

    response = await async_client.put(
        f"/groups/{group.id}/members/{target_id}/status", params={"member_status": "left"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_member_cannot_self_reactivate(async_client, monkeypatch, as_fake_user):
    """Self-service is only for the LEFT transition -- a member must not un-ban themselves
    by setting their own status back to active."""
    group = _make_group(owner_id=uuid.uuid4())
    member = _group_member(group.id, as_fake_user.id, status=MemberStatus.BANNED)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=member))

    response = await async_client.put(
        f"/groups/{group.id}/members/{as_fake_user.id}/status",
        params={"member_status": "active"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_owner_can_ban_a_member(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=as_fake_user.id)
    target_id = uuid.uuid4()
    member = _group_member(group.id, target_id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=member))
    monkeypatch.setattr(group_router.service, "update_member_status", AsyncMock(return_value=member))

    response = await async_client.put(
        f"/groups/{group.id}/members/{target_id}/status", params={"member_status": "banned"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 200


async def test_moderator_cannot_ban_a_member(async_client, monkeypatch, as_fake_user):
    """Conservative policy: ban/reactivate/remove stays owner-only even though a moderator
    role exists -- spec §42 leaves moderator ban/kick powers explicitly unresolved."""
    group = _make_group(owner_id=uuid.uuid4())
    target_id = uuid.uuid4()
    target_member = _group_member(group.id, target_id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=target_member))

    response = await async_client.put(
        f"/groups/{group.id}/members/{target_id}/status", params={"member_status": "banned"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_remove_member_requires_auth(async_client):
    response = await async_client.delete(f"/groups/{uuid.uuid4()}/members/{uuid.uuid4()}")
    assert response.status_code == 401


async def test_remove_member_allowed_for_owner(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=as_fake_user.id)
    target_id = uuid.uuid4()
    member = _group_member(group.id, target_id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=member))
    monkeypatch.setattr(group_router.service, "remove_member", AsyncMock(return_value=None))

    response = await async_client.delete(f"/groups/{group.id}/members/{target_id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_remove_member_forbidden_for_self_via_delete(async_client, monkeypatch, as_fake_user):
    """DELETE is the conservative hard-remove/"kick" operation (owner-only) -- a member
    must use PUT status=left to leave, not this endpoint, even against their own row."""
    group = _make_group(owner_id=uuid.uuid4())
    own_member = _group_member(group.id, as_fake_user.id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=own_member))

    response = await async_client.delete(f"/groups/{group.id}/members/{as_fake_user.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_remove_member_forbidden_for_moderator(async_client, monkeypatch, as_fake_user):
    group = _make_group(owner_id=uuid.uuid4())
    target_id = uuid.uuid4()
    target_member = _group_member(group.id, target_id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=target_member))

    response = await async_client.delete(f"/groups/{group.id}/members/{target_id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Member list read authorization ---


async def test_list_members_public_group_open(async_client, monkeypatch):
    group = _make_group(is_public=True)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "list_members", AsyncMock(return_value=[]))

    response = await async_client.get(f"/groups/{group.id}/members")
    assert response.status_code == 200


async def test_list_members_private_group_requires_auth(async_client, monkeypatch):
    group = _make_group(is_public=False)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))

    response = await async_client.get(f"/groups/{group.id}/members")
    assert response.status_code == 401


async def test_list_members_private_group_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    group = _make_group(is_public=False, owner_id=uuid.uuid4())
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    # _require_member_list_access's is_active_group_member check reads via permissions.py's
    # own GroupsService instance, not the router's.
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/groups/{group.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_list_members_private_group_allowed_for_active_member(async_client, monkeypatch, as_fake_user):
    group = _make_group(is_public=False, owner_id=uuid.uuid4())
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_group_member(group.id, as_fake_user.id))
    )
    monkeypatch.setattr(group_router.service, "list_members", AsyncMock(return_value=[]))

    response = await async_client.get(f"/groups/{group.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_list_members_private_group_allowed_for_owner(async_client, monkeypatch, as_fake_user):
    group = _make_group(is_public=False, owner_id=as_fake_user.id)
    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "get_member", AsyncMock(return_value=None))
    monkeypatch.setattr(group_router.service, "list_members", AsyncMock(return_value=[]))

    response = await async_client.get(f"/groups/{group.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 200
