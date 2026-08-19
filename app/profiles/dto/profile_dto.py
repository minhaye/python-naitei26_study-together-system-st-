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


class AvatarUploadUrlRequest(BaseModel):
    content_type: str
    file_size: int = Field(gt=0, le=5 * 1024 * 1024)

    def model_post_init(self, __context: object) -> None:
        if self.content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
            raise ValueError("Avatar must be a JPEG, PNG, WebP, or GIF image")


class AvatarUploadUrlResponse(BaseModel):
    path: str
    upload_url: str


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str | None
    display_name: str | None
    avatar_url: str | None
    bio: str | None
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
