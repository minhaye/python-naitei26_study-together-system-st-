import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import ChannelType


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
