import type { ProfileRole } from './profile.types';

export type BanType = 'post' | 'message' | 'create_group' | 'join_group' | 'join_room';

export type DurationType = 'day' | 'week' | 'month' | 'year' | 'permanent' | 'custom';

export type ModerationActionType =
  | 'delete_post'
  | 'delete_comment'
  | 'ban_user'
  | 'unban_user'
  | 'grant_moderator'
  | 'revoke_moderator';

export const BAN_TYPE_LABELS: Record<BanType, string> = {
  post: 'Đăng bài & bình luận',
  message: 'Nhắn tin',
  create_group: 'Tạo nhóm học tập',
  join_group: 'Tham gia nhóm học tập',
  join_room: 'Tham gia phòng học',
};

export const MODERATION_ACTION_LABELS: Record<ModerationActionType, string> = {
  delete_post: 'Xóa bài viết',
  delete_comment: 'Xóa bình luận',
  ban_user: 'Cấm người dùng',
  unban_user: 'Gỡ cấm người dùng',
  grant_moderator: 'Cấp quyền kiểm duyệt viên',
  revoke_moderator: 'Thu hồi quyền kiểm duyệt viên',
};

export interface BanCreate {
  user_id: string;
  ban_types: BanType[];
  duration_type: DurationType;
  duration_value?: number | null;
  custom_expires_at?: string | null;
  reason?: string | null;
}

export interface BanResponse {
  id: string;
  user_id: string;
  ban_type: BanType;
  reason: string | null;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  user_name?: string | null;
  created_by_name?: string | null;
}

export interface ModerationActionResponse {
  id: string;
  moderator_id: string;
  action: ModerationActionType;
  target_user_id: string | null;
  target_id: string | null;
  reason: string | null;
  created_at: string;
  moderator_name?: string | null;
  target_user_name?: string | null;
}

export interface RoleUpdate {
  role: ProfileRole;
}

export type ReportReason = 'spam' | 'harassment' | 'inappropriate_content' | 'impersonation' | 'other';

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam / quảng cáo',
  harassment: 'Quấy rối, xúc phạm',
  inappropriate_content: 'Nội dung không phù hợp',
  impersonation: 'Mạo danh người khác',
  other: 'Khác',
};

export interface ReportCreate {
  reported_user_id: string;
  reason: ReportReason;
  description?: string | null;
}

export interface ReportResponse {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  reporter_name?: string | null;
  reported_user_name?: string | null;
}

export interface ReportStatusUpdate {
  status: ReportStatus;
  resolution_note?: string | null;
}

export function isBanActive(ban: BanResponse): boolean {
  if (ban.revoked_at) return false;
  if (!ban.expires_at) return true;
  return new Date(ban.expires_at).getTime() > Date.now();
}
