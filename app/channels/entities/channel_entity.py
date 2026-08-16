import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import ChannelType, pg_enum

if TYPE_CHECKING:
    from app.groups.entities.group_entity import Group
    from app.profiles.entities.profile_entity import Profile
    from app.conversations.entities.conversation_entity import Conversation


class Channel(Base):
    __tablename__ = "channels"
    __table_args__ = (UniqueConstraint("group_id", "name"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    type: Mapped[ChannelType] = mapped_column(
        pg_enum(ChannelType, "channel_type"), server_default=text("'text'::channel_type")
    )
    is_private: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    group: Mapped["Group"] = relationship(back_populates="channels")
    creator: Mapped["Profile"] = relationship(back_populates="created_channels", foreign_keys=[created_by])
    members: Mapped[list["ChannelMember"]] = relationship(back_populates="channel")
    conversation: Mapped["Conversation | None"] = relationship(back_populates="channel", uselist=False)

    @property
    def conversation_id(self) -> uuid.UUID | None:
        """Convenience accessor for API responses. Requires `conversation` to already be
        loaded (see ChannelsService.get_by_id/list_by_group, which eager-load it)."""
        return self.conversation.id if self.conversation else None


class ChannelMember(Base):
    __tablename__ = "channel_members"
    __table_args__ = (UniqueConstraint("channel_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    channel: Mapped["Channel"] = relationship(back_populates="members")
    user: Mapped["Profile"] = relationship(back_populates="channel_memberships")
