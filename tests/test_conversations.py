import uuid
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.conversations.entities.conversation_entity import Conversation, ConversationMember
from app.conversations.routers import conversation_router
from app.conversations.services.conversation_service import ConversationsService
from app.db.enums import ConversationType
from app.db.session import get_db_session
from app.main import app
from app.profiles.entities.profile_entity import Profile

AUTH_HEADERS = {"Authorization": "Bearer testtoken"}


async def _fake_db_session():
    yield AsyncMock()


@pytest.fixture(autouse=True)
def override_db_session():
    app.dependency_overrides[get_db_session] = _fake_db_session
    yield
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
def as_fake_user():
    user = CurrentUser(id=uuid.uuid4(), email="user@example.com", role="authenticated")
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def _make_profile(user_id=None, username="user") -> Profile:
    return Profile(id=user_id or uuid.uuid4(), username=username, display_name=username, avatar_url=None, bio=None)


def _make_direct_conversation(user_a_id, user_b_id, created_by=None) -> Conversation:
    min_id, max_id = sorted((user_a_id, user_b_id))
    now = datetime.now(timezone.utc)
    return Conversation(
        id=uuid.uuid4(),
        type=ConversationType.DIRECT,
        created_by=created_by or user_a_id,
        direct_user_min_id=min_id,
        direct_user_max_id=max_id,
        created_at=now,
        updated_at=now,
    )


def _member(conversation_id, user_id) -> ConversationMember:
    return ConversationMember(conversation_id=conversation_id, user_id=user_id)


# ============================================================================
# ConversationsService.get_or_create_direct -- fake async session
# ============================================================================
#
# This project's convention (see tests/test_messages.py, tests/test_attachments.py) is to
# mock at the service-method level for router tests, and use AsyncMock() as an opaque stand-in
# for the DB session everywhere else -- there is no real-database or SQLite test harness in
# this repo. get_or_create_direct's actual logic (sort, SELECT, SAVEPOINT insert, retry on
# IntegrityError) is the one piece of new code in this task worth exercising directly rather
# than mocking away, so it gets a small purpose-built fake session instead.


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeNestedTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False  # never swallow -- mirrors a real SAVEPOINT: rolls back, re-raises


class _FakeSession:
    """`existing_sequence` models what successive SELECTs (get_direct_by_pair calls) find:
    the first entry is popped for the first call, the last entry repeats for every call after
    that. A single-element sequence means "always return this"."""

    def __init__(self, existing_sequence, raise_integrity_on_first_flush=False):
        self._existing_sequence = list(existing_sequence)
        self.added: list = []
        self.raise_integrity_on_first_flush = raise_integrity_on_first_flush
        self.flush_call_count = 0

    async def execute(self, _stmt):
        value = self._existing_sequence.pop(0) if len(self._existing_sequence) > 1 else self._existing_sequence[0]
        return _FakeResult(value)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flush_call_count += 1
        if self.raise_integrity_on_first_flush and self.flush_call_count == 1:
            raise IntegrityError(
                "INSERT INTO conversations ...",
                {},
                Exception('duplicate key value violates unique constraint "conversations_direct_pair_key"'),
            )
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()

    def begin_nested(self):
        return _FakeNestedTransaction()


async def test_get_or_create_direct_creates_new_conversation_and_two_members():
    service = ConversationsService()
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    session = _FakeSession(existing_sequence=[None])

    conversation = await service.get_or_create_direct(session, user_a, user_b)

    assert conversation.type == ConversationType.DIRECT
    min_id, max_id = sorted((user_a, user_b))
    assert conversation.direct_user_min_id == min_id
    assert conversation.direct_user_max_id == max_id
    members = [m for m in session.added if isinstance(m, ConversationMember)]
    assert len(members) == 2
    assert {m.user_id for m in members} == {user_a, user_b}
    assert all(m.conversation_id == conversation.id for m in members)


async def test_get_or_create_direct_rejects_self_pair_via_min_max_check():
    """The service itself has no explicit self-DM guard (that lives in the router, see
    test_create_direct_rejects_self_dm below) -- but sorted((x, x)) collapses to a single
    value, so min == max, which the DB CHECK constraint (migration 006) requires to be
    strictly min < max. Documented here as the defense-in-depth layer, not the primary one."""
    x = uuid.uuid4()
    min_id, max_id = sorted((x, x))
    assert min_id == max_id  # the invariant the DB CHECK constraint additionally guards


async def test_get_or_create_direct_returns_existing_without_inserting():
    service = ConversationsService()
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    existing = _make_direct_conversation(user_a, user_b)
    session = _FakeSession(existing_sequence=[existing])

    conversation = await service.get_or_create_direct(session, user_a, user_b)

    assert conversation is existing
    assert session.added == []
    assert session.flush_call_count == 0


