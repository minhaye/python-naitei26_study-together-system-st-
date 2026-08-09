import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.forum.entities.forum_entity import Comment, CommentLike, ForumCategory, ForumPost, PostLike
from app.forum.dto.forum_dto import (
    CommentCreate,
    CommentUpdate,
    ForumCategoryCreate,
    ForumCategoryUpdate,
    ForumPostCreate,
    ForumPostUpdate,
)


class ForumService:
    # --- Categories ---

    async def create_category(self, session: AsyncSession, data: ForumCategoryCreate) -> ForumCategory:
        category = ForumCategory(**data.model_dump())
        session.add(category)
        await session.flush()
        return category

    async def get_category_by_id(self, session: AsyncSession, category_id: uuid.UUID) -> ForumCategory | None:
        return await session.get(ForumCategory, category_id)

    async def list_categories(self, session: AsyncSession) -> list[ForumCategory]:
        result = await session.execute(select(ForumCategory))
        return list(result.scalars().all())

    async def update_category(
        self, session: AsyncSession, category: ForumCategory, data: ForumCategoryUpdate
    ) -> ForumCategory:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(category, field, value)
        await session.flush()
        return category

    async def delete_category(self, session: AsyncSession, category: ForumCategory) -> None:
        await session.delete(category)
        await session.flush()

    # --- Posts ---

    async def create_post(self, session: AsyncSession, data: ForumPostCreate) -> ForumPost:
        post = ForumPost(**data.model_dump())
        session.add(post)
        await session.flush()
        return post

    async def get_post_by_id(self, session: AsyncSession, post_id: uuid.UUID) -> ForumPost | None:
        return await session.get(ForumPost, post_id)

    async def list_posts_by_category(
        self, session: AsyncSession, category_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> list[ForumPost]:
        result = await session.execute(
            select(ForumPost)
            .where(ForumPost.category_id == category_id, ForumPost.deleted_at.is_(None))
            .order_by(ForumPost.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def update_post(self, session: AsyncSession, post: ForumPost, data: ForumPostUpdate) -> ForumPost:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(post, field, value)
        await session.flush()
        return post

    async def soft_delete_post(self, session: AsyncSession, post: ForumPost) -> ForumPost:
        post.deleted_at = datetime.now(timezone.utc)
        await session.flush()
        return post

    # --- Comments ---

    async def create_comment(self, session: AsyncSession, data: CommentCreate) -> Comment:
        comment = Comment(**data.model_dump())
        session.add(comment)
        await session.flush()
        return comment

    async def get_comment_by_id(self, session: AsyncSession, comment_id: uuid.UUID) -> Comment | None:
        return await session.get(Comment, comment_id)

    async def list_comments_by_post(self, session: AsyncSession, post_id: uuid.UUID) -> list[Comment]:
        result = await session.execute(
            select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at)
        )
        return list(result.scalars().all())

    async def update_comment(self, session: AsyncSession, comment: Comment, data: CommentUpdate) -> Comment:
        comment.content = data.content
        await session.flush()
        return comment

    async def delete_comment(self, session: AsyncSession, comment: Comment) -> None:
        await session.delete(comment)
        await session.flush()

    # --- Likes ---

    async def like_post(self, session: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID) -> PostLike:
        like = PostLike(post_id=post_id, user_id=user_id)
        session.add(like)
        await session.flush()
        return like

    async def get_post_like(self, session: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID) -> PostLike | None:
        result = await session.execute(
            select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def unlike_post(self, session: AsyncSession, like: PostLike) -> None:
        await session.delete(like)
        await session.flush()

    async def like_comment(self, session: AsyncSession, comment_id: uuid.UUID, user_id: uuid.UUID) -> CommentLike:
        like = CommentLike(comment_id=comment_id, user_id=user_id)
        session.add(like)
        await session.flush()
        return like

    async def get_comment_like(self, session: AsyncSession, comment_id: uuid.UUID, user_id: uuid.UUID) -> CommentLike | None:
        result = await session.execute(
            select(CommentLike).where(CommentLike.comment_id == comment_id, CommentLike.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def unlike_comment(self, session: AsyncSession, like: CommentLike) -> None:
        await session.delete(like)
        await session.flush()

