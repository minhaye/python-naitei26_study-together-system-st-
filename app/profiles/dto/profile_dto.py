import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProfileCreate(BaseModel):
    id: uuid.UUID
    username: str | None = Field(default=None, min_length=3, max_length=30)
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    organization: str | None = Field(default=None, max_length=120)


class ProfileUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=30)
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    organization: str | None = Field(default=None, max_length=120)


class AvatarConfirm(BaseModel):
    path: str


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str | None
    display_name: str | None
    avatar_url: str | None
    bio: str | None
    organization: str | None
    created_at: datetime
    updated_at: datetime


class UserSummary(BaseModel):
    """Minimal identity fields for embedding in membership/message responses (e.g.
    GroupMemberResponse.user, MessageResponse.sender) -- the canonical way another user's
    identity reaches the frontend, avoiding one-profile-per-member/sender API calls. Reuse
    this instead of embedding a full ProfileResponse (bio/timestamps aren't needed here) or
    inventing another shape per feature."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str | None
    display_name: str | None
    avatar_url: str | None
