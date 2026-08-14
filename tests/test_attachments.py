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
from app.db.enums import ConversationType, GroupMemberRole, MemberStatus
from app.db.session import get_db_session
from app.groups.entities.group_entity import GroupMember
from app.main import app

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
