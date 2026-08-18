import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.channels.entities.channel_entity import Channel
from app.conversations.entities.conversation_entity import Conversation
from app.core import permissions
from app.db.enums import ConversationType, GroupMemberRole, MemberStatus, StudyRoomMemberRole, StudyRoomStatus
from app.db.session import get_db_session
from app.groups.entities.group_entity import GroupMember
from app.main import app
from app.messages.entities.message_entity import Message
from app.messages.routers import message_router
from app.messages.services.message_service import MessagesService, _decode_cursor, _encode_cursor
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


def _make_channel(group_id=None, is_private=False, deleted_at=None):
    return Channel(
        id=uuid.uuid4(),
        group_id=group_id or uuid.uuid4(),
        name="general",
        is_private=is_private,
        created_by=uuid.uuid4(),
        deleted_at=deleted_at,
    )


def _make_conversation(channel: Channel) -> Conversation:
    return Conversation(
        id=uuid.uuid4(), type=ConversationType.CHANNEL, channel_id=channel.id, created_by=channel.created_by
    )


def _make_message(sender_id, conversation_id, content="Hello", attachment_path=None):
    now = datetime.now(timezone.utc)
    return Message(
        id=uuid.uuid4(),
        conversation_id=conversation_id,
        sender_id=sender_id,
        content=content,
        attachment_path=attachment_path,
        created_at=now,
        updated_at=now,
    )


def _active_member(group_id, user_id, role=GroupMemberRole.MEMBER):
    return GroupMember(group_id=group_id, user_id=user_id, role=role, status=MemberStatus.ACTIVE)


def _make_room(status=StudyRoomStatus.ACTIVE, host_id=None) -> StudyRoom:
    return StudyRoom(
        id=uuid.uuid4(),
        group_id=uuid.uuid4(),
        name="Room",
        host_id=host_id or uuid.uuid4(),
        status=status,
        max_participants=50,
    )


def _make_room_conversation(room: StudyRoom) -> Conversation:
    return Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=room.id, created_by=room.host_id)


def _room_member(room_id, user_id, role=StudyRoomMemberRole.PARTICIPANT, left_at=None) -> StudyRoomMember:
    return StudyRoomMember(room_id=room_id, user_id=user_id, role=role, left_at=left_at)


def _wire_room_conversation(monkeypatch, room: StudyRoom, conversation: Conversation, user_id=None):
    """Also wires an active Group membership for `user_id` (2026-08-18 parity fix --
    can_access_room now requires current active Group membership, not just an active
    study_room_members row). Tests exercising the Group-membership axis itself (left/banned/
    inactive) override this afterwards with their own monkeypatch.setattr call."""
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    if user_id is not None:
        monkeypatch.setattr(
            permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(room.group_id, user_id))
        )


def _make_direct_conversation(user_a_id, user_b_id) -> Conversation:
    min_id, max_id = sorted((user_a_id, user_b_id))
    return Conversation(
        id=uuid.uuid4(),
        type=ConversationType.DIRECT,
        created_by=user_a_id,
        direct_user_min_id=min_id,
        direct_user_max_id=max_id,
    )


def _wire_direct_conversation(monkeypatch, conversation: Conversation, member_ids: set):
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(
        permissions.conversations_service,
        "is_member",
        AsyncMock(side_effect=lambda session, conversation_id, user_id: user_id in member_ids),
    )


def _wire_conversation(monkeypatch, channel: Channel, conversation: Conversation):
    """Common wiring for conversation-centric endpoints: the router loads the conversation
    via message_router.conversation_service, while can_access_conversation (in
    app/core/permissions.py) loads the channel via its own ChannelsService instance
    (permissions.channels_service) -- a different object from message_router.channel_service,
    which is only used by the router for attachment path derivation."""
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.channels_service, "get_by_id", AsyncMock(return_value=channel))


# --- Send message ---


