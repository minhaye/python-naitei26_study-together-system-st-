import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.channels.entities.channel_entity import Channel, ChannelMember
from app.core import permissions
from app.db.enums import GroupMemberRole, InvitationMethod, MemberStatus, StudyRoomStatus
from app.db.session import get_db_session
from app.groups.entities.group_entity import Group, GroupMember
from app.invitations.entities.invitation_entity import Invitation
from app.invitations.routers import invitation_router
from app.invitations.services.invitation_service import InvitationsService
from app.main import app
from app.profiles.entities.profile_entity import Profile
from app.study_rooms.entities.study_room_entity import StudyRoom, StudyRoomMember

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
    yield fake_user
    app.dependency_overrides.pop(get_current_user, None)


def _mock_manager(monkeypatch, group_id, member: GroupMember | None):
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))


def _group_member(group_id, user_id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE) -> GroupMember:
    return GroupMember(
        id=uuid.uuid4(), group_id=group_id, user_id=user_id, role=role, status=status,
        joined_at=datetime.now(timezone.utc),
    )


def _group(group_id=None, owner_id=None) -> Group:
    return Group(id=group_id or uuid.uuid4(), name="G", owner_id=owner_id or uuid.uuid4(), is_public=True)


def _room(group_id, room_id=None, status=StudyRoomStatus.ACTIVE, deleted_at=None) -> StudyRoom:
    return StudyRoom(
        id=room_id or uuid.uuid4(), group_id=group_id, name="Room", host_id=uuid.uuid4(),
        status=status, max_participants=50, created_at=datetime.now(timezone.utc), deleted_at=deleted_at,
    )


def _channel(group_id, channel_id=None, is_private=True, deleted_at=None) -> Channel:
    return Channel(
        id=channel_id or uuid.uuid4(), group_id=group_id, name="private-chat", type="text",
        is_private=is_private, created_by=uuid.uuid4(), created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc), deleted_at=deleted_at,
    )


def _invitation(
    *,
    group_id=None,
    room_id=None,
    channel_id=None,
    method=InvitationMethod.EMAIL,
    recipient_email=None,
    created_by=None,
    expires_in=timedelta(minutes=5),
) -> Invitation:
    from app.db.enums import InvitationStatus

    return Invitation(
        id=uuid.uuid4(),
        group_id=group_id,
        room_id=room_id,
        channel_id=channel_id,
        method=method,
        status=InvitationStatus.PENDING,
        created_by=created_by or uuid.uuid4(),
        recipient_email=recipient_email,
        secret_hash="irrelevant-in-these-tests",
        expires_at=datetime.now(timezone.utc) + expires_in,
        created_at=datetime.now(timezone.utc),
    )


def _profile(user_id, display_name="Alice") -> Profile:
    return Profile(id=user_id, display_name=display_name)


# --- InvitationsService: pure logic (no DB) ---


def test_generate_code_format_and_alphabet():
    service = InvitationsService()
    code = service.generate_code()
    assert len(code) == 9
    assert code[4] == "-"
    body = code.replace("-", "")
    assert len(body) == 8
    for forbidden in "0O1IL":
        assert forbidden not in body


def test_generate_code_is_random():
    service = InvitationsService()
    codes = {service.generate_code() for _ in range(50)}
    assert len(codes) == 50


def test_hash_secret_deterministic_and_distinct():
    service = InvitationsService()
    assert service.hash_secret("abc") == service.hash_secret("abc")
    assert service.hash_secret("abc") != service.hash_secret("abd")
    assert service.hash_secret("abc") != "abc"


def test_is_pending_and_unexpired():
    from app.db.enums import InvitationStatus

    service = InvitationsService()
    pending = _invitation(group_id=uuid.uuid4(), expires_in=timedelta(minutes=5))
    assert service.is_pending_and_unexpired(pending)

    expired = _invitation(group_id=uuid.uuid4(), expires_in=-timedelta(minutes=1))
    assert not service.is_pending_and_unexpired(expired)

    revoked = _invitation(group_id=uuid.uuid4())
    revoked.status = InvitationStatus.REVOKED
    assert not service.is_pending_and_unexpired(revoked)


