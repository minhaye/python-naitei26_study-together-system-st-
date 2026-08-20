import re
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.forum.entities.forum_entity import Comment, CommentLike, ForumCategory, ForumPost, PostLike, PostTag, Tag
from app.forum.dto.forum_dto import (
    CommentCreate,
    CommentUpdate,
    ForumCategoryCreate,
    ForumCategoryUpdate,
    ForumPostCreate,
    ForumPostUpdate,
)


class ForumService:
    @staticmethod
    def parse_hashtags(content: str) -> list[str]:
        if not content:
            return []
        matches = re.findall(r'#([\w\u00C0-\u024F]+)', content)
        return list(dict.fromkeys([m.lower() for m in matches if m.strip()]))

    async def _sync_post_tags(self, session: AsyncSession, post_id: uuid.UUID, tag_names: list[str]) -> None:
        existing_tags_res = await session.execute(select(Tag).where(Tag.name.in_(tag_names))) if tag_names else None
        existing_tags = {t.name: t for t in existing_tags_res.scalars().all()} if existing_tags_res else {}

        tag_objs: list[Tag] = []
        for name in tag_names:
            if name in existing_tags:
                tag_objs.append(existing_tags[name])
            else:
                new_tag = Tag(name=name)
                session.add(new_tag)
                await session.flush()
                tag_objs.append(new_tag)

        current_pt_res = await session.execute(select(PostTag).where(PostTag.post_id == post_id))
        current_pts = current_pt_res.scalars().all()
        current_tag_ids = {pt.tag_id for pt in current_pts}
        new_tag_ids = {t.id for t in tag_objs}

        for pt in current_pts:
            if pt.tag_id not in new_tag_ids:
                await session.delete(pt)

        for t in tag_objs:
            if t.id not in current_tag_ids:
                session.add(PostTag(post_id=post_id, tag_id=t.id))

        await session.flush()

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
        
        tag_names = self.parse_hashtags(data.content)
        await self._sync_post_tags(session, post.id, tag_names)
        
        return post

    async def get_post_by_id(
        self, session: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID | None = None
    ) -> ForumPost | None:
        from sqlalchemy import func
        from sqlalchemy.orm import selectinload
        from app.forum.entities.forum_entity import Comment, PostLike, PostTag, Tag

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
        stmt = (
            select(ForumPost, comments_count_subq.label("comments_count"), likes_count_subq.label("likes_count"))
            .options(
                selectinload(ForumPost.category),
                selectinload(ForumPost.author),
                selectinload(ForumPost.post_tags).selectinload(PostTag.tag),
            )
            .where(ForumPost.id == post_id, ForumPost.deleted_at.is_(None))
        )
        result = await session.execute(stmt)
        row = result.first()
        if not row:
            return None
        post, c_count, l_count = row
        post.category_name = post.category.name if post.category else None
        post.author_name = post.author.display_name if post.author else None
        post.likes_count = l_count
        post.comments_count = c_count
        post.is_liked = False
        if user_id:
            like_res = await session.execute(
                select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user_id)
            )
            post.is_liked = like_res.scalars().first() is not None
        post.tags = [f"#{pt.tag.name}" for pt in post.post_tags if pt.tag]
        return post

    async def list_posts_by_category(
        self,
        session: AsyncSession,
        category_id: uuid.UUID | None,
        tag: str | None = None,
        user_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[ForumPost]:
        from sqlalchemy import func
        from sqlalchemy.orm import selectinload
        from app.forum.entities.forum_entity import Comment, PostLike, PostTag, Tag

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
            selectinload(ForumPost.author),
            selectinload(ForumPost.post_tags).selectinload(PostTag.tag)
        ).where(ForumPost.deleted_at.is_(None))

        if category_id:
            stmt = stmt.where(ForumPost.category_id == category_id)

        if tag:
            clean_tag = tag.lstrip("#").lower().strip()
            stmt = stmt.join(ForumPost.post_tags).join(PostTag.tag).where(Tag.name == clean_tag)

        stmt = stmt.order_by(ForumPost.created_at.desc()).offset(skip).limit(limit)

        result = await session.execute(stmt)
        rows = result.all()

        liked_post_ids = set()
        if user_id and rows:
            post_ids = [p[0].id for p in rows]
            liked_stmt = select(PostLike.post_id).where(
                PostLike.user_id == user_id,
                PostLike.post_id.in_(post_ids)
            )
            liked_res = await session.execute(liked_stmt)
            liked_post_ids = set(liked_res.scalars().all())

        posts = []
        for post, c_count, l_count in rows:
            post.category_name = post.category.name if post.category else None
            post.author_name = post.author.display_name if post.author else None
            post.likes_count = l_count
            post.comments_count = c_count
            post.is_liked = post.id in liked_post_ids
            post.tags = [f"#{pt.tag.name}" for pt in post.post_tags if pt.tag]
            posts.append(post)

        return posts

    async def update_post(self, session: AsyncSession, post: ForumPost, data: ForumPostUpdate) -> ForumPost:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(post, field, value)
        post.updated_at = datetime.now(timezone.utc)
        await session.flush()

        if data.content is not None:
            tag_names = self.parse_hashtags(data.content)
            await self._sync_post_tags(session, post.id, tag_names)

        return post

    async def soft_delete_post(self, session: AsyncSession, post: ForumPost) -> ForumPost:
        post.deleted_at = datetime.now(timezone.utc)
        # Clear post_tags so trigger decrements tag post_count
        await self._sync_post_tags(session, post.id, [])
        await session.flush()
        return post

    # --- Tags ---

    async def get_trending_tags(self, session: AsyncSession, limit: int = 10) -> list[Tag]:
        stmt = select(Tag).where(Tag.post_count > 0).order_by(Tag.post_count.desc(), Tag.name.asc()).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def search_tags(self, session: AsyncSession, query: str, limit: int = 10) -> list[Tag]:
        clean_q = query.lstrip("#").lower().strip()
        if not clean_q:
            return await self.get_trending_tags(session, limit=limit)
        stmt = select(Tag).where(Tag.name.ilike(f"%{clean_q}%")).order_by(Tag.post_count.desc(), Tag.name.asc()).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    # --- Comments ---

    async def create_comment(self, session: AsyncSession, data: CommentCreate) -> Comment:
        comment = Comment(**data.model_dump())
        session.add(comment)
        await session.flush()
        return comment

    async def get_comment_by_id(self, session: AsyncSession, comment_id: uuid.UUID) -> Comment | None:
        from sqlalchemy.orm import selectinload
        stmt = select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment_id)
        res = await session.execute(stmt)
        cmt = res.scalar_one_or_none()
        if cmt:
            cmt.author_name = cmt.author.display_name if cmt.author else None
        return cmt

    async def list_comments_by_post(
        self, session: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID | None = None
    ) -> list[Comment]:
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

        liked_comment_ids = set()
        if user_id and rows:
            cmt_ids = [c[0].id for c in rows]
            liked_stmt = select(CommentLike.comment_id).where(
                CommentLike.user_id == user_id,
                CommentLike.comment_id.in_(cmt_ids)
            )
            liked_res = await session.execute(liked_stmt)
            liked_comment_ids = set(liked_res.scalars().all())

        comments = []
        for cmt, l_count in rows:
            cmt.author_name = cmt.author.display_name if cmt.author else None
            cmt.likes_count = l_count
            cmt.is_liked = cmt.id in liked_comment_ids
            comments.append(cmt)

        return comments

    async def update_comment(self, session: AsyncSession, comment: Comment, data: CommentUpdate) -> Comment:
        comment.content = data.content
        comment.updated_at = datetime.now(timezone.utc)
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

