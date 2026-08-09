import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.messages.entities.message import Message
from app.messages.dto.message import MessageCreate, MessageUpdate


class MessagesService:
    async def create(self, session: AsyncSession, data: MessageCreate) -> Message:
        message = Message(**data.model_dump())
        session.add(message)
        await session.flush()
        return message

    async def get_by_id(self, session: AsyncSession, message_id: uuid.UUID) -> Message | None:
        return await session.get(Message, message_id)

    async def list_by_channel(
        self, session: AsyncSession, channel_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> list[Message]:
        result = await session.execute(
            select(Message)
            .where(Message.channel_id == channel_id)
            .order_by(Message.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def update(self, session: AsyncSession, message: Message, data: MessageUpdate) -> Message:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(message, field, value)
        await session.flush()
        return message

    async def delete(self, session: AsyncSession, message: Message) -> None:
        await session.delete(message)
        await session.flush()
