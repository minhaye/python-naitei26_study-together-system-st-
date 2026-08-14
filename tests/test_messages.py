import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.channels.entities.channel_entity import Channel
from app.conversations.entities.conversation_entity import Conversation
from app.core import permissions
from app.db.enums import ConversationType, GroupMemberRole, MemberStatus
from app.db.session import get_db_session
from app.groups.entities.group_entity import GroupMember
from app.main import app
from app.messages.entities.message_entity import Message
from app.messages.routers import message_router
from app.messages.services.message_service import MessagesService, _decode_cursor, _encode_cursor

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


def _make_channel(group_id=None, is_private=False):
    return Channel(
        id=uuid.uuid4(),
        group_id=group_id or uuid.uuid4(),
        name="general",
        is_private=is_private,
        created_by=uuid.uuid4(),
    )


def _make_conversation(channel: Channel) -> Conversation:
    return Conversation(
        id=uuid.uuid4(), type=ConversationType.CHANNEL, channel_id=channel.id, created_by=channel.created_by
    )


def _make_message(sender_id, conversation_id, content="Hello", attachment_path=None):
    now = datetime.now(timezone.utc)
    return Message(
        id=uuid.uuid4(),
        conversation_id=conversation_id,
        sender_id=sender_id,
        content=content,
        attachment_path=attachment_path,
        created_at=now,
        updated_at=now,
    )


def _active_member(group_id, user_id, role=GroupMemberRole.MEMBER):
    return GroupMember(group_id=group_id, user_id=user_id, role=role, status=MemberStatus.ACTIVE)


def _wire_conversation(monkeypatch, channel: Channel, conversation: Conversation):
    """Common wiring for conversation-centric endpoints: the router loads the conversation
    via message_router.conversation_service, while can_access_conversation (in
    app/core/permissions.py) loads the channel via its own ChannelsService instance
    (permissions.channels_service) -- a different object from message_router.channel_service,
    which is only used by the router for attachment path derivation."""
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.channels_service, "get_by_id", AsyncMock(return_value=channel))


# --- Send message ---


async def test_create_message_requires_auth(async_client):
    response = await async_client.post(f"/conversations/{uuid.uuid4()}/messages", json={"content": "hi"})
    assert response.status_code == 401


