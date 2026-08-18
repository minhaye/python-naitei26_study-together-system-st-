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
    is_group_manager,
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
from app.study_rooms.entities.study_room_entity import StudyRoom
from app.study_rooms.services.study_room_service import StudyRoomsService

router = APIRouter(prefix="/study-rooms", tags=["Study Rooms"])
service = StudyRoomsService()
groups_service = GroupsService()
profiles_service = ProfilesService()
livekit_service = LiveKitService()

_SELF_SERVICE_MODERATION_ACTIONS = {ModerationAction.RAISE_HAND, ModerationAction.LOWER_HAND}


async def _get_active_room_or_404(session: AsyncSession, room_id: uuid.UUID) -> StudyRoom:
    """Shared "not found or soft-deleted" gate: a deleted room must behave as if it no longer
    exists for every normal read/write entry point (get, update, start, end, join, leave,
    members, role changes, moderation, meeting token, and delete itself) -- see
    STUDY_PLATFORM_DATABASE_SPEC.md §16. Deleting an already-deleted room therefore also 404s
    here, same as deleting a missing one -- there is no distinct "already deleted" status, by
    design (mirrors channel_router._get_active_channel_or_404)."""
    room = await service.get_by_id(session, room_id)
    if room is None or room.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Study room not found")
    return room


@router.post("/", response_model=StudyRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    data: StudyRoomCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    group = await groups_service.get_by_id(session, data.group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    # Product rule (2026-08-18): only an active group owner or moderator may create a
    # Study Room -- a plain Member must not (supersedes the old STUDY_PLATFORM_DATABASE_SPEC.md
    # §16 behavior, which let any active member create a room).
    if not await is_group_manager(session, data.group_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only an active group owner or moderator can create a study room here"
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
    room = await _get_active_room_or_404(session, room_id)
    return room


@router.put("/{room_id}", response_model=StudyRoomResponse)
async def update_room(
    room_id: uuid.UUID,
    data: StudyRoomUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    room = await _get_active_room_or_404(session, room_id)
    # Management authority derives from the actor's CURRENT Group role, never from a stale
    # room.host_id snapshot -- see can_manage_room's docstring.
    if not await is_group_manager(session, room.group_id, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an active group owner or moderator can update this study room")
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
    room = await _get_active_room_or_404(session, room_id)
    if not await is_group_manager(session, room.group_id, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an active group owner or moderator can start this study room")
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
    room = await _get_active_room_or_404(session, room_id)
    if not await is_group_manager(session, room.group_id, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an active group owner or moderator can end this study room")
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


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    room_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Soft delete: the StudyRoom row, its Conversation, all historical Messages,
    StudyRoomMembers, and RoomModerationActions remain in the database (see
    docs/db/migrations/010_soft_delete_study_rooms.sql). An already-deleted or missing room
    both 404 via _get_active_room_or_404 -- a deleted room is not re-deletable/re-authorizable
    through this endpoint. Authorized actors: an active group owner/moderator of the room's
    group (mirrors ChannelsService's group-manager delete authority) -- an ordinary member, a
    non-member, or a banned/left group manager (is_group_manager already requires
    MemberStatus.ACTIVE) may not delete. Being the room's host_id is NOT sufficient on its own
    (2026-08-18 policy change) -- see can_manage_room's docstring."""
    room = await _get_active_room_or_404(session, room_id)
    if not await is_group_manager(session, room.group_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only an active group owner or moderator can delete this study room"
        )
    try:
        # deleted_by always comes from the authenticated caller, never a client-supplied
        # value -- there is no such field on this endpoint's request at all.
        await service.soft_delete(session, room, deleted_by=current_user.id)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete study room: {str(e)}"
        )


# --- Memberships ---


@router.post("/{room_id}/join", response_model=StudyRoomMemberResponse)
async def join_room(
    room_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    room = await _get_active_room_or_404(session, room_id)
    if not can_join_room(room):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This study room has ended")
    # Deliberately NOT can_access_room() here -- that also requires an active Room membership,
    # which a first-time joiner doesn't have yet (chicken-and-egg). Join's own prerequisite is
    # just current active Group membership (2026-08-18 parity fix, mirrors the same check
    # can_access_room applies for ongoing participation) -- a left/banned/inactive Group member
    # must not be able to join or rejoin a room under that group.
    if not await is_active_group_member(session, room.group_id, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an active group member can join this study room")

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
    # A deleted room must behave as if it no longer exists here too -- the soft-delete
    # invariant (deleted_at set -> normal operations stop) applies to leave just like every
    # other mutation, even though leaving only touches the caller's own membership row.
    # Ended-but-not-deleted rooms are deliberately unaffected: no lifecycle gate has ever
    # applied to leave, only to join (can_join_room) and to messages
    # (is_room_conversation_open_for_writes).
    await _get_active_room_or_404(session, room_id)
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
    room = await _get_active_room_or_404(session, room_id)
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
    room = await _get_active_room_or_404(session, room_id)
    if not await is_group_manager(session, room.group_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only an active group owner or moderator can change member roles"
        )
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
    room = await _get_active_room_or_404(session, room_id)

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
        # KICK/MUTE/UNMUTE require the actor to be an active group owner/moderator of this
        # room's group (can_manage_room) -- no separate "host protection" carve-out for the
        # target: once the actor is confirmed to be a current group manager, they have full
        # authority over every member of the room, including whoever holds the HOST role
        # (2026-08-18 policy change -- the old carve-out only made sense when room-scoped
        # moderators, not just group managers, could reach this branch).
        if not await can_manage_room(session, room, current_user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to moderate this study room")
        target_member = await service.get_member(session, room_id, data.target_user_id)
        if target_member is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Target is not a member of this study room")

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
    room = await _get_active_room_or_404(session, room_id)
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
    room = await _get_active_room_or_404(session, room_id)
    if not await can_join_room_meeting(session, room, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this study room"
        )

    # Canonical display-name fallback hierarchy (display_name -> username -> None, never a
    # raw id/email) -- LiveKit's own SDK-level fallback (bare `identity`, a UUID) only
    # applies if this is None too; see MeetingVideoGrid.tsx for the final generic-label step.
    profile = await profiles_service.get_by_id(session, current_user.id)
    participant_name = (profile.display_name or profile.username) if profile else None

    token = livekit_service.create_participant_token(
        room_id=room.id, identity=current_user.id, name=participant_name
    )
    return MeetingTokenResponse(server_url=settings.livekit_url, participant_token=token)
