import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.attachments.services.attachment_service import (
    AttachmentServiceNotConfigured,
    AttachmentStorageError,
    AttachmentsService,
)
from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.channels.services.channel_service import ChannelsService
from app.core.permissions import can_access_channel, is_group_manager
from app.db.session import get_db_session
from app.messages.dto.message_dto import MessageCreate, MessageListResponse, MessageResponse, MessageUpdate
from app.messages.services.message_service import MessagesService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Messages"])
message_service = MessagesService()
channel_service = ChannelsService()
attachments_service = AttachmentsService()


@router.get("/channels/{channel_id}/messages", response_model=MessageListResponse)
async def list_messages(
    channel_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    before: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    channel = await channel_service.get_by_id(session, channel_id)
    if not channel:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Channel not found")
    if not await can_access_channel(session, channel, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this channel")

    try:
        messages, next_cursor = await message_service.list_by_channel(session, channel_id, limit=limit, before=before)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid cursor")
    return MessageListResponse(items=messages, next_cursor=next_cursor)


@router.post("/channels/{channel_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    channel_id: uuid.UUID,
    data: MessageCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    channel = await channel_service.get_by_id(session, channel_id)
    if not channel:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Channel not found")
    if not await can_access_channel(session, channel, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this channel")

    if data.attachment_path:
        if not attachments_service.validate_ownership(
            data.attachment_path, channel.group_id, channel_id, current_user.id
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid attachment reference")
        try:
            exists = await attachments_service.object_exists(data.attachment_path)
        except AttachmentServiceNotConfigured as exc:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Attachment storage is not configured") from exc
        except AttachmentStorageError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
        if not exists:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Attachment was not found, upload it first")

    try:
        message = await message_service.create(session, channel_id=channel_id, sender_id=current_user.id, data=data)
        await session.commit()
        return message
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create message: {str(e)}"
        )


@router.get("/messages/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    message = await message_service.get_by_id(session, message_id)
    if not message:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    channel = await channel_service.get_by_id(session, message.channel_id)
    if not channel or not await can_access_channel(session, channel, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this message")
    return message


@router.patch("/messages/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: uuid.UUID,
    data: MessageUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    message = await message_service.get_by_id(session, message_id)
    if not message:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    if message.sender_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the sender can edit this message")

    try:
        updated = await message_service.update(session, message, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update message: {str(e)}"
        )


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    message = await message_service.get_by_id(session, message_id)
    if not message:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    allowed = message.sender_id == current_user.id
    if not allowed:
        channel = await channel_service.get_by_id(session, message.channel_id)
        allowed = channel is not None and await is_group_manager(session, channel.group_id, current_user.id)
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to delete this message")

    attachment_path = message.attachment_path
    try:
        await message_service.delete(session, message)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete message: {str(e)}"
        )

    # Best-effort cleanup: Postgres and Storage are separate systems, so this can't be
    # atomic with the row delete above. The message is already gone at this point either
    # way; a failure here just leaves an orphaned object for the cleanup job to reclaim
    # (see docs/chat-integration.md).
    if attachment_path:
        try:
            await attachments_service.delete_object(attachment_path)
        except (AttachmentStorageError, AttachmentServiceNotConfigured):
            logger.warning("Failed to delete storage object for deleted message", exc_info=True)
