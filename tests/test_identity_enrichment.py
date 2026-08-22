"""Verifies GroupMemberResponse/StudyRoomMemberResponse/ChannelMemberResponse/MessageResponse
each carry a real, correct UserSummary -- the backend fix for the frontend's previous
"Người dùng #XXXX" placeholder (there was nothing else to render; see docs/invitations.md-
adjacent identity audit). Also confirms UserSummary never leaks profile fields beyond
id/username/display_name/avatar_url (no bio, no timestamps)."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.auth.dto.auth_dto import CurrentUser
from app.channels.entities.channel_entity import Channel, ChannelMember
from app.channels.routers import channel_router
from app.conversations.entities.conversation_entity import Conversation
from app.core import permissions
from app.db.enums import ConversationType, GroupMemberRole, MemberStatus, StudyRoomMemberRole, StudyRoomStatus
from app.db.session import get_db_session
from app.groups.entities.group_entity import Group, GroupMember
from app.groups.routers import group_router
from app.main import app
from app.messages.entities.message_entity import Message
from app.messages.routers import message_router
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
    app.dependency_overrides[get_current_user_optional] = lambda: fake_user
    yield fake_user
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_optional, None)


def _profile(user_id, *, username=None, display_name=None, avatar_url=None) -> Profile:
    return Profile(id=user_id, username=username, display_name=display_name, avatar_url=avatar_url, bio="secret bio")


EXPECTED_USER_SUMMARY_KEYS = {"id", "username", "display_name", "avatar_url"}


# --- Group members ---


async def test_group_member_response_includes_real_identity(async_client, monkeypatch):
    group_id = uuid.uuid4()
    user_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=uuid.uuid4(), is_public=True)
    member = GroupMember(
        id=uuid.uuid4(), group_id=group_id, user_id=user_id, role=GroupMemberRole.MEMBER,
        status=MemberStatus.ACTIVE, joined_at=datetime.now(timezone.utc),
    )
    member.user = _profile(user_id, username="alice_u", display_name="Alice Nguyen", avatar_url="https://x/a.png")

    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "list_members", AsyncMock(return_value=[member]))

    response = await async_client.get(f"/groups/{group_id}/members")
    assert response.status_code == 200
    body = response.json()[0]
    assert body["user"]["id"] == str(user_id)
    assert body["user"]["display_name"] == "Alice Nguyen"
    assert body["user"]["username"] == "alice_u"
    assert body["user"]["avatar_url"] == "https://x/a.png"
    # UserSummary must not leak bio or timestamps -- only identity fields.
    assert set(body["user"].keys()) == EXPECTED_USER_SUMMARY_KEYS


async def test_group_member_response_user_fields_pass_through_null_without_fabricating_a_label(
    async_client, monkeypatch
):
    """The backend must never itself synthesize a "Người dùng #..." placeholder -- it hands
    the frontend raw nullable identity fields and lets the frontend apply its own fallback
    hierarchy (display_name -> username -> generic label)."""
    group_id = uuid.uuid4()
    user_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=uuid.uuid4(), is_public=True)
    member = GroupMember(
        id=uuid.uuid4(), group_id=group_id, user_id=user_id, role=GroupMemberRole.MEMBER,
        status=MemberStatus.ACTIVE, joined_at=datetime.now(timezone.utc),
    )
    member.user = _profile(user_id)  # no username/display_name/avatar_url set

    monkeypatch.setattr(group_router.service, "get_by_id", AsyncMock(return_value=group))
    monkeypatch.setattr(group_router.service, "list_members", AsyncMock(return_value=[member]))

    response = await async_client.get(f"/groups/{group_id}/members")
    assert response.status_code == 200
    body = response.json()[0]["user"]
    assert body["display_name"] is None
    assert body["username"] is None
    assert str(user_id) not in str(body.get("display_name"))


# --- Study Room members ---


async def test_study_room_member_response_includes_real_identity(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    room = StudyRoom(
        id=uuid.uuid4(), group_id=group_id, name="Room", host_id=uuid.uuid4(),
        status=StudyRoomStatus.ACTIVE, max_participants=50, created_at=datetime.now(timezone.utc),
    )
    member = StudyRoomMember(
        id=uuid.uuid4(), room_id=room.id, user_id=as_fake_user.id, role=StudyRoomMemberRole.PARTICIPANT,
        joined_at=datetime.now(timezone.utc), left_at=None,
    )
    member.user = _profile(as_fake_user.id, display_name="Bao Tran")

    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(
        permissions.groups_service, "get_member",
        AsyncMock(return_value=GroupMember(group_id=group_id, user_id=as_fake_user.id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE)),
    )
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=None))
    monkeypatch.setattr(study_room_router.service, "join", AsyncMock(return_value=member))

    response = await async_client.post(f"/study-rooms/{room.id}/join", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["user"]["display_name"] == "Bao Tran"
    assert set(response.json()["user"].keys()) == EXPECTED_USER_SUMMARY_KEYS


# --- Channel members ---


async def test_channel_member_response_includes_real_identity(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    target_id = uuid.uuid4()
    channel = Channel(
        id=uuid.uuid4(), group_id=group_id, name="private-chat", type="text", is_private=True,
        created_by=uuid.uuid4(), created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    )
    member = ChannelMember(id=uuid.uuid4(), channel_id=channel.id, user_id=target_id, joined_at=datetime.now(timezone.utc))
    member.user = _profile(target_id, username="target_user")

    monkeypatch.setattr(channel_router.service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service, "get_member",
        AsyncMock(return_value=GroupMember(group_id=group_id, user_id=as_fake_user.id, role=GroupMemberRole.OWNER, status=MemberStatus.ACTIVE)),
    )
    monkeypatch.setattr(channel_router.service, "get_member", AsyncMock(return_value=None))
    monkeypatch.setattr(channel_router.service, "add_member", AsyncMock(return_value=member))

    response = await async_client.post(
        f"/channels/{channel.id}/members", json={"user_id": str(target_id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201
    assert response.json()["user"]["username"] == "target_user"
    assert set(response.json()["user"].keys()) == EXPECTED_USER_SUMMARY_KEYS


# --- Message sender identity (chat) ---


async def test_message_response_includes_real_sender_identity(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    channel = Channel(
        id=uuid.uuid4(), group_id=group_id, name="general", is_private=False,
        created_by=uuid.uuid4(), deleted_at=None,
    )
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.CHANNEL, channel_id=channel.id)
    message = Message(
        id=uuid.uuid4(), conversation_id=conversation.id, sender_id=as_fake_user.id, content="hi",
        attachment_path=None, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    )
    message.sender = _profile(as_fake_user.id, display_name="Chi Pham")
    message.reactions = []

    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.channels_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service, "get_member",
        AsyncMock(return_value=GroupMember(group_id=group_id, user_id=as_fake_user.id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE)),
    )
    monkeypatch.setattr(message_router.message_service, "create", AsyncMock(return_value=message))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201
    assert response.json()["sender"]["display_name"] == "Chi Pham"
    assert set(response.json()["sender"].keys()) == EXPECTED_USER_SUMMARY_KEYS
