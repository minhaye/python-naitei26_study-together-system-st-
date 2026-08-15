import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.conversations.entities.conversation_entity import Conversation
from app.db.enums import ConversationType


class ConversationsService:
    async def get_by_id(self, session: AsyncSession, conversation_id: uuid.UUID) -> Conversation | None:
        return await session.get(Conversation, conversation_id)

    async def get_by_channel_id(self, session: AsyncSession, channel_id: uuid.UUID) -> Conversation | None:
        result = await session.execute(select(Conversation).where(Conversation.channel_id == channel_id))
        return result.scalar_one_or_none()

    async def create_for_channel(
        self, session: AsyncSession, channel_id: uuid.UUID, created_by: uuid.UUID
    ) -> Conversation:
        conversation = Conversation(type=ConversationType.CHANNEL, channel_id=channel_id, created_by=created_by)
        session.add(conversation)
        await session.flush()
        return conversation
