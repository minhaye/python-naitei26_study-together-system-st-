import base64
import binascii
import uuid
from datetime import datetime

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.messages.entities.message_entity import Message
from app.messages.dto.message_dto import MessageCreate, MessageUpdate
from app.profiles.services.profile_service import ProfilesService

profiles_service = ProfilesService()


def _encode_cursor(created_at: datetime, message_id: uuid.UUID) -> str:
    raw = f"{created_at.isoformat()}|{message_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        created_at_str, id_str = raw.split("|")
        return datetime.fromisoformat(created_at_str), uuid.UUID(id_str)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("invalid cursor") from exc


class MessagesService:
    async def create(
        self, session: AsyncSession, conversation_id: uuid.UUID, sender_id: uuid.UUID, data: MessageCreate
    ) -> Message:
        """Only sets conversation_id -- channel_id is resolved server-side by the
        `messages_sync_conversation_id` BEFORE INSERT trigger (migration 004 §7), which is
        the compatibility layer for the still-NOT-NULL legacy column. Do not set channel_id
        here."""
        message = Message(
            conversation_id=conversation_id,
            sender_id=sender_id,
            content=data.content,
            attachment_path=data.attachment_path,
        )
        session.add(message)
        await session.flush()
        # See GroupsService.add_member -- same reason for the in-memory `.sender` assignment
        # (MessageResponse.sender needs it, a freshly-flushed row has nothing loaded yet).
        message.sender = await profiles_service.get_by_id(session, sender_id)
        return message

    async def get_by_id(self, session: AsyncSession, message_id: uuid.UUID) -> Message | None:
        return await session.get(Message, message_id, options=[selectinload(Message.sender)])

    async def list_by_conversation(
        self, session: AsyncSession, conversation_id: uuid.UUID, limit: int = 50, before: str | None = None
    ) -> tuple[list[Message], str | None]:
        """Newest-first keyset pagination on (created_at, id) to avoid OFFSET and handle timestamp ties."""
        query = select(Message).options(selectinload(Message.sender)).where(Message.conversation_id == conversation_id)
        if before:
            cursor_created_at, cursor_id = _decode_cursor(before)
            query = query.where(tuple_(Message.created_at, Message.id) < tuple_(cursor_created_at, cursor_id))
        query = query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit + 1)

        result = await session.execute(query)
        messages = list(result.scalars().all())

        next_cursor = None
        if len(messages) > limit:
            messages = messages[:limit]
            last = messages[-1]
            next_cursor = _encode_cursor(last.created_at, last.id)
        return messages, next_cursor

    async def update(self, session: AsyncSession, message: Message, data: MessageUpdate) -> Message:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(message, field, value)
        await session.flush()
        return message

    async def delete(self, session: AsyncSession, message: Message) -> None:
        await session.delete(message)
        await session.flush()
