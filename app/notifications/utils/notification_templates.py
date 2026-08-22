"""Centralised notification message templates.

Every notification text format lives here so they can be maintained, translated,
or adjusted in a single place rather than scattered across service modules.

Usage from any backend service:
    from app.notifications.utils.notification_templates import build_notification_text
    text = build_notification_text(NotificationType.POST_LIKE, {
        "actor_name": "Nguyễn Văn A",
        "post_title": "Lộ trình ôn thi...",
        "other_count": 3,
    })
"""

from typing import Any, Dict, Optional

from app.db.enums import NotificationType


# ---------------------------------------------------------------------------
# Template registry
# ---------------------------------------------------------------------------
# Each entry maps a NotificationType to one or more format strings.
# - "template": the default / only format.
# - "single" / "grouped": used when aggregation changes the wording.
#
# Placeholders use Python str.format() syntax ({key}) so callers pass a plain
# dict of values.  Unknown keys are silently ignored (see _safe_format below).
# ---------------------------------------------------------------------------

NOTIFICATION_TEMPLATES: Dict[NotificationType, Dict[str, str]] = {
    # ── Forum tab ──────────────────────────────────────────────────────────
    NotificationType.POST_LIKE: {
        "single": "{actor_name} đã thích bài viết của bạn: \"{post_title}\"",
        "grouped": "{actor_name} và {other_count} người khác đã thích bài viết của bạn: \"{post_title}\"",
    },
    NotificationType.POST_COMMENT: {
        "template": "{actor_name} đã bình luận về bài viết của bạn: \"{comment_preview}\"",
    },
    NotificationType.COMMENT_REPLY: {
        "template": "{actor_name} đã trả lời bình luận của bạn: \"{reply_preview}\"",
    },

    # ── Goal tab ───────────────────────────────────────────────────────────
    NotificationType.TASK_DAILY_REMINDER: {
        "template": "Hôm nay bạn có {task_count} mục tiêu cần hoàn thành. Hãy bắt đầu ngay nhé!",
    },
    NotificationType.TASK_DUE_SOON: {
        "template": "Mục tiêu \"{task_title}\" sắp đến hạn trong {hours_left} giờ tới!",
    },
    NotificationType.TASK_OVERDUE: {
        "single": "Bạn có 1 mục tiêu chưa hoàn thành hôm qua: \"{task_title}\"",
        "grouped": "Bạn có {task_count} mục tiêu chưa hoàn thành hôm qua: \"{task_title}\"",
    },

    # ── Group tab ──────────────────────────────────────────────────────────
    NotificationType.GROUP_NEW_RESOURCE: {
        "template": "📄 {actor_name} vừa thêm tài liệu mới: \"{resource_name}\" vào nhóm \"{group_name}\".",
    },
    NotificationType.STUDY_ROOM_FIRST_JOINER: {
        "template": "🔥 {actor_name} vừa vào phòng học \"{room_name}\". Vào học chung ngay nào!",
    },
    NotificationType.STUDY_ROOM_ACTIVE: {
        "template": "👥 Đang có {user_count} bạn đang cùng học trong phòng \"{room_name}\". Tham gia cùng mọi người nhé!",
    },

    # ── Message tab ────────────────────────────────────────────────────────
    NotificationType.NEW_DIRECT_MESSAGE: {
        "template": "{actor_name}: \"{message_preview}\"",
    },
    NotificationType.MESSAGE_GROUP: {
        "template": "{actor_name} đã gửi cho bạn {message_count} tin nhắn mới.",
    },
}

_FALLBACK = "Bạn có một thông báo mới."


def _safe_format(template: str, data: Dict[str, Any]) -> str:
    """Format a template string, silently leaving placeholders intact if a key
    is missing from *data* rather than raising KeyError."""
    try:
        return template.format(**data)
    except KeyError:
        return template


def build_notification_text(
    noti_type: NotificationType,
    data: Optional[Dict[str, Any]] = None,
) -> str:
    """Return a fully-interpolated notification text string.

    *data* carries the dynamic values (actor_name, post_title, task_count …).
    For types that support aggregation ("single" / "grouped"), the function
    auto-selects the right variant based on ``other_count`` or ``task_count``.
    """
    data = data or {}
    config = NOTIFICATION_TEMPLATES.get(noti_type)
    if not config:
        return _FALLBACK

    # Types with single / grouped variants
    if "single" in config and "grouped" in config:
        count_key = "other_count" if "other_count" in data else "task_count"
        count = data.get(count_key, 0)
        variant = "grouped" if isinstance(count, int) and count > 0 else "single"
        return _safe_format(config[variant], data)

    # Default template
    template = config.get("template", "")
    return _safe_format(template, data) if template else _FALLBACK
