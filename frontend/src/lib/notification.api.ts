import { apiClient } from './apiClient';
import type {
  NotificationCategory,
  NotificationItem,
  UnreadCounts,
} from '../types/notification';

export interface ListNotificationsParams {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  skip?: number;
  limit?: number;
}

export function getUnreadCounts(): Promise<UnreadCounts> {
  return apiClient.get<UnreadCounts>('/notifications/unread-counts');
}

export function listNotifications(params: ListNotificationsParams = {}): Promise<NotificationItem[]> {
  const query = new URLSearchParams();
  if (params.category) query.append('category', params.category);
  if (params.unreadOnly) query.append('unread_only', 'true');
  if (params.skip !== undefined) query.append('skip', String(params.skip));
  if (params.limit !== undefined) query.append('limit', String(params.limit));

  const queryString = query.toString();
  const url = `/notifications/${queryString ? `?${queryString}` : ''}`;
  return apiClient.get<NotificationItem[]>(url);
}

export function markAsRead(notificationId: string): Promise<NotificationItem> {
  return apiClient.put<NotificationItem>(`/notifications/${notificationId}/read`);
}

export function markAllAsRead(category?: NotificationCategory): Promise<{ updated: number }> {
  const isGlobalCategory = !category || category === 'all' || category === 'unread';
  const url = isGlobalCategory ? '/notifications/read-all' : `/notifications/read-all?category=${category}`;
  return apiClient.put<{ updated: number }>(url);
}

export function deleteNotification(notificationId: string): Promise<void> {
  return apiClient.delete<void>(`/notifications/${notificationId}`);
}

export interface NotificationSettings {
  enable_forum: boolean;
  enable_group: boolean;
  enable_goal: boolean;
  enable_message: boolean;
  enable_sound: boolean;
}

export function getNotificationSettings(): Promise<NotificationSettings> {
  return apiClient.get<NotificationSettings>('/notifications/settings');
}

export function updateNotificationSettings(
  settings: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  return apiClient.put<NotificationSettings>('/notifications/settings', settings);
}
