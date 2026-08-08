import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.channel import Channel, ChannelMember, Message
from app.schemas.channel import ChannelCreate, ChannelUpdate, MessageCreate, MessageUpdate


async def create_channel(session: AsyncSession, data: ChannelCreate) -> Channel:
    channel = Channel(**data.model_dump())
    session.add(channel)
    await session.flush()
    return channel


async def get_channel(session: AsyncSession, channel_id: uuid.UUID) -> Channel | None:
    return await session.get(Channel, channel_id)


async def list_channels_by_group(session: AsyncSession, group_id: uuid.UUID) -> list[Channel]:
    result = await session.execute(select(Channel).where(Channel.group_id == group_id))
    return list(result.scalars().all())


async def update_channel(session: AsyncSession, channel: Channel, data: ChannelUpdate) -> Channel:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(channel, field, value)
    await session.flush()
    return channel


async def delete_channel(session: AsyncSession, channel: Channel) -> None:
    await session.delete(channel)
    await session.flush()


# --- channel_members: junction table -> add/remove/list membership ---


async def add_channel_member(session: AsyncSession, channel_id: uuid.UUID, user_id: uuid.UUID) -> ChannelMember:
    member = ChannelMember(channel_id=channel_id, user_id=user_id)
    session.add(member)
    await session.flush()
    return member


async def list_channel_members(session: AsyncSession, channel_id: uuid.UUID) -> list[ChannelMember]:
    result = await session.execute(select(ChannelMember).where(ChannelMember.channel_id == channel_id))
    return list(result.scalars().all())


async def get_channel_member(session: AsyncSession, channel_id: uuid.UUID, user_id: uuid.UUID) -> ChannelMember | None:
    result = await session.execute(
        select(ChannelMember).where(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def remove_channel_member(session: AsyncSession, member: ChannelMember) -> None:
    await session.delete(member)
    await session.flush()


# --- messages ---


async def create_message(session: AsyncSession, data: MessageCreate) -> Message:
    message = Message(**data.model_dump())
    session.add(message)
    await session.flush()
    return message


async def get_message(session: AsyncSession, message_id: uuid.UUID) -> Message | None:
    return await session.get(Message, message_id)


async def list_messages_by_channel(
    session: AsyncSession, channel_id: uuid.UUID, skip: int = 0, limit: int = 50
) -> list[Message]:
    result = await session.execute(
        select(Message)
        .where(Message.channel_id == channel_id)
        .order_by(Message.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_message(session: AsyncSession, message: Message, data: MessageUpdate) -> Message:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(message, field, value)
    await session.flush()
    return message


async def delete_message(session: AsyncSession, message: Message) -> None:
    await session.delete(message)
    await session.flush()
