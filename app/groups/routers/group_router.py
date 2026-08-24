import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.auth.dto.auth_dto import CurrentUser
from app.core.config import settings
from app.core.permissions import get_active_ban, is_active_group_member, is_group_manager, is_group_owner
from app.db.session import get_db_session
from app.db.enums import BanType, GroupMemberRole, MemberStatus
from app.groups.dto.group_dto import (
    GroupBackgroundConfirm,
    GroupCreate,
    GroupMemberCreate,
    GroupMemberResponse,
    GroupResponse,
    GroupUpdate,
)
from app.groups.entities.group_entity import Group
from app.groups.services.group_service import GroupsService
from app.moderation.services.moderation_service import ModerationService

router = APIRouter(prefix="/groups", tags=["Groups"])
service = GroupsService()
moderation_service = ModerationService()


@router.post("/", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    ban = await get_active_ban(session, current_user.id, BanType.CREATE_GROUP)
    if ban:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, moderation_service.format_ban_message(ban, "tạo nhóm học tập")
        )
    try:
        # The authenticated caller always becomes the owner; there is no client-supplied
        # owner_id to trust or ignore (see GroupCreate).
        group = await service.create(session, data, owner_id=current_user.id)
        await session.commit()
        return group
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create group: {str(e)}"
        )


@router.get("/", response_model=list[GroupResponse])
async def list_groups(
    public_only: bool = True,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
    session: AsyncSession = Depends(get_db_session)
):
    # Public discovery stays unauthenticated by design (documented decision, mirrors Study
    # Room's public GET /study-rooms). public_only=false is unrestricted read of all groups'
    # basic metadata; the actually-sensitive data (membership rosters) is gated separately
    # below, not here.
    if public_only:
        return await service.list_public(session, search=search, skip=skip, limit=limit)
    return await service.list_all(session, search=search, skip=skip, limit=limit)


