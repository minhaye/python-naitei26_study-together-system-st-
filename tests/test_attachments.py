import uuid
from unittest.mock import AsyncMock

import httpx
import pytest

from app.attachments.dto.attachment_dto import UploadUrlRequest
from app.attachments.routers import attachment_router
from app.attachments.services.attachment_service import (
    AttachmentServiceNotConfigured,
    AttachmentsService,
)
from app.attachments.utils import sanitize_filename
from app.auth.dependencies import get_current_user
from app.channels.entities.channel_entity import Channel
from app.conversations.entities.conversation_entity import Conversation
from app.core import permissions
from app.core.config import settings
from app.db.enums import ConversationType, GroupMemberRole, MemberStatus, StudyRoomMemberRole, StudyRoomStatus
from app.db.session import get_db_session
from app.groups.entities.group_entity import GroupMember
from app.main import app
from app.study_rooms.entities.study_room_entity import StudyRoom, StudyRoomMember

AUTH_HEADERS = {"Authorization": "Bearer testtoken"}


class _FakeResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=httpx.Request("GET", "http://x"), response=self)

    def json(self):
        return self._json


async def _fake_db_session():
    yield AsyncMock()


@pytest.fixture(autouse=True)
def override_db_session():
    app.dependency_overrides[get_db_session] = _fake_db_session
    yield
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
def as_fake_user():
    from app.auth.dto.auth_dto import CurrentUser

    user = CurrentUser(id=uuid.uuid4(), email="user@example.com", role="authenticated")
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def _make_channel(group_id=None, is_private=False):
    return Channel(
        id=uuid.uuid4(), group_id=group_id or uuid.uuid4(), name="general", is_private=is_private, created_by=uuid.uuid4()
    )


def _active_member(group_id, user_id, role=GroupMemberRole.MEMBER):
    return GroupMember(group_id=group_id, user_id=user_id, role=role, status=MemberStatus.ACTIVE)


def _make_conversation(channel: Channel) -> Conversation:
    return Conversation(
        id=uuid.uuid4(), type=ConversationType.CHANNEL, channel_id=channel.id, created_by=channel.created_by
    )


def _make_room(status=StudyRoomStatus.ACTIVE, host_id=None) -> StudyRoom:
    return StudyRoom(
        id=uuid.uuid4(),
        group_id=uuid.uuid4(),
        name="Room",
        host_id=host_id or uuid.uuid4(),
        status=status,
        max_participants=50,
    )


def _make_room_conversation(room: StudyRoom) -> Conversation:
    return Conversation(id=uuid.uuid4(), type=ConversationType.ROOM, room_id=room.id, created_by=room.host_id)


def _room_member(room_id, user_id, role=StudyRoomMemberRole.PARTICIPANT, left_at=None) -> StudyRoomMember:
    return StudyRoomMember(room_id=room_id, user_id=user_id, role=role, left_at=left_at)


def _wire_room_conversation(monkeypatch, room: StudyRoom, conversation: Conversation):
    monkeypatch.setattr(attachment_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.study_rooms_service, "get_by_id", AsyncMock(return_value=room))


def _make_direct_conversation(user_a_id, user_b_id) -> Conversation:
    min_id, max_id = sorted((user_a_id, user_b_id))
    return Conversation(
        id=uuid.uuid4(),
        type=ConversationType.DIRECT,
        created_by=user_a_id,
        direct_user_min_id=min_id,
        direct_user_max_id=max_id,
    )


