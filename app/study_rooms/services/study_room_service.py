import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import StudyRoomMemberRole, StudyRoomStatus
from app.study_rooms.entities.study_room_entity import StudyRoom, StudyRoomMember, RoomModerationAction
from app.study_rooms.dto.study_room_dto import RoomModerationActionCreate, StudyRoomCreate, StudyRoomUpdate


class StudyRoomsService:
    async def create(self, session: AsyncSession, data: StudyRoomCreate) -> StudyRoom:
        room = StudyRoom(**data.model_dump())
        session.add(room)
        await session.flush()

        host_membership = StudyRoomMember(room_id=room.id, user_id=data.host_id, role=StudyRoomMemberRole.HOST)
        session.add(host_membership)
        await session.flush()
        return room

    async def get_by_id(self, session: AsyncSession, room_id: uuid.UUID) -> StudyRoom | None:
        return await session.get(StudyRoom, room_id)

    async def list_by_group(self, session: AsyncSession, group_id: uuid.UUID) -> list[StudyRoom]:
        result = await session.execute(select(StudyRoom).where(StudyRoom.group_id == group_id))
        return list(result.scalars().all())

    async def update(self, session: AsyncSession, room: StudyRoom, data: StudyRoomUpdate) -> StudyRoom:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(room, field, value)
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
        action = RoomModerationAction(**data.model_dump())
        session.add(action)
        await session.flush()
        return action

    async def list_moderation_actions(self, session: AsyncSession, room_id: uuid.UUID) -> list[RoomModerationAction]:
        result = await session.execute(
            select(RoomModerationAction)
            .where(RoomModerationAction.room_id == room_id)
            .order_by(RoomModerationAction.created_at.desc())
        )
        return list(result.scalars().all())
