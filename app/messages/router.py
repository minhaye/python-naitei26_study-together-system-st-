import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.messages.dto.message import MessageCreate, MessageResponse, MessageUpdate
from app.messages.service import MessagesService

router = APIRouter(prefix="/messages", tags=["Messages"])
service = MessagesService()


@router.post("/", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(data: MessageCreate, session: AsyncSession = Depends(get_db_session)):
    try:
        message = await service.create(session, data)
        await session.commit()
        return message
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create message: {str(e)}"
        )


@router.get("/", response_model=list[MessageResponse])
async def list_messages(
    channel_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    session: AsyncSession = Depends(get_db_session)
):
    return await service.list_by_channel(session, channel_id, skip=skip, limit=limit)


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(message_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    message = await service.get_by_id(session, message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    return message


@router.put("/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: uuid.UUID,
    data: MessageUpdate,
    session: AsyncSession = Depends(get_db_session)
):
    message = await service.get_by_id(session, message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    try:
        updated = await service.update(session, message, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update message: {str(e)}"
        )


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(message_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    message = await service.get_by_id(session, message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    try:
        await service.delete(session, message)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete message: {str(e)}"
        )
