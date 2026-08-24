import type { NotificationItem } from '../../types/notification';

export interface FormattedNotification {
  actorName: string;
  actorAvatarUrl?: string | null;
  previewText: string;
  targetLink: string;
  timeAgo: string;
  iconName: 'heart' | 'comment' | 'reply' | 'file' | 'flame' | 'users' | 'sun' | 'clock' | 'alert' | 'message' | 'invite';
  emoji?: string;
}

/**
  Formats relative time string in Vietnamese (e.g. "vừa xong", "5 phút trước", "2 giờ trước", "1 ngày trước").
 */
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'vừa xong';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} ngày trước`;
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} tháng trước`;
}

/**
 * Strips HTML tags (e.g. TipTap <p>, <span style="...">, <img>) from a preview text string so notifications
 * render clean plain text in cards without raw HTML tags or truncated code snippets.
 */
export function stripHtmlTags(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '') // Complete HTML tags
    .replace(/<[a-z][^>]*$/gi, '') // Truncated HTML tag at end of string
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format a NotificationItem into structured presentation props for the UI card.
 */
export function formatNotification(item: NotificationItem): FormattedNotification {
  const data = item.data || {};
  const actorName = typeof data.actor_name === 'string' ? data.actor_name : 'Người dùng';
  const actorAvatarUrl = typeof data.actor_avatar_url === 'string' ? data.actor_avatar_url : null;
  const timeAgo = formatTimeAgo(item.created_at);

  switch (item.type) {
    // ── Forum Tab ──────────────────────────────────────────────────────────
    case 'post_like': {
      const otherCount = Number(data.other_count || 0);
      const titleStr = typeof data.post_title === 'string' ? data.post_title : '';
      const postTitle = titleStr ? `"${stripHtmlTags(titleStr)}"` : 'bài viết của bạn';
      const text = otherCount > 0
        ? `và ${otherCount} người khác đã bày tỏ cảm xúc với bài viết: ${postTitle}`
        : `đã bày tỏ cảm xúc với bài viết của bạn: ${postTitle}`;
      const emojiStr = typeof data.emoji === 'string' ? data.emoji : '❤️';
      return {
        actorName,
        actorAvatarUrl,
        previewText: text,
        targetLink: item.post_id ? `/?post=${item.post_id}` : '/',
        timeAgo,
        iconName: 'heart',
        emoji: emojiStr,
      };
    }

    case 'post_comment': {
      const cmtStr = typeof data.comment_preview === 'string' ? data.comment_preview : '';
      const commentPreview = cmtStr ? `"${stripHtmlTags(cmtStr)}"` : 'bài viết của bạn';
      return {
        actorName,
        actorAvatarUrl,
        previewText: `đã bình luận về bài viết của bạn: ${commentPreview}`,
        targetLink: item.post_id ? `/?post=${item.post_id}` : '/',
        timeAgo,
        iconName: 'comment',
      };
    }

    case 'comment_reply': {
      const rplyStr = typeof data.reply_preview === 'string' ? data.reply_preview : '';
      let rawReply = stripHtmlTags(rplyStr);
      // Strip leading @mention tag (e.g. "@Nguyễn Văn A " or "@User ")
      if (rawReply.startsWith('@')) {
        rawReply = rawReply.replace(/^@[^\n\r]+?\s{1,2}(?=[A-Za-z0-9\u00C0-\u024F\u1EA0-\u1EF9a-z])/i, '').trim();
        if (rawReply.startsWith('@')) {
          rawReply = rawReply.replace(/^@[^\s]+\s*/, '').trim();
        }
      }
      const replyPreview = rawReply ? `"${rawReply}"` : 'bình luận của bạn';
      return {
        actorName,
        actorAvatarUrl,
        previewText: `đã trả lời bình luận của bạn: ${replyPreview}`,
        targetLink: item.post_id ? `/?post=${item.post_id}` : '/',
        timeAgo,
        iconName: 'reply',
      };
    }

    // ── Group Tab ──────────────────────────────────────────────────────────
    case 'group_new_resource': {
      const resourceName = data.resource_name || 'tài liệu mới';
      const groupName = data.group_name ? `nhóm "${data.group_name}"` : 'nhóm';
      return {
        actorName,
        previewText: `vừa thêm tài liệu mới: "${resourceName}" vào ${groupName}`,
        targetLink: item.group_id ? `/groups/${item.group_id}` : '/groups',
        timeAgo,
        iconName: 'file',
      };
    }

    case 'study_room_first_joiner': {
      const roomName = data.room_name || 'phòng học';
      return {
        actorName,
        previewText: `vừa vào phòng học "${roomName}". Vào học chung ngay nào!`,
        targetLink: item.group_id ? `/groups/${item.group_id}` : '/groups',
        timeAgo,
        iconName: 'flame',
      };
    }

    case 'study_room_active': {
      const roomName = data.room_name || 'phòng học';
      const userCount = data.user_count || 5;
      return {
        actorName: 'Hệ thống',
        previewText: `Đang có ${userCount} bạn đang cùng học trong phòng "${roomName}". Tham gia ngay!`,
        targetLink: item.group_id ? `/groups/${item.group_id}` : '/groups',
        timeAgo,
        iconName: 'users',
      };
    }

    case 'group_invite':
    case 'study_room_invitation':
    case 'private_channel_invitation': {
      return {
        actorName,
        previewText: 'đã gửi cho bạn một lời mời tham gia.',
        targetLink: item.group_id ? `/groups/${item.group_id}` : '/groups',
        timeAgo,
        iconName: 'invite',
      };
    }

    // ── Goal Tab ───────────────────────────────────────────────────────────
    case 'task_daily_reminder': {
      const taskCount = data.task_count || 1;
      return {
        actorName: 'Mục tiêu ngày',
        previewText: `Hôm nay bạn có ${taskCount} mục tiêu cần hoàn thành. Hãy bắt đầu ngay nhé!`,
        targetLink: '/aim',
        timeAgo,
        iconName: 'sun',
      };
    }

    case 'task_due_soon': {
      const taskTitle = data.task_title ? `"${data.task_title}"` : 'của bạn';
      return {
        actorName: 'Nhắc nhở hạn chót',
        previewText: `Mục tiêu ${taskTitle} sắp đến hạn trong 2 giờ tới!`,
        targetLink: '/aim',
        timeAgo,
        iconName: 'clock',
      };
    }

    case 'task_overdue': {
      const taskCount = data.task_count || 1;
      const taskTitle = data.task_title ? `"${data.task_title}"` : '';
      const text = taskCount > 1
        ? `Bạn có ${taskCount} mục tiêu chưa hoàn thành hôm qua.`
        : `Bạn có 1 mục tiêu chưa hoàn thành hôm qua: "${taskTitle}"`;
      return {
        actorName: 'Cảnh báo quá hạn',
        previewText: text,
        targetLink: '/aim',
        timeAgo,
        iconName: 'alert',
      };
    }

    // ── Message Tab ────────────────────────────────────────────────────────
    case 'new_direct_message': {
      const messagePreview = data.message_preview ? `"${data.message_preview}"` : 'đã gửi cho bạn một tin nhắn';
      return {
        actorName,
        previewText: `: ${messagePreview}`,
        targetLink: '/messages',
        timeAgo,
        iconName: 'message',
      };
    }

    case 'message_group': {
      const msgCount = data.message_count || 2;
      return {
        actorName,
        previewText: `đã gửi cho bạn ${msgCount} tin nhắn mới.`,
        targetLink: '/messages',
        timeAgo,
        iconName: 'message',
      };
    }

    default: {
      return {
        actorName,
        previewText: 'đã tương tác với bạn.',
        targetLink: '/',
        timeAgo,
        iconName: 'message',
      };
    }
  }
}
