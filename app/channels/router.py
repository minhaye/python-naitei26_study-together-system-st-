import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.channels.dto.channel import (
    ChannelCreate,
    ChannelMemberCreate,
    ChannelMemberResponse,
    ChannelResponse,
    ChannelUpdate,
)
from app.channels.service import ChannelsService

router = APIRouter(prefix="/channels", tags=["Channels"])
service = ChannelsService()


@router.post("/", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(data: ChannelCreate, session: AsyncSession = Depends(get_db_session)):
    try:
        channel = await service.create(session, data)
        await session.commit()
        return channel
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create channel: {str(e)}"
        )


@router.get("/", response_model=list[ChannelResponse])
async def list_channels(
    group_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_db_session)
):
    if not group_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="group_id query parameter is required"
        )
    return await service.list_by_group(session, group_id)


@router.get("/{channel_id}", response_model=ChannelResponse)
async def get_channel(channel_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    channel = await service.get_by_id(session, channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    return channel


@router.put("/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: uuid.UUID,
    data: ChannelUpdate,
    session: AsyncSession = Depends(get_db_session)
):
    channel = await service.get_by_id(session, channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    try:
        updated = await service.update(session, channel, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update channel: {str(e)}"
        )


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(channel_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    channel = await service.get_by_id(session, channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    try:
        await service.delete(session, channel)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete channel: {str(e)}"
        )


# --- Channel Memberships ---


@router.post("/{channel_id}/members", response_model=ChannelMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    channel_id: uuid.UUID,
    data: ChannelMemberCreate,
    session: AsyncSession = Depends(get_db_session)
):
    # Ensure channel exists
    channel = await service.get_by_id(session, channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )

    # Check if already a member
    existing = await service.get_member(session, channel_id, data.user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this channel"
        )

    try:
        member = await service.add_member(session, channel_id, data.user_id)
        await session.commit()
        return member
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not add member: {str(e)}"
        )


@router.get("/{channel_id}/members", response_model=list[ChannelMemberResponse])
async def list_members(channel_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    channel = await service.get_by_id(session, channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    return await service.list_members(session, channel_id)


@router.get("/{channel_id}/members/{user_id}", response_model=ChannelMemberResponse)
async def get_member(channel_id: uuid.UUID, user_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    member = await service.get_member(session, channel_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel membership not found"
        )
    return member


@router.delete("/{channel_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    channel_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session)
):
    member = await service.get_member(session, channel_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel membership not found"
        )
    try:
        await service.remove_member(session, member)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not remove member: {str(e)}"
        )
