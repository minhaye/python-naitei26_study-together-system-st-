import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import GroupMemberRole, MemberStatus
from app.groups.entities.group import Group, GroupMember
from app.groups.dto.group import GroupCreate, GroupUpdate


class GroupsService:
    async def create(self, session: AsyncSession, data: GroupCreate) -> Group:
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

    async def get_by_id(self, session: AsyncSession, group_id: uuid.UUID) -> Group | None:
        return await session.get(Group, group_id)

    async def list_all(self, session: AsyncSession, skip: int = 0, limit: int = 50) -> list[Group]:
        result = await session.execute(select(Group).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def list_public(self, session: AsyncSession, skip: int = 0, limit: int = 50) -> list[Group]:
        result = await session.execute(select(Group).where(Group.is_public.is_(True)).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def update(self, session: AsyncSession, group: Group, data: GroupUpdate) -> Group:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(group, field, value)
        await session.flush()
        return group

    async def delete(self, session: AsyncSession, group: Group) -> None:
        await session.delete(group)
        await session.flush()

    # --- group_members ---
    async def add_member(
        self,
        session: AsyncSession,
        group_id: uuid.UUID,
        user_id: uuid.UUID,
        role: GroupMemberRole = GroupMemberRole.MEMBER,
        status: MemberStatus = MemberStatus.ACTIVE
    ) -> GroupMember:
        member = GroupMember(group_id=group_id, user_id=user_id, role=role, status=status)
        session.add(member)
        await session.flush()
        return member

    async def get_member(self, session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupMember | None:
        result = await session.execute(
            select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_members(self, session: AsyncSession, group_id: uuid.UUID) -> list[GroupMember]:
        result = await session.execute(select(GroupMember).where(GroupMember.group_id == group_id))
        return list(result.scalars().all())

    async def list_user_memberships(self, session: AsyncSession, user_id: uuid.UUID) -> list[GroupMember]:
        result = await session.execute(select(GroupMember).where(GroupMember.user_id == user_id))
        return list(result.scalars().all())

    async def update_member_role(self, session: AsyncSession, member: GroupMember, role: GroupMemberRole) -> GroupMember:
        member.role = role
        await session.flush()
        return member

    async def update_member_status(
        self, session: AsyncSession, member: GroupMember, status: MemberStatus
    ) -> GroupMember:
        member.status = status
        await session.flush()
        return member

    async def remove_member(self, session: AsyncSession, member: GroupMember) -> None:
        await session.delete(member)
        await session.flush()
