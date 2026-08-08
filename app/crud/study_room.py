import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import StudyRoomMemberRole, StudyRoomStatus
from app.models.study_room import RoomModerationAction, StudyRoom, StudyRoomMember
from app.schemas.study_room import RoomModerationActionCreate, StudyRoomCreate, StudyRoomUpdate

# --- study_rooms ---


async def create_study_room(session: AsyncSession, data: StudyRoomCreate) -> StudyRoom:
    """Creates the room and its host membership row together (see docs/STUDY_PLATFORM_DATABASE_SPEC.md #15)."""
    room = StudyRoom(**data.model_dump())
    session.add(room)
    await session.flush()

    host_membership = StudyRoomMember(room_id=room.id, user_id=data.host_id, role=StudyRoomMemberRole.HOST)
    session.add(host_membership)
    await session.flush()
    return room


async def get_study_room(session: AsyncSession, room_id: uuid.UUID) -> StudyRoom | None:
    return await session.get(StudyRoom, room_id)


async def list_study_rooms_by_group(session: AsyncSession, group_id: uuid.UUID) -> list[StudyRoom]:
    result = await session.execute(select(StudyRoom).where(StudyRoom.group_id == group_id))
    return list(result.scalars().all())


async def update_study_room(session: AsyncSession, room: StudyRoom, data: StudyRoomUpdate) -> StudyRoom:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(room, field, value)
    await session.flush()
    return room


async def start_study_room(session: AsyncSession, room: StudyRoom) -> StudyRoom:
    room.status = StudyRoomStatus.ACTIVE
    room.started_at = datetime.now(timezone.utc)
    await session.flush()
    return room


async def end_study_room(session: AsyncSession, room: StudyRoom) -> StudyRoom:
    # Docs: don't delete a finished room, mark it ended instead so history is kept.
    room.status = StudyRoomStatus.ENDED
    room.ended_at = datetime.now(timezone.utc)
    await session.flush()
    return room


# --- study_room_members: join / leave / rejoin, per docs #16 (UNIQUE(room_id, user_id)) ---


async def get_study_room_member(
    session: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID
) -> StudyRoomMember | None:
    result = await session.execute(
        select(StudyRoomMember).where(StudyRoomMember.room_id == room_id, StudyRoomMember.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def join_study_room(
    session: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID, role: StudyRoomMemberRole = StudyRoomMemberRole.PARTICIPANT
) -> StudyRoomMember:
    """First-time join. Rejoin (existing row) must go through rejoin_study_room instead,
    since UNIQUE(room_id, user_id) forbids a second row for the same room+user."""
    member = StudyRoomMember(room_id=room_id, user_id=user_id, role=role)
    session.add(member)
    await session.flush()
    return member


async def rejoin_study_room(session: AsyncSession, member: StudyRoomMember) -> StudyRoomMember:
    member.joined_at = datetime.now(timezone.utc)
    member.left_at = None
    await session.flush()
    return member


async def leave_study_room(session: AsyncSession, member: StudyRoomMember) -> StudyRoomMember:
    member.left_at = datetime.now(timezone.utc)
    await session.flush()
    return member


async def list_study_room_members(session: AsyncSession, room_id: uuid.UUID) -> list[StudyRoomMember]:
    result = await session.execute(select(StudyRoomMember).where(StudyRoomMember.room_id == room_id))
    return list(result.scalars().all())


async def list_active_study_room_members(session: AsyncSession, room_id: uuid.UUID) -> list[StudyRoomMember]:
    result = await session.execute(
        select(StudyRoomMember).where(StudyRoomMember.room_id == room_id, StudyRoomMember.left_at.is_(None))
    )
    return list(result.scalars().all())


async def update_study_room_member_role(
    session: AsyncSession, member: StudyRoomMember, role: StudyRoomMemberRole
) -> StudyRoomMember:
    member.role = role
    await session.flush()
    return member


# --- room_moderation_actions: append-only action log ---


async def log_moderation_action(session: AsyncSession, data: RoomModerationActionCreate) -> RoomModerationAction:
    action = RoomModerationAction(**data.model_dump())
    session.add(action)
    await session.flush()
    return action


async def list_moderation_actions_by_room(session: AsyncSession, room_id: uuid.UUID) -> list[RoomModerationAction]:
    result = await session.execute(
        select(RoomModerationAction)
        .where(RoomModerationAction.room_id == room_id)
        .order_by(RoomModerationAction.created_at.desc())
    )
    return list(result.scalars().all())
