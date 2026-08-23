import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import BanType, ForumModerationActionType, ReportReason, ReportStatus, pg_enum

if TYPE_CHECKING:
    from app.profiles.entities.profile_entity import Profile


class UserBan(Base):
    """One row per (user, ban_type) grant. `revoked_at`/`revoked_by` record an early unban;
    `expires_at is None` means permanent. Active = `revoked_at IS NULL AND (expires_at IS NULL
    OR expires_at > now())`, evaluated in application code (ModerationService) rather than a
    partial index, since a now()-based predicate isn't IMMUTABLE. Creating a new ban of a type
    that already has an active one auto-revokes the previous one instead of allowing duplicates."""

    __tablename__ = "user_bans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    ban_type: Mapped[BanType] = mapped_column(pg_enum(BanType, "ban_type"))
    reason: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"))

    user: Mapped["Profile"] = relationship(foreign_keys=[user_id])


class ForumModerationAction(Base):
    """Unified audit log for every moderator/admin action: post/comment deletion, bans/unbans,
    and moderator role grants/revokes. `target_id` is the post/comment id when applicable --
    not FK'd, since a hard-deleted comment row won't exist anymore for the log to reference."""

    __tablename__ = "forum_moderation_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    moderator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"))
    action: Mapped[ForumModerationActionType] = mapped_column(
        pg_enum(ForumModerationActionType, "forum_moderation_action_type")
    )
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT")
    )
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    moderator: Mapped["Profile"] = relationship(foreign_keys=[moderator_id])
    target_user: Mapped["Profile | None"] = relationship(foreign_keys=[target_user_id])


class UserReport(Base):
    """One row per report a user files against another user. A moderator reviewing the
    Reports tab typically resolves one by opening the existing Ban flow against
    `reported_user_id` (see BanUserModal/ReportsTable on the frontend), then marks it
    resolved -- or dismisses it outright with no ban."""

    __tablename__ = "user_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    reported_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    reason: Mapped[ReportReason] = mapped_column(pg_enum(ReportReason, "report_reason"))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ReportStatus] = mapped_column(pg_enum(ReportStatus, "report_status"), server_default=text("'pending'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"))
    resolution_note: Mapped[str | None] = mapped_column(Text)

    reporter: Mapped["Profile"] = relationship(foreign_keys=[reporter_id])
    reported_user: Mapped["Profile"] = relationship(foreign_keys=[reported_user_id])
