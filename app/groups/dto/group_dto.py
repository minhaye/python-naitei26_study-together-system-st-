import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import GroupMemberRole, MemberStatus


class GroupCreate(BaseModel):
    """No `owner_id` field: the group owner is always the authenticated caller
    (see GroupsService.create / group_router.create_group), never client-supplied."""

    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    avatar_url: str | None = None
    is_public: bool = True


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    avatar_url: str | None = None
    is_public: bool | None = None


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    avatar_url: str | None
    owner_id: uuid.UUID
    invite_code: str | None
    is_public: bool
    created_at: datetime
    updated_at: datetime


class GroupMemberCreate(BaseModel):
    """Target user for a manager (owner/moderator) adding someone else; omit to self-join
    as the authenticated caller. `role`/`status` are intentionally absent -- a new membership
    always starts as an active plain member; promote via the owner-only
    PUT /groups/{group_id}/members/{user_id}/role endpoint afterward."""

    user_id: uuid.UUID | None = None


class GroupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID
    user_id: uuid.UUID
    role: GroupMemberRole
    status: MemberStatus
    joined_at: datetime
