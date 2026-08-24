import re
import uuid
from datetime import datetime, timezone
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.forum.entities.forum_entity import (
    Comment,
    CommentReaction,
    ForumCategory,
    ForumPost,
    PostReaction,
    PostTag,
    Tag,
)
from app.forum.dto.forum_dto import (
    CommentCreate,
    CommentUpdate,
    ForumCategoryCreate,
    ForumCategoryUpdate,
    ForumPostCreate,
    ForumPostUpdate,
    ReactionSummary,
)
from app.notifications.services.notification_service import NotificationsService
from app.profiles.services.profile_service import ProfilesService

notifications_service = NotificationsService()
profiles_service = ProfilesService()


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

    async def create_post(self, session: AsyncSession, data: ForumPostCreate, author_id: uuid.UUID) -> ForumPost:
        post = ForumPost(**data.model_dump(), author_id=author_id)
        session.add(post)
        await session.flush()

        tag_names = self.parse_hashtags(data.content)
        await self._sync_post_tags(session, post.id, tag_names)

        # A brand-new post can't have reactions yet -- no query needed. Also avoids the
        # ForumPost.reactions relationship (same attribute name as this transient summary list,
        # see _attach_post_reactions) lazy-loading under async SQLAlchemy when the response
        # model serializes this object.
        post.reactions = []
        return post

    async def _attach_post_reactions(
        self, session: AsyncSession, posts: list[ForumPost], viewer_id: uuid.UUID | None
    ) -> None:
        """Batched grouped-reaction lookup for a page of posts (avoids N+1). Sets
        `.reactions` as a transient attribute on each ForumPost -- same pattern
        MessagesService._attach_reactions uses for messages."""
        if not posts:
            return
        post_ids = [p.id for p in posts]
        stmt = (
            select(
                PostReaction.post_id,
                PostReaction.emoji,
                func.count().label("count"),
                # bool_or(NULL) -> NULL when viewer_id is None (nothing to compare equal to),
                # and bool(None) is False -- reacted_by_me correctly comes out False either way.
                func.bool_or(PostReaction.user_id == viewer_id).label("reacted_by_me"),
            )
            .where(PostReaction.post_id.in_(post_ids))
            .group_by(PostReaction.post_id, PostReaction.emoji)
        )
        result = await session.execute(stmt)
        by_post: dict[uuid.UUID, list[ReactionSummary]] = {}
        for post_id, emoji, count, reacted_by_me in result.all():
            by_post.setdefault(post_id, []).append(
                ReactionSummary(emoji=emoji, count=count, reacted_by_me=bool(reacted_by_me))
            )
        for post in posts:
            post.reactions = by_post.get(post.id, [])

    async def _attach_comment_reactions(
        self, session: AsyncSession, comments: list[Comment], viewer_id: uuid.UUID | None
    ) -> None:
        if not comments:
            return
        comment_ids = [c.id for c in comments]
        stmt = (
            select(
                CommentReaction.comment_id,
                CommentReaction.emoji,
                func.count().label("count"),
                func.bool_or(CommentReaction.user_id == viewer_id).label("reacted_by_me"),
            )
            .where(CommentReaction.comment_id.in_(comment_ids))
            .group_by(CommentReaction.comment_id, CommentReaction.emoji)
        )
        result = await session.execute(stmt)
        by_comment: dict[uuid.UUID, list[ReactionSummary]] = {}
        for comment_id, emoji, count, reacted_by_me in result.all():
            by_comment.setdefault(comment_id, []).append(
                ReactionSummary(emoji=emoji, count=count, reacted_by_me=bool(reacted_by_me))
            )
        for comment in comments:
            comment.reactions = by_comment.get(comment.id, [])

    async def get_post_by_id(
        self, session: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID | None = None
    ) -> ForumPost | None:
        from sqlalchemy.orm import selectinload

        comments_count_subq = (
            select(func.count(Comment.id))
            .where(Comment.post_id == ForumPost.id)
            .scalar_subquery()
        )
        stmt = (
            select(ForumPost, comments_count_subq.label("comments_count"))
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
        post, c_count = row
        post.category_name = post.category.name if post.category else None
        post.author_name = post.author.display_name if post.author else None
        post.author_avatar_url = post.author.avatar_url if post.author else None
        post.comments_count = c_count
        post.tags = [f"#{pt.tag.name}" for pt in post.post_tags if pt.tag]
        await self._attach_post_reactions(session, [post], user_id)
        return post

    async def list_posts_by_category(
        self,
        session: AsyncSession,
        category_id: uuid.UUID | None,
        tag: str | None = None,
        author_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[ForumPost]:
        from sqlalchemy.orm import selectinload

        comments_count_subq = (
            select(func.count(Comment.id))
            .where(Comment.post_id == ForumPost.id)
            .scalar_subquery()
        )

        stmt = select(
            ForumPost,
            comments_count_subq.label("comments_count"),
        ).options(
            selectinload(ForumPost.category),
            selectinload(ForumPost.author),
            selectinload(ForumPost.post_tags).selectinload(PostTag.tag)
        ).where(ForumPost.deleted_at.is_(None))

        if category_id:
            stmt = stmt.where(ForumPost.category_id == category_id)

        if author_id:
            stmt = stmt.where(ForumPost.author_id == author_id)

        if tag:
            clean_tag = tag.lstrip("#").lower().strip()
            stmt = stmt.join(ForumPost.post_tags).join(PostTag.tag).where(Tag.name == clean_tag)

        stmt = stmt.order_by(ForumPost.created_at.desc()).offset(skip).limit(limit)

        result = await session.execute(stmt)
        rows = result.all()

        posts = []
        for post, c_count in rows:
            post.category_name = post.category.name if post.category else None
            post.author_name = post.author.display_name if post.author else None
            post.author_avatar_url = post.author.avatar_url if post.author else None
            post.comments_count = c_count
            post.tags = [f"#{pt.tag.name}" for pt in post.post_tags if pt.tag]
            posts.append(post)

        await self._attach_post_reactions(session, posts, user_id)
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

    async def soft_delete_post(
        self, session: AsyncSession, post: ForumPost, deleted_by: uuid.UUID | None = None
    ) -> ForumPost:
        post.deleted_at = datetime.now(timezone.utc)
        post.deleted_by = deleted_by
        # Clear post_tags so trigger decrements tag post_count
        await self._sync_post_tags(session, post.id, [])
        await session.flush()
        return post

    # --- Tags ---

    async def get_trending_tags(self, session: AsyncSession, limit: int = 5) -> list[Tag]:
        stmt = select(Tag).where(Tag.post_count > 0).order_by(Tag.post_count.desc(), Tag.created_at.desc()).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def search_tags(self, session: AsyncSession, query: str, limit: int = 10) -> list[Tag]:
        clean_q = query.lstrip("#").lower().strip()
        if not clean_q:
            return await self.get_trending_tags(session, limit=limit)
        stmt = select(Tag).where(Tag.name.ilike(f"%{clean_q}%")).order_by(Tag.post_count.desc(), Tag.created_at.desc()).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    # --- Comments ---

    async def create_comment(self, session: AsyncSession, data: CommentCreate, author_id: uuid.UUID) -> Comment:
        comment = Comment(**data.model_dump(), author_id=author_id)
        session.add(comment)
        await session.flush()
        comment.reactions = []

        try:
            post = await session.get(ForumPost, comment.post_id)
            actor = await profiles_service.get_by_id(session, comment.author_id)
            actor_name = (actor.display_name or actor.username or "Thành viên") if actor else "Thành viên"
            post_title = (post.title if post else None) or "Bài viết"

            if comment.parent_comment_id:
                parent_cmt = await session.get(Comment, comment.parent_comment_id)
                if parent_cmt:
                    await notifications_service.notify_comment_reply(
                        session,
                        post_id=comment.post_id,
                        post_title=post_title,
                        comment_id=comment.id,
                        parent_author_id=parent_cmt.author_id,
                        reply_content=comment.content,
                        actor_id=comment.author_id,
                        actor_name=actor_name,
                    )
            elif post:
                await notifications_service.notify_post_comment(
                    session,
                    post_id=comment.post_id,
                    post_author_id=post.author_id,
                    post_title=post_title,
                    comment_id=comment.id,
                    comment_content=comment.content,
                    actor_id=comment.author_id,
                    actor_name=actor_name,
                )
        except Exception as e:
            print(f"[ForumService] Error creating notification for comment: {e}")

        return comment

    async def get_comment_by_id(
        self, session: AsyncSession, comment_id: uuid.UUID, user_id: uuid.UUID | None = None
    ) -> Comment | None:
        from sqlalchemy.orm import selectinload
        stmt = select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment_id)
        res = await session.execute(stmt)
        cmt = res.scalar_one_or_none()
        if cmt:
            cmt.author_name = cmt.author.display_name if cmt.author else None
            cmt.author_avatar_url = cmt.author.avatar_url if cmt.author else None
            await self._attach_comment_reactions(session, [cmt], user_id)
        return cmt

    async def list_comments_by_post(
        self,
        session: AsyncSession,
        post_id: uuid.UUID,
        user_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Comment]:
        from sqlalchemy.orm import selectinload

        stmt = (
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.post_id == post_id)
            .order_by(Comment.created_at)
            .offset(skip)
            .limit(limit)
        )

        result = await session.execute(stmt)
        comments = list(result.scalars().all())

        for cmt in comments:
            cmt.author_name = cmt.author.display_name if cmt.author else None
            cmt.author_avatar_url = cmt.author.avatar_url if cmt.author else None

        await self._attach_comment_reactions(session, comments, user_id)
        return comments

    async def update_comment(self, session: AsyncSession, comment: Comment, data: CommentUpdate) -> Comment:
        comment.content = data.content
        comment.updated_at = datetime.now(timezone.utc)
        await session.flush()
        return comment

    async def delete_comment(self, session: AsyncSession, comment: Comment) -> None:
        await session.delete(comment)
        await session.flush()

    # --- Reactions ---

    async def list_reacted_posts(
        self, session: AsyncSession, user_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> list[ForumPost]:
        """Posts the given user has placed any emoji reaction on (formerly "liked posts") --
        ordered by when they reacted, most recent first."""
        from sqlalchemy.orm import selectinload

        comments_count_subq = (
            select(func.count(Comment.id))
            .where(Comment.post_id == ForumPost.id)
            .scalar_subquery()
        )

        stmt = select(
            ForumPost,
            comments_count_subq.label("comments_count"),
        ).join(
            PostReaction, PostReaction.post_id == ForumPost.id
        ).options(
            selectinload(ForumPost.category),
            selectinload(ForumPost.author)
        ).where(
            ForumPost.deleted_at.is_(None),
            PostReaction.user_id == user_id
        ).order_by(
            PostReaction.created_at.desc()
        ).offset(skip).limit(limit)

        result = await session.execute(stmt)
        rows = result.all()

        posts = []
        for post, c_count in rows:
            post.category_name = post.category.name if post.category else None
            post.author_name = post.author.display_name if post.author else None
            post.author_avatar_url = post.author.avatar_url if post.author else None
            post.comments_count = c_count
            posts.append(post)

        await self._attach_post_reactions(session, posts, user_id)
        return posts

    async def get_post_reactions(
        self, session: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID | None
    ) -> list[ReactionSummary]:
        stmt = (
            select(
                PostReaction.emoji,
                func.count().label("count"),
                func.bool_or(PostReaction.user_id == user_id).label("reacted_by_me"),
            )
            .where(PostReaction.post_id == post_id)
            .group_by(PostReaction.emoji)
        )
        result = await session.execute(stmt)
        return [
            ReactionSummary(emoji=emoji, count=count, reacted_by_me=bool(reacted_by_me))
            for emoji, count, reacted_by_me in result.all()
        ]

    async def set_post_reaction(self, session: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID, emoji: str) -> None:
        stmt = (
            pg_insert(PostReaction)
            .values(post_id=post_id, user_id=user_id, emoji=emoji)
            .on_conflict_do_update(index_elements=[PostReaction.post_id, PostReaction.user_id], set_={"emoji": emoji})
        )
        await session.execute(stmt)
        await session.flush()

        try:
            post = await session.get(ForumPost, post_id)
            if post:
                actor = await profiles_service.get_by_id(session, user_id)
                actor_name = (actor.display_name or actor.username or "Thành viên") if actor else "Thành viên"
                await notifications_service.notify_post_like(
                    session,
                    post_id=post_id,
                    post_author_id=post.author_id,
                    post_title=post.title or "Bài viết",
                    actor_id=user_id,
                    actor_name=actor_name,
                    emoji=emoji,
                )
        except Exception:
            pass

    async def remove_post_reaction(self, session: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Idempotent: a no-op if the caller has no reaction on this post."""
        result = await session.execute(
            select(PostReaction).where(PostReaction.post_id == post_id, PostReaction.user_id == user_id)
        )
        reaction = result.scalar_one_or_none()
        if reaction is not None:
            await session.delete(reaction)
            await session.flush()

    async def get_comment_reactions(
        self, session: AsyncSession, comment_id: uuid.UUID, user_id: uuid.UUID | None
    ) -> list[ReactionSummary]:
        stmt = (
            select(
                CommentReaction.emoji,
                func.count().label("count"),
                func.bool_or(CommentReaction.user_id == user_id).label("reacted_by_me"),
            )
            .where(CommentReaction.comment_id == comment_id)
            .group_by(CommentReaction.emoji)
        )
        result = await session.execute(stmt)
        return [
            ReactionSummary(emoji=emoji, count=count, reacted_by_me=bool(reacted_by_me))
            for emoji, count, reacted_by_me in result.all()
        ]

    async def set_comment_reaction(
        self, session: AsyncSession, comment_id: uuid.UUID, user_id: uuid.UUID, emoji: str
    ) -> None:
        stmt = (
            pg_insert(CommentReaction)
            .values(comment_id=comment_id, user_id=user_id, emoji=emoji)
            .on_conflict_do_update(
                index_elements=[CommentReaction.comment_id, CommentReaction.user_id], set_={"emoji": emoji}
            )
        )
        await session.execute(stmt)
        await session.flush()

        try:
            comment = await session.get(Comment, comment_id)
            if comment:
                actor = await profiles_service.get_by_id(session, user_id)
                actor_name = (actor.display_name or actor.username or "Thành viên") if actor else "Thành viên"
                await notifications_service.notify_comment_reply(
                    session,
                    post_id=comment.post_id,
                    post_title="Bình luận",
                    comment_id=comment_id,
                    parent_author_id=comment.author_id,
                    reply_content=f"đã thả cảm xúc {emoji} vào bình luận của bạn",
                    actor_id=user_id,
                    actor_name=actor_name,
                )
        except Exception as e:
            print(f"[ForumService] Error creating notification for comment reaction: {e}")

    async def remove_comment_reaction(self, session: AsyncSession, comment_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Idempotent: a no-op if the caller has no reaction on this comment."""
        result = await session.execute(
            select(CommentReaction).where(CommentReaction.comment_id == comment_id, CommentReaction.user_id == user_id)
        )
        reaction = result.scalar_one_or_none()
        if reaction is not None:
            await session.delete(reaction)
            await session.flush()

