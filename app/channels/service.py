import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.entities.channel import Channel, ChannelMember
from app.channels.dto.channel import ChannelCreate, ChannelUpdate


class ChannelsService:
    async def create(self, session: AsyncSession, data: ChannelCreate) -> Channel:
        channel = Channel(**data.model_dump())
        session.add(channel)
        await session.flush()
        return channel

    async def get_by_id(self, session: AsyncSession, channel_id: uuid.UUID) -> Channel | None:
        return await session.get(Channel, channel_id)

    async def list_by_group(self, session: AsyncSession, group_id: uuid.UUID) -> list[Channel]:
        result = await session.execute(select(Channel).where(Channel.group_id == group_id))
        return list(result.scalars().all())

    async def update(self, session: AsyncSession, channel: Channel, data: ChannelUpdate) -> Channel:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(channel, field, value)
        await session.flush()
        return channel

    async def delete(self, session: AsyncSession, channel: Channel) -> None:
        await session.delete(channel)
        await session.flush()

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
