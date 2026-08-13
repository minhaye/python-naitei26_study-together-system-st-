import base64
import binascii
import uuid
from datetime import datetime

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.messages.entities.message_entity import Message
from app.messages.dto.message_dto import MessageCreate, MessageUpdate


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
        self, session: AsyncSession, channel_id: uuid.UUID, sender_id: uuid.UUID, data: MessageCreate
    ) -> Message:
        message = Message(
            channel_id=channel_id,
            sender_id=sender_id,
            content=data.content,
            attachment_path=data.attachment_path,
        )
        session.add(message)
        await session.flush()
        return message

    async def get_by_id(self, session: AsyncSession, message_id: uuid.UUID) -> Message | None:
        return await session.get(Message, message_id)

    async def list_by_channel(
        self, session: AsyncSession, channel_id: uuid.UUID, limit: int = 50, before: str | None = None
    ) -> tuple[list[Message], str | None]:
        """Newest-first keyset pagination on (created_at, id) to avoid OFFSET and handle timestamp ties."""
        query = select(Message).where(Message.channel_id == channel_id)
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
