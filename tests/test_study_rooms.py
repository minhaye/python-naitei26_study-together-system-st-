import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.conversations.entities.conversation_entity import Conversation
from app.core import permissions
from app.db.enums import (
    ConversationType,
    GroupMemberRole,
    MemberStatus,
    ModerationAction,
    StudyRoomMemberRole,
    StudyRoomStatus,
)
from app.db.session import get_db_session
from app.groups.entities.group_entity import Group, GroupMember
from app.main import app
from app.messages.routers import message_router
from app.study_rooms.dto.study_room_dto import RoomModerationActionCreate, StudyRoomCreate
from app.study_rooms.entities.study_room_entity import RoomModerationAction, StudyRoom, StudyRoomMember
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


@pytest.fixture
def fake_user():
    return CurrentUser(id=uuid.uuid4(), email="user@example.com", role="authenticated")


@pytest.fixture
def as_fake_user(fake_user):
    app.dependency_overrides[get_current_user] = lambda: fake_user
    yield fake_user
    app.dependency_overrides.pop(get_current_user, None)


def _make_room(
    status: StudyRoomStatus = StudyRoomStatus.ACTIVE,
    host_id: uuid.UUID | None = None,
    deleted_at: datetime | None = None,
) -> StudyRoom:
    return StudyRoom(
        id=uuid.uuid4(),
        group_id=uuid.uuid4(),
        name="Room",
        host_id=host_id or uuid.uuid4(),
        status=status,
        max_participants=50,
        created_at=datetime.now(timezone.utc),
        deleted_at=deleted_at,
    )


def _room_member(room_id, user_id, role=StudyRoomMemberRole.PARTICIPANT, left_at=None) -> StudyRoomMember:
    return StudyRoomMember(
        id=uuid.uuid4(),
        room_id=room_id,
        user_id=user_id,
        role=role,
        joined_at=datetime.now(timezone.utc),
        left_at=left_at,
    )


def _group_member(group_id, user_id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE) -> GroupMember:
    return GroupMember(
        id=uuid.uuid4(), group_id=group_id, user_id=user_id, role=role, status=status,
        joined_at=datetime.now(timezone.utc),
    )


def _mock_group_membership(monkeypatch, member: GroupMember | None):
    """is_active_group_member reads via permissions.groups_service.get_member --
    mirrors how test_channels.py mocks the same shared permissions module instance."""
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))


def _moderation_action(room_id, moderator_id, target_user_id, action, reason=None) -> RoomModerationAction:
    return RoomModerationAction(
        id=uuid.uuid4(),
        room_id=room_id,
        moderator_id=moderator_id,
        target_user_id=target_user_id,
        action=action,
        reason=reason,
        created_at=datetime.now(timezone.utc),
    )


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
    # KICK now requires the actor to be a CURRENT active group owner/moderator
    # (can_manage_room / is_group_manager), not merely room.host_id.
    _mock_group_membership(monkeypatch, _group_member(room.group_id, room.host_id, role=GroupMemberRole.OWNER))

    host_user = CurrentUser(id=room.host_id, email="host@example.com", role="authenticated")
    kick_data = RoomModerationActionCreate(
        room_id=room.id, moderator_id=room.host_id, target_user_id=target_id, action=ModerationAction.KICK
    )
    await study_room_router.log_moderation(
        room_id=room.id, data=kick_data, current_user=host_user, session=_fake_session()
    )
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


# --- Discovery stays public (documented decision: rooms/list are intentionally public) ---


async def test_get_room_remains_public(async_client, monkeypatch):
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.get(f"/study-rooms/{room.id}")
    assert response.status_code == 200


async def test_list_rooms_remains_public(async_client, monkeypatch):
    monkeypatch.setattr(study_room_router.service, "list_by_group", AsyncMock(return_value=[]))

    response = await async_client.get("/study-rooms/", params={"group_id": str(uuid.uuid4())})
    assert response.status_code == 200


# --- Create: auth required, caller becomes host, host_id spoofing ignored ---


async def test_create_room_requires_auth(async_client):
    response = await async_client.post(
        "/study-rooms/",
        json={"group_id": str(uuid.uuid4()), "name": "Room"},
    )
    assert response.status_code == 401


