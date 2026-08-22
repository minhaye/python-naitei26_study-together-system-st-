import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Fixed quick-react set -- same as ALLOWED_MESSAGE_REACTIONS (app/messages/dto/message_dto.py)
# so Forum reactions feel identical to chat message reactions. Also mirrored as a CHECK
# constraint on post_reactions.emoji/comment_reactions.emoji (see
# docs/db/migrations/028_add_forum_reactions.sql) and as QUICK_REACTIONS in
# frontend/src/pages/forum/components/ReactionPicker.tsx. Keep all three in sync.
ALLOWED_FORUM_REACTIONS = ("👍", "❤️", "😆", "😮", "😢", "😡")


class ForumCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = None


class ForumCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None


class ForumCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime


class ForumPostCreate(BaseModel):
    author_id: uuid.UUID
    category_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    image_path: str | None = None


class ForumPostUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1)
    image_path: str | None = None


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    post_count: int
    created_at: datetime


class ReactionSet(BaseModel):
    emoji: str

    @model_validator(mode="after")
    def validate_emoji(self) -> "ReactionSet":
        if self.emoji not in ALLOWED_FORUM_REACTIONS:
            raise ValueError(f"emoji must be one of {ALLOWED_FORUM_REACTIONS}")
        return self


class ReactionSummary(BaseModel):
    """Grouped-by-emoji shape the wire actually needs -- never raw per-user reaction rows.
    `reacted_by_me` is relative to whichever user the request's `user_id` query param names
    (Forum has no auth dependency on any endpoint today, unlike the equivalent chat
    MessageReactionSummary). Mirrors MessageReactionSummary (app/messages/dto/message_dto.py)."""

    model_config = ConfigDict(from_attributes=True)

    emoji: str
    count: int
    reacted_by_me: bool


class ForumPostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_id: uuid.UUID
    category_id: uuid.UUID
    title: str
    content: str
    image_path: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    # Optional fields for UI aggregates
    category_name: str | None = None
    author_name: str | None = None
    author_avatar_url: str | None = None
    reactions: list[ReactionSummary] = Field(default_factory=list)
    comments_count: int = 0
    tags: list[str] = Field(default_factory=list)


class CommentCreate(BaseModel):
    post_id: uuid.UUID
    author_id: uuid.UUID
    parent_comment_id: uuid.UUID | None = None
    content: str = Field(min_length=1)


class CommentUpdate(BaseModel):
    content: str = Field(min_length=1)


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    post_id: uuid.UUID
    author_id: uuid.UUID
    parent_comment_id: uuid.UUID | None
    content: str
    created_at: datetime
    updated_at: datetime

    author_name: str | None = None
    author_avatar_url: str | None = None
    reactions: list[ReactionSummary] = Field(default_factory=list)
