import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.auth.dto.auth_dto import CurrentUser
from app.core.permissions import can_access_channel, is_group_manager
from app.db.session import get_db_session
from app.channels.dto.channel_dto import (
    ChannelCreate,
    ChannelMemberCreate,
    ChannelMemberResponse,
    ChannelResponse,
    ChannelUpdate,
)
from app.channels.entities.channel_entity import Channel
from app.channels.services.channel_service import ChannelsService
from app.groups.services.group_service import GroupsService

router = APIRouter(prefix="/channels", tags=["Channels"])
service = ChannelsService()
groups_service = GroupsService()


@router.post("/", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(
    data: ChannelCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new channel within a group. Only the group owner or a moderator may create channels."""
    group = await groups_service.get_by_id(session, data.group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    if not await is_group_manager(session, data.group_id, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group owner or a moderator can create channels")
    try:
        # Acting identity always comes from the authenticated caller, never data.created_by
        # (that field no longer exists on ChannelCreate at all).
        channel = await service.create(session, data, created_by=current_user.id)
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
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    """List channels for a group. Public endpoint; private channels are only included for callers who can access them."""
    if not group_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="group_id query parameter is required"
        )
    # Left public/unauthenticated (existing behavior, matches the already-shipped Group
    # Detail frontend which browses a public group's channel list before joining). Only
    # Private Channels are gated below, via the same `can_access_channel` helper used for
    # direct access -- a caller who cannot access a Private Channel must not even see its
    # metadata/name in this listing (reuses the existing authorization model rather than
    # inventing a separate one; also covers a stale channel_members row after the caller
    # lost active Group membership, since can_access_channel re-checks that first).
    channels = await service.list_by_group(session, group_id)
    if current_user is None:
        return [channel for channel in channels if not channel.is_private]
    return [
        channel for channel in channels
        if not channel.is_private or await can_access_channel(session, channel, current_user.id)
    ]


async def _get_active_channel_or_404(session: AsyncSession, channel_id: uuid.UUID) -> Channel:
    """Shared "not found or soft-deleted" gate: a deleted channel must behave as if it no
    longer exists for every normal read/write entry point (get, update, delete, and all
    channel_members endpoints) -- see docs/db/STUDY_PLATFORM_DATABASE_SPEC.md § 9. Deleting
    an already-deleted channel therefore also 404s here, same as deleting a missing one --
    there is no distinct "already deleted" status, by design."""
    channel = await service.get_by_id(session, channel_id)
    if channel is None or channel.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Channel not found")
    return channel


@router.get("/{channel_id}", response_model=ChannelResponse)
async def get_channel(
    channel_id: uuid.UUID,
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    """Public channels stay open/unauthenticated (matches list_channels). Private channels
    must not expose their metadata by direct ID lookup any more than they do through the
    list endpoint -- gated by the same `can_access_channel` helper used there, so a stale
    channel_members row or lost Group membership is denied the same way in both places."""
    channel = await _get_active_channel_or_404(session, channel_id)
    if channel.is_private:
        if current_user is None:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "Missing bearer token", headers={"WWW-Authenticate": "Bearer"}
            )
        if not await can_access_channel(session, channel, current_user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this channel")
    return channel


@router.put("/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: uuid.UUID,
    data: ChannelUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Update a channel's details. Only the group owner or a moderator of the channel's group may perform this action."""
    channel = await _get_active_channel_or_404(session, channel_id)
    # Authorization follows the channel's *actual stored* group_id, never a client-supplied
    # one -- ChannelUpdate has no group_id field, so there is no bypass surface here.
    if not await is_group_manager(session, channel.group_id, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group owner or a moderator can update this channel")
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
async def delete_channel(
    channel_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Soft delete: the Channel row, its Conversation, and all historical Messages remain in
    the database (see docs/db/migrations/009_soft_delete_channels.sql). An already-deleted
    or missing channel both 404 via _get_active_channel_or_404 -- a deleted channel is not
    re-deletable/re-authorizable through this endpoint."""
    channel = await _get_active_channel_or_404(session, channel_id)
    if not await is_group_manager(session, channel.group_id, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group owner or a moderator can delete this channel")
    try:
        # deleted_by always comes from the authenticated caller, never a client-supplied
        # value -- there is no such field on this endpoint's request at all.
        await service.soft_delete(session, channel, deleted_by=current_user.id)
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
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Add a member to a channel. Only the group owner or a moderator of the channel's group may manage channel membership."""
    channel = await _get_active_channel_or_404(session, channel_id)
    # No self-join case for channels (unlike groups) -- managing (typically private)
    # channel membership always requires group manager authority over channel.group_id.
    if not await is_group_manager(session, channel.group_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the group owner or a moderator can manage channel membership"
        )

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
async def list_members(
    channel_id: uuid.UUID,
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    """List the members of a channel. Public channel rosters are open; private channel rosters require membership or group-manager authority."""
    channel = await _get_active_channel_or_404(session, channel_id)
    await _require_channel_member_access(session, channel, current_user)
    return await service.list_members(session, channel_id)


@router.get("/{channel_id}/members/{user_id}", response_model=ChannelMemberResponse)
async def get_member(
    channel_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    """Get a single channel membership. Public channel rosters are open; private channel rosters require membership or group-manager authority."""
    channel = await _get_active_channel_or_404(session, channel_id)
    await _require_channel_member_access(session, channel, current_user)
    member = await service.get_member(session, channel_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel membership not found"
        )
    return member


async def _require_channel_member_access(
    session: AsyncSession, channel: Channel, current_user: CurrentUser | None
) -> None:
    """Public-channel rosters stay open (matches the public group-membership policy).
    Private-channel rosters require the caller to already be a channel member or hold
    group-manager authority (the latter so a channel's own creator/manager can see its
    roster even if they were never explicitly added as a channel_members row)."""
    if not channel.is_private:
        return
    if current_user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Missing bearer token", headers={"WWW-Authenticate": "Bearer"}
        )
    if await is_group_manager(session, channel.group_id, current_user.id):
        return
    member = await service.get_member(session, channel.id, current_user.id)
    if member is not None:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this channel's members")


@router.delete("/{channel_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    channel_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Remove a member from a channel. A user may remove themselves; removing another member requires group owner or moderator authority."""
    channel = await _get_active_channel_or_404(session, channel_id)
    member = await service.get_member(session, channel_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel membership not found"
        )
    # Self-leave is always allowed; removing someone else requires group manager authority.
    is_self = user_id == current_user.id
    if not is_self and not await is_group_manager(session, channel.group_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the group owner or a moderator can remove other channel members"
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
