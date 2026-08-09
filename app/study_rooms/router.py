import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.db.enums import StudyRoomMemberRole
from app.study_rooms.dto.study_room import (
    RoomModerationActionCreate,
    RoomModerationActionResponse,
    StudyRoomCreate,
    StudyRoomMemberResponse,
    StudyRoomResponse,
    StudyRoomUpdate,
)
from app.study_rooms.service import StudyRoomsService

router = APIRouter(prefix="/study-rooms", tags=["Study Rooms"])
service = StudyRoomsService()


@router.post("/", response_model=StudyRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(data: StudyRoomCreate, session: AsyncSession = Depends(get_db_session)):
    try:
        room = await service.create(session, data)
        await session.commit()
        return room
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create study room: {str(e)}"
        )


@router.get("/", response_model=list[StudyRoomResponse])
async def list_rooms(group_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    return await service.list_by_group(session, group_id)


@router.get("/{room_id}", response_model=StudyRoomResponse)
async def get_room(room_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    return room


@router.put("/{room_id}", response_model=StudyRoomResponse)
async def update_room(
    room_id: uuid.UUID,
    data: StudyRoomUpdate,
    session: AsyncSession = Depends(get_db_session)
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    try:
        updated = await service.update(session, room, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update study room: {str(e)}"
        )


@router.post("/{room_id}/start", response_model=StudyRoomResponse)
async def start_room(room_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    try:
        updated = await service.start(session, room)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not start study room: {str(e)}"
        )


@router.post("/{room_id}/end", response_model=StudyRoomResponse)
async def end_room(room_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    try:
        updated = await service.end(session, room)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not end study room: {str(e)}"
        )


# --- Memberships ---


@router.post("/{room_id}/join", response_model=StudyRoomMemberResponse)
async def join_room(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    role: StudyRoomMemberRole = StudyRoomMemberRole.PARTICIPANT,
    session: AsyncSession = Depends(get_db_session)
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )

    # Check existing membership
    member = await service.get_member(session, room_id, user_id)
    try:
        if member:
            updated = await service.rejoin(session, member)
        else:
            updated = await service.join(session, room_id, user_id, role=role)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not join study room: {str(e)}"
        )


@router.post("/{room_id}/leave", response_model=StudyRoomMemberResponse)
async def leave_room(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session)
):
    member = await service.get_member(session, room_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    try:
        updated = await service.leave(session, member)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not leave study room: {str(e)}"
        )


@router.get("/{room_id}/members", response_model=list[StudyRoomMemberResponse])
async def list_members(
    room_id: uuid.UUID,
    active_only: bool = False,
    session: AsyncSession = Depends(get_db_session)
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    if active_only:
        return await service.list_active_members(session, room_id)
    return await service.list_members(session, room_id)


@router.put("/{room_id}/members/{user_id}/role", response_model=StudyRoomMemberResponse)
async def update_member_role(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    role: StudyRoomMemberRole,
    session: AsyncSession = Depends(get_db_session)
):
    member = await service.get_member(session, room_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    try:
        updated = await service.update_member_role(session, member, role)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update member role: {str(e)}"
        )


# --- Moderation ---


@router.post("/{room_id}/moderation", response_model=RoomModerationActionResponse)
async def log_moderation(
    room_id: uuid.UUID,
    data: RoomModerationActionCreate,
    session: AsyncSession = Depends(get_db_session)
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    try:
        action = await service.log_moderation_action(session, data)
        await session.commit()
        return action
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not log moderation action: {str(e)}"
        )


@router.get("/{room_id}/moderation", response_model=list[RoomModerationActionResponse])
async def list_moderation(room_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    return await service.list_moderation_actions(session, room_id)
