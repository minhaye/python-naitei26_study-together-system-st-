import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator


class MessageCreate(BaseModel):
    channel_id: uuid.UUID
    sender_id: uuid.UUID
    content: str | None = None
    attachment_path: str | None = None

    @model_validator(mode="after")
    def check_content_or_attachment(self) -> "MessageCreate":
        if not (self.content and self.content.strip()) and not self.attachment_path:
            raise ValueError("message must have content or attachment_path")
        return self


class MessageUpdate(BaseModel):
    content: str | None = None
    attachment_path: str | None = None


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel_id: uuid.UUID
    sender_id: uuid.UUID
    content: str | None
    attachment_path: str | None
    created_at: datetime
    updated_at: datetime
