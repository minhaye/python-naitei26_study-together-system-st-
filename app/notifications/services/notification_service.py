import uuid
from typing import Optional

from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import NotificationType
from app.notifications.dto.notification_dto import (
    NotificationCategory,
    NotificationCreate,
    NOTIFICATION_TYPE_TO_CATEGORY,
)
from app.notifications.entities.notification_entity import Notification


# Pre-computed reverse mapping: category -> list of NotificationTypes
_CATEGORY_TYPES: dict[NotificationCategory, list[NotificationType]] = {}
for _ntype, _cat in NOTIFICATION_TYPE_TO_CATEGORY.items():
    _CATEGORY_TYPES.setdefault(_cat, []).append(_ntype)


class NotificationsService:

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
        query = select(Notification).where(Notification.user_id == user_id)

        if unread_only:
            query = query.where(Notification.is_read.is_(False))

        if category is not None:
            types_for_tab = _CATEGORY_TYPES.get(category, [])
            if types_for_tab:
                query = query.where(Notification.type.in_(types_for_tab))
            else:
                # Unknown category → return nothing
                return []

        query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all())

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
        """Mark all unread notifications as read. Optionally filter by tab category.
        Returns the number of rows updated."""
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
        """Return unread counts for all 4 tabs + total in a single SQL query.

        Uses the partial index idx_notifications_unread_user (WHERE is_read = FALSE)
        so this runs in sub-millisecond time regardless of total table size.
        """
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

    # ── Delete ─────────────────────────────────────────────────────────────

    async def delete(self, session: AsyncSession, notification: Notification) -> None:
        await session.delete(notification)
        await session.flush()
