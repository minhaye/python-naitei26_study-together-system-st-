import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import GroupMemberRole, MemberStatus, pg_enum

if TYPE_CHECKING:
    from app.channels.entities.channel_entity import Channel
    from app.notifications.entities.notification_entity import Notification
    from app.profiles.entities.profile_entity import Profile
    from app.resources.entities.resource_entity import Resource, ResourceFolder
    from app.study_rooms.entities.study_room_entity import StudyRoom


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"))
    invite_code: Mapped[str | None] = mapped_column(
        Text, unique=True, server_default=text("encode(gen_random_bytes(8), 'hex'::text)")
    )
    is_public: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    owner: Mapped["Profile"] = relationship(back_populates="owned_groups", foreign_keys=[owner_id])
    members: Mapped[list["GroupMember"]] = relationship(back_populates="group")
    channels: Mapped[list["Channel"]] = relationship(back_populates="group")
    resource_folders: Mapped[list["ResourceFolder"]] = relationship(back_populates="group")
    resources: Mapped[list["Resource"]] = relationship(back_populates="group")
    study_rooms: Mapped[list["StudyRoom"]] = relationship(back_populates="group")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="group")


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    role: Mapped[GroupMemberRole] = mapped_column(
        pg_enum(GroupMemberRole, "group_member_role"), server_default=text("'member'::group_member_role")
    )
    status: Mapped[MemberStatus] = mapped_column(
        pg_enum(MemberStatus, "member_status"), server_default=text("'active'::member_status")
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    group: Mapped["Group"] = relationship(back_populates="members")
    user: Mapped["Profile"] = relationship(back_populates="group_memberships")
