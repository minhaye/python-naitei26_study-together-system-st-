import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.entities.channel_entity import Channel
from app.channels.services.channel_service import ChannelsService
from app.conversations.entities.conversation_entity import Conversation
from app.conversations.services.conversation_service import ConversationsService
from app.db.enums import ConversationType, GroupMemberRole, MemberStatus, StudyRoomStatus
from app.groups.services.group_service import GroupsService
from app.study_rooms.entities.study_room_entity import StudyRoom
from app.study_rooms.services.study_room_service import StudyRoomsService

channels_service = ChannelsService()
groups_service = GroupsService()
study_rooms_service = StudyRoomsService()
conversations_service = ConversationsService()


async def is_active_group_member(session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    member = await groups_service.get_member(session, group_id, user_id)
    return member is not None and member.status == MemberStatus.ACTIVE


async def is_group_manager(session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    member = await groups_service.get_member(session, group_id, user_id)
    return (
        member is not None
        and member.status == MemberStatus.ACTIVE
        and member.role in (GroupMemberRole.OWNER, GroupMemberRole.MODERATOR)
    )


async def can_access_channel(session: AsyncSession, channel: Channel, user_id: uuid.UUID) -> bool:
    """Mirrors the `can_access_channel` RLS helper used by Supabase policies."""
    if not await is_active_group_member(session, channel.group_id, user_id):
        return False
    if channel.is_private:
        member = await channels_service.get_member(session, channel.id, user_id)
        return member is not None
    return True


async def is_active_room_member(session: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """A study room membership row has no `status` column (unlike group_members);
    the only signal for "no longer a participant" -- whether they left voluntarily
    or were kicked (see `can_access_room`) -- is `left_at` being set."""
    member = await study_rooms_service.get_member(session, room_id, user_id)
    return member is not None and member.left_at is None


async def can_access_room(session: AsyncSession, room: StudyRoom, user_id: uuid.UUID) -> bool:
    """Mirrors the intended `can_access_conversation` RLS helper for room conversations.
    The host always has access, even if their own membership row is somehow inactive;
    everyone else needs an active (non-left) `study_room_members` row. Study rooms have
    no separate "banned" concept -- `RoomModerationAction.KICK` is only an audit log entry,
    so a kicked member is indistinguishable from one who left (`left_at` set)."""
    if room.host_id == user_id:
        return True
    return await is_active_room_member(session, room.id, user_id)


async def can_join_room_meeting(session: AsyncSession, room: StudyRoom, user_id: uuid.UUID) -> bool:
    """Authorization for issuing a LiveKit meeting join token: same membership check as
    `can_access_room`, plus a lifecycle gate. Deliberately kept separate from
    `can_access_room` -- that helper is also used for historical/read access (e.g. chat
    history), which must keep working after a room ends, whereas a meeting join token must
    not be reissued once the room's live session is over. Mirrors how
    `is_room_conversation_open_for_writes` layers a lifecycle check on top of
    `can_access_conversation` for message writes."""
    if not await can_access_room(session, room, user_id):
        return False
    return room.status != StudyRoomStatus.ENDED


async def is_conversation_member(session: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """Direct-conversation membership check. Mirrors the `is_conversation_member` RLS
    helper (migration 004) -- `conversation_members` is the sole source of truth for
    DIRECT access; it is never consulted for CHANNEL/ROOM, which have their own
    membership tables."""
    return await conversations_service.is_member(session, conversation_id, user_id)


async def can_access_conversation(session: AsyncSession, conversation: Conversation, user_id: uuid.UUID) -> bool:
    """Single entry point for read-time message/attachment authorization, dispatching on
    conversation.type. Mirrors the `can_access_conversation` RLS helper.
    """
    if conversation.type == ConversationType.CHANNEL:
        if conversation.channel_id is None:
            return False
        channel = await channels_service.get_by_id(session, conversation.channel_id)
        return channel is not None and await can_access_channel(session, channel, user_id)
    if conversation.type == ConversationType.ROOM:
        if conversation.room_id is None:
            return False
        room = await study_rooms_service.get_by_id(session, conversation.room_id)
        return room is not None and await can_access_room(session, room, user_id)
    if conversation.type == ConversationType.DIRECT:
        return await is_conversation_member(session, conversation.id, user_id)
    return False


async def is_room_conversation_open_for_writes(session: AsyncSession, conversation: Conversation) -> bool:
    """Lifecycle-only check, deliberately separate from membership: an ended study room becomes
    read-only chat history (no new messages, no edits, no deletes) for everyone, including the
    original sender/host. Channel conversations have no such lifecycle gate and always pass.
    Used both by `can_send_to_conversation` (new messages/attachments) and directly by the
    message edit/delete routes, which authorize by sender identity rather than re-checking
    membership -- they only need this lifecycle half of the write check, not the full one."""
    if conversation.type != ConversationType.ROOM or conversation.room_id is None:
        return True
    room = await study_rooms_service.get_by_id(session, conversation.room_id)
    return room is None or room.status != StudyRoomStatus.ENDED


async def can_send_to_conversation(session: AsyncSession, conversation: Conversation, user_id: uuid.UUID) -> bool:
    """Write-time authorization: same membership check as `can_access_conversation`, plus
    any additional lifecycle restriction. An ended study room can still be read by its
    members but no longer accepts new messages/attachments; channel conversations have no
    such lifecycle gate today."""
    if not await can_access_conversation(session, conversation, user_id):
        return False
    return await is_room_conversation_open_for_writes(session, conversation)
