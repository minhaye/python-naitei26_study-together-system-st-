import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import GroupMemberRole, MemberStatus
from app.models.group import Group, GroupMember
from app.schemas.group import GroupCreate, GroupUpdate


async def create_group(session: AsyncSession, data: GroupCreate) -> Group:
    """Creates the group and its owner membership row together.

    groups.owner_id and a group_members(role=owner) row represent the same
    ownership fact in two places; the database has no trigger keeping them in
    sync, so both inserts must happen in this one unit of work (see docs/STUDY_PLATFORM_DATABASE_SPEC.md #8).
    """
    group = Group(**data.model_dump())
    session.add(group)
    await session.flush()

    owner_membership = GroupMember(
        group_id=group.id,
        user_id=data.owner_id,
        role=GroupMemberRole.OWNER,
        status=MemberStatus.ACTIVE,
    )
    session.add(owner_membership)
    await session.flush()
    return group


async def get_group(session: AsyncSession, group_id: uuid.UUID) -> Group | None:
    return await session.get(Group, group_id)


async def list_groups(session: AsyncSession, skip: int = 0, limit: int = 50) -> list[Group]:
    result = await session.execute(select(Group).offset(skip).limit(limit))
    return list(result.scalars().all())


async def list_public_groups(session: AsyncSession, skip: int = 0, limit: int = 50) -> list[Group]:
    result = await session.execute(select(Group).where(Group.is_public.is_(True)).offset(skip).limit(limit))
    return list(result.scalars().all())


async def update_group(session: AsyncSession, group: Group, data: GroupUpdate) -> Group:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    await session.flush()
    return group


async def delete_group(session: AsyncSession, group: Group) -> None:
    await session.delete(group)
    await session.flush()


# --- group_members: junction table, so membership add/remove/list rather than generic CRUD ---


async def add_group_member(session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID,
                            role: GroupMemberRole = GroupMemberRole.MEMBER,
                            status: MemberStatus = MemberStatus.ACTIVE) -> GroupMember:
    member = GroupMember(group_id=group_id, user_id=user_id, role=role, status=status)
    session.add(member)
    await session.flush()
    return member


async def get_group_member(session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupMember | None:
    result = await session.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def list_group_members(session: AsyncSession, group_id: uuid.UUID) -> list[GroupMember]:
    result = await session.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    return list(result.scalars().all())


async def list_user_memberships(session: AsyncSession, user_id: uuid.UUID) -> list[GroupMember]:
    result = await session.execute(select(GroupMember).where(GroupMember.user_id == user_id))
    return list(result.scalars().all())


async def update_group_member_role(session: AsyncSession, member: GroupMember, role: GroupMemberRole) -> GroupMember:
    member.role = role
    await session.flush()
    return member


async def update_group_member_status(
    session: AsyncSession, member: GroupMember, status: MemberStatus
) -> GroupMember:
    # Docs recommend updating status (e.g. to "left") over deleting, to keep membership history.
    member.status = status
    await session.flush()
    return member


async def remove_group_member(session: AsyncSession, member: GroupMember) -> None:
    await session.delete(member)
    await session.flush()