async def test_create_message_requires_auth(async_client):
    response = await async_client.post(f"/conversations/{uuid.uuid4()}/messages", json={"content": "hi"})
    assert response.status_code == 401


async def test_create_message_not_found_for_missing_conversation(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/conversations/{uuid.uuid4()}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 404


async def test_create_message_forbidden_when_not_group_member(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_message_forbidden_when_banned(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    banned_member = GroupMember(
        group_id=channel.group_id, user_id=as_fake_user.id, role=GroupMemberRole.MEMBER, status=MemberStatus.BANNED
    )
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=banned_member))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_message_forbidden_private_channel_without_channel_membership(
    async_client, monkeypatch, as_fake_user
):
    channel = _make_channel(is_private=True)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    monkeypatch.setattr(permissions.channels_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_message_owner_allowed_private_channel_without_channel_membership_row(
    async_client, monkeypatch, as_fake_user
):
    """Regression test: the group owner who created a private channel is never inserted into
    channel_members (see ChannelsService.create), so they must still be able to send via the
    is_group_manager implicit-access branch of can_access_channel."""
    channel = _make_channel(is_private=True)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service,
        "get_member",
        AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id, role=GroupMemberRole.OWNER)),
    )
    get_channel_member_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(permissions.channels_service, "get_member", get_channel_member_mock)
    created = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="Hello")
    monkeypatch.setattr(message_router.message_service, "create", AsyncMock(return_value=created))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "Hello"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201
    get_channel_member_mock.assert_not_awaited()


async def test_create_message_moderator_allowed_private_channel_without_channel_membership_row(
    async_client, monkeypatch, as_fake_user
):
    channel = _make_channel(is_private=True)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service,
        "get_member",
        AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR)),
    )
    monkeypatch.setattr(permissions.channels_service, "get_member", AsyncMock(return_value=None))
    created = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="Hello")
    monkeypatch.setattr(message_router.message_service, "create", AsyncMock(return_value=created))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "Hello"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201


async def test_create_message_explicit_private_channel_member_allowed(async_client, monkeypatch, as_fake_user):
    """A plain (non-manager) active group member with an explicit channel_members row must
    still be able to send -- the manager branch is additive, not a replacement."""
    from app.channels.entities.channel_entity import ChannelMember

    channel = _make_channel(is_private=True)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    monkeypatch.setattr(
        permissions.channels_service,
        "get_member",
        AsyncMock(return_value=ChannelMember(channel_id=channel.id, user_id=as_fake_user.id)),
    )
    created = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="Hello")
    monkeypatch.setattr(message_router.message_service, "create", AsyncMock(return_value=created))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "Hello"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201


