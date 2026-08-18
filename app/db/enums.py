import enum

from sqlalchemy import Enum as PgEnum


class ChannelType(str, enum.Enum):
    TEXT = "text"


class ConversationType(str, enum.Enum):
    CHANNEL = "channel"
    ROOM = "room"
    DIRECT = "direct"


class GroupMemberRole(str, enum.Enum):
    OWNER = "owner"
    MODERATOR = "moderator"
    MEMBER = "member"


class MemberStatus(str, enum.Enum):
    ACTIVE = "active"
    BANNED = "banned"
    LEFT = "left"


class ModerationAction(str, enum.Enum):
    MUTE = "mute"
    UNMUTE = "unmute"
    KICK = "kick"
    RAISE_HAND = "raise_hand"
    LOWER_HAND = "lower_hand"


class NotificationType(str, enum.Enum):
    POST_LIKE = "post_like"
    POST_COMMENT = "post_comment"
    COMMENT_REPLY = "comment_reply"
    GROUP_INVITE = "group_invite"
    GROUP_ROLE_CHANGED = "group_role_changed"
    ROOM_KICKED = "room_kicked"
    MENTION = "mention"
    STUDY_ROOM_INVITATION = "study_room_invitation"
    PRIVATE_CHANNEL_INVITATION = "private_channel_invitation"


class InvitationMethod(str, enum.Enum):
    EMAIL = "email"
    CODE = "code"


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    REVOKED = "revoked"


class StudyRoomMemberRole(str, enum.Enum):
    HOST = "host"
    MODERATOR = "moderator"
    PARTICIPANT = "participant"


class StudyRoomStatus(str, enum.Enum):
    WAITING = "waiting"
    ACTIVE = "active"
    ENDED = "ended"


def pg_enum(enum_cls: type[enum.Enum], pg_name: str) -> PgEnum:
    """Bind a Python str-enum to an existing PostgreSQL enum type (create_type=False: the type already exists in Supabase)."""
    return PgEnum(enum_cls, name=pg_name, create_type=False, values_callable=lambda cls: [e.value for e in cls])
