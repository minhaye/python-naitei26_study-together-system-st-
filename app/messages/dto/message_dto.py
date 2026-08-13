import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator


class MessageCreate(BaseModel):
    content: str | None = None
    attachment_path: str | None = None

    @model_validator(mode="after")
    def normalize_and_validate(self) -> "MessageCreate":
        if self.content is not None:
            self.content = self.content.strip() or None
        if not self.content and not self.attachment_path:
            raise ValueError("message must have content or attachment_path")
        return self


class MessageUpdate(BaseModel):
    """PATCH only ever edits text content. Changing the attachment requires the
    signed upload flow (see attachments router), not an arbitrary path swap here."""

    content: str

    @model_validator(mode="after")
    def normalize(self) -> "MessageUpdate":
        trimmed = self.content.strip()
        if not trimmed:
            raise ValueError("content must not be empty")
        self.content = trimmed
        return self


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel_id: uuid.UUID
    sender_id: uuid.UUID
    content: str | None
    attachment_path: str | None
    created_at: datetime
    updated_at: datetime


class MessageListResponse(BaseModel):
    items: list[MessageResponse]
    next_cursor: str | None
