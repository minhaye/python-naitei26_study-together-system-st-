import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.schemas.notification import NotificationCreate


async def create_notification(session: AsyncSession, data: NotificationCreate) -> Notification:
    notification = Notification(**data.model_dump())
    session.add(notification)
    await session.flush()
    return notification


async def get_notification(session: AsyncSession, notification_id: uuid.UUID) -> Notification | None:
    return await session.get(Notification, notification_id)


async def list_notifications_for_user(
    session: AsyncSession, user_id: uuid.UUID, unread_only: bool = False, skip: int = 0, limit: int = 50
) -> list[Notification]:
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await session.execute(query)
    return list(result.scalars().all())


async def mark_notification_read(session: AsyncSession, notification: Notification) -> Notification:
    notification.is_read = True
    await session.flush()
    return notification


async def delete_notification(session: AsyncSession, notification: Notification) -> None:
    await session.delete(notification)
    await session.flush()