async def test_create_message_forbidden_banned_owner_private_channel_even_with_stale_membership_row(
    async_client, monkeypatch, as_fake_user
):
    """A banned/left group member must be denied even if they held the owner role and still
    have a stale channel_members row -- is_active_group_member gates both branches."""
    from app.channels.entities.channel_entity import ChannelMember

    channel = _make_channel(is_private=True)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    banned_owner = GroupMember(
        group_id=channel.group_id, user_id=as_fake_user.id, role=GroupMemberRole.OWNER, status=MemberStatus.BANNED
    )
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=banned_owner))
    monkeypatch.setattr(
        permissions.channels_service,
        "get_member",
        AsyncMock(return_value=ChannelMember(channel_id=channel.id, user_id=as_fake_user.id)),
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


# --- Deleted channel: no messaging through its conversation for anyone (migration 009) ---


async def test_create_message_forbidden_deleted_channel_even_for_active_member(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False, deleted_at=datetime.now(timezone.utc))
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_message_forbidden_deleted_channel_even_for_group_owner(async_client, monkeypatch, as_fake_user):
    """A deleted channel must deny everyone, including the group owner/moderator who would
    otherwise get implicit access to a (non-deleted) private channel."""
    channel = _make_channel(is_private=True, deleted_at=datetime.now(timezone.utc))
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service,
        "get_member",
        AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id, role=GroupMemberRole.OWNER)),
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_message_valid_member_returns_201(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    created = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="Hello everyone")
    create_mock = AsyncMock(return_value=created)
    monkeypatch.setattr(message_router.message_service, "create", create_mock)

    other_user_id = str(uuid.uuid4())
    response = await async_client.post(
        f"/conversations/{conversation.id}/messages",
        json={"content": "Hello everyone", "sender_id": other_user_id},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["sender_id"] == str(as_fake_user.id)
    assert body["sender_id"] != other_user_id
    # sender_id must always come from the JWT, never from the request body.
    assert create_mock.await_args.kwargs["sender_id"] == as_fake_user.id


async def test_create_message_empty_content_and_attachment_returns_422(async_client, as_fake_user):
    response = await async_client.post(
        f"/conversations/{uuid.uuid4()}/messages",
        json={"content": "   ", "attachment_path": None},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


# --- Get messages ---


async def test_list_messages_forbidden_without_access(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_list_messages_valid_user_returns_200_and_uses_path_conversation_id(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id)
    list_mock = AsyncMock(return_value=([message], None))
    monkeypatch.setattr(message_router.message_service, "list_by_conversation", list_mock)

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["conversation_id"] == str(conversation.id)
    assert body["next_cursor"] is None

    _, called_conversation_id = list_mock.await_args.args[:2]
    assert called_conversation_id == conversation.id


async def test_list_messages_forbidden_deleted_channel(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False, deleted_at=datetime.now(timezone.utc))
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    list_mock = AsyncMock()
    monkeypatch.setattr(message_router.message_service, "list_by_conversation", list_mock)

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403
    list_mock.assert_not_awaited()


# --- Edit / Delete ---


async def test_update_message_forbidden_for_non_sender(async_client, monkeypatch, as_fake_user):
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=uuid.uuid4())
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))

    response = await async_client.patch(
        f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_update_message_success_for_sender(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    updated = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="edited")
    monkeypatch.setattr(message_router.message_service, "update", AsyncMock(return_value=updated))

    response = await async_client.patch(
        f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 200
    assert response.json()["content"] == "edited"


async def test_update_message_forbidden_deleted_channel_even_for_author(async_client, monkeypatch, as_fake_user):
    """Regression test: being the sender is not sufficient once the parent Channel is
    soft-deleted -- can_access_conversation (via can_access_channel) must also pass."""
    channel = _make_channel(is_private=False, deleted_at=datetime.now(timezone.utc))
    conversation = _make_conversation(channel)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    update_mock = AsyncMock()
    monkeypatch.setattr(message_router.message_service, "update", update_mock)

    response = await async_client.patch(
        f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403
    update_mock.assert_not_awaited()


async def test_delete_message_forbidden_for_non_sender_non_manager(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=conversation.id)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_delete_message_success_for_sender(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    monkeypatch.setattr(message_router.message_service, "delete", AsyncMock(return_value=None))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_delete_message_forbidden_deleted_channel_even_for_author(async_client, monkeypatch, as_fake_user):
    """Regression test: being the sender is not sufficient once the parent Channel is
    soft-deleted -- can_access_conversation (via can_access_channel) must also pass."""
    channel = _make_channel(is_private=False, deleted_at=datetime.now(timezone.utc))
    conversation = _make_conversation(channel)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    delete_mock = AsyncMock()
    monkeypatch.setattr(message_router.message_service, "delete", delete_mock)

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403
    delete_mock.assert_not_awaited()


async def test_delete_message_success_for_group_manager(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=conversation.id)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    # can_access_conversation (app/core/permissions.py) reads the channel via its own
    # ChannelsService instance (permissions.channels_service) -- see _wire_conversation's
    # docstring -- separate from message_router.channel_service above, which the router
    # uses for the manager-override branch/attachment path derivation.
    monkeypatch.setattr(permissions.channels_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service,
        "get_member",
        AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id, role=GroupMemberRole.OWNER)),
    )
    monkeypatch.setattr(message_router.message_service, "delete", AsyncMock(return_value=None))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_delete_message_forbidden_deleted_channel_even_for_group_manager(async_client, monkeypatch, as_fake_user):
    """A deleted channel must deny everyone through the normal message-delete path too,
    including the manager-override branch that would otherwise let an owner/moderator
    delete someone else's message."""
    channel = _make_channel(deleted_at=datetime.now(timezone.utc))
    conversation = _make_conversation(channel)
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=conversation.id)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(permissions.channels_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service,
        "get_member",
        AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id, role=GroupMemberRole.OWNER)),
    )
    delete_mock = AsyncMock()
    monkeypatch.setattr(message_router.message_service, "delete", delete_mock)

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403
    delete_mock.assert_not_awaited()


