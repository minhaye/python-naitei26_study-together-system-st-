import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.db.enums import GroupMemberRole, MemberStatus
from app.groups.dto.group_dto import (
    GroupCreate,
    GroupMemberCreate,
    GroupMemberResponse,
    GroupResponse,
    GroupUpdate,
)
from app.groups.services.group_service import GroupsService

router = APIRouter(prefix="/groups", tags=["Groups"])
service = GroupsService()


@router.post("/", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(data: GroupCreate, session: AsyncSession = Depends(get_db_session)):
    try:
        group = await service.create(session, data)
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
    skip: int = 0,
    limit: int = 50,
    session: AsyncSession = Depends(get_db_session)
):
    if public_only:
        return await service.list_public(session, skip=skip, limit=limit)
    return await service.list_all(session, skip=skip, limit=limit)


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
    session: AsyncSession = Depends(get_db_session)
):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
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


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(group_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
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
    session: AsyncSession = Depends(get_db_session)
):
    # Ensure group exists
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Check if already a member
    existing = await service.get_member(session, group_id, data.user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this group"
        )

    try:
        member = await service.add_member(
            session, group_id, data.user_id, role=data.role, status=data.status
        )
        await session.commit()
        return member
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not add member: {str(e)}"
        )


@router.get("/{group_id}/members", response_model=list[GroupMemberResponse])
async def list_members(group_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    # Ensure group exists
    group = await service.get_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    return await service.list_members(session, group_id)


@router.get("/{group_id}/members/{user_id}", response_model=GroupMemberResponse)
async def get_member(group_id: uuid.UUID, user_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    member = await service.get_member(session, group_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    return member


@router.put("/{group_id}/members/{user_id}/role", response_model=GroupMemberResponse)
async def update_member_role(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    role: GroupMemberRole,
    session: AsyncSession = Depends(get_db_session)
):
    member = await service.get_member(session, group_id, user_id)
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


@router.put("/{group_id}/members/{user_id}/status", response_model=GroupMemberResponse)
async def update_member_status(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    member_status: MemberStatus,
    session: AsyncSession = Depends(get_db_session)
):
    member = await service.get_member(session, group_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
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
    session: AsyncSession = Depends(get_db_session)
):
    member = await service.get_member(session, group_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
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