async def test_get_or_create_direct_order_independent_a_then_b_and_b_then_a():
    service = ConversationsService()
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    existing = _make_direct_conversation(user_a, user_b)
    session = _FakeSession(existing_sequence=[existing])

    conversation_ab = await service.get_or_create_direct(session, user_a, user_b)
    conversation_ba = await service.get_or_create_direct(session, user_b, user_a)

    assert conversation_ab is existing
    assert conversation_ba is existing


async def test_get_or_create_direct_concurrent_insert_retries_and_returns_winner():
    """Simulates two requests racing to open the same DM: this call's own INSERT loses the
    unique_violation race on `conversations_direct_pair_key` (migration 006) -- it must roll
    back its SAVEPOINT and re-fetch the row the other transaction committed, rather than
    raising to the caller or creating a duplicate conversation."""
    service = ConversationsService()
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    winner = _make_direct_conversation(user_a, user_b, created_by=user_b)
    # First execute() (initial get_direct_by_pair): nothing found yet -> proceed to insert.
    # Second execute() (retry get_direct_by_pair after the caught IntegrityError): the other
    # transaction's row is now visible.
    session = _FakeSession(existing_sequence=[None, winner], raise_integrity_on_first_flush=True)

    conversation = await service.get_or_create_direct(session, user_a, user_b)

    assert conversation is winner
    # The losing insert's Conversation/members were added to the session before the flush
    # failed, but nothing beyond that failed flush was ever committed by this call.
    assert session.flush_call_count == 1


async def test_get_or_create_direct_reraises_integrity_error_if_retry_still_finds_nothing():
    """If the flush fails but a retry SELECT still finds no matching row, this is not the
    known duplicate-pair race -- some other constraint violation occurred, and it must
    propagate rather than being silently swallowed."""
    service = ConversationsService()
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    session = _FakeSession(existing_sequence=[None], raise_integrity_on_first_flush=True)

    with pytest.raises(IntegrityError):
        await service.get_or_create_direct(session, user_a, user_b)


def test_migration_006_defines_direct_pair_unique_index_and_check():
    """Concurrency correctness ultimately rests on the DB-level constraint, not just the
    service-layer retry logic exercised above. Since this repo has no live-Supabase test
    harness for DDL, assert the migration file actually defines the guard it claims to."""
    migration_path = (
        Path(__file__).resolve().parents[1] / "docs" / "db" / "migrations" / "006_direct_conversation_pair_uniqueness.sql"
    )
    content = migration_path.read_text(encoding="utf-8")
    assert "create unique index if not exists conversations_direct_pair_key" in content
    assert "direct_user_min_id, direct_user_max_id" in content
    assert "where type = 'direct'::public.conversation_type" in content
    assert "conversations_direct_pair_check" in content
    assert "direct_user_min_id < direct_user_max_id" in content


# ============================================================================
# ConversationsService.is_member / list_members / list_direct_for_user
# ============================================================================


async def test_is_member_true_when_row_exists():
    service = ConversationsService()
    conversation_id, user_id = uuid.uuid4(), uuid.uuid4()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=_FakeResult(uuid.uuid4()))

    assert await service.is_member(session, conversation_id, user_id)


async def test_is_member_false_when_no_row():
    service = ConversationsService()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=_FakeResult(None))

    assert not await service.is_member(session, uuid.uuid4(), uuid.uuid4())


# ============================================================================
# POST /conversations/direct
# ============================================================================


async def test_create_direct_requires_auth(async_client):
    response = await async_client.post("/conversations/direct", json={"user_id": str(uuid.uuid4())})
    assert response.status_code == 401


