import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

from app.channels.entities.channel_entity import Channel, ChannelMember
from app.conversations.entities.conversation_entity import Conversation
from app.core import permissions
from app.db.enums import ConversationType, GroupMemberRole, MemberStatus, StudyRoomMemberRole, StudyRoomStatus
from app.groups.entities.group_entity import Group, GroupMember
from app.study_rooms.entities.study_room_entity import StudyRoom, StudyRoomMember


def _group_member(role: GroupMemberRole, status: MemberStatus) -> GroupMember:
    return GroupMember(group_id=uuid.uuid4(), user_id=uuid.uuid4(), role=role, status=status)


def _group(owner_id: uuid.UUID | None = None) -> Group:
    return Group(id=uuid.uuid4(), name="Group", owner_id=owner_id or uuid.uuid4(), is_public=True)


def _channel(is_private: bool, deleted_at: datetime | None = None) -> Channel:
    return Channel(id=uuid.uuid4(), group_id=uuid.uuid4(), name="general", is_private=is_private, deleted_at=deleted_at)


def _room(status: StudyRoomStatus = StudyRoomStatus.ACTIVE, host_id: uuid.UUID | None = None) -> StudyRoom:
    return StudyRoom(
        id=uuid.uuid4(),
        group_id=uuid.uuid4(),
        name="Room",
        host_id=host_id or uuid.uuid4(),
        status=status,
        max_participants=50,
    )


def _room_member(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    role: StudyRoomMemberRole = StudyRoomMemberRole.PARTICIPANT,
    left_at: datetime | None = None,
) -> StudyRoomMember:
    return StudyRoomMember(room_id=room_id, user_id=user_id, role=role, left_at=left_at)


async def test_is_active_group_member_true_for_active_member(monkeypatch):
    member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert await permissions.is_active_group_member(session=None, group_id=uuid.uuid4(), user_id=uuid.uuid4())


async def test_is_active_group_member_false_when_banned(monkeypatch):
    member = _group_member(GroupMemberRole.MEMBER, MemberStatus.BANNED)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert not await permissions.is_active_group_member(session=None, group_id=uuid.uuid4(), user_id=uuid.uuid4())


async def test_is_active_group_member_false_when_no_membership(monkeypatch):
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.is_active_group_member(session=None, group_id=uuid.uuid4(), user_id=uuid.uuid4())


async def test_is_group_manager_true_for_owner(monkeypatch):
    member = _group_member(GroupMemberRole.OWNER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert await permissions.is_group_manager(session=None, group_id=uuid.uuid4(), user_id=uuid.uuid4())


async def test_is_group_manager_false_for_plain_member(monkeypatch):
    member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert not await permissions.is_group_manager(session=None, group_id=uuid.uuid4(), user_id=uuid.uuid4())


def test_is_group_owner_true_for_owner():
    owner_id = uuid.uuid4()
    group = _group(owner_id=owner_id)

    assert permissions.is_group_owner(group, owner_id)


def test_is_group_owner_false_for_non_owner():
    group = _group(owner_id=uuid.uuid4())

    assert not permissions.is_group_owner(group, uuid.uuid4())


async def test_can_access_channel_public_requires_only_group_membership(monkeypatch):
    channel = _channel(is_private=False)
    member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())


async def test_can_access_channel_false_when_not_group_member(monkeypatch):
    channel = _channel(is_private=False)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())


async def test_can_access_channel_private_requires_channel_membership(monkeypatch):
    channel = _channel(is_private=True)
    group_member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=group_member))
    monkeypatch.setattr(permissions.channels_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())

    channel_member = ChannelMember(channel_id=channel.id, user_id=uuid.uuid4())
    monkeypatch.setattr(permissions.channels_service, "get_member", AsyncMock(return_value=channel_member))

    assert await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())


async def test_can_access_channel_private_grants_implicit_access_to_owner_without_membership_row(monkeypatch):
    """Mirrors the SQL `can_access_channel()` RLS helper (docs/db/migrations/
    004_refactor_chat_to_conversations.sql § 8), which ORs in `is_group_manager` alongside
    the channel_members check. Channel creation never inserts the creator into
    channel_members, so without this branch the creator would be locked out of their own
    private channel."""
    channel = _channel(is_private=True)
    owner = _group_member(GroupMemberRole.OWNER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=owner))
    get_channel_member_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(permissions.channels_service, "get_member", get_channel_member_mock)

    assert await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())
    get_channel_member_mock.assert_not_awaited()