# --- Room conversation: list / send ---


async def test_room_host_can_list_messages(async_client, monkeypatch, as_fake_user):
    """A host needs the same active study_room_members row as anyone else (2026-08-18 --
    host_id alone no longer bypasses the membership check); guaranteed in practice by
    StudyRoomsService.create()."""
    room = _make_room(host_id=as_fake_user.id)
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id, role=StudyRoomMemberRole.HOST)),
    )
    monkeypatch.setattr(message_router.message_service, "list_by_conversation", AsyncMock(return_value=([], None)))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_room_host_can_send_message(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id)
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id, role=StudyRoomMemberRole.HOST)),
    )
    created = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="hi all")
    monkeypatch.setattr(message_router.message_service, "create", AsyncMock(return_value=created))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi all"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201


async def test_room_host_without_active_membership_denied(async_client, monkeypatch, as_fake_user):
    """2026-08-18 policy: host_id alone (no active study_room_members row) must not bypass
    the normal participation check for room conversation access."""
    room = _make_room(host_id=as_fake_user.id)
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_active_member_can_list_messages(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id)),
    )
    monkeypatch.setattr(message_router.message_service, "list_by_conversation", AsyncMock(return_value=([], None)))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_room_active_member_can_send_message(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id)),
    )
    created = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "create", AsyncMock(return_value=created))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201


async def test_room_non_member_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_banned_member_denied(async_client, monkeypatch, as_fake_user):
    """Study rooms have no distinct 'banned' status (unlike group_members) -- a member no
    longer welcome in the room is represented by their study_room_members row having left_at
    set, same as a voluntary leave or a kick."""
    room = _make_room()
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    removed_member = _room_member(room.id, as_fake_user.id, left_at=datetime.now(timezone.utc))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=removed_member))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_kicked_member_denied(async_client, monkeypatch, as_fake_user):
    """RoomModerationAction.KICK is only an audit log entry; there is no auto-wiring to
    membership. A kicked member is represented identically to a left member (left_at set)."""
    room = _make_room()
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    kicked_member = _room_member(room.id, as_fake_user.id, left_at=datetime.now(timezone.utc))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=kicked_member))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_room_left_member_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    left_member = _room_member(room.id, as_fake_user.id, left_at=datetime.now(timezone.utc))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=left_member))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_left_group_member_with_stale_active_room_membership_denied(async_client, monkeypatch, as_fake_user):
    """Python/SQL parity fix (2026-08-18): before this fix, can_access_room only checked
    is_active_room_member, so a user who left the Group but still had an active
    study_room_members row (no cascade exists from Group membership changes to Room
    memberships) could keep reading/sending room messages via FastAPI forever, even though
    can_access_room_conversation() (SQL/RLS, migration 011, live) already denied the identical
    request via Realtime/direct PostgREST. Exercises the real router -> can_access_conversation
    -> can_access_room chain end to end, not a mock of can_access_room itself."""
    room = _make_room()
    conversation = _make_room_conversation(room)
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id)),
    )

    list_response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    send_response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )

    assert list_response.status_code == 403
    assert send_response.status_code == 403


