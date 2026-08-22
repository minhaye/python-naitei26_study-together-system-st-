import base64
import binascii
import uuid
from datetime import datetime

from sqlalchemy import func, select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.messages.entities.message_entity import Message, MessageReaction
from app.messages.dto.message_dto import MessageCreate, MessageReactionSummary, MessageUpdate
from app.profiles.services.profile_service import ProfilesService
from app.attachments.services.attachment_service import AttachmentsService

profiles_service = ProfilesService()
attachments_service = AttachmentsService()


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
        # A brand-new message can't have reactions yet -- no query needed.
        message.reactions = []
        
        message.attachment_url = None
        if message.attachment_path:
            try:
                url_dict = await attachments_service.create_signed_download_url(message.attachment_path, 3600)
                message.attachment_url = url_dict.get("url")
            except Exception:
                pass
                
        return message

    async def get_by_id(
        self, session: AsyncSession, message_id: uuid.UUID, viewer_id: uuid.UUID | None = None
    ) -> Message | None:
        message = await session.get(Message, message_id, options=[selectinload(Message.sender)])
        if message is None:
            return None
        if viewer_id is not None:
            await self._attach_reactions(session, [message], viewer_id)
        else:
            # Callers that don't need reactions (e.g. delete_message, which only reads
            # sender_id/conversation_id for authorization) skip the extra query.
            message.reactions = []
            
        message.attachment_url = None
        if message.attachment_path:
            try:
                url_dict = await attachments_service.create_signed_download_url(message.attachment_path, 3600)
                message.attachment_url = url_dict.get("url")
            except Exception:
                pass
        return message

    async def list_by_conversation(
        self, session: AsyncSession, conversation_id: uuid.UUID, viewer_id: uuid.UUID, limit: int = 50, before: str | None = None
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
        await self._attach_reactions(session, messages, viewer_id)
        
        attachment_paths = [m.attachment_path for m in messages if m.attachment_path]
        if attachment_paths:
            try:
                urls = await attachments_service.create_signed_download_urls(attachment_paths, 3600)
                for m in messages:
                    if m.attachment_path:
                        m.attachment_url = urls.get(m.attachment_path)
            except Exception:
                for m in messages:
                    m.attachment_url = None
        else:
            for m in messages:
                m.attachment_url = None
                
        return messages, next_cursor

    async def update(self, session: AsyncSession, message: Message, data: MessageUpdate) -> Message:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(message, field, value)
        await session.flush()
        return message

    async def delete(self, session: AsyncSession, message: Message) -> None:
        await session.delete(message)
        await session.flush()

    async def _attach_reactions(self, session: AsyncSession, messages: list[Message], viewer_id: uuid.UUID) -> None:
        """Batched grouped-reaction lookup for a page of messages (avoids N+1). Sets
        `.reactions` as a transient attribute on each Message -- same pattern ForumService
        uses for ForumPost.likes_count/is_liked (see forum_service.py's list queries)."""
        if not messages:
            return
        message_ids = [m.id for m in messages]
        stmt = (
            select(
                MessageReaction.message_id,
                MessageReaction.emoji,
                func.count().label("count"),
                func.bool_or(MessageReaction.user_id == viewer_id).label("reacted_by_me"),
            )
            .where(MessageReaction.message_id.in_(message_ids))
            .group_by(MessageReaction.message_id, MessageReaction.emoji)
        )
        result = await session.execute(stmt)
        by_message: dict[uuid.UUID, list[MessageReactionSummary]] = {}
        for message_id, emoji, count, reacted_by_me in result.all():
            by_message.setdefault(message_id, []).append(
                MessageReactionSummary(emoji=emoji, count=count, reacted_by_me=bool(reacted_by_me))
            )
        for message in messages:
            message.reactions = by_message.get(message.id, [])

    async def get_reactions(
        self, session: AsyncSession, message_id: uuid.UUID, viewer_id: uuid.UUID
    ) -> list[MessageReactionSummary]:
        stmt = (
            select(
                MessageReaction.emoji,
                func.count().label("count"),
                func.bool_or(MessageReaction.user_id == viewer_id).label("reacted_by_me"),
            )
            .where(MessageReaction.message_id == message_id)
            .group_by(MessageReaction.emoji)
        )
        result = await session.execute(stmt)
        return [
            MessageReactionSummary(emoji=emoji, count=count, reacted_by_me=bool(reacted_by_me))
            for emoji, count, reacted_by_me in result.all()
        ]

    async def set_reaction(self, session: AsyncSession, message: Message, user_id: uuid.UUID, emoji: str) -> None:
        """Upsert via ON CONFLICT DO UPDATE (target: the message_id/user_id unique
        constraint) rather than check-then-insert -- race-safe against concurrent requests
        from the same user, and lets picking a new emoji simply replace the old one."""
        stmt = (
            pg_insert(MessageReaction)
            .values(message_id=message.id, conversation_id=message.conversation_id, user_id=user_id, emoji=emoji)
            .on_conflict_do_update(index_elements=[MessageReaction.message_id, MessageReaction.user_id], set_={"emoji": emoji})
        )
        await session.execute(stmt)
        await session.flush()

    async def remove_reaction(self, session: AsyncSession, message_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Idempotent: a no-op if the caller has no reaction on this message."""
        result = await session.execute(
            select(MessageReaction).where(MessageReaction.message_id == message_id, MessageReaction.user_id == user_id)
        )
        reaction = result.scalar_one_or_none()
        if reaction is not None:
            await session.delete(reaction)
            await session.flush()
