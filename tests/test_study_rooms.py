import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.conversations.entities.conversation_entity import Conversation
from app.core import permissions
from app.db.enums import ConversationType, ModerationAction, StudyRoomMemberRole, StudyRoomStatus
from app.db.session import get_db_session
from app.main import app
from app.messages.routers import message_router
from app.study_rooms.dto.study_room_dto import RoomModerationActionCreate
from app.study_rooms.entities.study_room_entity import StudyRoom, StudyRoomMember
from app.study_rooms.routers import study_room_router
from app.study_rooms.services.study_room_service import StudyRoomsService

AUTH_HEADERS = {"Authorization": "Bearer testtoken"}


async def _fake_db_session():
    yield AsyncMock()


@pytest.fixture(autouse=True)
def override_db_session():
    app.dependency_overrides[get_db_session] = _fake_db_session
    yield
    app.dependency_overrides.pop(get_db_session, None)


def _make_room(status: StudyRoomStatus = StudyRoomStatus.ACTIVE, host_id: uuid.UUID | None = None) -> StudyRoom:
    return StudyRoom(
        id=uuid.uuid4(),
        group_id=uuid.uuid4(),
        name="Room",
        host_id=host_id or uuid.uuid4(),
        status=status,
        max_participants=50,
    )


def _room_member(room_id, user_id, role=StudyRoomMemberRole.PARTICIPANT, left_at=None) -> StudyRoomMember:
    return StudyRoomMember(room_id=room_id, user_id=user_id, role=role, left_at=left_at)


def _fake_session() -> AsyncMock:
    """`Session.add` is synchronous even on SQLAlchemy's AsyncSession -- override the
    auto-mocked async attribute so it isn't left as an un-awaited coroutine."""
    session = AsyncMock()
    session.add = MagicMock()
    return session


# --- StudyRoomsService.log_moderation_action: KICK must revoke membership ---


async def test_log_moderation_action_kick_marks_member_left(monkeypatch):
    service = StudyRoomsService()
    session = _fake_session()
    room_id, target_id = uuid.uuid4(), uuid.uuid4()
    member = _room_member(room_id, target_id, left_at=None)
    monkeypatch.setattr(service, "get_member", AsyncMock(return_value=member))

    data = RoomModerationActionCreate(
        room_id=room_id, moderator_id=uuid.uuid4(), target_user_id=target_id, action=ModerationAction.KICK
    )
    await service.log_moderation_action(session, data)

    assert member.left_at is not None


async def test_log_moderation_action_kick_without_active_membership_is_noop(monkeypatch):
    """Kicking someone who is already gone (or never joined) must not error and must not
    fabricate a membership row."""
    service = StudyRoomsService()
    session = _fake_session()
    room_id, target_id = uuid.uuid4(), uuid.uuid4()
    monkeypatch.setattr(service, "get_member", AsyncMock(return_value=None))

    data = RoomModerationActionCreate(
        room_id=room_id, moderator_id=uuid.uuid4(), target_user_id=target_id, action=ModerationAction.KICK
    )
    action = await service.log_moderation_action(session, data)

    assert action.action == ModerationAction.KICK


async def test_log_moderation_action_mute_does_not_touch_membership(monkeypatch):
    service = StudyRoomsService()
    session = _fake_session()
    room_id, target_id = uuid.uuid4(), uuid.uuid4()
    member = _room_member(room_id, target_id, left_at=None)
    get_member_mock = AsyncMock(return_value=member)
    monkeypatch.setattr(service, "get_member", get_member_mock)

    data = RoomModerationActionCreate(
        room_id=room_id, moderator_id=uuid.uuid4(), target_user_id=target_id, action=ModerationAction.MUTE
    )
    await service.log_moderation_action(session, data)

    assert member.left_at is None
    get_member_mock.assert_not_awaited()


# --- Full flow: KICK via the moderation endpoint must revoke room chat access ---


async def test_kick_via_moderation_endpoint_revokes_room_chat_access(async_client, monkeypatch):
    """Exercises the real router -> service call chain for POST /study-rooms/{room_id}/moderation
    (calling the route function directly rather than over ASGI, since RoomModerationAction.id/
    created_at are DB server_defaults that the fake AsyncMock session can't populate for
    response-model serialization -- that's a fake-session limitation, not something this test
    is trying to verify). What's under test is that the real, unmocked
    `StudyRoomsService.log_moderation_action` -- not a mock of it -- is what runs and mutates
    the target's membership."""
    room = _make_room()
    target_id = uuid.uuid4()
    member = _room_member(room.id, target_id, left_at=None)

    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=member))

    kick_data = RoomModerationActionCreate(
        room_id=room.id, moderator_id=room.host_id, target_user_id=target_id, action=ModerationAction.KICK
    )
    await study_room_router.log_moderation(room_id=room.id, data=kick_data, session=_fake_session())
    assert member.left_at is not None

    conversation = Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=room.id, created_by=room.host_id)
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=member))

    kicked_user = CurrentUser(id=target_id, email="kicked@example.com", role="authenticated")
    app.dependency_overrides[get_current_user] = lambda: kicked_user
    try:
        list_response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
        send_response = await async_client.post(
            f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert list_response.status_code == 403
    assert send_response.status_code == 403
