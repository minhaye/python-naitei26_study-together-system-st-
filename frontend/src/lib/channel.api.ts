import { apiClient } from './apiClient';
import type { Channel, ChannelCreate } from './channel.types';

export function listChannelsByGroup(groupId: string): Promise<Channel[]> {
  return apiClient.get<Channel[]>(`/channels/?group_id=${groupId}`);
}

/** Single-channel lookup -- primarily for Realtime hydration (see useGroupTableRealtime.ts):
 * `channels.conversation_id` is not a real column (it's a Python @property on the backend
 * entity, derived from the channel's related Conversation row), so a raw `channels`
 * postgres_changes row never carries it. Any INSERT/UPDATE consumed as a `Channel` must be
 * hydrated through this REST endpoint instead of the raw row. */
export function getChannel(channelId: string): Promise<Channel> {
  return apiClient.get<Channel>(`/channels/${channelId}`);
}

/** Owner/moderator only -- enforced server-side via is_group_manager. Creator identity
 * is always derived from the bearer token (see channel_router.create_channel); no
 * created_by field exists on the request. */
export function createChannel(data: ChannelCreate): Promise<Channel> {
  return apiClient.post<Channel>('/channels/', data);
}

/** Owner/moderator only -- enforced server-side via is_group_manager. Soft delete: the
 * Channel row, its Conversation, and all historical Messages remain in the database (see
 * docs/db/migrations/009_soft_delete_channels.sql); it only becomes inaccessible. Acting
 * identity (deleted_by) is always derived from the bearer token, never sent by the client. */
export function deleteChannel(channelId: string): Promise<void> {
  return apiClient.delete<void>(`/channels/${channelId}`);
}
