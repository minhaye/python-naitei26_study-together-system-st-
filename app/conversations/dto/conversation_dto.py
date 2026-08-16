import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.db.enums import ConversationType


class DirectConversationCreate(BaseModel):
    user_id: uuid.UUID


class ConversationParticipant(BaseModel):
    """Deliberately a subset of ProfileResponse (no `bio`) -- the other DM participant's
    identity is needed to render a conversation list/header, not their full profile."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str | None
    display_name: str | None
    avatar_url: str | None


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: ConversationType
    created_at: datetime
    other_participant: ConversationParticipant | None = None
