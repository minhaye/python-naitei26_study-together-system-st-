import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.entities.channel_entity import Channel
from app.channels.services.channel_service import ChannelsService
from app.db.enums import GroupMemberRole, MemberStatus
from app.groups.services.group_service import GroupsService

channels_service = ChannelsService()
groups_service = GroupsService()


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
