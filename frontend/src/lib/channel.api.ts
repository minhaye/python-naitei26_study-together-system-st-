import { apiClient } from './apiClient';
import type { Channel, ChannelCreate } from './channel.types';

export function listChannelsByGroup(groupId: string): Promise<Channel[]> {
  return apiClient.get<Channel[]>(`/channels/?group_id=${groupId}`);
}

/** Owner/moderator only -- enforced server-side via is_group_manager. Creator identity
 * is always derived from the bearer token (see channel_router.create_channel); no
 * created_by field exists on the request. */
export function createChannel(data: ChannelCreate): Promise<Channel> {
  return apiClient.post<Channel>('/channels/', data);
}
