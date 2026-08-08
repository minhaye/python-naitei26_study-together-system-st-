import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ModerationAction, StudyRoomMemberRole, StudyRoomStatus, pg_enum

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.profile import Profile


class StudyRoom(Base):
    __tablename__ = "study_rooms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    host_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"))
    status: Mapped[StudyRoomStatus] = mapped_column(
        pg_enum(StudyRoomStatus, "study_room_status"), server_default=text("'waiting'::study_room_status")
    )
    max_participants: Mapped[int] = mapped_column(Integer, server_default=text("50"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    group: Mapped["Group"] = relationship(back_populates="study_rooms")
    host: Mapped["Profile"] = relationship(back_populates="hosted_study_rooms")
    members: Mapped[list["StudyRoomMember"]] = relationship(back_populates="room")
    moderation_actions: Mapped[list["RoomModerationAction"]] = relationship(back_populates="room")


class StudyRoomMember(Base):
    __tablename__ = "study_room_members"
    __table_args__ = (UniqueConstraint("room_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("study_rooms.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    role: Mapped[StudyRoomMemberRole] = mapped_column(
        pg_enum(StudyRoomMemberRole, "study_room_member_role"),
        server_default=text("'participant'::study_room_member_role"),
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    room: Mapped["StudyRoom"] = relationship(back_populates="members")
    user: Mapped["Profile"] = relationship(back_populates="study_room_memberships")


class RoomModerationAction(Base):
    __tablename__ = "room_moderation_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("study_rooms.id", ondelete="CASCADE"))
    moderator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT")
    )
    target_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT")
    )
    action: Mapped[ModerationAction] = mapped_column(pg_enum(ModerationAction, "moderation_action"))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    room: Mapped["StudyRoom"] = relationship(back_populates="moderation_actions")
    moderator: Mapped["Profile"] = relationship(
        back_populates="moderation_actions_performed", foreign_keys=[moderator_id]
    )
    target_user: Mapped["Profile"] = relationship(
        back_populates="moderation_actions_received", foreign_keys=[target_user_id]
    )