async def test_can_access_channel_private_grants_implicit_access_to_moderator_without_membership_row(monkeypatch):
    channel = _channel(is_private=True)
    moderator = _group_member(GroupMemberRole.MODERATOR, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=moderator))
    monkeypatch.setattr(permissions.channels_service, "get_member", AsyncMock(return_value=None))

    assert await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())


async def test_can_access_channel_private_denies_plain_member_without_membership_row(monkeypatch):
    """Contrast with the manager tests above: an ordinary active member (not owner/moderator)
    must NOT get implicit private-channel access -- they still need an explicit
    channel_members row."""
    channel = _channel(is_private=True)
    plain_member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=plain_member))
    monkeypatch.setattr(permissions.channels_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())


async def test_can_access_channel_private_denies_banned_owner_even_with_stale_membership_row(monkeypatch):
    """A banned/inactive group_members row must deny access outright, regardless of role or
    of a leftover channel_members row -- is_active_group_member is checked first and gates
    both the manager branch and the explicit-membership branch."""
    channel = _channel(is_private=True)
    banned_owner = _group_member(GroupMemberRole.OWNER, MemberStatus.BANNED)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=banned_owner))
    stale_channel_member = ChannelMember(channel_id=channel.id, user_id=uuid.uuid4())
    get_channel_member_mock = AsyncMock(return_value=stale_channel_member)
    monkeypatch.setattr(permissions.channels_service, "get_member", get_channel_member_mock)

    assert not await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())
    get_channel_member_mock.assert_not_awaited()


# --- can_access_channel: soft-deleted channel (migration 009) ---


async def test_can_access_channel_false_when_deleted_even_for_active_member(monkeypatch):
    channel = _channel(is_private=False, deleted_at=datetime.now(timezone.utc))
    get_member_mock = AsyncMock(return_value=_group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE))
    monkeypatch.setattr(permissions.groups_service, "get_member", get_member_mock)

    assert not await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())
    # Deletion is checked before any group-membership lookup -- deny fast, no wasted query.
    get_member_mock.assert_not_awaited()


async def test_can_access_channel_false_when_deleted_even_for_group_owner(monkeypatch):
    """A deleted channel must deny everyone through normal access paths, including the
    group owner/moderator who could otherwise use the implicit-manager-access branch."""
    channel = _channel(is_private=True, deleted_at=datetime.now(timezone.utc))
    get_member_mock = AsyncMock(return_value=_group_member(GroupMemberRole.OWNER, MemberStatus.ACTIVE))
    monkeypatch.setattr(permissions.groups_service, "get_member", get_member_mock)

    assert not await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())
    get_member_mock.assert_not_awaited()


async def test_can_access_channel_false_when_deleted_even_for_explicit_channel_member(monkeypatch):
    channel = _channel(is_private=True, deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock())
    get_channel_member_mock = AsyncMock()
    monkeypatch.setattr(permissions.channels_service, "get_member", get_channel_member_mock)

    assert not await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())
    get_channel_member_mock.assert_not_awaited()


async def test_can_access_channel_true_when_deleted_at_is_none(monkeypatch):
    """Contrast case: an explicit deleted_at=None (the default/not-deleted state) must not
    itself deny access -- only an actually-set deleted_at does."""
    channel = _channel(is_private=False, deleted_at=None)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE))
    )

    assert await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())


async def test_can_access_conversation_channel_type_false_when_channel_deleted(monkeypatch):
    """End-to-end through the dispatch entry point: can_access_conversation for a channel-type
    conversation must deny once the underlying channel is soft-deleted."""
    channel = _channel(is_private=False, deleted_at=datetime.now(timezone.utc))
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.CHANNEL, channel_id=channel.id, created_by=uuid.uuid4())
    monkeypatch.setattr(permissions.channels_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=_group_member(GroupMemberRole.OWNER, MemberStatus.ACTIVE)))

    assert not await permissions.can_access_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())


# --- can_access_conversation ---


async def test_can_access_conversation_channel_type_delegates_to_can_access_channel(monkeypatch):
    channel = _channel(is_private=False)
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.CHANNEL, channel_id=channel.id, created_by=uuid.uuid4())
    member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.channels_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert await permissions.can_access_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())


async def test_can_access_conversation_channel_type_false_when_channel_missing(monkeypatch):
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.CHANNEL, channel_id=uuid.uuid4(), created_by=uuid.uuid4())
    monkeypatch.setattr(permissions.channels_service, "get_by_id", AsyncMock(return_value=None))

    assert not await permissions.can_access_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())


