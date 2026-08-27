import { apiClient } from './apiClient';
import type { Channel, ChannelCreate, ChannelMember } from './channel.types';

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

/** Public channel rosters are open; a private channel's roster requires the caller to
 * already be a channel member OR hold group-manager (owner/moderator) authority over the
 * channel's group -- see channel_router._require_channel_member_access. Note this only
 * returns explicit `channel_members` rows: a group manager who can access a private channel
 * via their manager authority (not an explicit row) is NOT included in this list -- callers
 * that need to display "everyone who can see this channel" must compose that themselves
 * (see StudyGroupDetail.tsx's `displayedMembers`). */
export function listChannelMembers(channelId: string): Promise<ChannelMember[]> {
  return apiClient.get<ChannelMember[]>(`/channels/${channelId}/members`);
}

/** "Xóa khỏi kênh" -- self-removal ("leave") is always allowed server-side; removing a
 * DIFFERENT member requires the caller to hold group-manager (owner/moderator) authority
 * over the channel's group -- see channel_router.remove_member. Only ever valid for a user
 * with an explicit `channel_members` row: a Group manager present in a private channel's
 * displayed roster purely via manager-access fallback (no row) has nothing here to delete --
 * see GroupMembersPanel's `explicitChannelMemberUserIds` prop. */
export function removeChannelMember(channelId: string, userId: string): Promise<void> {
  return apiClient.delete<void>(`/channels/${channelId}/members/${userId}`);
}
