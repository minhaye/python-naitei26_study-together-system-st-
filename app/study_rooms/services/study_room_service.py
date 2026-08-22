import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.conversations.services.conversation_service import ConversationsService
from app.db.enums import ModerationAction, StudyRoomMemberRole, StudyRoomStatus
from app.notifications.services.notification_service import NotificationsService
from app.profiles.services.profile_service import ProfilesService
from app.study_rooms.entities.study_room_entity import StudyRoom, StudyRoomMember, RoomModerationAction
from app.study_rooms.dto.study_room_dto import RoomModerationActionCreate, StudyRoomCreate, StudyRoomUpdate

conversations_service = ConversationsService()
profiles_service = ProfilesService()
notifications_service = NotificationsService()


class StudyRoomsService:
    async def create(self, session: AsyncSession, data: StudyRoomCreate, host_id: uuid.UUID) -> StudyRoom:
        """`host_id` is the authenticated caller, passed explicitly by the router --
        `StudyRoomCreate` has no host_id field at all, so there is no client-supplied
        value to trust or ignore.

        Creates the room, the creator's HOST-role membership, and its ROOM Conversation as
        one logical operation -- all three inserts are flushed into this same session but
        never committed here (mirrors ChannelsService.create). The router wraps this call in
        a single try/commit/except-rollback: if any flush fails (including the Conversation
        insert), the exception propagates out of this method uncaught, the router rolls back,
        and nothing -- not the room, not the membership, not the Conversation -- is persisted.
        A Study Room must never exist without its Conversation (see
        STUDY_PLATFORM_DATABASE_SPEC.md § 16); this is the only creation path, so that
        invariant holds by construction rather than by a later backfill."""
        room = StudyRoom(**data.model_dump(), host_id=host_id)
        session.add(room)
        await session.flush()

        host_membership = StudyRoomMember(room_id=room.id, user_id=host_id, role=StudyRoomMemberRole.HOST)
        session.add(host_membership)
        await session.flush()

        conversation = await conversations_service.create_for_room(session, room.id, host_id)
        # Sync in-memory relationship so the response (built in this same session, no
        # refetch) can read room.conversation_id without a lazy-load round trip.
        room.conversation = conversation
        return room

    async def get_by_id(self, session: AsyncSession, room_id: uuid.UUID) -> StudyRoom | None:
        """Returns the room regardless of deleted_at -- callers (study_room_router) decide
        whether a soft-deleted room should be treated as not-found, mirroring
        ChannelsService.get_by_id."""
        result = await session.execute(
            select(StudyRoom).options(selectinload(StudyRoom.conversation)).where(StudyRoom.id == room_id)
        )
        return result.scalar_one_or_none()

    async def list_by_group(self, session: AsyncSession, group_id: uuid.UUID) -> list[StudyRoom]:
        """Soft-deleted rooms are excluded unconditionally -- a deleted room must not appear
        in Study Room lists (mirrors ChannelsService.list_by_group)."""
        result = await session.execute(
            select(StudyRoom)
            .options(selectinload(StudyRoom.conversation))
            .where(StudyRoom.group_id == group_id, StudyRoom.deleted_at.is_(None))
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
            select(StudyRoomMember)
            .options(selectinload(StudyRoomMember.user))
            .where(StudyRoomMember.room_id == room_id, StudyRoomMember.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def _trigger_room_notifications(self, session: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> None:
        try:
            active_members = await self.list_active_members(session, room_id)
            active_count = len(active_members)
            room = await self.get_by_id(session, room_id)
            if not room:
                return

            user = await profiles_service.get_by_id(session, user_id)
            user_name = (user.display_name or user.username or "Thành viên") if user else "Thành viên"

            if active_count == 1:
                await notifications_service.notify_study_room_first_joiner(
                    session,
                    room_id=room_id,
                    room_name=room.name,
                    group_id=room.group_id,
                    joiner_id=user_id,
                    joiner_name=user_name,
                )
            elif active_count >= 5:
                await notifications_service.notify_study_room_active(
                    session,
                    room_id=room_id,
                    room_name=room.name,
                    group_id=room.group_id,
                    active_user_count=active_count,
                )
        except Exception:
            pass

    async def join(
        self, session: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID, role: StudyRoomMemberRole = StudyRoomMemberRole.PARTICIPANT
    ) -> StudyRoomMember:
        member = StudyRoomMember(room_id=room_id, user_id=user_id, role=role)
        session.add(member)
        await session.flush()
        member.user = await profiles_service.get_by_id(session, user_id)
        await self._trigger_room_notifications(session, room_id, user_id)
        return member

    async def rejoin(self, session: AsyncSession, member: StudyRoomMember) -> StudyRoomMember:
        member.joined_at = datetime.now(timezone.utc)
        member.left_at = None
        await session.flush()
        await self._trigger_room_notifications(session, member.room_id, member.user_id)
        return member

    async def leave(self, session: AsyncSession, member: StudyRoomMember) -> StudyRoomMember:
        member.left_at = datetime.now(timezone.utc)
        await session.flush()
        return member

    async def list_members(self, session: AsyncSession, room_id: uuid.UUID) -> list[StudyRoomMember]:
        result = await session.execute(
            select(StudyRoomMember)
            .options(selectinload(StudyRoomMember.user))
            .where(StudyRoomMember.room_id == room_id)
        )
        return list(result.scalars().all())

    async def list_active_members(self, session: AsyncSession, room_id: uuid.UUID) -> list[StudyRoomMember]:
        result = await session.execute(
            select(StudyRoomMember)
            .options(selectinload(StudyRoomMember.user))
            .where(StudyRoomMember.room_id == room_id, StudyRoomMember.left_at.is_(None))
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
