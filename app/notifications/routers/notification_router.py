import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.db.session import get_db_session
from app.notifications.dto.notification_dto import NotificationResponse
from app.notifications.services.notification_service import NotificationsService

router = APIRouter(prefix="/notifications", tags=["Notifications"])
service = NotificationsService()

# No public POST endpoint here, intentionally. Auditing actual callers found no legitimate
# client for notification creation -- notifications are always created by trusted
# server-side code that already knows the real recipient/actor ids (e.g.
# InvitationService.create, called in-process, never over HTTP). Requiring auth on a public
# create endpoint would not be enough on its own: any authenticated user could still set an
# arbitrary user_id/actor_id and impersonate/spam. Use NotificationsService.create directly
# from server-side code instead of adding a route back here.


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(
    unread_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    return await service.list_for_user(session, current_user.id, unread_only=unread_only, skip=skip, limit=limit)


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    notification = await service.get_by_id(session, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    return notification


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    notification = await service.get_by_id(session, notification_id)
    if not notification or notification.user_id != current_user.id:
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
async def delete_notification(
    notification_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    notification = await service.get_by_id(session, notification_id)
    if not notification or notification.user_id != current_user.id:
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
