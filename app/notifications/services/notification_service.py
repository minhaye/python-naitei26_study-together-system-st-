import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import NotificationType
from app.notifications.dto.notification_dto import (
    NotificationCategory,
    NotificationCreate,
    NotificationSettingsUpdate,
    NOTIFICATION_TYPE_TO_CATEGORY,
)
from app.notifications.entities.notification_entity import Notification


# Pre-computed reverse mapping: category -> list of NotificationTypes
_CATEGORY_TYPES: dict[NotificationCategory, list[NotificationType]] = {}
for _ntype, _cat in NOTIFICATION_TYPE_TO_CATEGORY.items():
    _CATEGORY_TYPES.setdefault(_cat, []).append(_ntype)


import re


def _clean_text_preview(text: str, max_len: int = 100) -> str:
    if not text:
        return ""
    # 1. Strip HTML tags first (<p>, <span>, <img>, etc.)
    cleaned = re.sub(r"<[^>]*>", "", text)
    # 2. Strip truncated opening tag if string ended mid-tag
    cleaned = re.sub(r"<[a-zA-Z][^>]*$", "", cleaned)
    # 3. Strip leading @mention tag if present
    cleaned = cleaned.strip()
    if cleaned.startswith("@"):
        cleaned = re.sub(
            r"^@[^\n\r]+?\s{1,2}(?=[A-Za-z0-9\u00C0-\u024F\u1EA0-\u1EF9a-z])",
            "",
            cleaned,
            flags=re.IGNORECASE,
        ).strip()
        if cleaned.startswith("@"):
            cleaned = re.sub(r"^@[^\s]+\s*", "", cleaned).strip()
    # 4. Normalize spaces and slice
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_len]