async def test_can_access_conversation_direct_type_true_for_member(monkeypatch):
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.DIRECT, created_by=user_a)
    monkeypatch.setattr(permissions.conversations_service, "is_member", AsyncMock(return_value=True))

    assert await permissions.can_access_conversation(session=None, conversation=conversation, user_id=user_a)


async def test_can_access_conversation_direct_type_false_for_non_member(monkeypatch):
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.DIRECT, created_by=uuid.uuid4())
    monkeypatch.setattr(permissions.conversations_service, "is_member", AsyncMock(return_value=False))

    assert not await permissions.can_access_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())


async def test_can_access_conversation_direct_type_denied_even_with_room_id_set(monkeypatch):
    """Type must gate dispatch, not the presence of a (contradictory) room_id/channel_id --
    a DIRECT conversation with a stray room_id must still resolve via conversation_members,
    never fall through to room logic."""
    conversation = Conversation(
        id=uuid.uuid4(), type=ConversationType.DIRECT, room_id=uuid.uuid4(), created_by=uuid.uuid4()
    )
    get_room_mock = AsyncMock()
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", get_room_mock)
    monkeypatch.setattr(permissions.conversations_service, "is_member", AsyncMock(return_value=False))

    assert not await permissions.can_access_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())
    get_room_mock.assert_not_awaited()


# --- can_access_room / can_access_conversation (room) ---


async def test_can_access_room_true_for_host(monkeypatch):
    host_id = uuid.uuid4()
    room = _room(host_id=host_id)
    get_member_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", get_member_mock)

    assert await permissions.can_access_room(session=None, room=room, user_id=host_id)
    get_member_mock.assert_not_awaited()


async def test_can_access_room_true_for_active_member(monkeypatch):
    room = _room()
    user_id = uuid.uuid4()
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, user_id))
    )

    assert await permissions.can_access_room(session=None, room=room, user_id=user_id)


async def test_can_access_room_false_for_non_member(monkeypatch):
    room = _room()
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.can_access_room(session=None, room=room, user_id=uuid.uuid4())


async def test_can_access_room_false_for_left_member(monkeypatch):
    room = _room()
    user_id = uuid.uuid4()
    left_member = _room_member(room.id, user_id, left_at=datetime.now(timezone.utc))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=left_member))

    assert not await permissions.can_access_room(session=None, room=room, user_id=user_id)


async def test_can_access_room_false_for_kicked_member(monkeypatch):
    """Study rooms have no separate 'banned'/'kicked' status column -- RoomModerationAction.KICK
    is only an audit log entry, not wired to membership. A kicked member is represented the
    same way as one who left: their study_room_members row has left_at set."""
    room = _room()
    user_id = uuid.uuid4()
    kicked_member = _room_member(room.id, user_id, left_at=datetime.now(timezone.utc))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=kicked_member))

    assert not await permissions.can_access_room(session=None, room=room, user_id=user_id)


# --- can_join_room_meeting ---


async def test_can_join_room_meeting_true_for_waiting_room_host(monkeypatch):
    host_id = uuid.uuid4()
    room = _room(status=StudyRoomStatus.WAITING, host_id=host_id)
    get_member_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", get_member_mock)

    assert await permissions.can_join_room_meeting(session=None, room=room, user_id=host_id)
    get_member_mock.assert_not_awaited()


async def test_can_join_room_meeting_true_for_active_room_member(monkeypatch):
    room = _room(status=StudyRoomStatus.ACTIVE)
    user_id = uuid.uuid4()
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, user_id))
    )

    assert await permissions.can_join_room_meeting(session=None, room=room, user_id=user_id)


async def test_can_join_room_meeting_false_when_room_ended_even_for_member(monkeypatch):
    room = _room(status=StudyRoomStatus.ENDED)
    user_id = uuid.uuid4()
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, user_id))
    )

    assert not await permissions.can_join_room_meeting(session=None, room=room, user_id=user_id)


async def test_can_join_room_meeting_false_when_room_ended_even_for_host(monkeypatch):
    host_id = uuid.uuid4()
    room = _room(status=StudyRoomStatus.ENDED, host_id=host_id)
    get_member_mock = AsyncMock()
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", get_member_mock)

    assert not await permissions.can_join_room_meeting(session=None, room=room, user_id=host_id)
    get_member_mock.assert_not_awaited()


async def test_can_join_room_meeting_false_for_non_member(monkeypatch):
    room = _room(status=StudyRoomStatus.ACTIVE)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.can_join_room_meeting(session=None, room=room, user_id=uuid.uuid4())