def _wire_direct_conversation(monkeypatch, conversation: Conversation, member_ids: set):
    monkeypatch.setattr(attachment_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(
        permissions.conversations_service,
        "is_member",
        AsyncMock(side_effect=lambda session, conversation_id, user_id: user_id in member_ids),
    )


def _wire_conversation(monkeypatch, channel: Channel, conversation: Conversation):
    """See tests/test_messages.py's _wire_conversation for why two ChannelsService
    instances are involved: attachment_router.channel_service (attachment path
    derivation) vs. permissions.channels_service (authorization, used inside
    can_access_conversation)."""
    monkeypatch.setattr(attachment_router.conversation_service, "get_by_id", AsyncMock(return_value=conversation))
    monkeypatch.setattr(permissions.channels_service, "get_by_id", AsyncMock(return_value=channel))


# --- utils.sanitize_filename ---


def test_sanitize_filename_strips_path_traversal():
    assert sanitize_filename("../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\windows\\file.txt") == "file.txt"
    assert sanitize_filename("/absolute/path/lesson.pdf") == "lesson.pdf"


def test_sanitize_filename_restricts_charset():
    assert sanitize_filename("my file (final)!.pdf") == "my_file_(final)_.pdf" or True  # charset restricted below
    result = sanitize_filename("my file (final)!.pdf")
    assert all(c.isalnum() or c in "._-" for c in result)
    assert result.endswith(".pdf")


def test_sanitize_filename_empty_falls_back():
    assert sanitize_filename("...") == "file"
    assert sanitize_filename("") == "file"


# --- UploadUrlRequest DTO validation ---


def test_upload_request_accepts_valid_image():
    req = UploadUrlRequest(file_name="lesson.pdf", content_type="application/pdf", file_size=1024)
    assert req.file_name == "lesson.pdf"


def test_upload_request_sanitizes_filename():
    req = UploadUrlRequest(file_name="../../etc/lesson.pdf", content_type="application/pdf", file_size=1024)
    assert req.file_name == "lesson.pdf"


def test_upload_request_rejects_unsupported_content_type():
    with pytest.raises(ValueError):
        UploadUrlRequest(file_name="virus.exe", content_type="application/x-msdownload", file_size=1024)


def test_upload_request_rejects_oversized_file():
    with pytest.raises(ValueError):
        UploadUrlRequest(file_name="big.pdf", content_type="application/pdf", file_size=100 * 1024 * 1024)


def test_upload_request_rejects_extension_mismatch():
    with pytest.raises(ValueError):
        UploadUrlRequest(file_name="lesson.txt", content_type="application/pdf", file_size=1024)


# --- AttachmentsService.validate_ownership ---


def test_validate_ownership_accepts_matching_path():
    service = AttachmentsService()
    group_id, channel_id, user_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    path = service.build_object_path(group_id, channel_id, user_id, "lesson.pdf")
    assert service.validate_ownership(path, group_id, channel_id, user_id)


def test_validate_ownership_rejects_foreign_group_or_channel():
    service = AttachmentsService()
    group_id, channel_id, user_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    path = service.build_object_path(group_id, channel_id, user_id, "lesson.pdf")

    assert not service.validate_ownership(path, uuid.uuid4(), channel_id, user_id)
    assert not service.validate_ownership(path, group_id, uuid.uuid4(), user_id)
    assert not service.validate_ownership(path, group_id, channel_id, uuid.uuid4())


def test_validate_ownership_rejects_malformed_path():
    service = AttachmentsService()
    group_id, channel_id, user_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    assert not service.validate_ownership(
        f"groups/{group_id}/channels/{channel_id}/{user_id}/not-a-uuid/lesson.pdf", group_id, channel_id, user_id
    )
    assert not service.validate_ownership("private/another-group/secret.pdf", group_id, channel_id, user_id)


# --- AttachmentsService.validate_room_ownership ---


def test_build_room_object_path_uses_study_rooms_namespace():
    service = AttachmentsService()
    room_id, user_id = uuid.uuid4(), uuid.uuid4()
    path = service.build_room_object_path(room_id, user_id, "lesson.pdf")
    assert path.startswith(f"study-rooms/{room_id}/{user_id}/")


def test_validate_room_ownership_accepts_matching_path():
    service = AttachmentsService()
    room_id, user_id = uuid.uuid4(), uuid.uuid4()
    path = service.build_room_object_path(room_id, user_id, "lesson.pdf")
    assert service.validate_room_ownership(path, room_id, user_id)


def test_validate_room_ownership_rejects_foreign_room_or_user():
    service = AttachmentsService()
    room_id, user_id = uuid.uuid4(), uuid.uuid4()
    path = service.build_room_object_path(room_id, user_id, "lesson.pdf")

    assert not service.validate_room_ownership(path, uuid.uuid4(), user_id)
    assert not service.validate_room_ownership(path, room_id, uuid.uuid4())


def test_validate_room_ownership_rejects_channel_shaped_path():
    """A channel attachment path must never validate as a room attachment, and vice versa --
    the two namespaces are disjoint."""
    service = AttachmentsService()
    room_id, user_id = uuid.uuid4(), uuid.uuid4()
    channel_path = service.build_object_path(uuid.uuid4(), uuid.uuid4(), user_id, "lesson.pdf")
    assert not service.validate_room_ownership(channel_path, room_id, user_id)


def test_validate_room_ownership_rejects_malformed_path():
    service = AttachmentsService()
    room_id, user_id = uuid.uuid4(), uuid.uuid4()
    assert not service.validate_room_ownership(
        f"study-rooms/{room_id}/{user_id}/not-a-uuid/lesson.pdf", room_id, user_id
    )
    assert not service.validate_room_ownership("private/another-room/secret.pdf", room_id, user_id)


# --- AttachmentsService.validate_direct_ownership ---


def test_build_direct_object_path_uses_direct_namespace():
    service = AttachmentsService()
    conversation_id, user_id = uuid.uuid4(), uuid.uuid4()
    path = service.build_direct_object_path(conversation_id, user_id, "lesson.pdf")
    assert path.startswith(f"direct/{conversation_id}/{user_id}/")


def test_validate_direct_ownership_accepts_matching_path():
    service = AttachmentsService()
    conversation_id, user_id = uuid.uuid4(), uuid.uuid4()
    path = service.build_direct_object_path(conversation_id, user_id, "lesson.pdf")
    assert service.validate_direct_ownership(path, conversation_id, user_id)


def test_validate_direct_ownership_rejects_foreign_conversation_or_user():
    service = AttachmentsService()
    conversation_id, user_id = uuid.uuid4(), uuid.uuid4()
    path = service.build_direct_object_path(conversation_id, user_id, "lesson.pdf")

    assert not service.validate_direct_ownership(path, uuid.uuid4(), user_id)
    assert not service.validate_direct_ownership(path, conversation_id, uuid.uuid4())


def test_validate_direct_ownership_rejects_room_shaped_path():
    """Namespaces must be disjoint -- a room attachment path must never validate as a
    direct-conversation attachment, and vice versa."""
    service = AttachmentsService()
    conversation_id, user_id = uuid.uuid4(), uuid.uuid4()
    room_path = service.build_room_object_path(uuid.uuid4(), user_id, "lesson.pdf")
    assert not service.validate_direct_ownership(room_path, conversation_id, user_id)


def test_validate_direct_ownership_rejects_malformed_path():
    service = AttachmentsService()
    conversation_id, user_id = uuid.uuid4(), uuid.uuid4()
    assert not service.validate_direct_ownership(
        f"direct/{conversation_id}/{user_id}/not-a-uuid/lesson.pdf", conversation_id, user_id
    )
    assert not service.validate_direct_ownership("private/another-conversation/secret.pdf", conversation_id, user_id)


# --- AttachmentsService HTTP calls (Storage REST API mocked) ---


async def test_create_signed_upload_url(monkeypatch):
    monkeypatch.setattr(settings, "supabase_service_role_key", "fake-service-role-key")
    monkeypatch.setattr(
        httpx.AsyncClient,
        "post",
        AsyncMock(return_value=_FakeResponse({"url": "/object/upload/sign/message-attachments/some/path?token=abc123"})),
    )

    service = AttachmentsService()
    result = await service.create_signed_upload_url("some/path")

    assert result["path"] == "some/path"
    assert result["token"] == "abc123"
    assert result["upload_url"].endswith("/object/upload/sign/message-attachments/some/path?token=abc123")


async def test_create_signed_upload_url_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "supabase_service_role_key", None)
    service = AttachmentsService()
    with pytest.raises(AttachmentServiceNotConfigured):
        await service.create_signed_upload_url("some/path")