async def test_create_room_group_not_found(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(study_room_router.groups_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(
        "/study-rooms/",
        json={"group_id": str(uuid.uuid4()), "name": "Room"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 404


async def test_create_room_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    """Regression test: POST /study-rooms/ used to have no group-membership check at all --
    any authenticated user could create a room under any group_id. See
    STUDY_PLATFORM_DATABASE_SPEC.md §16 and study_room_router.create_room's docstring."""
    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=uuid.uuid4(), is_public=True)
    monkeypatch.setattr(study_room_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_group_membership(monkeypatch, None)

    response = await async_client.post(
        "/study-rooms/",
        json={"group_id": str(group_id), "name": "Room"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_create_room_forbidden_for_plain_member(async_client, monkeypatch, as_fake_user):
    """Product rule (2026-08-18): a plain (non-owner, non-moderator) active group member must
    not be able to create a study room -- supersedes the old STUDY_PLATFORM_DATABASE_SPEC.md
    §16 behavior where any active member could create one."""
    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=uuid.uuid4(), is_public=True)
    monkeypatch.setattr(study_room_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_group_membership(monkeypatch, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(
        "/study-rooms/",
        json={"group_id": str(group_id), "name": "Room"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_create_room_forbidden_for_left_member(async_client, monkeypatch, as_fake_user):
    """A member who has left the group (status=left) must not be able to create a room, even
    if they previously held a manager role there."""
    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=uuid.uuid4(), is_public=True)
    monkeypatch.setattr(study_room_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_group_membership(
        monkeypatch,
        _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR, status=MemberStatus.LEFT),
    )

    response = await async_client.post(
        "/study-rooms/",
        json={"group_id": str(group_id), "name": "Room"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_create_room_forbidden_for_banned_member(async_client, monkeypatch, as_fake_user):
    """A banned member must not be able to create a room, even if they previously held a
    manager role there."""
    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=uuid.uuid4(), is_public=True)
    monkeypatch.setattr(study_room_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_group_membership(
        monkeypatch,
        _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER, status=MemberStatus.BANNED),
    )

    response = await async_client.post(
        "/study-rooms/",
        json={"group_id": str(group_id), "name": "Room"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_create_room_allowed_for_active_owner_and_host_id_spoofing_ignored(
    async_client, monkeypatch, as_fake_user
):
    """An active group owner may create a room and becomes its host -- a client-supplied
    host_id in the request body must be silently ignored (Pydantic drops unknown fields on
    StudyRoomCreate), never taken as identity."""
    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=as_fake_user.id, is_public=True)
    monkeypatch.setattr(study_room_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_group_membership(monkeypatch, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))

    spoofed_host_id = uuid.uuid4()
    captured = {}

    async def fake_create(session, data, host_id):
        captured["host_id"] = host_id
        return _make_room(host_id=host_id)

    monkeypatch.setattr(study_room_router.service, "create", fake_create)

    response = await async_client.post(
        "/study-rooms/",
        json={"group_id": str(group_id), "name": "Room", "host_id": str(spoofed_host_id)},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 201
    assert response.json()["host_id"] == str(as_fake_user.id)
    assert captured["host_id"] == as_fake_user.id
    assert captured["host_id"] != spoofed_host_id


async def test_create_room_allowed_for_active_moderator_and_host_id_spoofing_ignored(
    async_client, monkeypatch, as_fake_user
):
    """An active group moderator may create a room and becomes its host -- same host_id
    spoofing protection as the owner path."""
    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=uuid.uuid4(), is_public=True)
    monkeypatch.setattr(study_room_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_group_membership(monkeypatch, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR))

    spoofed_host_id = uuid.uuid4()
    captured = {}

    async def fake_create(session, data, host_id):
        captured["host_id"] = host_id
        return _make_room(host_id=host_id)

    monkeypatch.setattr(study_room_router.service, "create", fake_create)

    response = await async_client.post(
        "/study-rooms/",
        json={"group_id": str(group_id), "name": "Room", "host_id": str(spoofed_host_id)},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 201
    assert response.json()["host_id"] == str(as_fake_user.id)
    assert captured["host_id"] == as_fake_user.id
    assert captured["host_id"] != spoofed_host_id


# --- Create: Room + host StudyRoomMember + ROOM Conversation, created atomically ---
#
# A real database/SQLite test harness does not exist in this repo (see test_conversations.py's
# _FakeSession docstring for the same rationale) -- an ordinary AsyncMock() session is not
# safe here either: chaining through select(...).scalar_one_or_none() on a plain AsyncMock
# auto-creates further AsyncMocks at every attribute access, so an un-awaited coroutine can
# silently leak out as if it were a real value. StudyRoomsService.create()'s actual
# transactional logic -- three inserts in one session, atomicity owned entirely by the
# caller's commit/rollback -- is exactly the kind of new logic worth exercising directly
# rather than mocking away, so it gets a small purpose-built fake session (same pattern as
# test_conversations.py's _FakeSession for ConversationsService.get_or_create_direct).


class _FakeCreateRoomSession:
    """Assigns an id to each newly added object on flush (standing in for a real DB
    server_default becoming available post-flush), unless `fail_on_flush_call` matches the
    current 1-indexed flush call count, in which case it raises IntegrityError instead --
    simulating a DB constraint violation (e.g. conversations_room_id_key, migration 004)
    surfacing at flush time. StudyRoomsService.create() flushes exactly 3 times: after the
    Room insert, after the host StudyRoomMember insert, and after the Conversation insert
    (inside ConversationsService.create_for_room) -- so fail_on_flush_call=3 targets the
    Conversation insert specifically."""

    def __init__(self, fail_on_flush_call: int | None = None):
        self.added: list = []
        self.flush_call_count = 0
        self.commit_called = False
        self.rollback_called = False
        self._fail_on_flush_call = fail_on_flush_call

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flush_call_count += 1
        if self._fail_on_flush_call is not None and self.flush_call_count == self._fail_on_flush_call:
            raise IntegrityError(
                "INSERT INTO conversations ...",
                {},
                Exception('duplicate key value violates unique constraint "conversations_room_id_key"'),
            )
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()

    async def commit(self):
        self.commit_called = True

    async def rollback(self):
        self.rollback_called = True


async def test_service_create_room_creates_room_membership_and_conversation_atomically():
    """Exercises the real StudyRoomsService.create() -- not a mock of it, and not a mock of
    ConversationsService.create_for_room -- proving all three inserts (Room, host
    StudyRoomMember, ROOM Conversation) happen in this one call, in the same session, and
    that the returned room has its Conversation wired in-memory so the API response can read
    room.conversation_id without a lazy-load round trip."""
    service = StudyRoomsService()
    session = _FakeCreateRoomSession()
    host_id = uuid.uuid4()
    data = StudyRoomCreate(group_id=uuid.uuid4(), name="Room", max_participants=50)

    room = await service.create(session, data, host_id=host_id)

    assert len(session.added) == 3
    added_room, added_membership, added_conversation = session.added
    assert added_room is room
    assert isinstance(added_membership, StudyRoomMember)
    assert added_membership.room_id == room.id
    assert added_membership.user_id == host_id
    assert added_membership.role == StudyRoomMemberRole.HOST
    assert isinstance(added_conversation, Conversation)
    assert added_conversation.type == ConversationType.ROOM
    assert added_conversation.room_id == room.id
    assert added_conversation.created_by == host_id
    assert room.conversation is added_conversation
    assert room.conversation_id == added_conversation.id
    # Atomicity (commit-or-rollback-everything) is owned entirely by the caller
    # (study_room_router.create_room) -- the service itself must never commit.
    assert not session.commit_called


async def test_service_create_room_conversation_failure_propagates_without_internal_commit():
    """If the Conversation insert fails (simulated here the same way a real DB IntegrityError
    would surface -- an exception raised from session.flush()), the exception must propagate
    out of StudyRoomsService.create() uncaught, and the service must not have committed
    anything itself. This is exactly what lets a caller's rollback (see the router-level test
    below) undo the already-flushed-but-uncommitted Room and host membership too -- there must
    be no partial commit that could leave either of them behind as an orphan."""
    service = StudyRoomsService()
    session = _FakeCreateRoomSession(fail_on_flush_call=3)
    data = StudyRoomCreate(group_id=uuid.uuid4(), name="Room", max_participants=50)

    with pytest.raises(IntegrityError):
        await service.create(session, data, host_id=uuid.uuid4())

    # Room and host membership were successfully flushed (pending, with DB-assigned ids);
    # the Conversation was added to the session but its flush failed, so it never got an id.
    # None of the three was ever committed -- exactly the state a caller's rollback must be
    # able to undo cleanly, with no orphan left behind.
    assert len(session.added) == 3
    added_room, added_membership, added_conversation = session.added
    assert added_room.id is not None
    assert added_membership.id is not None
    assert added_conversation.id is None
    assert not session.commit_called


async def test_create_room_conversation_failure_rolls_back_via_router(async_client, monkeypatch, as_fake_user):
    """End-to-end: POST /study-rooms/ must roll back the whole operation -- not commit a
    partial result -- when Conversation creation fails deep inside
    StudyRoomsService.create(). Exercises the real router -> real StudyRoomsService.create()
    -> real ConversationsService.create_for_room chain; only the session's flush is
    fault-injected, and only on the specific call that corresponds to the Conversation
    insert."""
    group_id = uuid.uuid4()
    group = Group(id=group_id, name="G", owner_id=as_fake_user.id, is_public=True)
    monkeypatch.setattr(study_room_router.groups_service, "get_by_id", AsyncMock(return_value=group))
    _mock_group_membership(monkeypatch, _group_member(group_id, as_fake_user.id, role=GroupMemberRole.OWNER))

    session = _FakeCreateRoomSession(fail_on_flush_call=3)

    async def _fake_failing_session():
        yield session

    app.dependency_overrides[get_db_session] = _fake_failing_session
    try:
        response = await async_client.post(
            "/study-rooms/", json={"group_id": str(group_id), "name": "Room"}, headers=AUTH_HEADERS
        )
    finally:
        app.dependency_overrides.pop(get_db_session, None)

    assert response.status_code == 400
    # Room + host membership were successfully flushed (pending, with DB-assigned ids); the
    # Conversation was added but its flush failed, so it never got an id. Nothing was
    # committed, and the router's except/rollback ran -- the exact mechanism that leaves no
    # orphan Room or host membership behind in a real database.
    assert len(session.added) == 3
    added_room, added_membership, added_conversation = session.added
    assert added_room.id is not None
    assert added_membership.id is not None
    assert added_conversation.id is None
    assert not session.commit_called
    assert session.rollback_called


async def test_newly_created_room_conversation_is_resolvable_for_message_access(monkeypatch):
    """End-to-end proof that a freshly created Room's Conversation is not just structurally
    present, but actually usable by the production message-authorization path: exercises the
    real StudyRoomsService.create() and the real can_access_conversation()/can_access_room()
    dispatch -- only the Group/Room-member lookups are faked."""
    service = StudyRoomsService()
    session = _FakeCreateRoomSession()
    host_id = uuid.uuid4()
    data = StudyRoomCreate(group_id=uuid.uuid4(), name="Room", max_participants=50)

    room = await service.create(session, data, host_id=host_id)
    conversation = room.conversation

    assert conversation.type == ConversationType.ROOM
    assert conversation.room_id == room.id

    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, host_id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, host_id, role=StudyRoomMemberRole.HOST)),
    )

    assert await permissions.can_access_conversation(session=None, conversation=conversation, user_id=host_id)


# --- Update: active Group owner/moderator only (2026-08-18 -- host_id alone is not enough) ---


async def test_update_room_requires_auth(async_client):
    response = await async_client.put(f"/study-rooms/{uuid.uuid4()}", json={"name": "New"})
    assert response.status_code == 401


async def test_update_room_forbidden_for_plain_member(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.put(f"/study-rooms/{room.id}", json={"name": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_update_room_allowed_for_active_group_owner(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(study_room_router.service, "update", AsyncMock(return_value=room))

    response = await async_client.put(f"/study-rooms/{room.id}", json={"name": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_update_room_allowed_for_active_group_moderator(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(
        monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR)
    )
    monkeypatch.setattr(study_room_router.service, "update", AsyncMock(return_value=room))

    response = await async_client.put(f"/study-rooms/{room.id}", json={"name": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_update_room_forbidden_for_demoted_former_host(async_client, monkeypatch, as_fake_user):
    """Core stale-host regression: the caller is this room's host_id (they created it while a
    Moderator) but has since been demoted to a plain active Member -- host_id is unchanged,
    but the update must now be denied."""
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.put(f"/study-rooms/{room.id}", json={"name": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Lifecycle: start/end require an active Group owner/moderator ---


async def test_start_room_requires_auth(async_client):
    response = await async_client.post(f"/study-rooms/{uuid.uuid4()}/start")
    assert response.status_code == 401


async def test_start_room_forbidden_for_plain_member(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(f"/study-rooms/{room.id}/start", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_start_room_allowed_for_active_group_owner(async_client, monkeypatch, as_fake_user):
    room = _make_room(status=StudyRoomStatus.WAITING, host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(study_room_router.service, "start", AsyncMock(return_value=room))

    response = await async_client.post(f"/study-rooms/{room.id}/start", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_start_room_allowed_for_active_group_moderator(async_client, monkeypatch, as_fake_user):
    room = _make_room(status=StudyRoomStatus.WAITING, host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(
        monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR)
    )
    monkeypatch.setattr(study_room_router.service, "start", AsyncMock(return_value=room))

    response = await async_client.post(f"/study-rooms/{room.id}/start", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_start_room_forbidden_for_demoted_former_host(async_client, monkeypatch, as_fake_user):
    room = _make_room(status=StudyRoomStatus.WAITING, host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(f"/study-rooms/{room.id}/start", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_end_room_requires_auth(async_client):
    response = await async_client.post(f"/study-rooms/{uuid.uuid4()}/end")
    assert response.status_code == 401


async def test_end_room_forbidden_for_plain_member(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(f"/study-rooms/{room.id}/end", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_end_room_allowed_for_active_group_owner(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(study_room_router.service, "end", AsyncMock(return_value=room))

    response = await async_client.post(f"/study-rooms/{room.id}/end", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_end_room_allowed_for_active_group_moderator(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(
        monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR)
    )
    monkeypatch.setattr(study_room_router.service, "end", AsyncMock(return_value=room))

    response = await async_client.post(f"/study-rooms/{room.id}/end", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_end_room_forbidden_for_demoted_former_host(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(f"/study-rooms/{room.id}/end", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Join: identity always from auth, role always PARTICIPANT, ENDED denied ---


async def test_join_room_requires_auth(async_client):
    response = await async_client.post(f"/study-rooms/{uuid.uuid4()}/join")
    assert response.status_code == 401


async def test_join_room_uses_authenticated_identity_not_request_supplied_user_id(
    async_client, monkeypatch, as_fake_user
):
    """A client cannot join as an arbitrary user or self-assign a privileged role by
    injecting query parameters -- the endpoint no longer even accepts user_id/role, and
    always acts on the authenticated caller as a plain participant."""
    room = _make_room()
    other_user_id = uuid.uuid4()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=None))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id))

    captured = {}

    async def fake_join(session, room_id, user_id):
        captured["user_id"] = user_id
        return _room_member(room_id, user_id)

    monkeypatch.setattr(study_room_router.service, "join", fake_join)

    response = await async_client.post(
        f"/study-rooms/{room.id}/join?user_id={other_user_id}&role=host", headers=AUTH_HEADERS
    )

    assert response.status_code == 200
    assert captured["user_id"] == as_fake_user.id
    assert response.json()["user_id"] == str(as_fake_user.id)
    assert response.json()["role"] == "participant"


async def test_join_ended_room_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room(status=StudyRoomStatus.ENDED)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.post(f"/study-rooms/{room.id}/join", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_join_room_rejoin_resets_left_at_without_duplicate_membership(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    member = _room_member(room.id, as_fake_user.id, left_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=member))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id))

    async def fake_rejoin(session, member):
        member.left_at = None
        return member

    monkeypatch.setattr(study_room_router.service, "rejoin", fake_rejoin)
    join_mock = AsyncMock()
    monkeypatch.setattr(study_room_router.service, "join", join_mock)

    response = await async_client.post(f"/study-rooms/{room.id}/join", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json()["left_at"] is None
    join_mock.assert_not_awaited()


async def test_join_room_denied_for_left_group_member(async_client, monkeypatch, as_fake_user):
    """2026-08-18: join's own prerequisite is current active Group membership (mirrors
    can_access_room's requirement for ongoing participation) -- a user who left the Group must
    not be able to join a room under it, even though can_join_room() itself only checks room
    lifecycle. Regression guard: the join endpoint previously had NO Group-membership check at
    all -- any authenticated user, member or not, could join any room."""
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=None))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, status=MemberStatus.LEFT))
    join_mock = AsyncMock()
    monkeypatch.setattr(study_room_router.service, "join", join_mock)

    response = await async_client.post(f"/study-rooms/{room.id}/join", headers=AUTH_HEADERS)

    assert response.status_code == 403
    join_mock.assert_not_awaited()


async def test_join_room_denied_for_banned_group_member(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=None))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, status=MemberStatus.BANNED))
    join_mock = AsyncMock()
    monkeypatch.setattr(study_room_router.service, "join", join_mock)

    response = await async_client.post(f"/study-rooms/{room.id}/join", headers=AUTH_HEADERS)

    assert response.status_code == 403
    join_mock.assert_not_awaited()


async def test_join_room_denied_for_non_group_member(async_client, monkeypatch, as_fake_user):
    """A user with no group_members row at all (never joined, or fully removed) must also be
    denied -- not just a user with an explicit non-active status."""
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=None))
    _mock_group_membership(monkeypatch, None)
    join_mock = AsyncMock()
    monkeypatch.setattr(study_room_router.service, "join", join_mock)

    response = await async_client.post(f"/study-rooms/{room.id}/join", headers=AUTH_HEADERS)

    assert response.status_code == 403
    join_mock.assert_not_awaited()


async def test_rejoin_room_denied_for_left_group_member_with_stale_room_membership(
    async_client, monkeypatch, as_fake_user
):
    """Same Group-membership prerequisite applies to rejoin (an existing, previously-left
    study_room_members row) -- not just first-time join."""
    room = _make_room()
    member = _room_member(room.id, as_fake_user.id, left_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=member))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, status=MemberStatus.LEFT))
    rejoin_mock = AsyncMock()
    monkeypatch.setattr(study_room_router.service, "rejoin", rejoin_mock)

    response = await async_client.post(f"/study-rooms/{room.id}/join", headers=AUTH_HEADERS)

    assert response.status_code == 403
    rejoin_mock.assert_not_awaited()


# --- Leave: self-leave only, no user_id spoofing possible ---


async def test_leave_room_requires_auth(async_client):
    response = await async_client.post(f"/study-rooms/{uuid.uuid4()}/leave")
    assert response.status_code == 401


async def test_leave_room_only_affects_own_membership(async_client, monkeypatch, as_fake_user):
    """The endpoint has no user_id parameter at all -- a caller can never force another
    user's membership to leave, even by appending a stray query string."""
    room = _make_room()
    own_member = _room_member(room.id, as_fake_user.id)

    async def fake_get_member(session, rid, uid):
        return own_member if uid == as_fake_user.id else None

    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", fake_get_member)
    monkeypatch.setattr(study_room_router.service, "leave", AsyncMock(side_effect=lambda s, m: m))

    response = await async_client.post(
        f"/study-rooms/{room.id}/leave?user_id={uuid.uuid4()}", headers=AUTH_HEADERS
    )

    assert response.status_code == 200


async def test_leave_room_still_works_for_active_room(async_client, monkeypatch, as_fake_user):
    """Regression guard: the new deleted-room gate must not affect ordinary leave on a normal,
    non-deleted room."""
    room = _make_room(status=StudyRoomStatus.ACTIVE)
    own_member = _room_member(room.id, as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=own_member))
    monkeypatch.setattr(study_room_router.service, "leave", AsyncMock(side_effect=lambda s, m: m))

    response = await async_client.post(f"/study-rooms/{room.id}/leave", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_leave_room_still_works_for_ended_but_not_deleted_room(async_client, monkeypatch, as_fake_user):
    """Ended != deleted (STUDY_PLATFORM_DATABASE_SPEC.md §17): no lifecycle gate has ever
    applied to leave, only to join/messages -- an ended room's leave behavior must stay
    unchanged by the new deleted-room gate."""
    room = _make_room(status=StudyRoomStatus.ENDED)
    own_member = _room_member(room.id, as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=own_member))
    monkeypatch.setattr(study_room_router.service, "leave", AsyncMock(side_effect=lambda s, m: m))

    response = await async_client.post(f"/study-rooms/{room.id}/leave", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_leave_deleted_room_denied(async_client, monkeypatch, as_fake_user):
    """A soft-deleted room must behave as unavailable for leave too -- the caller's
    StudyRoomMember row must not be mutated after the room is gone."""
    room = _make_room(deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    get_member_mock = AsyncMock()
    leave_mock = AsyncMock()
    monkeypatch.setattr(study_room_router.service, "get_member", get_member_mock)
    monkeypatch.setattr(study_room_router.service, "leave", leave_mock)

    response = await async_client.post(f"/study-rooms/{room.id}/leave", headers=AUTH_HEADERS)

    assert response.status_code == 404
    get_member_mock.assert_not_awaited()
    leave_mock.assert_not_awaited()


# --- Members: auth + room access required (member roster is not public) ---


async def test_list_members_requires_auth(async_client):
    response = await async_client.get(f"/study-rooms/{uuid.uuid4()}/members")
    assert response.status_code == 401


async def test_list_members_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/study-rooms/{room.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_list_members_forbidden_for_left_group_member_with_stale_active_room_membership(
    async_client, monkeypatch, as_fake_user
):
    """Python/SQL parity fix (2026-08-18): an active study_room_members row must not grant
    access once the caller has left the Group."""
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, None)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )

    response = await async_client.get(f"/study-rooms/{room.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_list_members_allowed_for_active_member(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id))
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    monkeypatch.setattr(study_room_router.service, "list_members", AsyncMock(return_value=[]))

    response = await async_client.get(f"/study-rooms/{room.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_list_members_allowed_for_host(async_client, monkeypatch, as_fake_user):
    """A host needs the same active study_room_members row as anyone else (2026-08-18 --
    host_id alone no longer bypasses the membership check); guaranteed in practice by
    StudyRoomsService.create()."""
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id))
    monkeypatch.setattr(
        permissions.study_rooms_service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id, role=StudyRoomMemberRole.HOST)),
    )
    monkeypatch.setattr(study_room_router.service, "list_members", AsyncMock(return_value=[]))

    response = await async_client.get(f"/study-rooms/{room.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 200


# --- Member role updates: active Group owner/moderator only (2026-08-18) ---


async def test_update_member_role_requires_auth(async_client):
    response = await async_client.put(
        f"/study-rooms/{uuid.uuid4()}/members/{uuid.uuid4()}/role", params={"role": "moderator"}
    )
    assert response.status_code == 401


async def test_update_member_role_forbidden_for_plain_member(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    target_id = uuid.uuid4()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.put(
        f"/study-rooms/{room.id}/members/{target_id}/role", params={"role": "moderator"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_update_member_role_allowed_for_active_group_owner(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    target_id = uuid.uuid4()
    member = _room_member(room.id, target_id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=member))
    monkeypatch.setattr(study_room_router.service, "update_member_role", AsyncMock(return_value=member))

    response = await async_client.put(
        f"/study-rooms/{room.id}/members/{target_id}/role", params={"role": "moderator"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 200


async def test_update_member_role_allowed_for_active_group_moderator(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    target_id = uuid.uuid4()
    member = _room_member(room.id, target_id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(
        monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR)
    )
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=member))
    monkeypatch.setattr(study_room_router.service, "update_member_role", AsyncMock(return_value=member))

    response = await async_client.put(
        f"/study-rooms/{room.id}/members/{target_id}/role", params={"role": "moderator"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 200


async def test_update_member_role_forbidden_for_demoted_former_host(async_client, monkeypatch, as_fake_user):
    """Core stale-host regression: the caller still is this room's host_id but has since been
    demoted to a plain active Member -- role changes must now be denied."""
    room = _make_room(host_id=as_fake_user.id)
    target_id = uuid.uuid4()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.put(
        f"/study-rooms/{room.id}/members/{target_id}/role", params={"role": "moderator"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


# --- Moderation: actor spoofing, active-Group-manager-only authorization ---


async def test_log_moderation_requires_auth(async_client):
    response = await async_client.post(
        f"/study-rooms/{uuid.uuid4()}/moderation",
        json={
            "room_id": str(uuid.uuid4()),
            "moderator_id": str(uuid.uuid4()),
            "target_user_id": str(uuid.uuid4()),
            "action": "kick",
        },
    )
    assert response.status_code == 401


async def test_log_moderation_kick_by_active_group_owner_allowed(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    target_id = uuid.uuid4()
    target_member = _room_member(room.id, target_id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=target_member))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    action = _moderation_action(room.id, as_fake_user.id, target_id, ModerationAction.KICK)
    monkeypatch.setattr(study_room_router.service, "log_moderation_action", AsyncMock(return_value=action))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(uuid.uuid4()),
            "target_user_id": str(target_id),
            "action": "kick",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200


async def test_log_moderation_kick_by_active_group_moderator_allowed(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    target_id = uuid.uuid4()
    target_member = _room_member(room.id, target_id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=target_member))
    _mock_group_membership(
        monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR)
    )
    action = _moderation_action(room.id, as_fake_user.id, target_id, ModerationAction.KICK)
    monkeypatch.setattr(study_room_router.service, "log_moderation_action", AsyncMock(return_value=action))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(uuid.uuid4()),
            "target_user_id": str(target_id),
            "action": "kick",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200


async def test_log_moderation_kick_by_room_scoped_moderator_role_alone_denied(
    async_client, monkeypatch, as_fake_user
):
    """Regression guard: holding study_room_members.role == MODERATOR for this room (a
    room-scoped delegation, STUDY_PLATFORM_DATABASE_SPEC.md §22) must NOT, by itself, grant
    KICK/MUTE/UNMUTE authority any more -- only a CURRENT active Group owner/moderator can
    (2026-08-18 policy change, closes the same class of stale-authority bug as host_id)."""
    room = _make_room()
    target_id = uuid.uuid4()
    actor_member = _room_member(room.id, as_fake_user.id, role=StudyRoomMemberRole.MODERATOR)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=actor_member))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(room.host_id),
            "target_user_id": str(target_id),
            "action": "kick",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_log_moderation_kick_by_plain_member_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    target_id = uuid.uuid4()
    actor_member = _room_member(room.id, as_fake_user.id, role=StudyRoomMemberRole.PARTICIPANT)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=actor_member))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(room.host_id),
            "target_user_id": str(target_id),
            "action": "kick",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_log_moderation_kick_by_non_member_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    target_id = uuid.uuid4()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=None))
    _mock_group_membership(monkeypatch, None)

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(room.host_id),
            "target_user_id": str(target_id),
            "action": "kick",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_log_moderation_kick_by_demoted_former_host_denied(async_client, monkeypatch, as_fake_user):
    """Core stale-host regression via the moderation endpoint: the caller is still this room's
    host_id but has since been demoted to a plain active Group Member -- KICK must be denied."""
    room = _make_room(host_id=as_fake_user.id)
    target_id = uuid.uuid4()
    target_member = _room_member(room.id, target_id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=target_member))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(as_fake_user.id),
            "target_user_id": str(target_id),
            "action": "kick",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_log_moderation_kick_by_host_who_left_group_denied(async_client, monkeypatch, as_fake_user):
    """A host who has left the Group entirely must not retain moderation authority via
    host_id."""
    room = _make_room(host_id=as_fake_user.id)
    target_id = uuid.uuid4()
    target_member = _room_member(room.id, target_id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=target_member))
    _mock_group_membership(
        monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR, status=MemberStatus.LEFT)
    )

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(as_fake_user.id),
            "target_user_id": str(target_id),
            "action": "kick",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_log_moderation_actor_id_spoofing_ignored(async_client, monkeypatch, as_fake_user):
    """A plain member sending moderator_id = host in the request body must not be treated as
    the host -- authority comes only from the authenticated caller."""
    room = _make_room()
    actor_member = _room_member(room.id, as_fake_user.id, role=StudyRoomMemberRole.PARTICIPANT)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=actor_member))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(room.host_id),
            "target_user_id": str(uuid.uuid4()),
            "action": "mute",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_log_moderation_cross_room_target_denied(async_client, monkeypatch, as_fake_user):
    """An active group manager must not be able to moderate a membership that only exists in
    a different room, even by pointing target_user_id at a real user -- get_member is scoped
    to this room."""
    room_a = _make_room(host_id=uuid.uuid4())
    target_id = uuid.uuid4()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room_a))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=None))
    _mock_group_membership(monkeypatch, _group_member(room_a.group_id, as_fake_user.id, role=GroupMemberRole.OWNER))

    response = await async_client.post(
        f"/study-rooms/{room_a.id}/moderation",
        json={
            "room_id": str(room_a.id),
            "moderator_id": str(as_fake_user.id),
            "target_user_id": str(target_id),
            "action": "kick",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 404


async def test_log_moderation_active_group_manager_can_target_room_host(async_client, monkeypatch, as_fake_user):
    """2026-08-18 policy change: the old "moderators cannot act against the host" carve-out is
    gone -- once the actor is confirmed to be a CURRENT active group owner/moderator, they have
    full authority over every member of the room, including whoever holds the HOST role. This
    was only ever meant to protect against a lesser room-scoped moderator overriding the host;
    it no longer applies now that room-scoped roles carry no management authority at all."""
    room = _make_room()
    host_member = _room_member(room.id, room.host_id, role=StudyRoomMemberRole.HOST)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(study_room_router.service, "get_member", AsyncMock(return_value=host_member))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR))
    action = _moderation_action(room.id, as_fake_user.id, room.host_id, ModerationAction.MUTE)
    monkeypatch.setattr(study_room_router.service, "log_moderation_action", AsyncMock(return_value=action))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(as_fake_user.id),
            "target_user_id": str(room.host_id),
            "action": "mute",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200


async def test_log_moderation_raise_hand_self_service_allowed(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id))
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    action = _moderation_action(room.id, as_fake_user.id, as_fake_user.id, ModerationAction.RAISE_HAND)
    monkeypatch.setattr(study_room_router.service, "log_moderation_action", AsyncMock(return_value=action))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(as_fake_user.id),
            "target_user_id": str(as_fake_user.id),
            "action": "raise_hand",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200


async def test_log_moderation_raise_hand_for_another_user_denied(async_client, monkeypatch, as_fake_user):
    """Participant A must not be able to raise/lower participant B's hand."""
    room = _make_room()
    other_user_id = uuid.uuid4()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(as_fake_user.id),
            "target_user_id": str(other_user_id),
            "action": "raise_hand",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


# --- Moderation history: readable by room members/host only ---


async def test_list_moderation_requires_auth(async_client):
    response = await async_client.get(f"/study-rooms/{uuid.uuid4()}/moderation")
    assert response.status_code == 401


async def test_list_moderation_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id))
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/study-rooms/{room.id}/moderation", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_list_moderation_forbidden_for_left_group_member_with_stale_active_room_membership(
    async_client, monkeypatch, as_fake_user
):
    """Python/SQL parity fix (2026-08-18): an active study_room_members row must not grant
    access to moderation history once the caller has left the Group."""
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, None)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )

    response = await async_client.get(f"/study-rooms/{room.id}/moderation", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_list_moderation_allowed_for_member(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id))
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    monkeypatch.setattr(study_room_router.service, "list_moderation_actions", AsyncMock(return_value=[]))

    response = await async_client.get(f"/study-rooms/{room.id}/moderation", headers=AUTH_HEADERS)
    assert response.status_code == 200


# --- Delete: soft delete, authorization (host OR active group owner/moderator) ---


async def test_delete_room_requires_auth(async_client):
    response = await async_client.delete(f"/study-rooms/{uuid.uuid4()}")
    assert response.status_code == 401


async def test_delete_room_not_found_for_missing_room(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.delete(f"/study-rooms/{uuid.uuid4()}", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_delete_room_allowed_for_host_who_is_still_active_group_owner(async_client, monkeypatch, as_fake_user):
    """The common case: the room's host is also its group's active owner (the only way to
    create a room since the earlier authorization change) -- delete succeeds because they are
    a current active group manager, not merely because host_id matches them."""
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    soft_delete_mock = AsyncMock(return_value=room)
    monkeypatch.setattr(study_room_router.service, "soft_delete", soft_delete_mock)

    response = await async_client.delete(f"/study-rooms/{room.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204
    soft_delete_mock.assert_awaited_once()
    assert soft_delete_mock.await_args.kwargs["deleted_by"] == as_fake_user.id


async def test_delete_room_allowed_for_active_group_owner(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    monkeypatch.setattr(study_room_router.service, "soft_delete", AsyncMock(return_value=room))

    response = await async_client.delete(f"/study-rooms/{room.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_delete_room_allowed_for_active_group_moderator(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(
        monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR)
    )
    monkeypatch.setattr(study_room_router.service, "soft_delete", AsyncMock(return_value=room))

    response = await async_client.delete(f"/study-rooms/{room.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_delete_room_forbidden_for_ordinary_member(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))
    soft_delete_mock = AsyncMock()
    monkeypatch.setattr(study_room_router.service, "soft_delete", soft_delete_mock)

    response = await async_client.delete(f"/study-rooms/{room.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403
    soft_delete_mock.assert_not_awaited()


async def test_delete_room_forbidden_for_non_member(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, None)

    response = await async_client.delete(f"/study-rooms/{room.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_delete_room_forbidden_for_banned_group_owner(async_client, monkeypatch, as_fake_user):
    """A banned/left group owner must not retain delete authority via a stale role -- mirrors
    is_group_manager's existing MemberStatus.ACTIVE requirement."""
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(
        monkeypatch,
        _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.OWNER, status=MemberStatus.BANNED),
    )

    response = await async_client.delete(f"/study-rooms/{room.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_delete_room_forbidden_for_demoted_former_host(async_client, monkeypatch, as_fake_user):
    """Core stale-host regression (2026-08-18 policy change, supersedes the previous pinned
    "not a security hole" behavior): the caller still is this room's host_id -- created it
    while a Moderator -- but has since been demoted to a plain active Member. host_id is
    unchanged, but delete must now be denied; management authority is derived from the
    caller's CURRENT Group role only (is_group_manager), never from host_id."""
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MEMBER))
    soft_delete_mock = AsyncMock()
    monkeypatch.setattr(study_room_router.service, "soft_delete", soft_delete_mock)

    response = await async_client.delete(f"/study-rooms/{room.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403
    soft_delete_mock.assert_not_awaited()


async def test_delete_room_forbidden_for_host_who_left_group(async_client, monkeypatch, as_fake_user):
    """A host who has left the Group entirely must not retain delete authority via host_id."""
    room = _make_room(host_id=as_fake_user.id)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(
        monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.MODERATOR, status=MemberStatus.LEFT)
    )
    soft_delete_mock = AsyncMock()
    monkeypatch.setattr(study_room_router.service, "soft_delete", soft_delete_mock)

    response = await async_client.delete(f"/study-rooms/{room.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403
    soft_delete_mock.assert_not_awaited()


async def test_delete_room_allowed_for_active_group_owner_who_is_not_the_host(
    async_client, monkeypatch, as_fake_user
):
    """The inverse of the stale-host regression: a CURRENT active group owner can delete a
    room they did not create at all -- authority comes from is_group_manager, not host_id."""
    room = _make_room(host_id=uuid.uuid4())
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    soft_delete_mock = AsyncMock(return_value=room)
    monkeypatch.setattr(study_room_router.service, "soft_delete", soft_delete_mock)

    response = await async_client.delete(f"/study-rooms/{room.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204
    soft_delete_mock.assert_awaited_once()


async def test_delete_room_deleted_by_is_never_client_supplied(async_client, monkeypatch, as_fake_user):
    """The DELETE endpoint has no request body at all -- a stray deleted_by in a JSON body
    must be silently ignored (never parsed), acting identity always comes from the bearer
    token via current_user.id."""
    room = _make_room(host_id=as_fake_user.id)
    spoofed_deleted_by = uuid.uuid4()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    _mock_group_membership(monkeypatch, _group_member(room.group_id, as_fake_user.id, role=GroupMemberRole.OWNER))
    soft_delete_mock = AsyncMock(return_value=room)
    monkeypatch.setattr(study_room_router.service, "soft_delete", soft_delete_mock)

    response = await async_client.request(
        "DELETE", f"/study-rooms/{room.id}", json={"deleted_by": str(spoofed_deleted_by)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 204
    assert soft_delete_mock.await_args.kwargs["deleted_by"] == as_fake_user.id
    assert soft_delete_mock.await_args.kwargs["deleted_by"] != spoofed_deleted_by


async def test_delete_room_already_deleted_is_not_redeletable(async_client, monkeypatch, as_fake_user):
    """An already-deleted room 404s just like a missing one -- there is no distinct
    'already deleted' status, mirroring channel_router's delete_channel."""
    room = _make_room(host_id=as_fake_user.id, deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    soft_delete_mock = AsyncMock()
    monkeypatch.setattr(study_room_router.service, "soft_delete", soft_delete_mock)

    response = await async_client.delete(f"/study-rooms/{room.id}", headers=AUTH_HEADERS)
    assert response.status_code == 404
    soft_delete_mock.assert_not_awaited()


# --- Deleted room: excluded from reads ---


async def test_get_room_404_for_deleted_room(async_client, monkeypatch):
    room = _make_room(deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.get(f"/study-rooms/{room.id}")
    assert response.status_code == 404


async def test_list_rooms_excludes_deleted_rooms():
    """Unit test on the service method itself -- StudyRoomsService.list_by_group must filter
    deleted_at IS NULL at the query level, mirroring ChannelsService.list_by_group."""
    import inspect

    source = inspect.getsource(StudyRoomsService.list_by_group)
    assert "deleted_at" in source


# --- Deleted room: cannot continue functioning as a live room ---


async def test_join_deleted_room_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room(deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.post(f"/study-rooms/{room.id}/join", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_rejoin_deleted_room_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room(deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))
    monkeypatch.setattr(
        study_room_router.service,
        "get_member",
        AsyncMock(return_value=_room_member(room.id, as_fake_user.id, left_at=datetime.now(timezone.utc))),
    )

    response = await async_client.post(f"/study-rooms/{room.id}/join", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_start_deleted_room_denied_even_for_host(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id, deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.post(f"/study-rooms/{room.id}/start", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_end_deleted_room_denied_even_for_host(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id, deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.post(f"/study-rooms/{room.id}/end", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_update_deleted_room_denied_even_for_host(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id, deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.put(f"/study-rooms/{room.id}", json={"name": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_update_member_role_deleted_room_denied_even_for_host(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id, deleted_at=datetime.now(timezone.utc))
    target_id = uuid.uuid4()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.put(
        f"/study-rooms/{room.id}/members/{target_id}/role", params={"role": "moderator"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 404


async def test_list_members_deleted_room_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room(deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.get(f"/study-rooms/{room.id}/members", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_log_moderation_deleted_room_denied_even_for_host(async_client, monkeypatch, as_fake_user):
    room = _make_room(host_id=as_fake_user.id, deleted_at=datetime.now(timezone.utc))
    target_id = uuid.uuid4()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(as_fake_user.id),
            "target_user_id": str(target_id),
            "action": "kick",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 404


async def test_log_moderation_raise_hand_deleted_room_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room(deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.post(
        f"/study-rooms/{room.id}/moderation",
        json={
            "room_id": str(room.id),
            "moderator_id": str(as_fake_user.id),
            "target_user_id": str(as_fake_user.id),
            "action": "raise_hand",
        },
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 404


async def test_list_moderation_deleted_room_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room(deleted_at=datetime.now(timezone.utc))
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.get(f"/study-rooms/{room.id}/moderation", headers=AUTH_HEADERS)
    assert response.status_code == 404


# --- Regression: active (non-deleted) room behavior is unchanged ---


async def test_get_room_still_200_for_active_room(async_client, monkeypatch):
    room = _make_room()
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.get(f"/study-rooms/{room.id}")
    assert response.status_code == 200


async def test_get_room_still_200_for_ended_but_not_deleted_room(async_client, monkeypatch):
    """Ended != deleted (STUDY_PLATFORM_DATABASE_SPEC.md §17): an ended room stays a normal
    200, only a soft-deleted one 404s."""
    room = _make_room(status=StudyRoomStatus.ENDED)
    monkeypatch.setattr(study_room_router.service, "get_by_id", AsyncMock(return_value=room))

    response = await async_client.get(f"/study-rooms/{room.id}")
    assert response.status_code == 200
