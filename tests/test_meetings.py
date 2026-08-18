import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from livekit.api import TokenVerifier

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.core import permissions
from app.core.config import settings
from app.db.enums import GroupMemberRole, MemberStatus, StudyRoomStatus
from app.db.session import get_db_session
from app.groups.entities.group_entity import GroupMember
from app.main import app
from app.meetings.services.livekit_service import study_room_livekit_name
from app.profiles.entities.profile_entity import Profile
from app.study_rooms.entities.study_room_entity import StudyRoom, StudyRoomMember
from app.study_rooms.routers import study_room_router

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


def _make_room(status: StudyRoomStatus = StudyRoomStatus.ACTIVE, host_id: uuid.UUID | None = None) -> StudyRoom:
    return StudyRoom(
        id=uuid.uuid4(),
        group_id=uuid.uuid4(),
        name="Room",
        host_id=host_id or uuid.uuid4(),
        status=status,
        max_participants=50,
    )


def _room_member(room_id: uuid.UUID, user_id: uuid.UUID) -> StudyRoomMember:
    return StudyRoomMember(room_id=room_id, user_id=user_id)


def _mock_active_group_membership(monkeypatch):
    """can_join_room_meeting -> can_access_room now also requires current active Group
    membership (2026-08-18 parity fix) -- mock it active by default so these tests keep
    isolating the Room-membership/lifecycle axis they were written for. Ignores args, so it
    applies uniformly regardless of which room/group is being checked."""
    monkeypatch.setattr(
        permissions.groups_service,
        "get_member",
        AsyncMock(return_value=GroupMember(role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE)),
    )


def _mock_no_group_membership(monkeypatch):
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))


def _verify(token: str):
    """Decode the token via LiveKit's own verifier rather than re-implementing JWT parsing."""
    return TokenVerifier(settings.livekit_api_key, settings.livekit_api_secret).verify(token)


# --- Auth / existence / authorization ---


async def test_meeting_token_requires_auth(async_client):
    response = await async_client.post(f"/study-rooms/{uuid.uuid4()}/meeting/token")
    assert response.status_code == 401


async def test_meeting_token_not_found_for_missing_room(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{uuid.uuid4()}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_meeting_token_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_meeting_token_forbidden_for_left_member(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    left_member = StudyRoomMember(room_id=room.id, user_id=as_fake_user.id, left_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=left_member))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_meeting_token_forbidden_for_left_group_member_with_stale_active_room_membership(
    async_client, monkeypatch, as_fake_user
):
    """Python/SQL parity fix (2026-08-18): an active study_room_members row must not grant a
    meeting token once the caller has left the Group."""
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_no_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Success cases ---


async def test_meeting_token_success_for_host(async_client, monkeypatch, as_fake_user):
    """A host needs the same active study_room_members row as anyone else (2026-08-18 --
    host_id alone no longer bypasses the membership check); guaranteed in practice by
    StudyRoomsService.create()."""
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=StudyRoomMember(room_id=room.id, user_id=as_fake_user.id)),
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["server_url"] == settings.livekit_url
    assert body["participant_token"]