async def test_room_missing_room_id_denied_safely(async_client, monkeypatch, as_fake_user):
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=None, created_by=uuid.uuid4())
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_dangling_room_reference_denied_safely(async_client, monkeypatch, as_fake_user):
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=uuid.uuid4(), created_by=uuid.uuid4())
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_direct_conversation_type_cannot_bypass_via_room_id(async_client, monkeypatch, as_fake_user):
    """Dispatch must key off conversation.type, not the presence of a room_id -- a direct
    conversation resolves via conversation_members even if a (contradictory) room_id happens
    to be set, never falling through to room logic."""
    conversation = Conversation(
        id=uuid.uuid4(), type=ConversationType.DIRECT, room_id=uuid.uuid4(), created_by=uuid.uuid4()
    )
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    get_room_mock = AsyncMock()
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", get_room_mock)
    monkeypatch.setattr(permissions.conversations_service, "is_member", AsyncMock(return_value=False))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403
    get_room_mock.assert_not_awaited()


async def test_room_ended_denies_new_message_but_allows_reading_history(async_client, monkeypatch, as_fake_user):
    room = _make_room(status=StudyRoomStatus.ENDED)
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id)),
    )
    monkeypatch.setattr(message_router.message_service, "list_by_conversation", AsyncMock(return_value=([], None)))

    list_response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert list_response.status_code == 200

    send_response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert send_response.status_code == 403


# --- Room conversation: message-level ---


async def test_room_member_can_get_room_message(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id)),
    )

    response = await async_client.get(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_room_member_can_patch_own_message(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    updated = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="edited")
    monkeypatch.setattr(message_router.message_service, "update", AsyncMock(return_value=updated))

    response = await async_client.patch(f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["content"] == "edited"


async def test_room_member_can_delete_own_message(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    monkeypatch.setattr(message_router.message_service, "delete", AsyncMock(return_value=None))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_room_unauthorized_user_cannot_get_room_message(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_unauthorized_user_cannot_patch_room_message(async_client, monkeypatch, as_fake_user):
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=uuid.uuid4(), content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))

    response = await async_client.patch(f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_unauthorized_user_cannot_delete_room_message(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Room conversation: ended room is read-only ---


async def test_room_ended_member_can_get_message(async_client, monkeypatch, as_fake_user):
    room = _make_room(status=StudyRoomStatus.ENDED)
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=conversation.id, content="old message")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id)),
    )

    response = await async_client.get(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_room_ended_member_cannot_patch_own_message(async_client, monkeypatch, as_fake_user):
    # host_id=as_fake_user.id, plus an active study_room_members row (2026-08-18 -- host_id
    # alone no longer bypasses the membership check) -- isolates the assertion to the
    # ended-room lifecycle gate this test is actually about, not incidental access denial.
    room = _make_room(status=StudyRoomStatus.ENDED, host_id=as_fake_user.id)
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="old")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(room.group_id, as_fake_user.id))
    )
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id, role=StudyRoomMemberRole.HOST)),
    )

    response = await async_client.patch(f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_ended_member_cannot_delete_own_message(async_client, monkeypatch, as_fake_user):
    room = _make_room(status=StudyRoomStatus.ENDED, host_id=as_fake_user.id)
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="old")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(room.group_id, as_fake_user.id))
    )
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id, role=StudyRoomMemberRole.HOST)),
    )

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_active_member_can_still_patch_own_message(async_client, monkeypatch, as_fake_user):
    """Regression guard: the new ended-room gate must not affect active/waiting rooms."""
    room = _make_room(status=StudyRoomStatus.ACTIVE, host_id=as_fake_user.id)
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="old")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(room.group_id, as_fake_user.id))
    )
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id, role=StudyRoomMemberRole.HOST)),
    )
    updated = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="edited")
    monkeypatch.setattr(message_router.message_service, "update", AsyncMock(return_value=updated))

    response = await async_client.patch(f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS)
    assert response.status_code == 200


# --- Room conversation: soft-deleted room is fully unavailable (not just read-only) ---


