import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.conversations.entities.conversation_entity import Conversation, ConversationMember
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

    # --- direct (1-1) conversations ---

    async def get_direct_by_pair(
        self, session: AsyncSession, user_a_id: uuid.UUID, user_b_id: uuid.UUID
    ) -> Conversation | None:
        """Order-independent lookup: A/B and B/A both resolve to the same row."""
        min_id, max_id = sorted((user_a_id, user_b_id))
        result = await session.execute(
            select(Conversation).where(
                Conversation.type == ConversationType.DIRECT,
                Conversation.direct_user_min_id == min_id,
                Conversation.direct_user_max_id == max_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_or_create_direct(
        self, session: AsyncSession, user_a_id: uuid.UUID, user_b_id: uuid.UUID
    ) -> Conversation:
        """Idempotently resolve the single direct conversation between two users.

        Race safety: a plain select-then-insert is not sufficient under concurrent
        requests (see migration 006's header). The pair (sorted so A->B and B->A agree)
        is unique-constrained at the DB level; a losing concurrent insert here raises
        IntegrityError on flush, which is caught, the SAVEPOINT it ran in is rolled back
        (not the whole session/transaction), and the row the winner committed is re-fetched.
        """
        existing = await self.get_direct_by_pair(session, user_a_id, user_b_id)
        if existing is not None:
            return existing

        min_id, max_id = sorted((user_a_id, user_b_id))
        try:
            async with session.begin_nested():
                conversation = Conversation(
                    type=ConversationType.DIRECT,
                    created_by=user_a_id,
                    direct_user_min_id=min_id,
                    direct_user_max_id=max_id,
                )
                session.add(conversation)
                await session.flush()
                session.add(ConversationMember(conversation_id=conversation.id, user_id=min_id))
                session.add(ConversationMember(conversation_id=conversation.id, user_id=max_id))
                await session.flush()
        except IntegrityError:
            existing = await self.get_direct_by_pair(session, user_a_id, user_b_id)
            if existing is None:
                raise
            return existing

        return conversation

    async def is_member(self, session: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await session.execute(
            select(ConversationMember.id).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none() is not None

    async def list_members(self, session: AsyncSession, conversation_id: uuid.UUID) -> list[ConversationMember]:
        result = await session.execute(
            select(ConversationMember).where(ConversationMember.conversation_id == conversation_id)
        )
        return list(result.scalars().all())

    async def list_direct_for_user(self, session: AsyncSession, user_id: uuid.UUID) -> list[Conversation]:
        result = await session.execute(
            select(Conversation)
            .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
            .where(Conversation.type == ConversationType.DIRECT, ConversationMember.user_id == user_id)
            .order_by(Conversation.created_at.desc())
        )
        return list(result.scalars().all())