async def test_meeting_token_forbidden_for_host_without_active_room_membership(
    async_client, monkeypatch, as_fake_user
):
    """2026-08-18 policy: a meeting token must never be issued solely because host_id matches
    the caller -- host_id alone (no active study_room_members row) must not bypass the normal
    participation check."""
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_meeting_token_success_for_active_member(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 200


# --- Lifecycle (room status gates meeting joins, not just membership) ---


async def test_meeting_token_waiting_room_authorized_member_allowed(async_client, monkeypatch, as_fake_user):
    """A meeting has not started yet, but an authorized member should still be able to fetch
    a token to join once it does (e.g. the host starting the call)."""
    room = _make_room(status=StudyRoomStatus.WAITING)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_meeting_token_active_room_authorized_member_allowed(async_client, monkeypatch, as_fake_user):
    room = _make_room(status=StudyRoomStatus.ACTIVE)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_meeting_token_ended_room_authorized_member_denied(async_client, monkeypatch, as_fake_user):
    """An ended room is still readable as chat history (see can_access_room), but its live
    session is over -- no new join tokens, even for a member who was active throughout."""
    room = _make_room(status=StudyRoomStatus.ENDED)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_meeting_token_ended_room_host_denied(async_client, monkeypatch, as_fake_user):
    """Even a host with a valid active membership row must be denied once the room has
    ended -- the lifecycle gate applies on top of (not instead of) the membership check."""
    room = _make_room(status=StudyRoomStatus.ENDED, host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=StudyRoomMember(room_id=room.id, user_id=as_fake_user.id)),
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Deleted room: no new LiveKit token for anyone, regardless of prior authority ---


async def test_meeting_token_deleted_room_denied_for_host(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id)
    room.deleted_at = datetime.now(timezone.utc)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_meeting_token_deleted_room_denied_for_previously_active_member(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    room.deleted_at = datetime.now(timezone.utc)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    get_member_mock = AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", get_member_mock)

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_meeting_token_deleted_room_denied_via_can_access_room_directly(monkeypatch):
    """Defense-in-depth unit check on the permission helper itself, independent of the router's
    404 gate: can_access_room (and therefore can_join_room_meeting) must deny a deleted room
    for every caller, including the host -- the deleted_at guard is checked first,
    unconditionally, before the (now membership-only) participation check."""
    room = _make_room(host_id=uuid.uuid4())
    room.deleted_at = datetime.now(timezone.utc)

    assert not await permissions.can_join_room_meeting(session=None, room=room, user_id=room.host_id)


async def test_meeting_token_response_never_leaks_livekit_secret(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=StudyRoomMember(room_id=room.id, user_id=as_fake_user.id)),
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    body = response.json()

    assert settings.livekit_api_secret not in response.text
    assert settings.livekit_api_key not in response.text
    assert set(body.keys()) == {"server_url", "participant_token"}


# --- Token claims ---


async def test_meeting_token_identity_matches_authenticated_user(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=StudyRoomMember(room_id=room.id, user_id=as_fake_user.id)),
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    claims = _verify(response.json()["participant_token"])

    assert claims.identity == str(as_fake_user.id)


async def test_meeting_token_room_restricted_to_study_room(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=StudyRoomMember(room_id=room.id, user_id=as_fake_user.id)),
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    claims = _verify(response.json()["participant_token"])

    assert claims.video.room == study_room_livekit_name(room.id)
    assert claims.video.room == f"study-room-{room.id}"


async def test_meeting_token_grants_are_minimal(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=StudyRoomMember(room_id=room.id, user_id=as_fake_user.id)),
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    grants = _verify(response.json()["participant_token"]).video

    assert grants.room_join is True
    assert grants.can_publish is True
    assert grants.can_subscribe is True
    assert not grants.can_publish_data
    assert not grants.room_admin
    assert not grants.room_create
    assert not grants.room_list
    assert not grants.room_record
    assert not grants.ingress_admin
    assert not grants.recorder


async def test_meeting_token_uses_display_name_when_available(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id)
    profile = Profile(id=as_fake_user.id, display_name="Study Buddy")
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=StudyRoomMember(room_id=room.id, user_id=as_fake_user.id)),
    )
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=profile))

    response = await async_client.post(f"/study-rooms/{room.id}/meeting/token", headers=AUTH_HEADERS)
    claims = _verify(response.json()["participant_token"])

    assert claims.name == "Study Buddy"


# --- Isolation across rooms ---


async def test_meeting_token_isolation_across_rooms(async_client, monkeypatch, as_fake_user):
    """A user authorized for room A must not obtain a token merely by swapping the room_id
    in the URL to room B, unless they are also authorized for room B."""
    room_a = _make_room(host_id=as_fake_user.id)
    room_b = _make_room()

    async def get_by_id(session, room_id):
        return room_a if room_id == room_a.id else room_b

    async def get_member(session, room_id, user_id):
        # The caller has an active membership row in room A only (their own room) -- room B
        # must fall through to the non-member denial, not any host_id-based shortcut.
        return StudyRoomMember(room_id=room_a.id, user_id=as_fake_user.id) if room_id == room_a.id else None

    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(side_effect=get_by_id))
    _mock_active_group_membership(monkeypatch)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", get_member)
    monkeypatch.setattr(study_room_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response_a = await async_client.post(f"/study-rooms/{room_a.id}/meeting/token", headers=AUTH_HEADERS)
    assert response_a.status_code == 200
    claims_a = _verify(response_a.json()["participant_token"])
    assert claims_a.video.room == study_room_livekit_name(room_a.id)

    response_b = await async_client.post(f"/study-rooms/{room_b.id}/meeting/token", headers=AUTH_HEADERS)
    assert response_b.status_code == 403
