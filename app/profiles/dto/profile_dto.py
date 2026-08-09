import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProfileCreate(BaseModel):
    id: uuid.UUID
    username: str | None = Field(default=None, min_length=3, max_length=30)
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None


class ProfileUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=30)
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str | None
    display_name: str | None
    avatar_url: str | None
    bio: str | None
    created_at: datetime
    updated_at: datetime