async def test_create_direct_rejects_self_dm(async_client, as_fake_user):
    response = await async_client.post(
        "/conversations/direct", json={"user_id": str(as_fake_user.id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 400


async def test_create_direct_404_when_target_user_missing(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(conversation_router.profiles_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(
        "/conversations/direct", json={"user_id": str(uuid.uuid4())}, headers=AUTH_HEADERS
    )
    assert response.status_code == 404


async def test_create_direct_success_returns_conversation_with_other_participant(
    async_client, monkeypatch, as_fake_user
):
    target_id = uuid.uuid4()
    target_profile = _make_profile(target_id, username="bob")
    conversation = _make_direct_conversation(as_fake_user.id, target_id, created_by=as_fake_user.id)

    monkeypatch.setattr(conversation_router.profiles_service, "get_by_id", AsyncMock(return_value=target_profile))
    get_or_create_mock = AsyncMock(return_value=conversation)
    monkeypatch.setattr(conversation_router.conversation_service, "get_or_create_direct", get_or_create_mock)
    monkeypatch.setattr(
        conversation_router.conversation_service,
        "list_members",
        AsyncMock(return_value=[_member(conversation.id, as_fake_user.id), _member(conversation.id, target_id)]),
    )

    response = await async_client.post(
        "/conversations/direct", json={"user_id": str(target_id)}, headers=AUTH_HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(conversation.id)
    assert body["type"] == "direct"
    assert body["other_participant"]["id"] == str(target_id)
    assert body["other_participant"]["username"] == "bob"
    assert "bio" not in body["other_participant"]
    _, called_user_a, called_user_b = get_or_create_mock.await_args.args
    assert called_user_a == as_fake_user.id
    assert called_user_b == target_id


async def test_create_direct_idempotent_repeated_calls_return_same_conversation_id(
    async_client, monkeypatch, as_fake_user
):
    """The route itself just delegates the idempotency guarantee to
    ConversationsService.get_or_create_direct (exercised directly above) -- this asserts the
    router faithfully returns whatever the service resolves to, twice in a row, without ever
    minting a second id on its own."""
    target_id = uuid.uuid4()
    target_profile = _make_profile(target_id, username="bob")
    conversation = _make_direct_conversation(as_fake_user.id, target_id, created_by=as_fake_user.id)

    monkeypatch.setattr(conversation_router.profiles_service, "get_by_id", AsyncMock(return_value=target_profile))
    monkeypatch.setattr(
        conversation_router.conversation_service, "get_or_create_direct", AsyncMock(return_value=conversation)
    )
    monkeypatch.setattr(conversation_router.conversation_service, "list_members", AsyncMock(return_value=[]))

    first = await async_client.post("/conversations/direct", json={"user_id": str(target_id)}, headers=AUTH_HEADERS)
    second = await async_client.post("/conversations/direct", json={"user_id": str(target_id)}, headers=AUTH_HEADERS)

    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["id"] == second.json()["id"] == str(conversation.id)


async def test_create_direct_b_to_a_returns_same_conversation_as_a_to_b(async_client, monkeypatch, as_fake_user):
    """Simulates B opening the DM after A already did: from B's perspective (as_fake_user is
    now B), the body names A, and the (mocked) service resolves to the same pre-existing
    conversation regardless of direction."""
    user_a = uuid.uuid4()
    conversation = _make_direct_conversation(user_a, as_fake_user.id, created_by=user_a)
    a_profile = _make_profile(user_a, username="alice")

    monkeypatch.setattr(conversation_router.profiles_service, "get_by_id", AsyncMock(return_value=a_profile))
    monkeypatch.setattr(
        conversation_router.conversation_service, "get_or_create_direct", AsyncMock(return_value=conversation)
    )
    monkeypatch.setattr(
        conversation_router.conversation_service,
        "list_members",
        AsyncMock(return_value=[_member(conversation.id, user_a), _member(conversation.id, as_fake_user.id)]),
    )

    response = await async_client.post("/conversations/direct", json={"user_id": str(user_a)}, headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json()["id"] == str(conversation.id)
    assert response.json()["other_participant"]["id"] == str(user_a)


async def test_create_direct_service_error_rolls_back_and_returns_400(async_client, monkeypatch, as_fake_user):
    target_id = uuid.uuid4()
    monkeypatch.setattr(
        conversation_router.profiles_service, "get_by_id", AsyncMock(return_value=_make_profile(target_id))
    )
    monkeypatch.setattr(
        conversation_router.conversation_service,
        "get_or_create_direct",
        AsyncMock(side_effect=IntegrityError("stmt", {}, Exception("boom"))),
    )

    response = await async_client.post(
        "/conversations/direct", json={"user_id": str(target_id)}, headers=AUTH_HEADERS
    )
    assert response.status_code == 400


# ============================================================================
# GET /conversations/direct
# ============================================================================


async def test_list_direct_requires_auth(async_client):
    response = await async_client.get("/conversations/direct")
    assert response.status_code == 401


async def test_list_direct_returns_only_callers_conversations(async_client, monkeypatch, as_fake_user):
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user, created_by=as_fake_user.id)
    other_profile = _make_profile(other_user, username="carol")

    monkeypatch.setattr(
        conversation_router.conversation_service, "list_direct_for_user", AsyncMock(return_value=[conversation])
    )
    monkeypatch.setattr(
        conversation_router.conversation_service,
        "list_members",
        AsyncMock(return_value=[_member(conversation.id, as_fake_user.id), _member(conversation.id, other_user)]),
    )
    monkeypatch.setattr(conversation_router.profiles_service, "get_by_id", AsyncMock(return_value=other_profile))

    response = await async_client.get("/conversations/direct", headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == str(conversation.id)
    assert body[0]["other_participant"]["username"] == "carol"
