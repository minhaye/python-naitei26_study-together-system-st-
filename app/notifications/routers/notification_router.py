import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.notifications.dto.notification_dto import NotificationCreate, NotificationResponse
from app.notifications.services.notification_service import NotificationsService

router = APIRouter(prefix="/notifications", tags=["Notifications"])
service = NotificationsService()


@router.post("/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(data: NotificationCreate, session: AsyncSession = Depends(get_db_session)):
    try:
        notification = await service.create(session, data)
        await session.commit()
        return notification
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create notification: {str(e)}"
        )


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(
    user_id: uuid.UUID,
    unread_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    session: AsyncSession = Depends(get_db_session)
):
    return await service.list_for_user(session, user_id, unread_only=unread_only, skip=skip, limit=limit)


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(notification_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    notification = await service.get_by_id(session, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    return notification


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(notification_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    notification = await service.get_by_id(session, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    try:
        updated = await service.mark_read(session, notification)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not mark notification read: {str(e)}"
        )


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(notification_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    notification = await service.get_by_id(session, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    try:
        await service.delete(session, notification)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete notification: {str(e)}"
        )
