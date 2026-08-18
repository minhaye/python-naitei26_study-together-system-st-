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
        self, session: AsyncSession, category_id: uuid.UUID | None, skip: int = 0, limit: int = 50
    ) -> list[ForumPost]:
        from sqlalchemy import func
        from sqlalchemy.orm import selectinload
        from app.forum.entities.forum_entity import Comment, PostLike
        
        comments_count_subq = (
            select(func.count(Comment.id))
            .where(Comment.post_id == ForumPost.id)
            .scalar_subquery()
        )
        
        likes_count_subq = (
            select(func.count(PostLike.id))
            .where(PostLike.post_id == ForumPost.id)
            .scalar_subquery()
        )
        
        stmt = select(
            ForumPost, 
            comments_count_subq.label("comments_count"), 
            likes_count_subq.label("likes_count")
        ).options(
            selectinload(ForumPost.category),
            selectinload(ForumPost.author)
        ).where(ForumPost.deleted_at.is_(None))
        
        if category_id:
            stmt = stmt.where(ForumPost.category_id == category_id)
            
        stmt = stmt.order_by(ForumPost.created_at.desc()).offset(skip).limit(limit)
        
        result = await session.execute(stmt)
        rows = result.all()
        
        posts = []
        for post, c_count, l_count in rows:
            post.category_name = post.category.name if post.category else None
            post.author_name = post.author.display_name if post.author else None
            post.likes_count = l_count
            post.comments_count = c_count
            post.is_liked = False # Could be calculated if user_id passed
            posts.append(post)
            
        return posts

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
        from sqlalchemy import func, select
        from sqlalchemy.orm import selectinload
        from app.forum.entities.forum_entity import Comment, CommentLike
        
        likes_count_subq = (
            select(func.count(CommentLike.id))
            .where(CommentLike.comment_id == Comment.id)
            .scalar_subquery()
        )
        
        stmt = select(Comment, likes_count_subq.label("likes_count")).options(
            selectinload(Comment.author)
        ).where(Comment.post_id == post_id).order_by(Comment.created_at)
        
        result = await session.execute(stmt)
        rows = result.all()
        
        comments = []
        for cmt, l_count in rows:
            cmt.author_name = cmt.author.display_name if cmt.author else None
            cmt.likes_count = l_count
            cmt.is_liked = False
            comments.append(cmt)
            
        return comments

    async def update_comment(self, session: AsyncSession, comment: Comment, data: CommentUpdate) -> Comment:
        comment.content = data.content
        await session.flush()
        return comment

    async def delete_comment(self, session: AsyncSession, comment: Comment) -> None:
        await session.delete(comment)
        await session.flush()

    # --- Likes ---

    async def list_liked_posts(
        self, session: AsyncSession, user_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> list[ForumPost]:
        from sqlalchemy import func, select
        from sqlalchemy.orm import selectinload, aliased
        from app.forum.entities.forum_entity import Comment, PostLike, ForumPost
        
        comments_count_subq = (
            select(func.count(Comment.id))
            .where(Comment.post_id == ForumPost.id)
            .scalar_subquery()
        )
        
        PostLikeAlias = aliased(PostLike)
        likes_count_subq = (
            select(func.count(PostLikeAlias.id))
            .where(PostLikeAlias.post_id == ForumPost.id)
            .scalar_subquery()
        )
        
        stmt = select(
            ForumPost, 
            comments_count_subq.label("comments_count"), 
            likes_count_subq.label("likes_count")
        ).join(
            PostLike, PostLike.post_id == ForumPost.id
        ).options(
            selectinload(ForumPost.category),
            selectinload(ForumPost.author)
        ).where(
            ForumPost.deleted_at.is_(None),
            PostLike.user_id == user_id
        ).order_by(
            PostLike.created_at.desc()
        ).offset(skip).limit(limit)
        
        result = await session.execute(stmt)
        rows = result.all()
        
        posts = []
        for post, c_count, l_count in rows:
            post.category_name = post.category.name if post.category else None
            post.author_name = post.author.display_name if post.author else None
            post.likes_count = l_count
            post.comments_count = c_count
            post.is_liked = True
            posts.append(post)
            
        return posts

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