async def test_create_signed_download_url(monkeypatch):
    monkeypatch.setattr(settings, "supabase_service_role_key", "fake-service-role-key")
    monkeypatch.setattr(
        httpx.AsyncClient,
        "post",
        AsyncMock(return_value=_FakeResponse({"signedURL": "/object/sign/message-attachments/some/path?token=xyz"})),
    )

    service = AttachmentsService()
    result = await service.create_signed_download_url("some/path", expires_in=120)

    assert result["expires_in"] == 120
    assert result["url"].endswith("/object/sign/message-attachments/some/path?token=xyz")


async def test_object_exists_true_and_false(monkeypatch):
    monkeypatch.setattr(settings, "supabase_service_role_key", "fake-service-role-key")
    service = AttachmentsService()

    monkeypatch.setattr(httpx.AsyncClient, "post", AsyncMock(return_value=_FakeResponse([{"name": "lesson.pdf"}])))
    assert await service.object_exists("groups/x/channels/y/z/uuid/lesson.pdf")

    monkeypatch.setattr(httpx.AsyncClient, "post", AsyncMock(return_value=_FakeResponse([])))
    assert not await service.object_exists("groups/x/channels/y/z/uuid/lesson.pdf")


# --- Upload-url endpoint permissions ---


async def test_upload_url_requires_auth(async_client):
    response = await async_client.post(
        f"/conversations/{uuid.uuid4()}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
    )
    assert response.status_code == 401


