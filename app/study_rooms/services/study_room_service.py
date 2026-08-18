import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import ModerationAction, StudyRoomMemberRole, StudyRoomStatus
from app.study_rooms.entities.study_room_entity import StudyRoom, StudyRoomMember, RoomModerationAction
from app.study_rooms.dto.study_room_dto import RoomModerationActionCreate, StudyRoomCreate, StudyRoomUpdate


class StudyRoomsService:
    async def create(self, session: AsyncSession, data: StudyRoomCreate, host_id: uuid.UUID) -> StudyRoom:
        """`host_id` is the authenticated caller, passed explicitly by the router --
        `StudyRoomCreate` has no host_id field at all, so there is no client-supplied
        value to trust or ignore."""
        room = StudyRoom(**data.model_dump(), host_id=host_id)
        session.add(room)
        await session.flush()

        host_membership = StudyRoomMember(room_id=room.id, user_id=host_id, role=StudyRoomMemberRole.HOST)
        session.add(host_membership)
        await session.flush()
        return room

    async def get_by_id(self, session: AsyncSession, room_id: uuid.UUID) -> StudyRoom | None:
        """Returns the room regardless of deleted_at -- callers (study_room_router) decide
        whether a soft-deleted room should be treated as not-found, mirroring
        ChannelsService.get_by_id."""
        return await session.get(StudyRoom, room_id)

    async def list_by_group(self, session: AsyncSession, group_id: uuid.UUID) -> list[StudyRoom]:
        """Soft-deleted rooms are excluded unconditionally -- a deleted room must not appear
        in Study Room lists (mirrors ChannelsService.list_by_group)."""
        result = await session.execute(
            select(StudyRoom).where(StudyRoom.group_id == group_id, StudyRoom.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def update(self, session: AsyncSession, room: StudyRoom, data: StudyRoomUpdate) -> StudyRoom:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(room, field, value)
        await session.flush()
        return room

    async def soft_delete(self, session: AsyncSession, room: StudyRoom, deleted_by: uuid.UUID) -> StudyRoom:
        """`deleted_by` is the authenticated caller, passed explicitly by the router -- never
        trust a client-supplied deleted_by. Never physically deletes the row: the StudyRoom,
        its Conversation, all historical Messages, StudyRoomMembers, and RoomModerationActions
        remain in the database (see docs/db/migrations/010_soft_delete_study_rooms.sql)."""
        room.deleted_at = datetime.now(timezone.utc)
        room.deleted_by = deleted_by
        await session.flush()
        return room

    async def start(self, session: AsyncSession, room: StudyRoom) -> StudyRoom:
        room.status = StudyRoomStatus.ACTIVE
        room.started_at = datetime.now(timezone.utc)
        await session.flush()
        return room

    async def end(self, session: AsyncSession, room: StudyRoom) -> StudyRoom:
        room.status = StudyRoomStatus.ENDED
        room.ended_at = datetime.now(timezone.utc)
        await session.flush()
        return room

    # --- study_room_members ---

    async def get_member(self, session: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> StudyRoomMember | None:
        result = await session.execute(
            select(StudyRoomMember).where(StudyRoomMember.room_id == room_id, StudyRoomMember.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def join(
        self, session: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID, role: StudyRoomMemberRole = StudyRoomMemberRole.PARTICIPANT
    ) -> StudyRoomMember:
        member = StudyRoomMember(room_id=room_id, user_id=user_id, role=role)
        session.add(member)
        await session.flush()
        return member

    async def rejoin(self, session: AsyncSession, member: StudyRoomMember) -> StudyRoomMember:
        member.joined_at = datetime.now(timezone.utc)
        member.left_at = None
        await session.flush()
        return member

    async def leave(self, session: AsyncSession, member: StudyRoomMember) -> StudyRoomMember:
        member.left_at = datetime.now(timezone.utc)
        await session.flush()
        return member

    async def list_members(self, session: AsyncSession, room_id: uuid.UUID) -> list[StudyRoomMember]:
        result = await session.execute(select(StudyRoomMember).where(StudyRoomMember.room_id == room_id))
        return list(result.scalars().all())

    async def list_active_members(self, session: AsyncSession, room_id: uuid.UUID) -> list[StudyRoomMember]:
        result = await session.execute(
            select(StudyRoomMember).where(StudyRoomMember.room_id == room_id, StudyRoomMember.left_at.is_(None))
        )
        return list(result.scalars().all())

    async def update_member_role(
        self, session: AsyncSession, member: StudyRoomMember, role: StudyRoomMemberRole
    ) -> StudyRoomMember:
        member.role = role
        await session.flush()
        return member

    # --- moderation ---

    async def log_moderation_action(self, session: AsyncSession, data: RoomModerationActionCreate) -> RoomModerationAction:
        """A KICK also revokes the target's room membership (same session/transaction as the
        audit log insert -- both are flushed together and committed by the caller as one unit).
        study_room_members has no separate banned/kicked status, so a kicked member is marked
        the same way as one who left: `left_at` is set. Other actions (mute, raise hand, ...)
        are audit-only and never touch membership."""
        action = RoomModerationAction(**data.model_dump())
        session.add(action)
        if data.action == ModerationAction.KICK:
            member = await self.get_member(session, data.room_id, data.target_user_id)
            if member is not None and member.left_at is None:
                await self.leave(session, member)
        await session.flush()
        return action

    async def list_moderation_actions(self, session: AsyncSession, room_id: uuid.UUID) -> list[RoomModerationAction]:
        result = await session.execute(
            select(RoomModerationAction)
            .where(RoomModerationAction.room_id == room_id)
            .order_by(RoomModerationAction.created_at.desc())
        )
        return list(result.scalars().all())
