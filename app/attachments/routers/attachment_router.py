import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.attachments.dto.attachment_dto import DownloadUrlResponse, UploadUrlRequest, UploadUrlResponse
from app.attachments.services.attachment_service import (
    AttachmentServiceNotConfigured,
    AttachmentStorageError,
    AttachmentsService,
)
from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.channels.services.channel_service import ChannelsService
from app.conversations.services.conversation_service import ConversationsService
from app.core.config import settings
from app.core.permissions import can_access_conversation
from app.db.enums import ConversationType
from app.db.session import get_db_session
from app.messages.services.message_service import MessagesService

router = APIRouter(tags=["Attachments"])
attachments_service = AttachmentsService()
channel_service = ChannelsService()
conversation_service = ConversationsService()
message_service = MessagesService()


@router.post("/conversations/{conversation_id}/attachments/upload-url", response_model=UploadUrlResponse)
async def create_upload_url(
    conversation_id: uuid.UUID,
    data: UploadUrlRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    conversation = await conversation_service.get_by_id(session, conversation_id)
    if not conversation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    if not await can_access_conversation(session, conversation, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this conversation")
    if conversation.type != ConversationType.CHANNEL:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Attachments are only supported for channel conversations")

    channel = await channel_service.get_by_id(session, conversation.channel_id)
    if not channel:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Channel not found")

    path = attachments_service.build_object_path(channel.group_id, channel.id, current_user.id, data.file_name)
    try:
        result = await attachments_service.create_signed_upload_url(path)
    except AttachmentServiceNotConfigured as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Attachment storage is not configured") from exc
    except AttachmentStorageError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return UploadUrlResponse(**result)


@router.get("/messages/{message_id}/attachment-url", response_model=DownloadUrlResponse)
async def get_attachment_url(
    message_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    message = await message_service.get_by_id(session, message_id)
    if not message:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    conversation = await conversation_service.get_by_id(session, message.conversation_id)
    if not conversation or not await can_access_conversation(session, conversation, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this message")

    if not message.attachment_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This message has no attachment")

    try:
        result = await attachments_service.create_signed_download_url(
            message.attachment_path, expires_in=settings.attachment_download_url_expires_in
        )
    except AttachmentServiceNotConfigured as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Attachment storage is not configured") from exc
    except AttachmentStorageError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return DownloadUrlResponse(**result)
