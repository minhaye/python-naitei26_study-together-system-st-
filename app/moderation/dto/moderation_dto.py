import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.db.enums import BanType, ForumModerationActionType, ProfileRole, ReportReason, ReportStatus

DurationType = Literal["day", "week", "month", "year", "permanent", "custom"]


class BanCreate(BaseModel):
    user_id: uuid.UUID
    ban_types: list[BanType] = Field(min_length=1)
    duration_type: DurationType
    duration_value: int | None = Field(default=None, gt=0)
    custom_expires_at: datetime | None = None
    reason: str | None = None

    @model_validator(mode="after")
    def validate_duration(self) -> "BanCreate":
        if self.duration_type == "custom" and self.custom_expires_at is None:
            raise ValueError("custom_expires_at is required when duration_type is 'custom'")
        if self.duration_type in ("day", "week", "month", "year") and not self.duration_value:
            raise ValueError("duration_value is required for day/week/month/year durations")
        return self


class BanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    ban_type: BanType
    reason: str | None
    created_by: uuid.UUID
    created_at: datetime
    expires_at: datetime | None
    revoked_at: datetime | None
    revoked_by: uuid.UUID | None

    user_name: str | None = None
    created_by_name: str | None = None


class ModerationActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    moderator_id: uuid.UUID
    action: ForumModerationActionType
    target_user_id: uuid.UUID | None
    target_id: uuid.UUID | None
    reason: str | None
    created_at: datetime

    moderator_name: str | None = None
    target_user_name: str | None = None


class RoleUpdate(BaseModel):
    role: ProfileRole


class ReportCreate(BaseModel):
    reported_user_id: uuid.UUID
    reason: ReportReason
    description: str | None = None


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reporter_id: uuid.UUID
    reported_user_id: uuid.UUID
    reason: ReportReason
    description: str | None
    status: ReportStatus
    created_at: datetime
    resolved_at: datetime | None
    resolved_by: uuid.UUID | None
    resolution_note: str | None

    reporter_name: str | None = None
    reported_user_name: str | None = None


class ReportStatusUpdate(BaseModel):
    status: ReportStatus
    resolution_note: str | None = None
