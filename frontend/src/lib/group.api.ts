import { apiClient } from './apiClient';
import type { Group, GroupMember } from './group.types';

/**
 * Note: app/groups/routers/group_router.py has no auth dependency on any route (read or
 * write) — writes (create/join/leave/role changes) trust client-supplied user ids/roles with
 * no bearer-token derivation at all, unlike the Study Room API. Only the public read endpoints
 * are wired here; see StudyGroups.tsx / StudyGroupDetail.tsx for why join/create/leave are not.
 */

export function getGroups(publicOnly: boolean): Promise<Group[]> {
  return apiClient.get<Group[]>(`/groups/?public_only=${publicOnly}`);
}

export function getGroup(groupId: string): Promise<Group> {
  return apiClient.get<Group>(`/groups/${groupId}`);
}

export function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  return apiClient.get<GroupMember[]>(`/groups/${groupId}/members`);
}