async def test_room_deleted_denies_listing_messages_even_for_host(async_client, monkeypatch, as_fake_user):
    """Contrast with test_room_ended_denies_new_message_but_allows_reading_history: an ended
    room stays readable, a deleted room does not -- for anyone, including the host."""
    room = _make_room(host_id=as_fake_user.id)
    room.deleted_at = datetime.now(timezone.utc)
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_deleted_denies_sending_message(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    room.deleted_at = datetime.now(timezone.utc)
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation, as_fake_user.id)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_room_deleted_denies_patching_own_historical_message(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id)
    room.deleted_at = datetime.now(timezone.utc)
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="old")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.patch(f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_deleted_denies_deleting_own_historical_message(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id)
    room.deleted_at = datetime.now(timezone.utc)
    conversation = _make_room_conversation(room)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="old")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Direct conversation: list / send ---


async def test_direct_member_a_can_list_messages(async_client, monkeypatch, as_fake_user):
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user)
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})
    monkeypatch.setattr(message_router.message_service, "list_by_conversation", AsyncMock(return_value=([], None)))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_direct_member_b_can_list_messages(async_client, monkeypatch, as_fake_user):
    """Same pair, opposite constructor argument order -- membership must not depend on
    which side of the pair the caller happens to be."""
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(other_user, as_fake_user.id)
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})
    monkeypatch.setattr(message_router.message_service, "list_by_conversation", AsyncMock(return_value=([], None)))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_direct_member_can_send_message(async_client, monkeypatch, as_fake_user):
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user)
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})
    created = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "create", AsyncMock(return_value=created))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201


async def test_direct_third_user_cannot_list_messages(async_client, monkeypatch, as_fake_user):
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    conversation = _make_direct_conversation(user_a, user_b)
    _wire_direct_conversation(monkeypatch, conversation, {user_a, user_b})

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_direct_third_user_cannot_send_message(async_client, monkeypatch, as_fake_user):
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    conversation = _make_direct_conversation(user_a, user_b)
    _wire_direct_conversation(monkeypatch, conversation, {user_a, user_b})

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_direct_missing_membership_denied_safely(async_client, monkeypatch, as_fake_user):
    """A direct conversation with no matching conversation_members row at all (e.g. data
    corruption, or a conversation that lost its membership rows) must deny, not error out."""
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.DIRECT, created_by=uuid.uuid4())
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.conversations_service, "is_member", AsyncMock(return_value=False))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Direct conversation: message-level ---


async def test_direct_member_can_get_message(async_client, monkeypatch, as_fake_user):
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user)
    message = _make_message(sender_id=other_user, conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})

    response = await async_client.get(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_direct_third_user_cannot_get_message(async_client, monkeypatch, as_fake_user):
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    conversation = _make_direct_conversation(user_a, user_b)
    message = _make_message(sender_id=user_a, conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_direct_conversation(monkeypatch, conversation, {user_a, user_b})

    response = await async_client.get(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_direct_sender_can_patch_own_message(async_client, monkeypatch, as_fake_user):
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})
    updated = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="edited")
    monkeypatch.setattr(message_router.message_service, "update", AsyncMock(return_value=updated))

    response = await async_client.patch(f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_direct_other_participant_cannot_patch_sender_message(async_client, monkeypatch, as_fake_user):
    """The other DM participant has no special edit rights -- same sender-only rule as
    channel/room messages; being 'in the conversation' does not grant edit access to someone
    else's message."""
    other_user = uuid.uuid4()
    message = _make_message(sender_id=other_user, conversation_id=uuid.uuid4(), content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))

    response = await async_client.patch(f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_direct_sender_can_delete_own_message(async_client, monkeypatch, as_fake_user):
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user)
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})
    monkeypatch.setattr(message_router.message_service, "delete", AsyncMock(return_value=None))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_direct_other_participant_cannot_delete_sender_message(async_client, monkeypatch, as_fake_user):
    """Unlike channel messages, direct messages have no 'manager' override at all -- the
    other participant can never delete a DM partner's message, full stop."""
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user)
    message = _make_message(sender_id=other_user, conversation_id=conversation.id, content="hi")
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Pagination (service-level) ---


