import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.db.enums import NotificationType


class NotificationCreate(BaseModel):
    user_id: uuid.UUID
    type: NotificationType
    actor_id: uuid.UUID | None = None
    post_id: uuid.UUID | None = None
    comment_id: uuid.UUID | None = None
    group_id: uuid.UUID | None = None


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    type: NotificationType
    actor_id: uuid.UUID | None
    post_id: uuid.UUID | None
    comment_id: uuid.UUID | None
    group_id: uuid.UUID | None
    is_read: bool
    created_at: datetime
