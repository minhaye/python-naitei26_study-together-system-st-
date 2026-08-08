import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ChannelType


class ChannelCreate(BaseModel):
    group_id: uuid.UUID
    name: str = Field(min_length=1, max_length=80)
    description: str | None = None
    type: ChannelType = ChannelType.TEXT
    is_private: bool = False
    created_by: uuid.UUID


class ChannelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None
    is_private: bool | None = None


class ChannelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID
    name: str
    description: str | None
    type: ChannelType
    is_private: bool
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ChannelMemberCreate(BaseModel):
    channel_id: uuid.UUID
    user_id: uuid.UUID


class ChannelMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel_id: uuid.UUID
    user_id: uuid.UUID
    joined_at: datetime


class MessageCreate(BaseModel):
    channel_id: uuid.UUID
    sender_id: uuid.UUID
    content: str | None = None
    attachment_path: str | None = None

    @model_validator(mode="after")
    def check_content_or_attachment(self) -> "MessageCreate":
        # Mirrors the messages_not_empty CHECK constraint in the database.
        if not (self.content and self.content.strip()) and not self.attachment_path:
            raise ValueError("message must have content or attachment_path")
        return self


class MessageUpdate(BaseModel):
    content: str | None = None
    attachment_path: str | None = None


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel_id: uuid.UUID
    sender_id: uuid.UUID
    content: str | None
    attachment_path: str | None
    created_at: datetime
    updated_at: datetime
