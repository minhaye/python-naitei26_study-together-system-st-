import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False
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
    likes_count: int = 0
    is_liked: bool = False


class PostLikeCreate(BaseModel):
    post_id: uuid.UUID
    user_id: uuid.UUID


class PostLikeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    post_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime


class CommentLikeCreate(BaseModel):
    comment_id: uuid.UUID
    user_id: uuid.UUID


class CommentLikeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    comment_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
