import enum
import uuid
from datetime import datetime
from typing import Any, Dict

from pydantic import BaseModel, ConfigDict

from app.db.enums import NotificationType


class NotificationCategory(str, enum.Enum):
    """Maps notification types to UI tabs."""
    ALL = "all"
    UNREAD = "unread"
    FORUM = "forum"
    GROUP = "group"
    GOAL = "goal"
    MESSAGE = "message"


# Mapping from NotificationType -> NotificationCategory (tab)
NOTIFICATION_TYPE_TO_CATEGORY: Dict[NotificationType, NotificationCategory] = {
    # Forum tab
    NotificationType.POST_LIKE: NotificationCategory.FORUM,
    NotificationType.POST_COMMENT: NotificationCategory.FORUM,
    NotificationType.COMMENT_REPLY: NotificationCategory.FORUM,
    # Group tab
    NotificationType.GROUP_INVITE: NotificationCategory.GROUP,
    NotificationType.GROUP_ROLE_CHANGED: NotificationCategory.GROUP,
    NotificationType.ROOM_KICKED: NotificationCategory.GROUP,
    NotificationType.MENTION: NotificationCategory.GROUP,
    NotificationType.STUDY_ROOM_INVITATION: NotificationCategory.GROUP,
    NotificationType.PRIVATE_CHANNEL_INVITATION: NotificationCategory.GROUP,
    NotificationType.GROUP_NEW_RESOURCE: NotificationCategory.GROUP,
    NotificationType.STUDY_ROOM_FIRST_JOINER: NotificationCategory.GROUP,
    NotificationType.STUDY_ROOM_ACTIVE: NotificationCategory.GROUP,
    # Goal tab
    NotificationType.TASK_DAILY_REMINDER: NotificationCategory.GOAL,
    NotificationType.TASK_DUE_SOON: NotificationCategory.GOAL,
    NotificationType.TASK_OVERDUE: NotificationCategory.GOAL,
    # Message tab
    NotificationType.NEW_DIRECT_MESSAGE: NotificationCategory.MESSAGE,
    NotificationType.MESSAGE_GROUP: NotificationCategory.MESSAGE,
}


class NotificationCreate(BaseModel):
    """Server-side-only DTO -- there is no public endpoint that accepts this anymore
    (see notification_router.py). Only trusted in-process callers (e.g. InvitationService)
    construct this, always with server-resolved ids, never client input."""

    user_id: uuid.UUID
    type: NotificationType
    actor_id: uuid.UUID | None = None
    post_id: uuid.UUID | None = None
    comment_id: uuid.UUID | None = None
    group_id: uuid.UUID | None = None
    invitation_id: uuid.UUID | None = None
    data: Dict[str, Any] | None = None


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    type: NotificationType
    category: NotificationCategory
    actor_id: uuid.UUID | None
    post_id: uuid.UUID | None
    comment_id: uuid.UUID | None
    group_id: uuid.UUID | None
    invitation_id: uuid.UUID | None
    data: Dict[str, Any] | None
    is_read: bool
    created_at: datetime


class UnreadCountsResponse(BaseModel):
    """Badge counts for the notification bell icon and each tab."""
    total: int
    forum: int
    group: int
    goal: int
    message: int


class NotificationSettingsResponse(BaseModel):
    enable_forum: bool = True
    enable_group: bool = True
    enable_goal: bool = True
    enable_message: bool = True
    enable_sound: bool = True


class NotificationSettingsUpdate(BaseModel):
    enable_forum: bool | None = None
    enable_group: bool | None = None
    enable_goal: bool | None = None
    enable_message: bool | None = None
    enable_sound: bool | None = None
