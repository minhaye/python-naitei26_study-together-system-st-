import uuid
from unittest.mock import AsyncMock

from app.channels.entities.channel_entity import Channel, ChannelMember
from app.core import permissions
from app.db.enums import GroupMemberRole, MemberStatus
from app.groups.entities.group_entity import GroupMember


def _group_member(role: GroupMemberRole, status: MemberStatus) -> GroupMember:
    return GroupMember(group_id=uuid.uuid4(), user_id=uuid.uuid4(), role=role, status=status)


def _channel(is_private: bool) -> Channel:
    return Channel(id=uuid.uuid4(), group_id=uuid.uuid4(), name="general", is_private=is_private)


async def test_is_active_group_member_true_for_active_member(monkeypatch):
    member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert await permissions.is_active_group_member(session=None, group_id=uuid.uuid4(), user_id=uuid.uuid4())


async def test_is_active_group_member_false_when_banned(monkeypatch):
    member = _group_member(GroupMemberRole.MEMBER, MemberStatus.BANNED)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert not await permissions.is_active_group_member(session=None, group_id=uuid.uuid4(), user_id=uuid.uuid4())


async def test_is_active_group_member_false_when_no_membership(monkeypatch):
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.is_active_group_member(session=None, group_id=uuid.uuid4(), user_id=uuid.uuid4())


async def test_is_group_manager_true_for_owner(monkeypatch):
    member = _group_member(GroupMemberRole.OWNER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert await permissions.is_group_manager(session=None, group_id=uuid.uuid4(), user_id=uuid.uuid4())


async def test_is_group_manager_false_for_plain_member(monkeypatch):
    member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert not await permissions.is_group_manager(session=None, group_id=uuid.uuid4(), user_id=uuid.uuid4())


async def test_can_access_channel_public_requires_only_group_membership(monkeypatch):
    channel = _channel(is_private=False)
    member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=member))

    assert await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())


async def test_can_access_channel_false_when_not_group_member(monkeypatch):
    channel = _channel(is_private=False)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())


async def test_can_access_channel_private_requires_channel_membership(monkeypatch):
    channel = _channel(is_private=True)
    group_member = _group_member(GroupMemberRole.MEMBER, MemberStatus.ACTIVE)
    monkeypatch.setattr(permissions.groups_service, "get_member", AsyncMock(return_value=group_member))
    monkeypatch.setattr(permissions.channels_service, "get_member", AsyncMock(return_value=None))

    assert not await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())

    channel_member = ChannelMember(channel_id=channel.id, user_id=uuid.uuid4())
    monkeypatch.setattr(permissions.channels_service, "get_member", AsyncMock(return_value=channel_member))

    assert await permissions.can_access_channel(session=None, channel=channel, user_id=uuid.uuid4())
