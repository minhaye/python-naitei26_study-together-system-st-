import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.core import permissions
from app.db.enums import GroupMemberRole, MemberStatus
from app.db.session import get_db_session
from app.groups.entities.group_entity import GroupMember
from app.main import app
from app.notes.entities.note_entity import Note
from app.notes.routers import note_router
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
def fake_user():
    return CurrentUser(id=uuid.uuid4(), email="user@example.com", role="authenticated")


@pytest.fixture
def as_fake_user(fake_user):
    app.dependency_overrides[get_current_user] = lambda: fake_user
    yield fake_user
    app.dependency_overrides.pop(get_current_user, None)


def _group_member(group_id, user_id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE) -> GroupMember:
    return GroupMember(group_id=group_id, user_id=user_id, role=role, status=status)


def _make_note(group_id, author_id, content="Hello", title=None) -> Note:
    now = datetime.now(timezone.utc)
    note = Note(
        id=uuid.uuid4(),
        group_id=group_id,
        author_id=author_id,
        title=title,
        content=content,
        created_at=now,
        updated_at=now,
    )
    note.author = Profile(id=author_id, username=None, display_name="Author", avatar_url=None)
    return note


def _grant_group_access(monkeypatch, user_id, role=GroupMemberRole.MEMBER, status=MemberStatus.ACTIVE, group_id=None):
    """Mocks the real is_active_group_member/is_group_manager chain (both read via
    permissions.groups_service.get_member), not those functions themselves -- mirrors
    test_messages.py/test_study_rooms.py's preferred style."""
    monkeypatch.setattr(
        permissions.groups_service,
        "get_member",
        AsyncMock(return_value=_group_member(group_id or uuid.uuid4(), user_id, role, status)),
    )


def _deny_group_access(monkeypatch):
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))


def _fake_session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    return session


def _use_fake_session():
    async def _session():
        yield _fake_session()

    app.dependency_overrides[get_db_session] = _session


# --- create: manager-only, requires active Group membership ---


@pytest.mark.parametrize("role", [GroupMemberRole.OWNER, GroupMemberRole.MODERATOR])
async def test_create_note_success_for_manager(async_client, monkeypatch, as_fake_user, role):
    group_id = uuid.uuid4()
    _grant_group_access(monkeypatch, as_fake_user.id, role=role, group_id=group_id)

    created = _make_note(group_id, as_fake_user.id, content="My note")
    monkeypatch.setattr(note_router.service, "create", AsyncMock(return_value=created))
    _use_fake_session()

    response = await async_client.post(
        "/notes", json={"group_id": str(group_id), "content": "My note"}, headers=AUTH_HEADERS
    )

    assert response.status_code == 201
    body = response.json()
    assert body["content"] == "My note"
    assert body["group_id"] == str(group_id)
    assert body["author_id"] == str(as_fake_user.id)


