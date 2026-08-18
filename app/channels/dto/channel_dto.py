import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import ChannelType


class ChannelCreate(BaseModel):
    """No `created_by` field: attribution always comes from the authenticated caller
    (see ChannelsService.create / channel_router.create_channel), never client-supplied."""

    group_id: uuid.UUID
    name: str = Field(min_length=1, max_length=80)
    description: str | None = None
    type: ChannelType = ChannelType.TEXT
    is_private: bool = False


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
    conversation_id: uuid.UUID | None
    deleted_at: datetime | None
    deleted_by: uuid.UUID | None


class ChannelMemberCreate(BaseModel):
    """Target user for a group manager (owner/moderator) adding someone to a (typically
    private) channel. There is no self-join case for channels in this task's scope."""

    user_id: uuid.UUID


class ChannelMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel_id: uuid.UUID
    user_id: uuid.UUID
    joined_at: datetime
