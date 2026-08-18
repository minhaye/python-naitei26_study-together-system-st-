import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import InvitationMethod, InvitationStatus, pg_enum

if TYPE_CHECKING:
    from app.channels.entities.channel_entity import Channel
    from app.groups.entities.group_entity import Group
    from app.notifications.entities.notification_entity import Notification
    from app.profiles.entities.profile_entity import Profile
    from app.study_rooms.entities.study_room_entity import StudyRoom


class Invitation(Base):
    """Exactly one of group_id/room_id/channel_id is set (see the CHECK constraint) --
    the target's type is derived from which FK is populated rather than a separate
    target_type column, which would let application code and the FK go out of sync.

    `secret_hash` is the only persisted form of the plaintext token (EMAIL method) or code
    (CODE method); the plaintext is returned exactly once, at creation, and is never
    recoverable afterward (see InvitationsService.create)."""

    __tablename__ = "invitations"
    __table_args__ = (
        CheckConstraint(
            "(group_id is not null)::int + (room_id is not null)::int + (channel_id is not null)::int = 1",
            name="invitations_exactly_one_target",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"))
    room_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("study_rooms.id", ondelete="CASCADE")
    )
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE")
    )
    method: Mapped[InvitationMethod] = mapped_column(pg_enum(InvitationMethod, "invitation_method"))
    status: Mapped[InvitationStatus] = mapped_column(
        pg_enum(InvitationStatus, "invitation_status"), server_default=text("'pending'::invitation_status")
    )
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"))
    recipient_email: Mapped[str | None] = mapped_column(Text)
    secret_hash: Mapped[str] = mapped_column(Text, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    group: Mapped["Group | None"] = relationship()
    room: Mapped["StudyRoom | None"] = relationship()
    channel: Mapped["Channel | None"] = relationship()
    creator: Mapped["Profile"] = relationship(foreign_keys=[created_by])
    notifications: Mapped[list["Notification"]] = relationship(back_populates="invitation")
