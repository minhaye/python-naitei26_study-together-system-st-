import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import ConversationType, pg_enum

if TYPE_CHECKING:
    from app.channels.entities.channel_entity import Channel
    from app.messages.entities.message_entity import Message
    from app.profiles.entities.profile_entity import Profile
    from app.study_rooms.entities.study_room_entity import StudyRoom


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    type: Mapped[ConversationType] = mapped_column(pg_enum(ConversationType, "conversation_type"))
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE")
    )
    room_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("study_rooms.id", ondelete="CASCADE")
    )
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"))
    # Only set (and only meaningful) for type=direct: the conversation's two participant
    # ids, sorted so that opening a DM as A->B or B->A always resolves to the same pair.
    # Enforced/validated at the DB level by migration 006 (CHECK + partial unique index) --
    # see ConversationsService.get_or_create_direct for how the sort/race-safety works.
    direct_user_min_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE")
    )
    direct_user_max_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    channel: Mapped["Channel | None"] = relationship(back_populates="conversation")
    room: Mapped["StudyRoom | None"] = relationship(back_populates="conversation")
    creator: Mapped["Profile"] = relationship(foreign_keys=[created_by])
    members: Mapped[list["ConversationMember"]] = relationship(back_populates="conversation")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation")


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    conversation: Mapped["Conversation"] = relationship(back_populates="members")
    user: Mapped["Profile"] = relationship()