async def test_create_note_forbidden_for_member(async_client, monkeypatch, as_fake_user):
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.MEMBER)

    response = await async_client.post(
        "/notes", json={"group_id": str(uuid.uuid4()), "content": "x"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_note_forbidden_non_member(async_client, monkeypatch, as_fake_user):
    _deny_group_access(monkeypatch)

    response = await async_client.post(
        "/notes", json={"group_id": str(uuid.uuid4()), "content": "x"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


@pytest.mark.parametrize("status", [MemberStatus.LEFT, MemberStatus.BANNED])
async def test_create_note_forbidden_inactive_member(async_client, monkeypatch, as_fake_user, status):
    """A left/removed/banned Group member must not retain write access via a stale
    membership row, even if that row still carries an Owner/Moderator role."""
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.OWNER, status=status)

    response = await async_client.post(
        "/notes", json={"group_id": str(uuid.uuid4()), "content": "x"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_note_requires_auth(async_client):
    response = await async_client.post("/notes", json={"group_id": str(uuid.uuid4()), "content": "x"})
    assert response.status_code == 401


async def test_create_note_title_too_long_rejected(async_client, as_fake_user):
    response = await async_client.post(
        "/notes",
        json={"group_id": str(uuid.uuid4()), "title": "x" * 101, "content": "ok"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


async def test_create_note_content_too_long_rejected(async_client, as_fake_user):
    response = await async_client.post(
        "/notes",
        json={"group_id": str(uuid.uuid4()), "content": "x" * 2001},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


# --- list: any active Group member can read ---


async def test_list_notes_success_for_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.MEMBER, group_id=group_id)

    notes = [_make_note(group_id, uuid.uuid4(), content="A"), _make_note(group_id, uuid.uuid4(), content="B")]
    monkeypatch.setattr(note_router.service, "list_by_group", AsyncMock(return_value=notes))

    response = await async_client.get("/notes", params={"group_id": str(group_id)}, headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.parametrize("role", [GroupMemberRole.OWNER, GroupMemberRole.MODERATOR])
async def test_list_notes_success_for_manager(async_client, monkeypatch, as_fake_user, role):
    group_id = uuid.uuid4()
    _grant_group_access(monkeypatch, as_fake_user.id, role=role, group_id=group_id)
    monkeypatch.setattr(note_router.service, "list_by_group", AsyncMock(return_value=[]))

    response = await async_client.get("/notes", params={"group_id": str(group_id)}, headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_list_notes_forbidden_non_member(async_client, monkeypatch, as_fake_user):
    _deny_group_access(monkeypatch)

    response = await async_client.get("/notes", params={"group_id": str(uuid.uuid4())}, headers=AUTH_HEADERS)
    assert response.status_code == 403


@pytest.mark.parametrize("status", [MemberStatus.LEFT, MemberStatus.BANNED])
async def test_list_notes_forbidden_inactive_member(async_client, monkeypatch, as_fake_user, status):
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.MEMBER, status=status)

    response = await async_client.get("/notes", params={"group_id": str(uuid.uuid4())}, headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- get: any active Group member can read (Realtime hydration) ---


async def test_get_note_success_for_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    note = _make_note(group_id, uuid.uuid4(), content="Hello")
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=note))
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.MEMBER, group_id=group_id)

    response = await async_client.get(f"/notes/{note.id}", headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(note.id)
    assert body["content"] == "Hello"
    assert body["author"]["id"] == str(note.author_id)


async def test_get_note_not_found(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.get(f"/notes/{uuid.uuid4()}", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_get_note_forbidden_non_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    note = _make_note(group_id, uuid.uuid4(), content="Hello")
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=note))
    _deny_group_access(monkeypatch)

    response = await async_client.get(f"/notes/{note.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


@pytest.mark.parametrize("status", [MemberStatus.LEFT, MemberStatus.BANNED])
async def test_get_note_forbidden_inactive_member(async_client, monkeypatch, as_fake_user, status):
    group_id = uuid.uuid4()
    note = _make_note(group_id, uuid.uuid4(), content="Hello")
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=note))
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.MEMBER, status=status, group_id=group_id)

    response = await async_client.get(f"/notes/{note.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_get_note_requires_auth(async_client):
    response = await async_client.get(f"/notes/{uuid.uuid4()}")
    assert response.status_code == 401


# --- update: manager-only, independent of note authorship ---


@pytest.mark.parametrize("role", [GroupMemberRole.OWNER, GroupMemberRole.MODERATOR])
async def test_update_note_success_for_manager_on_note_by_another_manager(async_client, monkeypatch, as_fake_user, role):
    group_id = uuid.uuid4()
    other_author_id = uuid.uuid4()
    note = _make_note(group_id, other_author_id, content="Old")
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=note))
    _grant_group_access(monkeypatch, as_fake_user.id, role=role, group_id=group_id)

    updated = _make_note(group_id, other_author_id, content="New")
    monkeypatch.setattr(note_router.service, "update", AsyncMock(return_value=updated))
    _use_fake_session()

    response = await async_client.put(f"/notes/{note.id}", json={"content": "New"}, headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["content"] == "New"
    # author_id is preserved as the original creator, not overwritten by the editing manager.
    assert body["author_id"] == str(other_author_id)


async def test_update_note_not_found(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.put(f"/notes/{uuid.uuid4()}", json={"content": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_update_note_forbidden_for_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    note = _make_note(group_id, uuid.uuid4(), content="Old")
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=note))
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.MEMBER, group_id=group_id)

    response = await async_client.put(f"/notes/{note.id}", json={"content": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_update_note_forbidden_for_author_who_is_a_plain_member(async_client, monkeypatch, as_fake_user):
    """Authorship no longer grants mutation power -- even the original author is denied if
    they are only a plain Member, not a Group Owner/Moderator."""
    group_id = uuid.uuid4()
    note = _make_note(group_id, as_fake_user.id, content="Old")
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=note))
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.MEMBER, group_id=group_id)

    response = await async_client.put(f"/notes/{note.id}", json={"content": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


@pytest.mark.parametrize("status", [MemberStatus.LEFT, MemberStatus.BANNED])
async def test_update_note_forbidden_inactive_member(async_client, monkeypatch, as_fake_user, status):
    group_id = uuid.uuid4()
    note = _make_note(group_id, uuid.uuid4(), content="Old")
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=note))
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.OWNER, status=status, group_id=group_id)

    response = await async_client.put(f"/notes/{note.id}", json={"content": "New"}, headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_update_note_title_too_long_rejected(async_client, as_fake_user):
    response = await async_client.put(
        f"/notes/{uuid.uuid4()}", json={"title": "x" * 101}, headers=AUTH_HEADERS
    )
    assert response.status_code == 422


async def test_update_note_content_too_long_rejected(async_client, as_fake_user):
    response = await async_client.put(
        f"/notes/{uuid.uuid4()}", json={"content": "x" * 2001}, headers=AUTH_HEADERS
    )
    assert response.status_code == 422


# --- delete: manager-only, independent of note authorship ---


@pytest.mark.parametrize("role", [GroupMemberRole.OWNER, GroupMemberRole.MODERATOR])
async def test_delete_note_success_for_manager_on_note_by_another_manager(async_client, monkeypatch, as_fake_user, role):
    group_id = uuid.uuid4()
    note = _make_note(group_id, uuid.uuid4(), content="Old")
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=note))
    _grant_group_access(monkeypatch, as_fake_user.id, role=role, group_id=group_id)
    monkeypatch.setattr(note_router.service, "delete", AsyncMock(return_value=None))
    _use_fake_session()

    response = await async_client.delete(f"/notes/{note.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_delete_note_not_found(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.delete(f"/notes/{uuid.uuid4()}", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_delete_note_forbidden_for_member(async_client, monkeypatch, as_fake_user):
    group_id = uuid.uuid4()
    note = _make_note(group_id, uuid.uuid4(), content="Old")
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=note))
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.MEMBER, group_id=group_id)

    response = await async_client.delete(f"/notes/{note.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


@pytest.mark.parametrize("status", [MemberStatus.LEFT, MemberStatus.BANNED])
async def test_delete_note_forbidden_inactive_member(async_client, monkeypatch, as_fake_user, status):
    group_id = uuid.uuid4()
    note = _make_note(group_id, uuid.uuid4(), content="Old")
    monkeypatch.setattr(note_router.service, "get_by_id", AsyncMock(return_value=note))
    _grant_group_access(monkeypatch, as_fake_user.id, role=GroupMemberRole.MODERATOR, status=status, group_id=group_id)

    response = await async_client.delete(f"/notes/{note.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403