class _FakeScalars:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _FakeResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return _FakeScalars(self._items)


async def test_list_by_conversation_returns_next_cursor_when_more_rows_exist():
    conversation_id = uuid.uuid4()
    messages = [_make_message(sender_id=uuid.uuid4(), conversation_id=conversation_id) for _ in range(3)]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=_FakeResult(messages))

    result, next_cursor = await MessagesService().list_by_conversation(session, conversation_id, limit=2)

    assert len(result) == 2
    assert next_cursor is not None


async def test_list_by_conversation_no_next_cursor_on_exact_page():
    conversation_id = uuid.uuid4()
    messages = [_make_message(sender_id=uuid.uuid4(), conversation_id=conversation_id) for _ in range(2)]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=_FakeResult(messages))

    result, next_cursor = await MessagesService().list_by_conversation(session, conversation_id, limit=2)

    assert len(result) == 2
    assert next_cursor is None


def test_cursor_round_trip():
    created_at = datetime.now(timezone.utc)
    message_id = uuid.uuid4()
    cursor = _encode_cursor(created_at, message_id)
    decoded_created_at, decoded_id = _decode_cursor(cursor)
    assert decoded_id == message_id
    assert decoded_created_at == created_at


def test_decode_cursor_invalid_raises():
    with pytest.raises(ValueError):
        _decode_cursor("not-a-valid-cursor")


# --- Send message with attachment ---


async def test_create_message_with_valid_attachment_returns_201(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    path = message_router.attachments_service.build_object_path(channel.group_id, channel.id, as_fake_user.id, "lesson.pdf")
    monkeypatch.setattr(message_router.attachments_service, "object_exists", AsyncMock(return_value=True))
    created = _make_message(
        sender_id=as_fake_user.id, conversation_id=conversation.id, content=None, attachment_path=path
    )
    monkeypatch.setattr(message_router.message_service, "create", AsyncMock(return_value=created))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"attachment_path": path}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201
    assert response.json()["attachment_path"] == path


async def test_create_message_rejects_attachment_from_other_channel(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    foreign_path = message_router.attachments_service.build_object_path(
        uuid.uuid4(), uuid.uuid4(), as_fake_user.id, "secret.pdf"
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"attachment_path": foreign_path}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_message_rejects_nonexistent_attachment(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    path = message_router.attachments_service.build_object_path(channel.group_id, channel.id, as_fake_user.id, "lesson.pdf")
    monkeypatch.setattr(message_router.attachments_service, "object_exists", AsyncMock(return_value=False))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"attachment_path": path}, headers=AUTH_HEADERS
    )
    assert response.status_code == 400


# --- Delete message with attachment ---


async def test_delete_message_removes_attachment_object(async_client, monkeypatch, as_fake_user):
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user)
    path = "groups/a/channels/b/c/d/lesson.pdf"
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content=None, attachment_path=path)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})
    monkeypatch.setattr(message_router.message_service, "delete", AsyncMock(return_value=None))
    delete_object_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(message_router.attachments_service, "delete_object", delete_object_mock)

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)

    assert response.status_code == 204
    delete_object_mock.assert_awaited_once_with(path)


async def test_delete_message_succeeds_even_if_storage_cleanup_fails(async_client, monkeypatch, as_fake_user):
    from app.attachments.services.attachment_service import AttachmentStorageError

    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user)
    path = "groups/a/channels/b/c/d/lesson.pdf"
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content=None, attachment_path=path)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})
    monkeypatch.setattr(message_router.message_service, "delete", AsyncMock(return_value=None))
    monkeypatch.setattr(
        message_router.attachments_service, "delete_object", AsyncMock(side_effect=AttachmentStorageError("boom"))
    )

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)

    assert response.status_code == 204
