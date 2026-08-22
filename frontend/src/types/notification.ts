export type NotificationCategory = 'forum' | 'group' | 'goal' | 'message';

export type NotificationType =
  | 'post_like'
  | 'post_comment'
  | 'comment_reply'
  | 'group_invite'
  | 'group_role_changed'
  | 'room_kicked'
  | 'mention'
  | 'study_room_invitation'
  | 'private_channel_invitation'
  | 'task_daily_reminder'
  | 'task_due_soon'
  | 'task_overdue'
  | 'group_new_resource'
  | 'study_room_first_joiner'
  | 'study_room_active'
  | 'new_direct_message'
  | 'message_group';

export interface NotificationData {
  actor_name?: string;
  post_title?: string;
  comment_preview?: string;
  reply_preview?: string;
  resource_name?: string;
  group_name?: string;
  room_name?: string;
  message_preview?: string;
  message_count?: number;
  task_count?: number;
  task_title?: string;
  hours_left?: number;
  other_count?: number;
  user_count?: number;
  [key: string]: unknown;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  category: NotificationCategory;
  actor_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  group_id: string | null;
  invitation_id: string | null;
  data: NotificationData | null;
  is_read: boolean;
  created_at: string;
}

export interface UnreadCounts {
  total: number;
  forum: number;
  group: number;
  goal: number;
  message: number;
}
