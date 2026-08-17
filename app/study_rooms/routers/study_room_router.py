import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.core.config import settings
from app.core.permissions import (
    can_access_room,
    can_join_room,
    can_join_room_meeting,
    can_manage_room,
    is_active_group_member,
    is_room_host,
)
from app.db.session import get_db_session
from app.db.enums import ModerationAction, StudyRoomMemberRole
from app.groups.services.group_service import GroupsService
from app.meetings.dto.meeting_dto import MeetingTokenResponse
from app.meetings.services.livekit_service import LiveKitService
from app.profiles.services.profile_service import ProfilesService
from app.study_rooms.dto.study_room_dto import (
    RoomModerationActionCreate,
    RoomModerationActionResponse,
    StudyRoomCreate,
    StudyRoomMemberResponse,
    StudyRoomResponse,
    StudyRoomUpdate,
)
from app.study_rooms.services.study_room_service import StudyRoomsService

router = APIRouter(prefix="/study-rooms", tags=["Study Rooms"])
service = StudyRoomsService()
groups_service = GroupsService()
profiles_service = ProfilesService()
livekit_service = LiveKitService()

_SELF_SERVICE_MODERATION_ACTIONS = {ModerationAction.RAISE_HAND, ModerationAction.LOWER_HAND}


@router.post("/", response_model=StudyRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    data: StudyRoomCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    group = await groups_service.get_by_id(session, data.group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    # STUDY_PLATFORM_DATABASE_SPEC.md §16: "a normal Member can still create a Study
    # Room and become its Host" -- any active member (not just owner/moderator) may
    # create a room, but non-members must not be able to create rooms under a group
    # they don't belong to at all.
    if not await is_active_group_member(session, data.group_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only an active member of this group can create a study room here"
        )
    try:
        # The authenticated caller always becomes the host; there is no client-supplied
        # host_id to trust or ignore (see StudyRoomCreate).
        room = await service.create(session, data, host_id=current_user.id)
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
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    if not is_room_host(room, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the host can update this study room")
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
async def start_room(
    room_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    if not is_room_host(room, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the host can start this study room")
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
async def end_room(
    room_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    if not is_room_host(room, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the host can end this study room")
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
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    if not can_join_room(room):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This study room has ended")

    # Check existing membership. The joining identity is always the caller --
    # never a client-supplied user_id -- and the role is always PARTICIPANT;
    # self-assigning HOST/MODERATOR via this endpoint is not permitted.
    member = await service.get_member(session, room_id, current_user.id)
    try:
        if member:
            updated = await service.rejoin(session, member)
        else:
            updated = await service.join(session, room_id, current_user.id)
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
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    member = await service.get_member(session, room_id, current_user.id)
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
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    if not await can_access_room(session, room, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this study room")
    if active_only:
        return await service.list_active_members(session, room_id)
    return await service.list_members(session, room_id)


@router.put("/{room_id}/members/{user_id}/role", response_model=StudyRoomMemberResponse)
async def update_member_role(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    role: StudyRoomMemberRole,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    if not is_room_host(room, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the host can change member roles")
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
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )

    # The acting moderator is always the authenticated caller -- data.moderator_id
    # is client-supplied and never trusted, even though it stays in the DTO for
    # compatibility.
    data = data.model_copy(update={"moderator_id": current_user.id, "room_id": room_id})

    if data.action in _SELF_SERVICE_MODERATION_ACTIONS:
        # RAISE_HAND/LOWER_HAND are self-service only: a member may not raise or
        # lower another participant's hand.
        if data.target_user_id != current_user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only raise or lower your own hand")
        if not await can_access_room(session, room, current_user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this study room")
    else:
        # KICK/MUTE/UNMUTE require host/moderator authority over this specific room.
        if not await can_manage_room(session, room, current_user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to moderate this study room")
        target_member = await service.get_member(session, room_id, data.target_user_id)
        if target_member is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Target is not a member of this study room")
        # Host protection: a moderator (non-host) must not be able to act on the host.
        if target_member.role == StudyRoomMemberRole.HOST and not is_room_host(room, current_user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Moderators cannot take this action against the host")

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
async def list_moderation(
    room_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    if not await can_access_room(session, room, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this study room")
    return await service.list_moderation_actions(session, room_id)


# --- Meeting (LiveKit) ---


@router.post("/{room_id}/meeting/token", response_model=MeetingTokenResponse)
async def create_meeting_token(
    room_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    room = await service.get_by_id(session, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study room not found"
        )
    if not await can_join_room_meeting(session, room, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this study room"
        )

    profile = await profiles_service.get_by_id(session, current_user.id)
    participant_name = profile.display_name if profile and profile.display_name else None

    token = livekit_service.create_participant_token(
        room_id=room.id, identity=current_user.id, name=participant_name
    )
    return MeetingTokenResponse(server_url=settings.livekit_url, participant_token=token)
