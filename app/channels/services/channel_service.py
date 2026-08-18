import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.channels.entities.channel_entity import Channel, ChannelMember
from app.channels.dto.channel_dto import ChannelCreate, ChannelUpdate
from app.conversations.services.conversation_service import ConversationsService

conversations_service = ConversationsService()


class ChannelsService:
    async def create(self, session: AsyncSession, data: ChannelCreate, created_by: uuid.UUID) -> Channel:
        """`created_by` is the authenticated caller, passed explicitly by the router --
        never trust a client-supplied created_by as the acting/attributed identity."""
        channel = Channel(**data.model_dump(), created_by=created_by)
        session.add(channel)
        await session.flush()

        conversation = await conversations_service.create_for_channel(session, channel.id, created_by)
        # Sync in-memory relationship so the response (built in this same session, no
        # refetch) can read channel.conversation_id without a lazy-load round trip.
        channel.conversation = conversation
        return channel

    async def get_by_id(self, session: AsyncSession, channel_id: uuid.UUID) -> Channel | None:
        """Returns the channel regardless of deleted_at -- callers (channel_router) decide
        whether a soft-deleted channel should be treated as not-found, since some call
        sites (e.g. delete_channel's own idempotency check) need to see it either way."""
        result = await session.execute(
            select(Channel).options(selectinload(Channel.conversation)).where(Channel.id == channel_id)
        )
        return result.scalar_one_or_none()

    async def list_by_group(self, session: AsyncSession, group_id: uuid.UUID) -> list[Channel]:
        """Soft-deleted channels are excluded unconditionally -- a deleted channel must not
        appear in Channel lists (see docs/db/STUDY_PLATFORM_DATABASE_SPEC.md § 9)."""
        result = await session.execute(
            select(Channel)
            .options(selectinload(Channel.conversation))
            .where(Channel.group_id == group_id, Channel.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def update(self, session: AsyncSession, channel: Channel, data: ChannelUpdate) -> Channel:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(channel, field, value)
        await session.flush()
        return channel

    async def soft_delete(self, session: AsyncSession, channel: Channel, deleted_by: uuid.UUID) -> Channel:
        """`deleted_by` is the authenticated caller, passed explicitly by the router --
        never trust a client-supplied deleted_by. Never physically deletes the row: the
        Channel, its Conversation, and all historical Messages remain in the database (see
        docs/db/migrations/009_soft_delete_channels.sql)."""
        channel.deleted_at = datetime.now(timezone.utc)
        channel.deleted_by = deleted_by
        await session.flush()
        return channel

    # --- channel_members ---

    async def add_member(self, session: AsyncSession, channel_id: uuid.UUID, user_id: uuid.UUID) -> ChannelMember:
        member = ChannelMember(channel_id=channel_id, user_id=user_id)
        session.add(member)
        await session.flush()
        return member

    async def list_members(self, session: AsyncSession, channel_id: uuid.UUID) -> list[ChannelMember]:
        result = await session.execute(select(ChannelMember).where(ChannelMember.channel_id == channel_id))
        return list(result.scalars().all())

    async def get_member(self, session: AsyncSession, channel_id: uuid.UUID, user_id: uuid.UUID) -> ChannelMember | None:
        result = await session.execute(
            select(ChannelMember).where(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def remove_member(self, session: AsyncSession, member: ChannelMember) -> None:
        await session.delete(member)
        await session.flush()
