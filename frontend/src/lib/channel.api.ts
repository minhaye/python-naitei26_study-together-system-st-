import { apiClient } from './apiClient';
import type { Channel } from './channel.types';

export function listChannelsByGroup(groupId: string): Promise<Channel[]> {
  return apiClient.get<Channel[]>(`/channels/?group_id=${groupId}`);
}
