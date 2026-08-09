import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import NotificationType, pg_enum

if TYPE_CHECKING:
    from app.forum.entities.forum_entity import Comment, ForumPost
    from app.groups.entities.group_entity import Group
    from app.profiles.entities.profile_entity import Profile


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE")
    )
    type: Mapped[NotificationType] = mapped_column(pg_enum(NotificationType, "notification_type"))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    post_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forum_posts.id", ondelete="CASCADE")
    )
    comment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE")
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE")
    )
    is_read: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    user: Mapped["Profile"] = relationship(back_populates="notifications", foreign_keys=[user_id])
    actor: Mapped["Profile | None"] = relationship(back_populates="triggered_notifications", foreign_keys=[actor_id])
    post: Mapped["ForumPost | None"] = relationship(back_populates="notifications")
    comment: Mapped["Comment | None"] = relationship(back_populates="notifications")
    group: Mapped["Group | None"] = relationship(back_populates="notifications")