async def test_create_message_not_found_for_missing_conversation(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/conversations/{uuid.uuid4()}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 404


async def test_create_message_forbidden_when_not_group_member(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_message_forbidden_when_banned(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    banned_member = GroupMember(
        group_id=channel.group_id, user_id=as_fake_user.id, role=GroupMemberRole.MEMBER, status=MemberStatus.BANNED
    )
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=banned_member))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_message_forbidden_private_channel_without_channel_membership(
    async_client, monkeypatch, as_fake_user
):
    channel = _make_channel(is_private=True)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    monkeypatch.setattr(permissions.channels_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"content": "hi"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_message_valid_member_returns_201(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    created = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id, content="Hello everyone")
    create_mock = AsyncMock(return_value=created)
    monkeypatch.setattr(message_router.message_service, "create", create_mock)

    other_user_id = str(uuid.uuid4())
    response = await async_client.post(
        f"/conversations/{conversation.id}/messages",
        json={"content": "Hello everyone", "sender_id": other_user_id},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["sender_id"] == str(as_fake_user.id)
    assert body["sender_id"] != other_user_id
    # sender_id must always come from the JWT, never from the request body.
    assert create_mock.await_args.kwargs["sender_id"] == as_fake_user.id


async def test_create_message_empty_content_and_attachment_returns_422(async_client, as_fake_user):
    response = await async_client.post(
        f"/conversations/{uuid.uuid4()}/messages",
        json={"content": "   ", "attachment_path": None},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


# --- Get messages ---


async def test_list_messages_forbidden_without_access(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_list_messages_valid_user_returns_200_and_uses_path_conversation_id(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    message = _make_message(sender_id=as_fake_user.id, conversation_id=conversation.id)
    list_mock = AsyncMock(return_value=([message], None))
    monkeypatch.setattr(message_router.message_service, "list_by_conversation", list_mock)

    response = await async_client.get(f"/conversations/{conversation.id}/messages", headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["conversation_id"] == str(conversation.id)
    assert body["next_cursor"] is None

    _, called_conversation_id = list_mock.await_args.args[:2]
    assert called_conversation_id == conversation.id


# --- Edit / Delete ---


async def test_update_message_forbidden_for_non_sender(async_client, monkeypatch, as_fake_user):
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=uuid.uuid4())
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))

    response = await async_client.patch(
        f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_update_message_success_for_sender(async_client, monkeypatch, as_fake_user):
    message = _make_message(sender_id=as_fake_user.id, conversation_id=uuid.uuid4())
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    updated = _make_message(sender_id=as_fake_user.id, conversation_id=message.conversation_id, content="edited")
    monkeypatch.setattr(message_router.message_service, "update", AsyncMock(return_value=updated))

    response = await async_client.patch(
        f"/messages/{message.id}", json={"content": "edited"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 200
    assert response.json()["content"] == "edited"


async def test_delete_message_forbidden_for_non_sender_non_manager(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=conversation.id)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_delete_message_success_for_sender(async_client, monkeypatch, as_fake_user):
    message = _make_message(sender_id=as_fake_user.id, conversation_id=uuid.uuid4())
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.message_service, "delete", AsyncMock(return_value=None))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


async def test_delete_message_success_for_group_manager(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    message = _make_message(sender_id=uuid.uuid4(), conversation_id=conversation.id)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service,
        "get_member",
        AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id, role=GroupMemberRole.OWNER)),
    )
    monkeypatch.setattr(message_router.message_service, "delete", AsyncMock(return_value=None))

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


# --- Pagination (service-level) ---


class _FakeScalars:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _FakeResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return _FakeScalars(self._items)


async def test_list_by_conversation_returns_next_cursor_when_more_rows_exist():
    conversation_id = uuid.uuid4()
    messages = [_make_message(sender_id=uuid.uuid4(), conversation_id=conversation_id) for _ in range(3)]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=_FakeResult(messages))

    result, next_cursor = await MessagesService().list_by_conversation(session, conversation_id, limit=2)

    assert len(result) == 2
    assert next_cursor is not None


async def test_list_by_conversation_no_next_cursor_on_exact_page():
    conversation_id = uuid.uuid4()
    messages = [_make_message(sender_id=uuid.uuid4(), conversation_id=conversation_id) for _ in range(2)]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=_FakeResult(messages))

    result, next_cursor = await MessagesService().list_by_conversation(session, conversation_id, limit=2)

    assert len(result) == 2
    assert next_cursor is None


def test_cursor_round_trip():
    created_at = datetime.now(timezone.utc)
    message_id = uuid.uuid4()
    cursor = _encode_cursor(created_at, message_id)
    decoded_created_at, decoded_id = _decode_cursor(cursor)
    assert decoded_id == message_id
    assert decoded_created_at == created_at


def test_decode_cursor_invalid_raises():
    with pytest.raises(ValueError):
        _decode_cursor("not-a-valid-cursor")


# --- Send message with attachment ---


async def test_create_message_with_valid_attachment_returns_201(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    path = message_router.attachments_service.build_object_path(channel.group_id, channel.id, as_fake_user.id, "lesson.pdf")
    monkeypatch.setattr(message_router.attachments_service, "object_exists", AsyncMock(return_value=True))
    created = _make_message(
        sender_id=as_fake_user.id, conversation_id=conversation.id, content=None, attachment_path=path
    )
    monkeypatch.setattr(message_router.message_service, "create", AsyncMock(return_value=created))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"attachment_path": path}, headers=AUTH_HEADERS
    )
    assert response.status_code == 201
    assert response.json()["attachment_path"] == path


async def test_create_message_rejects_attachment_from_other_channel(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    foreign_path = message_router.attachments_service.build_object_path(
        uuid.uuid4(), uuid.uuid4(), as_fake_user.id, "secret.pdf"
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"attachment_path": foreign_path}, headers=AUTH_HEADERS
    )
    assert response.status_code == 403


async def test_create_message_rejects_nonexistent_attachment(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(message_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    path = message_router.attachments_service.build_object_path(channel.group_id, channel.id, as_fake_user.id, "lesson.pdf")
    monkeypatch.setattr(message_router.attachments_service, "object_exists", AsyncMock(return_value=False))

    response = await async_client.post(
        f"/conversations/{conversation.id}/messages", json={"attachment_path": path}, headers=AUTH_HEADERS
    )
    assert response.status_code == 400


# --- Delete message with attachment ---


async def test_delete_message_removes_attachment_object(async_client, monkeypatch, as_fake_user):
    path = "groups/a/channels/b/c/d/lesson.pdf"
    message = _make_message(sender_id=as_fake_user.id, conversation_id=uuid.uuid4(), content=None, attachment_path=path)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.message_service, "delete", AsyncMock(return_value=None))
    delete_object_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(message_router.attachments_service, "delete_object", delete_object_mock)

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)

    assert response.status_code == 204
    delete_object_mock.assert_awaited_once_with(path)


async def test_delete_message_succeeds_even_if_storage_cleanup_fails(async_client, monkeypatch, as_fake_user):
    from app.attachments.services.attachment_service import AttachmentStorageError

    path = "groups/a/channels/b/c/d/lesson.pdf"
    message = _make_message(sender_id=as_fake_user.id, conversation_id=uuid.uuid4(), content=None, attachment_path=path)
    monkeypatch.setattr(message_router.message_service, "get_by_id", AsyncMock(return_value=message))
    monkeypatch.setattr(message_router.message_service, "delete", AsyncMock(return_value=None))
    monkeypatch.setattr(
        message_router.attachments_service, "delete_object", AsyncMock(side_effect=AttachmentStorageError("boom"))
    )

    response = await async_client.delete(f"/messages/{message.id}", headers=AUTH_HEADERS)

    assert response.status_code == 204
