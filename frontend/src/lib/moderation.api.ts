import { apiClient } from './apiClient';
import type { Profile } from './profile.types';
import type {
  BanCreate,
  BanResponse,
  ModerationActionResponse,
  ModerationActionType,
  ReportCreate,
  ReportResponse,
  ReportStatus,
  ReportStatusUpdate,
  RoleUpdate,
} from './moderation.types';

export const moderationApi = {
  /** Self-service: the caller's own active restrictions. Unlike every other method here, this
   * one works for any authenticated user, not just moderators/admins. */
  listMyBans: (): Promise<BanResponse[]> => apiClient.get<BanResponse[]>('/moderation/bans/me'),

  searchUsers: (q: string, limit = 20): Promise<Profile[]> =>
    apiClient.get<Profile[]>(`/moderation/users/search?q=${encodeURIComponent(q)}&limit=${limit}`),

  listModerators: (): Promise<Profile[]> => apiClient.get<Profile[]>('/moderation/moderators'),

  updateUserRole: (userId: string, role: RoleUpdate['role']): Promise<Profile> =>
    apiClient.put<Profile>(`/moderation/users/${userId}/role`, { role }),

  createBan: (data: BanCreate): Promise<BanResponse[]> => apiClient.post<BanResponse[]>('/moderation/bans', data),

  listBans: (params: { userId?: string; activeOnly?: boolean; skip?: number; limit?: number } = {}): Promise<BanResponse[]> => {
    const query = new URLSearchParams();
    if (params.userId) query.set('user_id', params.userId);
    query.set('active_only', String(params.activeOnly ?? true));
    if (params.skip) query.set('skip', String(params.skip));
    if (params.limit) query.set('limit', String(params.limit));
    return apiClient.get<BanResponse[]>(`/moderation/bans?${query.toString()}`);
  },

  revokeBan: (banId: string): Promise<BanResponse> => apiClient.delete<BanResponse>(`/moderation/bans/${banId}`),

  listActions: (
    params: { moderatorId?: string; targetUserId?: string; action?: ModerationActionType; skip?: number; limit?: number } = {}
  ): Promise<ModerationActionResponse[]> => {
    const query = new URLSearchParams();
    if (params.moderatorId) query.set('moderator_id', params.moderatorId);
    if (params.targetUserId) query.set('target_user_id', params.targetUserId);
    if (params.action) query.set('action', params.action);
    if (params.skip) query.set('skip', String(params.skip));
    if (params.limit) query.set('limit', String(params.limit));
    return apiClient.get<ModerationActionResponse[]>(`/moderation/actions?${query.toString()}`);
  },

  /** Any authenticated user, not just moderators/admins -- reports another user. */
  createReport: (data: ReportCreate): Promise<ReportResponse> => apiClient.post<ReportResponse>('/moderation/reports', data),

  listReports: (params: { status?: ReportStatus; skip?: number; limit?: number } = {}): Promise<ReportResponse[]> => {
    const query = new URLSearchParams();
    if (params.status) query.set('status_filter', params.status);
    if (params.skip) query.set('skip', String(params.skip));
    if (params.limit) query.set('limit', String(params.limit));
    return apiClient.get<ReportResponse[]>(`/moderation/reports?${query.toString()}`);
  },

  updateReportStatus: (reportId: string, data: ReportStatusUpdate): Promise<ReportResponse> =>
    apiClient.patch<ReportResponse>(`/moderation/reports/${reportId}`, data),
};
