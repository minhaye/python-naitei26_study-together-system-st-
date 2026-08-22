import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from app.profiles.dto.profile_dto import UserSummary

# Fixed Messenger-style quick-react set -- also mirrored as a CHECK constraint on
# message_reactions.emoji (see docs/db/migrations/025_add_message_reactions.sql) and as
# QUICK_REACTIONS in frontend/src/components/chat/MessageReactions.tsx.
ALLOWED_MESSAGE_REACTIONS = ("👍", "❤️", "😆", "😮", "😢", "😡")


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


class MessageReactionSet(BaseModel):
    emoji: str

    @model_validator(mode="after")
    def validate_emoji(self) -> "MessageReactionSet":
        if self.emoji not in ALLOWED_MESSAGE_REACTIONS:
            raise ValueError(f"emoji must be one of {ALLOWED_MESSAGE_REACTIONS}")
        return self


class MessageReactionSummary(BaseModel):
    """Grouped-by-emoji shape a message actually needs on the wire -- never the raw
    per-user MessageReaction rows. `reacted_by_me` is relative to whichever user the
    request/session belongs to (see MessagesService.get_reactions/_attach_reactions)."""

    model_config = ConfigDict(from_attributes=True)

    emoji: str
    count: int
    reacted_by_me: bool


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    content: str | None
    attachment_path: str | None
    created_at: datetime
    updated_at: datetime
    # See GroupMemberResponse.user -- same canonical-identity convention. This is what fixes
    # chat sender display (previously a "Người dùng #XXXX" placeholder on the frontend, since
    # sender_id alone gave it nothing else to render).
    sender: UserSummary
    reactions: list[MessageReactionSummary]


class MessageListResponse(BaseModel):
    items: list[MessageResponse]
    next_cursor: str | None
