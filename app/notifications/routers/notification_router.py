import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.db.session import get_db_session
from app.notifications.dto.notification_dto import (
    NotificationCategory,
    NotificationResponse,
    NOTIFICATION_TYPE_TO_CATEGORY,
    UnreadCountsResponse,
)
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


def _enrich_response(notification) -> dict:
    """Attach the computed `category` field before Pydantic serialisation.

    The `category` is derived from `type` via the mapping dict and is not stored
    in the database — it's a presentation-layer concern only."""
    cat = NOTIFICATION_TYPE_TO_CATEGORY.get(notification.type, NotificationCategory.FORUM)
    return {
        **{c.key: getattr(notification, c.key) for c in notification.__table__.columns},
        "category": cat,
    }


# ── Unread counts (bell badge) ────────────────────────────────────────────

@router.get("/unread-counts", response_model=UnreadCountsResponse)
async def get_unread_counts(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Return unread notification counts for the bell badge and each of the 4 tabs."""
    return await service.get_unread_counts(session, current_user.id)


# ── List notifications (with optional tab filter) ─────────────────────────

@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(
    unread_only: bool = False,
    category: Optional[NotificationCategory] = Query(None, description="Filter by tab: forum | group | goal | message"),
    skip: int = 0,
    limit: int = 50,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    notifications = await service.list_for_user(
        session, current_user.id,
        unread_only=unread_only,
        category=category,
        skip=skip,
        limit=limit,
    )
    return [_enrich_response(n) for n in notifications]


# ── Get single notification ───────────────────────────────────────────────

@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    notification = await service.get_by_id(session, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return _enrich_response(notification)


# ── Mark single notification as read ──────────────────────────────────────

@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    notification = await service.get_by_id(session, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    try:
        updated = await service.mark_read(session, notification)
        await session.commit()
        return _enrich_response(updated)
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not mark notification read: {str(e)}",
        )


# ── Mark all notifications as read (optionally filtered by tab) ───────────

@router.put("/read-all", status_code=status.HTTP_200_OK)
async def mark_all_read(
    category: Optional[NotificationCategory] = Query(None, description="Only mark this tab's notifications as read"),
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        count = await service.mark_all_read(session, current_user.id, category=category)
        await session.commit()
        return {"updated": count}
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not mark notifications read: {str(e)}",
        )


# ── Delete single notification ────────────────────────────────────────────

@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    notification = await service.get_by_id(session, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    try:
        await service.delete(session, notification)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete notification: {str(e)}",
        )
