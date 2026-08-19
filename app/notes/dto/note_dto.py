import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.profiles.dto.profile_dto import UserSummary


class NoteCreate(BaseModel):
    """No `author_id`: the backend always derives the author from the authenticated caller
    (see note_router.create_note), same convention as ResourceCreate/uploader_id."""

    group_id: uuid.UUID
    title: str | None = Field(default=None, max_length=100)
    content: str = Field(min_length=1, max_length=2000)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=100)
    content: str | None = Field(default=None, min_length=1, max_length=2000)


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID
    author_id: uuid.UUID
    title: str | None
    content: str
    created_at: datetime
    updated_at: datetime
    # Canonical identity source for the author -- see ResourceResponse.uploader, never derive
    # a display label from author_id alone.
    author: UserSummary
