import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import ModerationAction, StudyRoomMemberRole, StudyRoomStatus


class StudyRoomCreate(BaseModel):
    """No `host_id` field: the room host is always the authenticated caller
    (see StudyRoomsService.create / study_room_router.create_room), never client-supplied."""

    group_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    max_participants: int = Field(default=50, ge=2, le=500)


class StudyRoomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    max_participants: int | None = Field(default=None, ge=2, le=500)


class StudyRoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID
    name: str
    description: str | None
    host_id: uuid.UUID
    status: StudyRoomStatus
    max_participants: int
    created_at: datetime
    started_at: datetime | None
    ended_at: datetime | None
    deleted_at: datetime | None
    deleted_by: uuid.UUID | None


class StudyRoomMemberCreate(BaseModel):
    room_id: uuid.UUID
    user_id: uuid.UUID
    role: StudyRoomMemberRole = StudyRoomMemberRole.PARTICIPANT


class StudyRoomMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    room_id: uuid.UUID
    user_id: uuid.UUID
    role: StudyRoomMemberRole
    joined_at: datetime
    left_at: datetime | None


class RoomModerationActionCreate(BaseModel):
    room_id: uuid.UUID
    moderator_id: uuid.UUID
    target_user_id: uuid.UUID
    action: ModerationAction
    reason: str | None = None


class RoomModerationActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    room_id: uuid.UUID
    moderator_id: uuid.UUID
    target_user_id: uuid.UUID
    action: ModerationAction
    reason: str | None
    created_at: datetime
