import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.groups.entities.group_entity import Group, GroupMember
    from app.channels.entities.channel_entity import Channel, ChannelMember
    from app.messages.entities.message_entity import Message
    from app.forum.entities.forum_entity import Comment, CommentReaction, ForumPost, PostReaction
    from app.notifications.entities.notification_entity import Notification
    from app.resources.entities.resource_entity import Resource, ResourceFolder
    from app.study_rooms.entities.study_room_entity import RoomModerationAction, StudyRoom, StudyRoomMember


class Profile(Base):
    """Maps to public.profiles."""

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    username: Mapped[str | None] = mapped_column(Text, unique=True)
    display_name: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    organization: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    owned_groups: Mapped[list["Group"]] = relationship(back_populates="owner", foreign_keys="Group.owner_id")
    group_memberships: Mapped[list["GroupMember"]] = relationship(back_populates="user")
    created_channels: Mapped[list["Channel"]] = relationship(back_populates="creator", foreign_keys="Channel.created_by")
    channel_memberships: Mapped[list["ChannelMember"]] = relationship(back_populates="user")
    sent_messages: Mapped[list["Message"]] = relationship(back_populates="sender")
    forum_posts: Mapped[list["ForumPost"]] = relationship(back_populates="author")
    comments: Mapped[list["Comment"]] = relationship(back_populates="author")
    comment_reactions: Mapped[list["CommentReaction"]] = relationship(back_populates="user")
    post_reactions: Mapped[list["PostReaction"]] = relationship(back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user", foreign_keys="Notification.user_id"
    )
    triggered_notifications: Mapped[list["Notification"]] = relationship(
        back_populates="actor", foreign_keys="Notification.actor_id"
    )
    created_resource_folders: Mapped[list["ResourceFolder"]] = relationship(back_populates="creator")
    uploaded_resources: Mapped[list["Resource"]] = relationship(back_populates="uploader")
    hosted_study_rooms: Mapped[list["StudyRoom"]] = relationship(back_populates="host", foreign_keys="StudyRoom.host_id")
    study_room_memberships: Mapped[list["StudyRoomMember"]] = relationship(back_populates="user")
    moderation_actions_performed: Mapped[list["RoomModerationAction"]] = relationship(
        back_populates="moderator", foreign_keys="RoomModerationAction.moderator_id"
    )
    moderation_actions_received: Mapped[list["RoomModerationAction"]] = relationship(
        back_populates="target_user", foreign_keys="RoomModerationAction.target_user_id"
    )