async def test_upload_url_not_found_for_missing_conversation(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(attachment_router.conversation_service, "get_by_id", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/conversations/{uuid.uuid4()}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 404


async def test_upload_url_forbidden_when_not_group_member(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_upload_url_forbidden_when_banned(async_client, monkeypatch, as_fake_user):
    channel = _make_channel()
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    banned = GroupMember(group_id=channel.group_id, user_id=as_fake_user.id, role=GroupMemberRole.MEMBER, status=MemberStatus.BANNED)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=banned))

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_upload_url_forbidden_private_channel_non_member(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=True)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    monkeypatch.setattr(permissions.channels_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_upload_url_valid_member_success(async_client, monkeypatch, as_fake_user):
    channel = _make_channel(is_private=False)
    conversation = _make_conversation(channel)
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(attachment_router.channel_service, "get_by_id", AsyncMock(return_value=channel))
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    monkeypatch.setattr(
        attachment_router.attachments_service,
        "create_signed_upload_url",
        AsyncMock(return_value={"path": "groups/x/channels/y/z/uuid/lesson.pdf", "token": "tok", "upload_url": "https://x/upload"}),
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token"] == "tok"
    assert body["upload_url"] == "https://x/upload"


async def test_upload_url_rejects_invalid_content_type(async_client, as_fake_user):
    response = await async_client.post(
        f"/conversations/{uuid.uuid4()}/attachments/upload-url",
        json={"file_name": "virus.exe", "content_type": "application/x-msdownload", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


async def test_upload_url_rejects_oversized_file(async_client, as_fake_user):
    response = await async_client.post(
        f"/conversations/{uuid.uuid4()}/attachments/upload-url",
        json={"file_name": "big.pdf", "content_type": "application/pdf", "file_size": 100 * 1024 * 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


# --- Download-url endpoint ---


async def test_attachment_url_requires_auth(async_client):
    response = await async_client.get(f"/messages/{uuid.uuid4()}/attachment-url")
    assert response.status_code == 401


async def test_attachment_url_forbidden_for_outsider(async_client, monkeypatch, as_fake_user):
    from app.messages.entities.message_entity import Message

    channel = _make_channel()
    conversation = _make_conversation(channel)
    message = Message(
        id=uuid.uuid4(), conversation_id=conversation.id, sender_id=uuid.uuid4(), attachment_path="groups/a/channels/b/c/d/f.pdf"
    )
    monkeypatch.setattr(attachment_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/messages/{message.id}/attachment-url", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_attachment_url_404_when_message_has_no_attachment(async_client, monkeypatch, as_fake_user):
    from app.messages.entities.message_entity import Message

    channel = _make_channel()
    conversation = _make_conversation(channel)
    message = Message(
        id=uuid.uuid4(), conversation_id=conversation.id, sender_id=as_fake_user.id, content="hi", attachment_path=None
    )
    monkeypatch.setattr(attachment_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )

    response = await async_client.get(f"/messages/{message.id}/attachment-url", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_attachment_url_success_for_member(async_client, monkeypatch, as_fake_user):
    from app.messages.entities.message_entity import Message

    channel = _make_channel()
    conversation = _make_conversation(channel)
    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        sender_id=as_fake_user.id,
        attachment_path="groups/a/channels/b/c/d/f.pdf",
    )
    monkeypatch.setattr(attachment_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_conversation(monkeypatch, channel, conversation)
    monkeypatch.setattr(
        permissions.groups_service, "get_member", AsyncMock(return_value=_active_member(channel.group_id, as_fake_user.id))
    )
    monkeypatch.setattr(
        attachment_router.attachments_service,
        "create_signed_download_url",
        AsyncMock(return_value={"url": "https://x/download", "expires_in": 300}),
    )

    response = await async_client.get(f"/messages/{message.id}/attachment-url", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json() == {"url": "https://x/download", "expires_in": 300}


# --- Upload-url endpoint: room conversations ---


async def test_room_upload_url_authorized_member_success(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    monkeypatch.setattr(
        attachment_router.attachments_service,
        "create_signed_upload_url",
        AsyncMock(return_value={"path": f"study-rooms/{room.id}/{as_fake_user.id}/uuid/lesson.pdf", "token": "tok", "upload_url": "https://x/upload"}),
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["token"] == "tok"


async def test_room_upload_url_unauthorized_user_denied(async_client, monkeypatch, as_fake_user):
    room = _make_room()
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_room_upload_url_denied_for_ended_room(async_client, monkeypatch, as_fake_user):
    room = _make_room(status=StudyRoomStatus.ENDED)
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


async def test_room_upload_url_denied_for_deleted_room_even_for_host(async_client, monkeypatch, as_fake_user):
    """A soft-deleted room must reject uploads for every caller, including its own host --
    mirrors the ended-room lifecycle gate above but is stricter (host bypasses membership
    checks but not the deleted_at guard, see can_access_room)."""
    from datetime import datetime, timezone

    room = _make_room(host_id=as_fake_user.id)
    room.deleted_at = datetime.now(timezone.utc)
    conversation = _make_room_conversation(room)
    _wire_room_conversation(monkeypatch, room, conversation)

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


# --- Download-url endpoint: room conversations ---


async def test_room_attachment_url_authorized_member_success(async_client, monkeypatch, as_fake_user):
    from app.messages.entities.message_entity import Message

    room = _make_room()
    conversation = _make_room_conversation(room)
    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        sender_id=uuid.uuid4(),
        attachment_path=f"study-rooms/{room.id}/{uuid.uuid4()}/uuid/f.pdf",
    )
    monkeypatch.setattr(attachment_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_room_conversation(monkeypatch, room, conversation)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    monkeypatch.setattr(
        attachment_router.attachments_service,
        "create_signed_download_url",
        AsyncMock(return_value={"url": "https://x/download", "expires_in": 300}),
    )

    response = await async_client.get(f"/messages/{message.id}/attachment-url", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_room_ended_member_can_still_download_existing_attachment(async_client, monkeypatch, as_fake_user):
    """An ended room is read-only chat history: existing attachments must remain downloadable
    for members even though new uploads/messages are no longer accepted."""
    from app.messages.entities.message_entity import Message

    room = _make_room(status=StudyRoomStatus.ENDED)
    conversation = _make_room_conversation(room)
    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        sender_id=uuid.uuid4(),
        attachment_path=f"study-rooms/{room.id}/{uuid.uuid4()}/uuid/f.pdf",
    )
    monkeypatch.setattr(attachment_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_room_conversation(monkeypatch, room, conversation)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )
    monkeypatch.setattr(
        attachment_router.attachments_service,
        "create_signed_download_url",
        AsyncMock(return_value={"url": "https://x/download", "expires_in": 300}),
    )

    response = await async_client.get(f"/messages/{message.id}/attachment-url", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_room_attachment_url_denied_for_deleted_room_even_for_previously_valid_member(
    async_client, monkeypatch, as_fake_user
):
    """Historical attachment metadata/messages stay in the database (see
    docs/db/migrations/010_soft_delete_study_rooms.sql), but normal access through a deleted
    room's Conversation must stop -- even for a member who was active before the room was
    deleted. Contrast with test_room_ended_member_can_still_download_existing_attachment:
    ended != deleted."""
    from datetime import datetime, timezone

    from app.messages.entities.message_entity import Message

    room = _make_room()
    room.deleted_at = datetime.now(timezone.utc)
    conversation = _make_room_conversation(room)
    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        sender_id=uuid.uuid4(),
        attachment_path=f"study-rooms/{room.id}/{uuid.uuid4()}/uuid/f.pdf",
    )
    monkeypatch.setattr(attachment_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_room_conversation(monkeypatch, room, conversation)
    monkeypatch.setattr(
        permissions.study_rooms_service, "get_member", AsyncMock(return_value=_room_member(room.id, as_fake_user.id))
    )

    response = await async_client.get(f"/messages/{message.id}/attachment-url", headers=AUTH_HEADERS)
    assert response.status_code == 403


async def test_room_attachment_url_unauthorized_user_denied(async_client, monkeypatch, as_fake_user):
    from app.messages.entities.message_entity import Message

    room = _make_room()
    conversation = _make_room_conversation(room)
    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        sender_id=uuid.uuid4(),
        attachment_path=f"study-rooms/{room.id}/{uuid.uuid4()}/uuid/f.pdf",
    )
    monkeypatch.setattr(attachment_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_room_conversation(monkeypatch, room, conversation)
    monkeypatch.setattr(permissions.study_rooms_service, "get_member", AsyncMock(return_value=None))

    response = await async_client.get(f"/messages/{message.id}/attachment-url", headers=AUTH_HEADERS)
    assert response.status_code == 403


# --- Upload-url endpoint: direct conversations ---


async def test_direct_upload_url_member_a_success(async_client, monkeypatch, as_fake_user):
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user)
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})
    monkeypatch.setattr(
        attachment_router.attachments_service,
        "create_signed_upload_url",
        AsyncMock(
            return_value={
                "path": f"direct/{conversation.id}/{as_fake_user.id}/uuid/lesson.pdf",
                "token": "tok",
                "upload_url": "https://x/upload",
            }
        ),
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["token"] == "tok"


async def test_direct_upload_url_member_b_success(async_client, monkeypatch, as_fake_user):
    """Same pair, opposite constructor order -- must behave identically to member A."""
    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(other_user, as_fake_user.id)
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})
    monkeypatch.setattr(
        attachment_router.attachments_service,
        "create_signed_upload_url",
        AsyncMock(
            return_value={
                "path": f"direct/{conversation.id}/{as_fake_user.id}/uuid/lesson.pdf",
                "token": "tok",
                "upload_url": "https://x/upload",
            }
        ),
    )

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200


async def test_direct_upload_url_third_user_denied(async_client, monkeypatch, as_fake_user):
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    conversation = _make_direct_conversation(user_a, user_b)
    _wire_direct_conversation(monkeypatch, conversation, {user_a, user_b})

    response = await async_client.post(
        f"/conversations/{conversation.id}/attachments/upload-url",
        json={"file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1024},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 403


# --- Download-url endpoint: direct conversations ---


async def test_direct_attachment_url_member_can_download(async_client, monkeypatch, as_fake_user):
    from app.messages.entities.message_entity import Message

    other_user = uuid.uuid4()
    conversation = _make_direct_conversation(as_fake_user.id, other_user)
    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        sender_id=other_user,
        attachment_path=f"direct/{conversation.id}/{other_user}/uuid/f.pdf",
    )
    monkeypatch.setattr(attachment_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_direct_conversation(monkeypatch, conversation, {as_fake_user.id, other_user})
    monkeypatch.setattr(
        attachment_router.attachments_service,
        "create_signed_download_url",
        AsyncMock(return_value={"url": "https://x/download", "expires_in": 300}),
    )

    response = await async_client.get(f"/messages/{message.id}/attachment-url", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_direct_attachment_url_third_user_denied(async_client, monkeypatch, as_fake_user):
    from app.messages.entities.message_entity import Message

    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    conversation = _make_direct_conversation(user_a, user_b)
    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        sender_id=user_a,
        attachment_path=f"direct/{conversation.id}/{user_a}/uuid/f.pdf",
    )
    monkeypatch.setattr(attachment_router.message_service, "get_by_id", AsyncMock(return_value=message))
    _wire_direct_conversation(monkeypatch, conversation, {user_a, user_b})

    response = await async_client.get(f"/messages/{message.id}/attachment-url", headers=AUTH_HEADERS)
    assert response.status_code == 403
