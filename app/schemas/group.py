import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import GroupMemberRole, MemberStatus


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    avatar_url: str | None = None
    owner_id: uuid.UUID
    is_public: bool = True
    # invite_code is server-generated (DB default encode(gen_random_bytes(8), 'hex')), not client-settable.


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
    group_id: uuid.UUID
    user_id: uuid.UUID
    role: GroupMemberRole = GroupMemberRole.MEMBER
    status: MemberStatus = MemberStatus.ACTIVE


class GroupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID
    user_id: uuid.UUID
    role: GroupMemberRole
    status: MemberStatus
    joined_at: datetime