@router.get("/mine", response_model=list[GroupResponse])
async def list_my_groups(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """"My Groups": every Group the caller currently has an ACTIVE membership in, public or
    private alike -- distinct from `public_only` discovery above, which is about
    discoverability, not membership. Registered before `/{group_id}` so the literal path
    "mine" is never captured as a group_id."""
    return await service.list_by_member(session, current_user.id)


@router.get("/me/memberships", response_model=list[GroupMemberResponse])
async def get_my_memberships(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Bulk fetch all active memberships for the caller. Avoids N+1 queries on the frontend."""
    return await service.list_user_memberships(session, current_user.id)


@router.get("/stats/member-counts", response_model=dict[uuid.UUID, int])
async def get_member_counts(session: AsyncSession = Depends(get_db_session)):
    """Bulk fetch active member counts for all groups. Avoids N+1 queries on the frontend."""
    return await service.get_all_active_member_counts(session)



@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    return group


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: uuid.UUID,
    data: GroupUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    if not is_group_owner(group, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group owner can update this group")
    try:
        updated = await service.update(session, group, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update group: {str(e)}"
        )


@router.post("/{group_id}/background", response_model=GroupResponse)
async def confirm_background_upload(
    group_id: uuid.UUID,
    data: GroupBackgroundConfirm,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Sets the group's background image after the frontend has already uploaded the file
    directly to the public `group-backgrounds` Storage bucket (mirrors
    POST /profiles/me/avatar). Owner OR active moderator may call this -- deliberately
    looser than update_group's owner-only PUT, since the background image is the one Group
    setting leader and mod are both meant to control."""
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    if not await is_group_manager(session, group_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the group owner or a moderator can change the background image"
        )
    prefix = f"groups/{group_id}/"
    if not data.path.startswith(prefix) or not data.path.endswith(".bg"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid background image reference")
    try:
        group.background_url = (
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/group-backgrounds/{data.path}"
        )
        await session.commit()
        return group
    except HTTPException:
        raise
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not save background image") from exc


@router.delete("/{group_id}/background", response_model=GroupResponse)
async def remove_background(
    group_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Clears the group's background image. Same owner-or-moderator authority as setting it."""
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    if not await is_group_manager(session, group_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the group owner or a moderator can change the background image"
        )
    try:
        group.background_url = None
        await session.commit()
        return group
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not remove background image") from exc


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    if not is_group_owner(group, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group owner can delete this group")
    try:
        await service.delete(session, group)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete group: {str(e)}"
        )


# --- Memberships ---


@router.post("/{group_id}/members", response_model=GroupMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: uuid.UUID,
    data: GroupMemberCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Two distinct cases, both driven by the authenticated caller:
    #   - self-join (target == caller, or no target given): allowed only for public groups.
    #     Private-group self-join is deliberately not implemented -- the spec leaves
    #     "invite code vs. approval" for private groups as an open product question.
    #   - manager-driven add of someone else: requires owner/moderator authority over
    #     this group. Not gated by is_public -- a manager may add members to a private
    #     group too (spec §42: only the *self-service* flow is unresolved for private groups).
    target_user_id = data.user_id if data.user_id is not None else current_user.id
    is_self_join = target_user_id == current_user.id

    if is_self_join:
        if not group.is_public:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This group is private; self-join is not supported")
        ban = await get_active_ban(session, current_user.id, BanType.JOIN_GROUP)
        if ban:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, moderation_service.format_ban_message(ban, "tham gia nhóm học tập")
            )
    elif not await is_group_manager(session, group_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the group owner or a moderator can add other members"
        )

    existing = await service.get_member(session, group_id, target_user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this group"
        )

    try:
        # Always joins as a plain active member -- never moderator/owner, even when a
        # manager adds someone else. Promote afterward via the owner-only role endpoint.
        member = await service.add_member(session, group_id, target_user_id)
        await session.commit()
        return member
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not add member: {str(e)}"
        )


@router.get("/{group_id}/members", response_model=list[GroupMemberResponse])
async def list_members(
    group_id: uuid.UUID,
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    await _require_member_list_access(session, group, current_user)
    return await service.list_members(session, group_id)


@router.get("/{group_id}/members/{user_id}", response_model=GroupMemberResponse)
async def get_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    await _require_member_list_access(session, group, current_user)
    member = await service.get_member(session, group_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    return member


async def _require_member_list_access(session: AsyncSession, group: Group, current_user: CurrentUser | None) -> None:
    """Public groups keep their membership roster readable by anyone (needed for public
    discovery, e.g. showing member counts before joining). Private groups restrict it to
    active members/the owner, per the requirement that private membership data must not
    leak to unauthorized callers."""
    if group.is_public:
        return
    if current_user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Missing bearer token", headers={"WWW-Authenticate": "Bearer"}
        )
    if is_group_owner(group, current_user.id):
        return
    if await is_active_group_member(session, group.id, current_user.id):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this group's members")


@router.put("/{group_id}/members/{user_id}/role", response_model=GroupMemberResponse)
async def update_member_role(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    role: GroupMemberRole,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    if not is_group_owner(group, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group owner can change member roles")
    if role == GroupMemberRole.OWNER:
        # Ownership transfer is out of scope for this task (spec §42 leaves it unresolved).
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ownership transfer is not supported")

    member = await service.get_member(session, group_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    if member.role == GroupMemberRole.OWNER:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot change the owner's role")

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


@router.put("/{group_id}/members/{user_id}/status", response_model=GroupMemberResponse)
async def update_member_status(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    member_status: MemberStatus,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    member = await service.get_member(session, group_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )

    is_self_leave = user_id == current_user.id and member_status == MemberStatus.LEFT
    if not is_self_leave and not is_group_owner(group, current_user.id):
        # Ban/reactivate/any status change on another member is deliberately owner-only
        # (conservative default -- spec §42 explicitly leaves moderator ban/kick powers
        # unresolved, so they are not granted here). Self-leave is always allowed.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the group owner can change another member's status"
        )

    try:
        updated = await service.update_member_status(session, member, member_status)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update member status: {str(e)}"
        )


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    member = await service.get_member(session, group_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    # Hard removal ("kick") is the conservative owner-only operation -- self-leave should
    # go through PUT .../status (status=left) instead, which preserves membership history
    # per the spec's recommendation.
    if not is_group_owner(group, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group owner can remove members")
    try:
        await service.remove_member(session, member)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not remove member: {str(e)}"
        )
