import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import GroupMemberRole, MemberStatus
from app.groups.entities.group_entity import Group, GroupMember
from app.groups.dto.group_dto import GroupCreate, GroupUpdate


class GroupsService:
    async def create(self, session: AsyncSession, data: GroupCreate, owner_id: uuid.UUID) -> Group:
        """`owner_id` is the authenticated caller, passed explicitly by the router --
        never trust a client-supplied owner id as the group owner.

        Deliberately does NOT insert the owner's `group_members` row here. The live DB
        trigger `groups_add_owner` (AFTER INSERT ON groups -> add_group_owner(), a
        SECURITY DEFINER function using `INSERT ... ON CONFLICT (group_id, user_id) DO
        UPDATE`) already does this unconditionally for every row inserted into `groups`,
        regardless of code path. Inserting it again here raced that trigger within the
        same transaction: the trigger's insert lands first (fired synchronously by the
        `groups` INSERT/flush below), and this method's own plain `session.add` of a
        second GroupMember for the same (group_id, owner_id) then violated the
        group_members_group_id_user_id_key unique constraint. The trigger is the single
        source of truth for this invariant; do not duplicate it in application code."""
        group = Group(**data.model_dump(), owner_id=owner_id)
        session.add(group)
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
    async def add_member(self, session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupMember:
        """Always creates a plain active member -- role/status escalation only happens
        through the dedicated, separately-authorized endpoints (never at add-time)."""
        member = GroupMember(
            group_id=group_id, user_id=user_id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE
        )
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

    async def reactivate_member(self, session: AsyncSession, member: GroupMember) -> GroupMember:
        """Flips a `left` membership back to `active` (mirrors StudyRoomsService.rejoin --
        study_room_members has no reactivate/rejoin equivalent method name, but the same
        shape: reuse the existing row instead of inserting a duplicate). Used by invitation
        redemption only; the manual add_member endpoint still 400s on any existing row
        (pre-existing, unrelated behavior -- not changed here)."""
        member.status = MemberStatus.ACTIVE
        await session.flush()
        return member

    async def remove_member(self, session: AsyncSession, member: GroupMember) -> None:
        await session.delete(member)
        await session.flush()
