import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.entities.channel_entity import Channel
from app.channels.services.channel_service import ChannelsService
from app.conversations.entities.conversation_entity import Conversation
from app.conversations.services.conversation_service import ConversationsService
from app.db.enums import ConversationType, GroupMemberRole, MemberStatus, StudyRoomStatus
from app.groups.entities.group_entity import Group
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


def is_group_owner(group: Group, user_id: uuid.UUID) -> bool:
    """Stricter than `is_group_manager` (owner-only, not owner-or-moderator). Reads the
    denormalized `groups.owner_id` directly rather than re-querying group_members. Used for
    operations the spec keeps conservative/owner-only: group update/delete, member role
    changes, and ban/reactivate/remove (moderator authority over these is explicitly left
    unresolved by the spec, so it is not granted here)."""
    return group.owner_id == user_id


async def can_access_channel(session: AsyncSession, channel: Channel, user_id: uuid.UUID) -> bool:
    """Mirrors the `can_access_channel` RLS helper used by Supabase policies (see
    `public.can_access_channel` in docs/db/migrations/004_refactor_chat_to_conversations.sql
    § 8, updated by 009_soft_delete_channels.sql): private channels grant access to an
    explicit `channel_members` row OR group-manager authority (owner/moderator), not
    membership alone. The manager branch matters because channel creation never inserts the
    creator into `channel_members` -- without it, a manager who just created a private
    channel would be locked out of their own channel.

    A soft-deleted channel (deleted_at set) is denied outright, before any other check --
    this must hold for every caller, including an active group owner/moderator, so a deleted
    channel behaves as if it no longer exists for everyone (see
    docs/db/STUDY_PLATFORM_DATABASE_SPEC.md § 9)."""
    if channel.deleted_at is not None:
        return False
    if not await is_active_group_member(session, channel.group_id, user_id):
        return False
    if channel.is_private:
        if await is_group_manager(session, channel.group_id, user_id):
            return True
        member = await channels_service.get_member(session, channel.id, user_id)
        return member is not None
    return True


async def is_active_room_member(session: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """A study room membership row has no `status` column (unlike group_members);
    the only signal for "no longer a participant" -- whether they left voluntarily
    or were kicked (see `can_access_room`) -- is `left_at` being set."""
    member = await study_rooms_service.get_member(session, room_id, user_id)
    return member is not None and member.left_at is None


async def can_manage_room(session: AsyncSession, room: StudyRoom, user_id: uuid.UUID) -> bool:
    """Room management authority (update/start/end/delete, KICK/MUTE/UNMUTE, member-role
    changes) derives entirely from the actor's CURRENT Group role -- `is_group_manager`
    (active owner or moderator of `room.group_id`), never from `study_rooms.host_id` or from
    a room-scoped `study_room_members.role` (2026-08-18 policy: `host_id` identifies the
    original creator, it is not an independent or permanent authorization grant -- see
    STUDY_PLATFORM_DATABASE_SPEC.md §16/§22). Without this, a Moderator who creates a room and
    is later demoted to plain Member (or leaves/is banned from the Group) would keep
    unconditional host authority over that room forever, since `host_id` never changes.

    A soft-deleted room (deleted_at set) is denied outright, before any other check --
    this does not go through `can_access_room`, so it needs its own guard (see
    docs/db/migrations/010_soft_delete_study_rooms.sql)."""
    if room.deleted_at is not None:
        return False
    return await is_group_manager(session, room.group_id, user_id)


def can_join_room(room: StudyRoom) -> bool:
    """Lifecycle gate for joining: an ended OR soft-deleted room must not accept new/returning
    participants, even though an ended (but not deleted) room stays readable as history (see
    `can_access_room` / `is_room_conversation_open_for_writes`)."""
    return room.deleted_at is None and room.status != StudyRoomStatus.ENDED


async def can_access_room(session: AsyncSession, room: StudyRoom, user_id: uuid.UUID) -> bool:
    """Mirrors `can_access_room_conversation` (SQL/RLS, migration 011). Participation requires
    BOTH a CURRENT active Group membership AND an active (non-left) `study_room_members` row --
    `room.host_id` is NOT an independent access grant (2026-08-18 policy change: `host_id`
    identifies the original creator, it does not confer standing authorization -- see
    STUDY_PLATFORM_DATABASE_SPEC.md §16).

    The Group-membership check (2026-08-18 parity fix) matters because a `study_room_members`
    row has no way to expire itself when the user later leaves/is banned from the Group -- there
    is no cascade from Group membership changes to Room memberships (see
    STUDY_PLATFORM_DATABASE_SPEC.md §16). Without it, a user who left or was banned from the
    Group could keep reading/writing this room's chat forever on their stale active Room
    membership alone, even though migration 011 already denies them the same access at the
    SQL/RLS layer (Realtime, direct PostgREST) -- this was a real Python/SQL authorization
    mismatch, not just a theoretical one.

    A still-participating host is unaffected by either check: room creation always inserts an
    active HOST-role `study_room_members` row for the creator in the same transaction (see
    `StudyRoomsService.create`), and the creator was necessarily an active Group member at
    creation time (`create_room` requires `is_group_manager`). Only a host who has since left
    the room, or whose Group membership has since lapsed, loses the access `host_id` alone used
    to grant. Study rooms have no separate "banned" concept -- `RoomModerationAction.KICK` is
    only an audit log entry, so a kicked member is indistinguishable from one who left
    (`left_at` set).

    A soft-deleted room (deleted_at set) is denied outright, before any other check -- this
    must hold for every caller, including the host, so a deleted room behaves as if it no
    longer exists for everyone (mirrors `can_access_channel`, see
    docs/db/migrations/010_soft_delete_study_rooms.sql). This is the single choke point every
    read/write path for room messages, attachments, and meeting tokens goes through (via
    `can_access_conversation`/`can_send_to_conversation`/`can_join_room_meeting`).

    This is participation authority, separate from management authority (`can_manage_room`,
    `is_group_manager`) -- an active Group owner/moderator does NOT bypass this check purely by
    virtue of being a manager; they still need their own active `study_room_members` row like
    any other participant."""
    if room.deleted_at is not None:
        return False
    if not await is_active_group_member(session, room.group_id, user_id):
        return False
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