class NotificationsService:

    DEFAULT_SETTINGS = {
        "enable_forum": True,
        "enable_group": True,
        "enable_goal": True,
        "enable_message": True,
        "enable_sound": True,
    }

    _USER_SETTINGS_STORE: dict[uuid.UUID, dict] = {}

    async def get_settings(self, session: AsyncSession, user_id: uuid.UUID) -> dict:
        stored = self._USER_SETTINGS_STORE.get(user_id)
        if stored:
            return {**self.DEFAULT_SETTINGS, **stored}
        return dict(self.DEFAULT_SETTINGS)

    async def update_settings(self, session: AsyncSession, user_id: uuid.UUID, settings_in: NotificationSettingsUpdate) -> dict:
        current = dict(self._USER_SETTINGS_STORE.get(user_id) or self.DEFAULT_SETTINGS)
        updates = settings_in.model_dump(exclude_unset=True)
        current.update(updates)
        self._USER_SETTINGS_STORE[user_id] = current
        return current

    # ── CRUD ───────────────────────────────────────────────────────────────

    async def create(self, session: AsyncSession, data: NotificationCreate) -> Notification:
        notification = Notification(**data.model_dump())
        session.add(notification)
        await session.flush()
        return notification

    async def get_by_id(self, session: AsyncSession, notification_id: uuid.UUID) -> Notification | None:
        return await session.get(Notification, notification_id)

    async def list_for_user(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        unread_only: bool = False,
        category: Optional[NotificationCategory] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Notification]:
        from sqlalchemy.orm import selectinload

        query = select(Notification).options(selectinload(Notification.actor)).where(Notification.user_id == user_id)

        if category == NotificationCategory.UNREAD or unread_only:
            query = query.where(Notification.is_read.is_(False))
        elif category != NotificationCategory.ALL and category is not None:
            types_for_tab = _CATEGORY_TYPES.get(category, [])
            if types_for_tab:
                query = query.where(Notification.type.in_(types_for_tab))
            else:
                return []

        query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
        result = await session.execute(query)
        notifications = list(result.scalars().all())

        for noti in notifications:
            if noti.actor and noti.data is not None:
                noti.data = {
                    **noti.data,
                    "actor_avatar_url": noti.actor.avatar_url,
                }

        return notifications

    # ── Mark read ──────────────────────────────────────────────────────────

    async def mark_read(self, session: AsyncSession, notification: Notification) -> Notification:
        notification.is_read = True
        await session.flush()
        return notification

    async def mark_all_read(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        category: Optional[NotificationCategory] = None,
    ) -> int:
        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )
        if category is not None:
            types_for_tab = _CATEGORY_TYPES.get(category, [])
            if types_for_tab:
                stmt = stmt.where(Notification.type.in_(types_for_tab))
        stmt = stmt.values(is_read=True)
        result = await session.execute(stmt)
        await session.flush()
        return result.rowcount  # type: ignore[return-value]

    # ── Unread counts ──────────────────────────────────────────────────────

    async def get_unread_counts(self, session: AsyncSession, user_id: uuid.UUID) -> dict:
        forum_types = _CATEGORY_TYPES.get(NotificationCategory.FORUM, [])
        group_types = _CATEGORY_TYPES.get(NotificationCategory.GROUP, [])
        goal_types = _CATEGORY_TYPES.get(NotificationCategory.GOAL, [])
        message_types = _CATEGORY_TYPES.get(NotificationCategory.MESSAGE, [])

        query = (
            select(
                func.count().label("total"),
                func.count(case((Notification.type.in_(forum_types), 1))).label("forum"),
                func.count(case((Notification.type.in_(group_types), 1))).label("group"),
                func.count(case((Notification.type.in_(goal_types), 1))).label("goal"),
                func.count(case((Notification.type.in_(message_types), 1))).label("message"),
            )
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )
        result = await session.execute(query)
        return dict(result.mappings().one())

    # ── Domain Event Triggers ─────────────────────────────────────────────

    async def notify_post_like(
        self,
        session: AsyncSession,
        *,
        post_id: uuid.UUID,
        post_author_id: uuid.UUID,
        post_title: str,
        actor_id: uuid.UUID,
        actor_name: str,
        emoji: Optional[str] = None,
    ) -> Notification | None:
        """Triggered when actor likes post. Aggregates multiple likes if unread exists."""
        if actor_id == post_author_id:
            return None

        # Check existing unread POST_LIKE notification for this post
        existing_stmt = select(Notification).where(
            Notification.user_id == post_author_id,
            Notification.post_id == post_id,
            Notification.type == NotificationType.POST_LIKE,
            Notification.is_read.is_(False),
        )
        existing_res = await session.execute(existing_stmt)
        existing = existing_res.scalar_one_or_none()

        # Count total distinct reactors on this post
        from app.forum.entities.forum_entity import PostReaction
        count_stmt = select(func.count(func.distinct(PostReaction.user_id))).where(PostReaction.post_id == post_id)
        total_reactors = (await session.execute(count_stmt)).scalar() or 1

        other_count = max(0, total_reactors - 1)
        data = {
            "actor_name": actor_name,
            "post_title": post_title[:50],
            "other_count": other_count,
            "emoji": emoji or "❤️",
        }

        if existing:
            existing.actor_id = actor_id
            existing.data = data
            existing.created_at = datetime.now(timezone.utc)
            await session.flush()
            return existing

        return await self.create(
            session,
            NotificationCreate(
                user_id=post_author_id,
                type=NotificationType.POST_LIKE,
                actor_id=actor_id,
                post_id=post_id,
                data=data,
            ),
        )

    async def notify_post_comment(
        self,
        session: AsyncSession,
        *,
        post_id: uuid.UUID,
        post_author_id: uuid.UUID,
        post_title: str,
        comment_id: uuid.UUID,
        comment_content: str,
        actor_id: uuid.UUID,
        actor_name: str,
    ) -> Notification | None:
        """Triggered when actor comments on a post."""
        if actor_id == post_author_id:
            return None

        clean_comment = _clean_text_preview(comment_content, 80)
        clean_title = _clean_text_preview(post_title, 80)

        return await self.create(
            session,
            NotificationCreate(
                user_id=post_author_id,
                type=NotificationType.POST_COMMENT,
                actor_id=actor_id,
                post_id=post_id,
                comment_id=comment_id,
                data={
                    "actor_name": actor_name,
                    "comment_preview": clean_comment,
                    "post_title": clean_title or "bài viết",
                },
            ),
        )

    async def notify_comment_reply(
        self,
        session: AsyncSession,
        *,
        post_id: uuid.UUID,
        post_title: str,
        comment_id: uuid.UUID,
        parent_author_id: uuid.UUID,
        reply_content: str,
        actor_id: uuid.UUID,
        actor_name: str,
    ) -> Notification | None:
        """Triggered when actor replies to a comment."""
        if actor_id == parent_author_id:
            return None

        clean_reply = _clean_text_preview(reply_content, 80)
        clean_title = _clean_text_preview(post_title, 80)

        return await self.create(
            session,
            NotificationCreate(
                user_id=parent_author_id,
                type=NotificationType.COMMENT_REPLY,
                actor_id=actor_id,
                post_id=post_id,
                comment_id=comment_id,
                data={
                    "actor_name": actor_name,
                    "reply_preview": clean_reply,
                    "post_title": clean_title or "bài viết",
                },
            ),
        )

    async def notify_new_resource(
        self,
        session: AsyncSession,
        *,
        group_id: uuid.UUID,
        group_name: str,
        resource_name: str,
        uploader_id: uuid.UUID,
        uploader_name: str,
    ) -> list[Notification]:
        """Triggered when member uploads new file into group. Notifies all other active group members."""
        from app.db.enums import MemberStatus
        from app.groups.entities.group_entity import GroupMember

        members_stmt = select(GroupMember.user_id).where(
            GroupMember.group_id == group_id,
            GroupMember.status == MemberStatus.ACTIVE,
            GroupMember.user_id != uploader_id,
        )
        res = await session.execute(members_stmt)
        recipient_ids = res.scalars().all()

        notifications = []
        for uid in recipient_ids:
            noti = await self.create(
                session,
                NotificationCreate(
                    user_id=uid,
                    type=NotificationType.GROUP_NEW_RESOURCE,
                    actor_id=uploader_id,
                    group_id=group_id,
                    data={
                        "actor_name": uploader_name,
                        "resource_name": resource_name,
                        "group_name": group_name,
                    },
                ),
            )
            notifications.append(noti)
        return notifications

    async def notify_study_room_first_joiner(
        self,
        session: AsyncSession,
        *,
        room_id: uuid.UUID,
        room_name: str,
        group_id: uuid.UUID,
        joiner_id: uuid.UUID,
        joiner_name: str,
    ) -> list[Notification]:
        """Triggered when first user enters an empty study room. Has 2-hour cooldown per room."""
        cooldown_threshold = datetime.now(timezone.utc) - timedelta(hours=2)

        check_stmt = select(Notification).where(
            Notification.type == NotificationType.STUDY_ROOM_FIRST_JOINER,
            Notification.created_at >= cooldown_threshold,
            Notification.group_id == group_id,
        )
        existing = (await session.execute(check_stmt)).scalars().first()
        if existing:
            return []

        from app.db.enums import MemberStatus
        from app.groups.entities.group_entity import GroupMember

        members_stmt = select(GroupMember.user_id).where(
            GroupMember.group_id == group_id,
            GroupMember.status == MemberStatus.ACTIVE,
            GroupMember.user_id != joiner_id,
        )
        recipient_ids = (await session.execute(members_stmt)).scalars().all()

        notifications = []
        for uid in recipient_ids:
            noti = await self.create(
                session,
                NotificationCreate(
                    user_id=uid,
                    type=NotificationType.STUDY_ROOM_FIRST_JOINER,
                    actor_id=joiner_id,
                    group_id=group_id,
                    data={
                        "actor_name": joiner_name,
                        "room_name": room_name,
                    },
                ),
            )
            notifications.append(noti)
        return notifications

    async def notify_study_room_active(
        self,
        session: AsyncSession,
        *,
        room_id: uuid.UUID,
        room_name: str,
        group_id: uuid.UUID,
        active_user_count: int,
    ) -> list[Notification]:
        """Triggered when active members in room reaches >= 5 (fires once per 4-hour session)."""
        if active_user_count < 5:
            return []

        cooldown_threshold = datetime.now(timezone.utc) - timedelta(hours=4)

        check_stmt = select(Notification).where(
            Notification.type == NotificationType.STUDY_ROOM_ACTIVE,
            Notification.created_at >= cooldown_threshold,
            Notification.group_id == group_id,
        )
        existing = (await session.execute(check_stmt)).scalars().first()
        if existing:
            return []

        from app.db.enums import MemberStatus
        from app.groups.entities.group_entity import GroupMember

        members_stmt = select(GroupMember.user_id).where(
            GroupMember.group_id == group_id,
            GroupMember.status == MemberStatus.ACTIVE,
        )
        recipient_ids = (await session.execute(members_stmt)).scalars().all()

        notifications = []
        for uid in recipient_ids:
            noti = await self.create(
                session,
                NotificationCreate(
                    user_id=uid,
                    type=NotificationType.STUDY_ROOM_ACTIVE,
                    group_id=group_id,
                    data={
                        "room_name": room_name,
                        "user_count": active_user_count,
                    },
                ),
            )
            notifications.append(noti)
        return notifications

    async def notify_direct_message(
        self,
        session: AsyncSession,
        *,
        conversation_id: uuid.UUID,
        sender_id: uuid.UUID,
        sender_name: str,
        message_content: str,
    ) -> list[Notification]:
        """Triggered on new message. Debounces multiple messages within 3 minutes into MESSAGE_GROUP."""
        from app.conversations.entities.conversation_entity import ConversationMember

        members_stmt = select(ConversationMember.user_id).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id != sender_id,
        )
        recipient_ids = (await session.execute(members_stmt)).scalars().all()
        if not recipient_ids:
            return []

        debounce_threshold = datetime.now(timezone.utc) - timedelta(minutes=3)

        notifications = []
        for recipient_id in recipient_ids:
            existing_stmt = select(Notification).where(
                Notification.user_id == recipient_id,
                Notification.actor_id == sender_id,
                Notification.type.in_([NotificationType.NEW_DIRECT_MESSAGE, NotificationType.MESSAGE_GROUP]),
                Notification.is_read.is_(False),
                Notification.created_at >= debounce_threshold,
            )
            existing = (await session.execute(existing_stmt)).scalar_one_or_none()

            if existing:
                msg_count = (existing.data or {}).get("message_count", 1) + 1
                existing.type = NotificationType.MESSAGE_GROUP
                existing.data = {
                    "actor_name": sender_name,
                    "message_count": msg_count,
                }
                existing.created_at = datetime.now(timezone.utc)
                await session.flush()
                notifications.append(existing)
            else:
                noti = await self.create(
                    session,
                    NotificationCreate(
                        user_id=recipient_id,
                        type=NotificationType.NEW_DIRECT_MESSAGE,
                        actor_id=sender_id,
                        data={
                            "actor_name": sender_name,
                            "message_preview": (message_content or "Gửi tệp đính kèm")[:50],
                        },
                    ),
                )
                notifications.append(noti)

        return notifications

    # ── Delete ─────────────────────────────────────────────────────────────

    async def delete(self, session: AsyncSession, notification: Notification) -> None:
        await session.delete(notification)
        await session.flush()
