import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import GroupMemberRole, MemberStatus
from app.groups.entities.group_entity import Group, GroupMember
from app.groups.dto.group_dto import GroupCreate, GroupUpdate
from app.profiles.services.profile_service import ProfilesService

profiles_service = ProfilesService()


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
        result = await session.execute(
            select(Group).options(selectinload(Group.streak)).where(Group.id == group_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self, session: AsyncSession, skip: int = 0, limit: int = 50) -> list[Group]:
        result = await session.execute(select(Group).options(selectinload(Group.streak)).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def list_public(self, session: AsyncSession, skip: int = 0, limit: int = 50) -> list[Group]:
        result = await session.execute(select(Group).options(selectinload(Group.streak)).where(Group.is_public.is_(True)).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def list_by_member(self, session: AsyncSession, user_id: uuid.UUID) -> list[Group]:
        """"My Groups": active membership, independent of `is_public`. A private Group must
        stay listed here for its active Owner/Moderator/Member -- `is_public` only governs
        public *discoverability*, not whether an already-active member keeps seeing their own
        Group. Filters on `GroupMember.status == ACTIVE` so a left/removed/banned membership
        row (status != active) drops the Group from this list even though the row itself
        still exists."""
        result = await session.execute(
            select(Group)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .options(selectinload(Group.streak))
            .where(GroupMember.user_id == user_id, GroupMember.status == MemberStatus.ACTIVE)
        )
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
        through the dedicated, separately-authorized endpoints (never at add-time).

        Assigns `.user` in-memory after flush (mirrors ChannelsService.create() syncing
        `channel.conversation` the same way) -- GroupMemberResponse.user needs it, and a
        freshly-flushed row has no relationship loaded yet; accessing it lazily during
        response serialization would raise (async SQLAlchemy has no implicit IO)."""
        member = GroupMember(
            group_id=group_id, user_id=user_id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE
        )
        session.add(member)
        await session.flush()
        member.user = await profiles_service.get_by_id(session, user_id)
        return member

    async def get_member(self, session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupMember | None:
        result = await session.execute(
            select(GroupMember)
            .options(selectinload(GroupMember.user))
            .where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_members(self, session: AsyncSession, group_id: uuid.UUID) -> list[GroupMember]:
        result = await session.execute(
            select(GroupMember).options(selectinload(GroupMember.user)).where(GroupMember.group_id == group_id)
        )
        return list(result.scalars().all())

    async def list_user_memberships(self, session: AsyncSession, user_id: uuid.UUID) -> list[GroupMember]:
        result = await session.execute(
            select(GroupMember)
            .options(selectinload(GroupMember.user))
            .where(GroupMember.user_id == user_id)
        )
        return list(result.scalars().all())

    async def get_all_active_member_counts(self, session: AsyncSession) -> dict[uuid.UUID, int]:
        from sqlalchemy import func
        result = await session.execute(
            select(GroupMember.group_id, func.count(GroupMember.id))
            .where(GroupMember.status == MemberStatus.ACTIVE)
            .group_by(GroupMember.group_id)
        )
        return {group_id: count for group_id, count in result.all()}

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
