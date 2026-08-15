import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.conversations.dto.conversation_dto import (
    ConversationParticipant,
    ConversationResponse,
    DirectConversationCreate,
)
from app.conversations.entities.conversation_entity import Conversation
from app.conversations.services.conversation_service import ConversationsService
from app.db.session import get_db_session
from app.profiles.services.profile_service import ProfilesService

router = APIRouter(prefix="/conversations", tags=["Conversations"])
conversation_service = ConversationsService()
profiles_service = ProfilesService()


async def _to_response(
    session: AsyncSession, conversation: Conversation, current_user_id: uuid.UUID
) -> ConversationResponse:
    other_participant = None
    for member in await conversation_service.list_members(session, conversation.id):
        if member.user_id == current_user_id:
            continue
        profile = await profiles_service.get_by_id(session, member.user_id)
        if profile is not None:
            other_participant = ConversationParticipant.model_validate(profile)
        break
    return ConversationResponse(
        id=conversation.id,
        type=conversation.type,
        created_at=conversation.created_at,
        other_participant=other_participant,
    )


@router.post("/direct", response_model=ConversationResponse, status_code=status.HTTP_200_OK)
async def create_or_get_direct_conversation(
    data: DirectConversationCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Idempotent: returns the existing direct conversation for this pair if one already
    exists (regardless of who opened it first), otherwise creates it. Always 200, never 201
    -- the caller can't distinguish "created" from "already existed" from the response, by
    design, since both are the same steady-state resource."""
    if data.user_id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot start a direct conversation with yourself")

    target = await profiles_service.get_by_id(session, data.user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    try:
        conversation = await conversation_service.get_or_create_direct(session, current_user.id, data.user_id)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create direct conversation: {str(e)}",
        )

    return await _to_response(session, conversation, current_user.id)


@router.get("/direct", response_model=list[ConversationResponse])
async def list_direct_conversations(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    conversations = await conversation_service.list_direct_for_user(session, current_user.id)
    return [await _to_response(session, conversation, current_user.id) for conversation in conversations]
