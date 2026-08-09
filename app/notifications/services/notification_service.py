import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.notifications.entities.notification_entity import Notification
from app.notifications.dto.notification_dto import NotificationCreate


class NotificationsService:
    async def create(self, session: AsyncSession, data: NotificationCreate) -> Notification:
        notification = Notification(**data.model_dump())
        session.add(notification)
        await session.flush()
        return notification

    async def get_by_id(self, session: AsyncSession, notification_id: uuid.UUID) -> Notification | None:
        return await session.get(Notification, notification_id)

    async def list_for_user(
        self, session: AsyncSession, user_id: uuid.UUID, unread_only: bool = False, skip: int = 0, limit: int = 50
    ) -> list[Notification]:
        query = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            query = query.where(Notification.is_read.is_(False))
        query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all())

    async def mark_read(self, session: AsyncSession, notification: Notification) -> Notification:
        notification.is_read = True
        await session.flush()
        return notification

    async def delete(self, session: AsyncSession, notification: Notification) -> None:
        await session.delete(notification)
        await session.flush()