async def test_can_join_room_meeting_false_for_left_member(monkeypatch):
    room = _room(status=StudyRoomStatus.ACTIVE)
    user_id = uuid.uuid4()
    left_member = _room_member(room.id, user_id, left_at=datetime.now(timezone.utc))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=left_member))

    assert not await permissions.can_join_room_meeting(session=None, room=room, user_id=user_id)


async def test_can_access_conversation_room_type_true_for_host(monkeypatch):
    host_id = uuid.uuid4()
    room = _room(host_id=host_id)
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=room.id, created_by=host_id)
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))

    assert await permissions.can_access_conversation(session=None, conversation=conversation, user_id=host_id)


async def test_can_access_conversation_room_type_true_for_active_member(monkeypatch):
    room = _room()
    user_id = uuid.uuid4()
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=room.id, created_by=room.host_id)
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, user_id))
    )

    assert await permissions.can_access_conversation(session=None, conversation=conversation, user_id=user_id)


async def test_can_access_conversation_room_type_false_for_non_member(monkeypatch):
    room = _room()
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=room.id, created_by=room.host_id)
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.can_access_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())


async def test_can_access_conversation_room_type_false_for_left_member(monkeypatch):
    room = _room()
    user_id = uuid.uuid4()
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=room.id, created_by=room.host_id)
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    left_member = _room_member(room.id, user_id, left_at=datetime.now(timezone.utc))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=left_member))

    assert not await permissions.can_access_conversation(session=None, conversation=conversation, user_id=user_id)


async def test_can_access_conversation_room_type_false_when_room_id_missing():
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=None, created_by=uuid.uuid4())

    assert not await permissions.can_access_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())


async def test_can_access_conversation_room_type_false_when_room_missing(monkeypatch):
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=uuid.uuid4(), created_by=uuid.uuid4())
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=None))

    assert not await permissions.can_access_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())


async def test_can_access_conversation_channel_type_denied_even_with_room_id_set(monkeypatch):
    """Type must gate dispatch: a CHANNEL conversation with a (contradictory) room_id set
    must not fall through to room logic, and must still require channel_id/membership."""
    conversation = Conversation(
        id=uuid.uuid4(), type=ConversationType.CHANNEL, channel_id=None, room_id=uuid.uuid4(), created_by=uuid.uuid4()
    )
    get_room_mock = AsyncMock()
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", get_room_mock)

    assert not await permissions.can_access_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())
    get_room_mock.assert_not_awaited()


# --- can_send_to_conversation (room lifecycle) ---


async def test_can_send_to_conversation_room_active_allows_send(monkeypatch):
    room = _room(status=StudyRoomStatus.ACTIVE)
    user_id = uuid.uuid4()
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=room.id, created_by=room.host_id)
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, user_id))
    )

    assert await permissions.can_send_to_conversation(session=None, conversation=conversation, user_id=user_id)


async def test_can_send_to_conversation_room_ended_denies_send_but_allows_read(monkeypatch):
    room = _room(status=StudyRoomStatus.ENDED)
    user_id = uuid.uuid4()
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=room.id, created_by=room.host_id)
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, user_id))
    )

    assert await permissions.can_access_conversation(session=None, conversation=conversation, user_id=user_id)
    assert not await permissions.can_send_to_conversation(session=None, conversation=conversation, user_id=user_id)


async def test_can_send_to_conversation_room_non_member_still_denied(monkeypatch):
    room = _room(status=StudyRoomStatus.ACTIVE)
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=room.id, created_by=room.host_id)
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.can_send_to_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())


async def test_can_send_to_conversation_channel_type_unaffected_by_room_logic(monkeypatch):
    channel = _channel(is_private=False)
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.CHANNEL, channel_id=channel.id, created_by=uuid.uuid4())
    member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.channels_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert await permissions.can_send_to_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())


# --- can_send_to_conversation (direct) ---


async def test_can_send_to_conversation_direct_member_allowed(monkeypatch):
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.DIRECT, created_by=uuid.uuid4())
    monkeypatch.setattr(permissions.conversations_service, "is_member", AsyncMock(return_value=True))

    assert await permissions.can_send_to_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())


async def test_can_send_to_conversation_direct_non_member_denied(monkeypatch):
    """Covers both 'never a member' and 'malformed/dangling direct conversation' cases --
    is_member() returning False is the single safe-deny path for either."""
    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.DIRECT, created_by=uuid.uuid4())
    monkeypatch.setattr(permissions.conversations_service, "is_member", AsyncMock(return_value=False))

    assert not await permissions.can_send_to_conversation(session=None, conversation=conversation, user_id=uuid.uuid4())
