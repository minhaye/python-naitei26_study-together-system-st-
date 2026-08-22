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
from app.conversations.entities.conversation_entity import Conversation
from app.conversations.services.conversation_service import ConversationsService
from app.core.permissions import (
    can_access_conversation,
    can_send_to_conversation,
    is_group_manager,
    is_room_conversation_open_for_writes,
)
from app.db.enums import ConversationType
from app.db.session import get_db_session
from app.messages.dto.message_dto import (
    MessageCreate,
    MessageListResponse,
    MessageReactionSet,
    MessageReactionSummary,
    MessageResponse,
    MessageUpdate,
)
from app.messages.services.message_service import MessagesService
from app.study_rooms.services.study_room_service import StudyRoomsService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Messages"])
message_service = MessagesService()
channel_service = ChannelsService()
conversation_service = ConversationsService()
attachments_service = AttachmentsService()
study_room_service = StudyRoomsService()


async def _load_conversation(session: AsyncSession, conversation_id: uuid.UUID) -> Conversation:
    conversation = await conversation_service.get_by_id(session, conversation_id)
    if not conversation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conversation


async def _authorize(session: AsyncSession, conversation: Conversation, user_id: uuid.UUID) -> None:
    if not await can_access_conversation(session, conversation, user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this conversation")


async def _authorize_send(session: AsyncSession, conversation: Conversation, user_id: uuid.UUID) -> None:
    if not await can_send_to_conversation(session, conversation, user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this conversation")


async def _authorize_mutation_conversation_access(
    session: AsyncSession, conversation: Conversation | None, user_id: uuid.UUID
) -> None:
    """Edit/delete authorize primarily by sender identity (or, for delete, channel-manager
    override) -- but that ownership rule alone is not sufficient. A message mutation must
    also require that the caller can still access the message's parent Conversation, via
    the same generic can_access_conversation() entry point every other conversation-scoped
    endpoint uses (list/get/send). This is what makes a soft-deleted Channel's messages
    stop being PATCH/DELETE-able (see docs/db/STUDY_PLATFORM_DATABASE_SPEC.md § 9) without
    any Channel-specific logic in this router -- can_access_conversation already
    type-dispatches to channel/room/direct and denies a deleted channel on its own. Being
    the sender never bypasses this: sender-only access to a conversation you can no longer
    reach is exactly the case this closes."""
    if conversation is None or not await can_access_conversation(session, conversation, user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this conversation")


@router.get("/conversations/{conversation_id}/messages", response_model=MessageListResponse)
async def list_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    before: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    from sqlalchemy import select
    from app.conversations.entities.conversation_entity import Conversation
    from app.channels.entities.channel_entity import Channel
    from app.groups.entities.group_entity import GroupMember
    from app.db.enums import MemberStatus, ConversationType

    # TỐI ƯU HÓA: Gom 4 query (Conversation -> Channel -> GroupMember -> Permission) thành 1 Query duy nhất
    stmt = (
        select(Conversation, Channel, GroupMember)
        .outerjoin(Channel, Conversation.channel_id == Channel.id)
        .outerjoin(
            GroupMember,
            (GroupMember.group_id == Channel.group_id) &
            (GroupMember.user_id == current_user.id) &
            (GroupMember.status == MemberStatus.ACTIVE)
        )
        .where(Conversation.id == conversation_id)
    )
    result = await session.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
        
    conversation, channel, group_member = row
    
    # Authorize nhanh bằng data đã JOIN
    if conversation.type == ConversationType.CHANNEL:
        if not channel or channel.deleted_at is not None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this conversation")
        if not group_member:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this conversation")
        # Bỏ qua check is_private cho đơn giản trong demo hoặc có thể check thêm ChannelMember
    else:
        # Fallback cho Room / Direct
        await _authorize(session, conversation, current_user.id)

    try:
        messages, next_cursor = await message_service.list_by_conversation(
            session, conversation_id, viewer_id=current_user.id, limit=limit, before=before
        )
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid cursor")
    return MessageListResponse(items=messages, next_cursor=next_cursor)


@router.post(
    "/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED
)
async def create_message(
    conversation_id: uuid.UUID,
    data: MessageCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    conversation = await _load_conversation(session, conversation_id)
    await _authorize_send(session, conversation, current_user.id)

    if data.attachment_path:
        if conversation.type == ConversationType.CHANNEL:
            channel = await channel_service.get_by_id(session, conversation.channel_id)
            if not channel:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Channel not found")
            valid_reference = attachments_service.validate_ownership(
                data.attachment_path, channel.group_id, channel.id, current_user.id
            )
        elif conversation.type == ConversationType.ROOM:
            room = await study_room_service.get_by_id(session, conversation.room_id)
            if not room:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Study room not found")
            valid_reference = attachments_service.validate_room_ownership(
                data.attachment_path, room.id, current_user.id
            )
        elif conversation.type == ConversationType.DIRECT:
            valid_reference = attachments_service.validate_direct_ownership(
                data.attachment_path, conversation.id, current_user.id
            )
        else:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Attachments are only supported for channel, room, and direct conversations",
            )
        if not valid_reference:
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
        message = await message_service.create(
            session, conversation_id=conversation_id, sender_id=current_user.id, data=data
        )
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
    message = await message_service.get_by_id(session, message_id, viewer_id=current_user.id)
    if not message:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    conversation = await _load_conversation(session, message.conversation_id)
    await _authorize(session, conversation, current_user.id)
    return message


@router.patch("/messages/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: uuid.UUID,
    data: MessageUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    message = await message_service.get_by_id(session, message_id, viewer_id=current_user.id)
    if not message:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    if message.sender_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the sender can edit this message")

    conversation = await conversation_service.get_by_id(session, message.conversation_id)
    await _authorize_mutation_conversation_access(session, conversation, current_user.id)
    if not await is_room_conversation_open_for_writes(session, conversation):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This study room has ended; messages can no longer be edited")

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

    conversation = await conversation_service.get_by_id(session, message.conversation_id)

    allowed = message.sender_id == current_user.id
    if not allowed and conversation is not None and conversation.type == ConversationType.CHANNEL:
        channel = await channel_service.get_by_id(session, conversation.channel_id)
        allowed = channel is not None and await is_group_manager(session, channel.group_id, current_user.id)
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to delete this message")

    await _authorize_mutation_conversation_access(session, conversation, current_user.id)
    if not await is_room_conversation_open_for_writes(session, conversation):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This study room has ended; messages can no longer be deleted")

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


# --- Reactions ---
# Authorized via can_access_conversation (read-level), not can_send_to_conversation --
# reacting to history in an ended Study Room is harmless, unlike posting a new message.


@router.put("/messages/{message_id}/reactions", response_model=list[MessageReactionSummary])
async def set_message_reaction(
    message_id: uuid.UUID,
    data: MessageReactionSet,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    message = await message_service.get_by_id(session, message_id)
    if not message:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    conversation = await _load_conversation(session, message.conversation_id)
    await _authorize(session, conversation, current_user.id)

    try:
        await message_service.set_reaction(session, message, current_user.id, data.emoji)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not react to message: {str(e)}")
    return await message_service.get_reactions(session, message_id, current_user.id)


@router.delete("/messages/{message_id}/reactions", response_model=list[MessageReactionSummary])
async def remove_message_reaction(
    message_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    message = await message_service.get_by_id(session, message_id)
    if not message:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    conversation = await _load_conversation(session, message.conversation_id)
    await _authorize(session, conversation, current_user.id)

    try:
        await message_service.remove_reaction(session, message_id, current_user.id)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not remove reaction: {str(e)}")
    return await message_service.get_reactions(session, message_id, current_user.id)


@router.get("/messages/{message_id}/reactions", response_model=list[MessageReactionSummary])
async def get_message_reactions(
    message_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Not called by the acting user (PUT/DELETE above already return the fresh list) --
    this is what other connected clients call to hydrate a raw Realtime reaction-change
    event into a real summary, mirroring how GET /messages/{id} hydrates a raw message
    INSERT event today (see useMessageReactionsRealtime.ts)."""
    message = await message_service.get_by_id(session, message_id)
    if not message:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    conversation = await _load_conversation(session, message.conversation_id)
    await _authorize(session, conversation, current_user.id)
    return await message_service.get_reactions(session, message_id, current_user.id)