# --- Creation: authorization ---


async def test_create_invitation_requires_auth(async_client):
    response = await async_client.post(
        "/invitations/", json={"group_id": str(uuid.uuid4()), "method": "code"}
    )
    assert response.status_code == 401


async def test_create_invitation_target_not_found(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=None))
    response = await async_client.post(
        "/invitations/", json={"group_id": str(uuid.uuid4()), "method": "code"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 404


async def test_create_group_invitation_allowed_for_owner(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    group = _group(group_id, owner_id=as_fake_user.id)
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))

    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE, created_by=as_fake_user.id)
    monkeypatch.setattr(
        invitation_router.service, "create", AsyncMock(return_value=(invitation, "K9XR-7P2M"))
    )

    response = await async_client.post(
        "/invitations/", json={"group_id": str(group_id), "method": "code"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201
    assert response.json()["code"] == "K9XR-7P2M"


async def test_create_invitation_forbidden_for_plain_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    group = _group(group_id)
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(
        "/invitations/", json={"group_id": str(group_id), "method": "code"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_invitation_forbidden_for_left_moderator(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    group = _group(group_id)
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_manager(
        monkeypatch,
        group_id,
        _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR, status=MemberStatus.LEFT),
    )

    response = await async_client.post(
        "/invitations/", json={"group_id": str(group_id), "method": "code"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_room_invitation_checked_against_rooms_own_group(async_client, monkeypatch, as_fake_user):
    """Authorization for a Study Room invitation must use the room's actual group_id, not
    trust anything else -- mirrors test_channels.py's equivalent guard."""
    real_group_id = uuid.uuid4()
    other_group_caller_manages = uuid.uuid4()
    room = _room(real_group_id)
    monkeypatch.setattr(invitation_router.study_rooms_service, "get_by_id", AsyncMock(return_value=room))

    async def fake_get_member(session, group_id, user_id):
        if group_id == other_group_caller_manages:
            return _group_member(group_id, user_id, role=GroupMemberRole.OWNER)
        return None

    monkeypatch.setattr(permissions.groups_service, "get_member", fake_get_member)

    response = await async_client.post(
        "/invitations/", json={"room_id": str(room.id), "method": "code"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_channel_invitation_deleted_channel_not_found(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _channel(group_id, deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(invitation_router.channels_service, "get_by_id", AsyncMock(return_value=channel))

    response = await async_client.post(
        "/invitations/", json={"channel_id": str(channel.id), "method": "code"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 404


# --- Creation: email invitations, notifications, and account-existence privacy ---


async def test_create_email_invitation_sends_mail_and_notifies_existing_user(
    async_client, monkeypatch, as_fake_user
):
    group_id = uuid.uuid4()
    group = _group(group_id)
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))

    invitation = _invitation(
        group_id=group_id, method=InvitationMethod.EMAIL, recipient_email="bob@example.com", created_by=as_fake_user.id
    )
    monkeypatch.setattr(invitation_router.service, "create", AsyncMock(return_value=(invitation, "plaintext-token")))
    monkeypatch.setattr(invitation_router.profiles_service, "get_by_id", AsyncMock(return_value=_profile(as_fake_user.id)))

    send_mock = MagicMock()
    monkeypatch.setattr(invitation_router, "send_invitation_email", send_mock)

    recipient_user_id = uuid.uuid4()
    monkeypatch.setattr(
        invitation_router.service, "lookup_user_id_by_email", AsyncMock(return_value=recipient_user_id)
    )
    notify_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.notifications_service, "create", notify_mock)

    response = await async_client.post(
        "/invitations/",
        json={"group_id": str(group_id), "method": "email", "recipient_email": "bob@example.com"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 201
    assert response.json()["code"] is None  # plaintext token is never returned in the API response
    send_mock.assert_called_once()
    notify_mock.assert_awaited_once()
    assert notify_mock.await_args.args[1].user_id == recipient_user_id
    assert notify_mock.await_args.args[1].invitation_id == invitation.id


async def test_create_email_invitation_unknown_email_still_sends_but_no_notification(
    async_client, monkeypatch, as_fake_user
):
    """Non-existing recipient: email delivery still allowed, but there's obviously no user
    to notify in-app -- and the API must not otherwise reveal whether the address matched
    an account."""
    group_id = uuid.uuid4()
    group = _group(group_id)
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))

    invitation = _invitation(
        group_id=group_id, method=InvitationMethod.EMAIL, recipient_email="nobody@example.com", created_by=as_fake_user.id
    )
    monkeypatch.setattr(invitation_router.service, "create", AsyncMock(return_value=(invitation, "plaintext-token")))
    monkeypatch.setattr(invitation_router.profiles_service, "get_by_id", AsyncMock(return_value=_profile(as_fake_user.id)))
    send_mock = MagicMock()
    monkeypatch.setattr(invitation_router, "send_invitation_email", send_mock)
    monkeypatch.setattr(invitation_router.service, "lookup_user_id_by_email", AsyncMock(return_value=None))
    notify_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.notifications_service, "create", notify_mock)

    response = await async_client.post(
        "/invitations/",
        json={"group_id": str(group_id), "method": "email", "recipient_email": "nobody@example.com"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 201
    send_mock.assert_called_once()
    notify_mock.assert_not_awaited()


# --- Redeem: recipient binding, expiry, revocation, race ---


async def test_redeem_requires_auth(async_client):
    response = await async_client.post("/invitations/redeem/some-secret")
    assert response.status_code == 401


async def test_redeem_unknown_secret_not_found(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=None))
    response = await async_client.post("/invitations/redeem/bad-secret", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_redeem_expired_invitation_not_found(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE, expires_in=-timedelta(minutes=1))
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_redeem_email_invitation_wrong_recipient_forbidden(async_client, monkeypatch, as_fake_user):
    """A different authenticated account must not be able to accept an email invitation
    just by obtaining the token/link."""
    group_id = uuid.uuid4()
    invitation = _invitation(group_id=group_id, method=InvitationMethod.EMAIL, recipient_email="someone-else@example.com")
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))

    response = await async_client.post("/invitations/redeem/some-token", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_redeem_email_invitation_correct_recipient_allowed(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    group = _group(group_id)
    invitation = _invitation(group_id=group_id, method=InvitationMethod.EMAIL, recipient_email=as_fake_user.email)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(invitation_router.groups_service, "get_member", AsyncMock(return_value=None))
    monkeypatch.setattr(invitation_router.groups_service, "add_member", AsyncMock(return_value=None))
    monkeypatch.setattr(invitation_router.service, "try_accept", AsyncMock(return_value=True))

    response = await async_client.post("/invitations/redeem/some-token", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["outcome"] == "joined"


async def test_redeem_race_lost_returns_409(async_client, monkeypatch, as_fake_user):
    """try_accept returning False means another request already consumed/expired/revoked
    this invitation between the read and the atomic UPDATE -- must not join, must 409."""
    group_id = uuid.uuid4()
    group = _group(group_id)
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(invitation_router.service, "try_accept", AsyncMock(return_value=False))
    add_member_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.groups_service, "add_member", add_member_mock)

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 409
    add_member_mock.assert_not_awaited()


# --- Redeem: Group join/reactivation semantics ---


async def test_redeem_group_invitation_new_member_joins(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    group = _group(group_id)
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(invitation_router.groups_service, "get_member", AsyncMock(return_value=None))
    add_member_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.groups_service, "add_member", add_member_mock)
    monkeypatch.setattr(invitation_router.service, "try_accept", AsyncMock(return_value=True))

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["outcome"] == "joined"
    add_member_mock.assert_awaited_once()


async def test_redeem_group_invitation_left_member_reactivated(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    group = _group(group_id)
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE)
    left_member = _group_member(group_id, as_fake_user.id, status=MemberStatus.LEFT)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(invitation_router.groups_service, "get_member", AsyncMock(return_value=left_member))
    reactivate_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.groups_service, "reactivate_member", reactivate_mock)
    monkeypatch.setattr(invitation_router.service, "try_accept", AsyncMock(return_value=True))

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["outcome"] == "reactivated"
    reactivate_mock.assert_awaited_once()


async def test_redeem_group_invitation_already_active_member_idempotent(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    group = _group(group_id)
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE)
    active_member = _group_member(group_id, as_fake_user.id, status=MemberStatus.ACTIVE)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(invitation_router.groups_service, "get_member", AsyncMock(return_value=active_member))
    add_member_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.groups_service, "add_member", add_member_mock)
    monkeypatch.setattr(invitation_router.service, "try_accept", AsyncMock(return_value=True))

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["outcome"] == "already_member"
    add_member_mock.assert_not_awaited()


async def test_redeem_group_invitation_banned_user_denied(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    group = _group(group_id)
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE)
    banned_member = _group_member(group_id, as_fake_user.id, status=MemberStatus.BANNED)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(invitation_router.groups_service, "get_member", AsyncMock(return_value=banned_member))
    monkeypatch.setattr(invitation_router.service, "try_accept", AsyncMock(return_value=True))

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Redeem: Study Room requires active Group membership, never auto-joins the Group ---


async def test_redeem_study_room_invitation_non_group_member_guided_not_joined(
    async_client, monkeypatch, as_fake_user
):
    group_id = uuid.uuid4()
    room = _room(group_id)
    invitation = _invitation(room_id=room.id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, None)  # not an active group member

    accept_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.service, "try_accept", accept_mock)
    join_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.study_rooms_service, "join", join_mock)

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["outcome"] == "group_membership_required"
    # Not consumed and no room join attempted -- and no Group auto-join anywhere in this path.
    accept_mock.assert_not_awaited()
    join_mock.assert_not_awaited()


async def test_redeem_study_room_invitation_active_group_member_joins(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    room = _room(group_id)
    invitation = _invitation(room_id=room.id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id))
    monkeypatch.setattr(invitation_router.study_rooms_service, "get_member", AsyncMock(return_value=None))
    join_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.study_rooms_service, "join", join_mock)
    monkeypatch.setattr(invitation_router.service, "try_accept", AsyncMock(return_value=True))

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["outcome"] == "joined"
    join_mock.assert_awaited_once()


async def test_redeem_study_room_invitation_ended_room_denied(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    room = _room(group_id, status=StudyRoomStatus.ENDED)
    invitation = _invitation(room_id=room.id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id))
    monkeypatch.setattr(invitation_router.service, "try_accept", AsyncMock(return_value=True))

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Redeem: Private Channel requires active Group membership, stale membership can't bypass it ---


async def test_redeem_private_channel_invitation_non_group_member_guided_not_joined(
    async_client, monkeypatch, as_fake_user
):
    group_id = uuid.uuid4()
    channel = _channel(group_id, is_private=True)
    invitation = _invitation(channel_id=channel.id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.channels_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, None)

    add_member_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.channels_service, "add_member", add_member_mock)

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["outcome"] == "group_membership_required"
    add_member_mock.assert_not_awaited()


async def test_redeem_private_channel_invitation_active_group_member_joins(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = _channel(group_id, is_private=True)
    invitation = _invitation(channel_id=channel.id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.channels_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id))
    monkeypatch.setattr(invitation_router.channels_service, "get_member", AsyncMock(return_value=None))
    add_member_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.channels_service, "add_member", add_member_mock)
    monkeypatch.setattr(invitation_router.service, "try_accept", AsyncMock(return_value=True))

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["outcome"] == "joined"
    add_member_mock.assert_awaited_once()


async def test_redeem_private_channel_stale_membership_cannot_bypass_lost_group_membership(
    async_client, monkeypatch, as_fake_user
):
    """A stale channel_members row from before the user left the Group must not grant
    access -- active Group membership is re-checked at redemption time regardless."""
    group_id = uuid.uuid4()
    channel = _channel(group_id, is_private=True)
    invitation = _invitation(channel_id=channel.id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.channels_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, None)  # left/banned -- no active group_members row
    # Even though a channel_members row still exists for this user...
    monkeypatch.setattr(
        invitation_router.channels_service,
        "get_member",
        AsyncMock(return_value=ChannelMember(id=uuid.uuid4(), channel_id=channel.id, user_id=as_fake_user.id, joined_at=datetime.now(timezone.utc))),
    )
    accept_mock = AsyncMock()
    monkeypatch.setattr(invitation_router.service, "try_accept", accept_mock)

    response = await async_client.post("/invitations/redeem/K9XR-7P2M", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["outcome"] == "group_membership_required"
    accept_mock.assert_not_awaited()


# --- Redeem by id (in-app notification Join button) ---


async def test_redeem_by_id_requires_auth(async_client):
    response = await async_client.post(f"/invitations/{uuid.uuid4()}/redeem")
    assert response.status_code == 401


async def test_redeem_by_id_wrong_recipient_forbidden(async_client, monkeypatch, as_fake_user):
    invitation = _invitation(group_id=uuid.uuid4(), method=InvitationMethod.EMAIL, recipient_email="someone-else@example.com")
    monkeypatch.setattr(invitation_router.service, "get_by_id", AsyncMock(return_value=invitation))

    response = await async_client.post(f"/invitations/{invitation.id}/redeem", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_redeem_by_id_code_invitation_forbidden(async_client, monkeypatch, as_fake_user):
    """CODE invitations have no bound recipient -- id-based redemption must be refused even
    for a caller who correctly guesses/discovers the id, since the id is not the credential
    (the code is)."""
    invitation = _invitation(group_id=uuid.uuid4(), method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_id", AsyncMock(return_value=invitation))

    response = await async_client.post(f"/invitations/{invitation.id}/redeem", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_redeem_by_id_correct_recipient_allowed(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    group = _group(group_id)
    invitation = _invitation(group_id=group_id, method=InvitationMethod.EMAIL, recipient_email=as_fake_user.email)
    monkeypatch.setattr(invitation_router.service, "get_by_id", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(invitation_router.groups_service, "get_member", AsyncMock(return_value=None))
    monkeypatch.setattr(invitation_router.groups_service, "add_member", AsyncMock(return_value=None))
    monkeypatch.setattr(invitation_router.service, "try_accept", AsyncMock(return_value=True))

    response = await async_client.post(f"/invitations/{invitation.id}/redeem", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["outcome"] == "joined"


# --- Revoke / decline ---


async def test_revoke_requires_manager(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_id", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(f"/invitations/{invitation.id}/revoke", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_revoke_allowed_for_manager(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_id", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(invitation_router.service, "try_revoke", AsyncMock(return_value=True))

    response = await async_client.post(f"/invitations/{invitation.id}/revoke", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_revoke_already_resolved_returns_409(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_id", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(invitation_router.service, "try_revoke", AsyncMock(return_value=False))

    response = await async_client.post(f"/invitations/{invitation.id}/revoke", headers=AUTH_HEADERS)
    assert response.status_code == 409


async def test_decline_wrong_recipient_forbidden(async_client, monkeypatch, as_fake_user):
    invitation = _invitation(group_id=uuid.uuid4(), method=InvitationMethod.EMAIL, recipient_email="someone-else@example.com")
    monkeypatch.setattr(invitation_router.service, "get_by_id", AsyncMock(return_value=invitation))

    response = await async_client.post(f"/invitations/{invitation.id}/decline", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_decline_correct_recipient_allowed(async_client, monkeypatch, as_fake_user):
    invitation = _invitation(group_id=uuid.uuid4(), method=InvitationMethod.EMAIL, recipient_email=as_fake_user.email)
    monkeypatch.setattr(invitation_router.service, "get_by_id", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.service, "try_decline", AsyncMock(return_value=True))

    response = await async_client.post(f"/invitations/{invitation.id}/decline", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_decline_code_invitation_forbidden(async_client, monkeypatch, as_fake_user):
    """Code invitations have no single bound recipient -- there's nobody who can "decline"
    one via this endpoint."""
    invitation = _invitation(group_id=uuid.uuid4(), method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.service, "get_by_id", AsyncMock(return_value=invitation))

    response = await async_client.post(f"/invitations/{invitation.id}/decline", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Resolve (public preview) ---


async def test_resolve_invitation_no_auth_required(async_client, monkeypatch):
    group_id = uuid.uuid4()
    group = _group(group_id)
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE, created_by=group.owner_id)
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=invitation))
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(invitation_router.profiles_service, "get_by_id", AsyncMock(return_value=_profile(group.owner_id)))

    response = await async_client.get("/invitations/resolve/K9XR-7P2M")
    assert response.status_code == 200
    assert response.json()["target"]["type"] == "group"


async def test_resolve_invitation_invalid_secret_same_response_shape_regardless_of_reason(
    async_client, monkeypatch
):
    """Expired/revoked/already-used/unknown all look identical to an unauthenticated
    prober -- no detail leaks which one applies."""
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=None))
    response_unknown = await async_client.get("/invitations/resolve/does-not-exist")

    expired = _invitation(group_id=uuid.uuid4(), method=InvitationMethod.CODE, expires_in=-timedelta(minutes=1))
    monkeypatch.setattr(invitation_router.service, "get_by_secret", AsyncMock(return_value=expired))
    response_expired = await async_client.get("/invitations/resolve/K9XR-7P2M")

    assert response_unknown.status_code == response_expired.status_code == 404
    assert response_unknown.json() == response_expired.json()


# --- Active code (metadata-only, manager-only) ---


async def test_active_code_requires_manager(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, None)

    response = await async_client.get(
        "/invitations/active-code", params={"group_id": str(group_id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_active_code_never_exposes_plaintext(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    invitation = _invitation(group_id=group_id, method=InvitationMethod.CODE)
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(invitation_router.service, "get_active_code_for_target", AsyncMock(return_value=invitation))

    response = await async_client.get(
        "/invitations/active-code", params={"group_id": str(group_id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"id", "expires_at"}


async def test_active_code_none_when_no_pending_code(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    monkeypatch.setattr(invitation_router.groups_service, "get_by_id", AsyncMock(return_value=_group(group_id)))
    _mock_manager(monkeypatch, group_id, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(invitation_router.service, "get_active_code_for_target", AsyncMock(return_value=None))

    response = await async_client.get(
        "/invitations/active-code", params={"group_id": str(group_id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 200
    assert response.json() is None


# --- Incoming invitations (scoped to caller's own verified email) ---


async def test_list_incoming_uses_callers_own_verified_email(async_client, monkeypatch, as_fake_user):
    list_mock = AsyncMock(return_value=[])
    monkeypatch.setattr(invitation_router.service, "list_incoming", list_mock)

    response = await async_client.get("/invitations/incoming", headers=AUTH_HEADERS)
    assert response.status_code == 200
    list_mock.assert_awaited_once_with(list_mock.await_args.args[0], as_fake_user.email.lower())
