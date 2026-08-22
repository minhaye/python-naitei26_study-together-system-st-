import { apiClient } from './apiClient';
import { supabase } from './supabase';
import type { Group, GroupCreate, GroupMember, GroupMemberCreate, GroupMemberRole, GroupUpdate } from './group.types';

export function getGroups(publicOnly: boolean): Promise<Group[]> {
  return apiClient.get<Group[]>(`/groups/?public_only=${publicOnly}`);
}

/** "My Groups": every Group the caller currently has an ACTIVE membership in, public or
 * private alike -- distinct from getGroups(true), which is public *discoverability*, not
 * membership. Requires auth; the backend derives the caller from the bearer token. */
export function getMyGroups(): Promise<Group[]> {
  return apiClient.get<Group[]>('/groups/mine');
}

export function getMyMemberships(): Promise<GroupMember[]> {
  return apiClient.get<GroupMember[]>('/groups/me/memberships');
}

export function getMemberCounts(): Promise<Record<string, number>> {
  return apiClient.get<Record<string, number>>('/groups/stats/member-counts');
}

export function getGroup(groupId: string): Promise<Group> {
  return apiClient.get<Group>(`/groups/${groupId}`);
}

export function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  return apiClient.get<GroupMember[]>(`/groups/${groupId}/members`);
}

/** Owner is always derived from the bearer token on the backend; no owner_id is ever sent. */
export function createGroup(data: GroupCreate): Promise<Group> {
  return apiClient.post<Group>('/groups/', data);
}

/** Owner-only; caller identity/authority is enforced server-side. */
export function updateGroup(groupId: string, data: GroupUpdate): Promise<Group> {
  return apiClient.put<Group>(`/groups/${groupId}`, data);
}

/** Owner OR active moderator; uploads directly to the public `group-backgrounds` bucket
 * then confirms with the backend (mirrors uploadProfileAvatar / POST /profiles/me/avatar).
 * Deliberately not part of updateGroup -- the backend authorizes this one field looser
 * (owner-or-moderator) than the rest of Group settings (owner-only). */
export async function uploadGroupBackground(groupId: string, file: File): Promise<Group> {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (!allowedTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Ảnh phải là JPEG, PNG, WebP hoặc GIF và không quá 5 MB.');
  }
  const path = `groups/${groupId}/${crypto.randomUUID()}.bg`;
  const { error } = await supabase.storage.from('group-backgrounds').upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  return apiClient.post<Group>(`/groups/${groupId}/background`, { path });
}

/** Owner OR active moderator; clears the group's background image. */
export function removeGroupBackground(groupId: string): Promise<Group> {
  return apiClient.delete<Group>(`/groups/${groupId}/background`);
}

/** Self-join a public group: omitting user_id means "join myself" — the backend derives the
 * caller from the bearer token and always assigns the plain `member` role. */
export function joinGroup(groupId: string): Promise<GroupMember> {
  const body: GroupMemberCreate = {};
  return apiClient.post<GroupMember>(`/groups/${groupId}/members`, body);
}

/** Self-leave: the caller's own membership status becomes `left`. Cannot affect another member. */
export function leaveGroup(groupId: string, userId: string): Promise<GroupMember> {
  return apiClient.put<GroupMember>(`/groups/${groupId}/members/${userId}/status?member_status=left`);
}

/** Owner-only; promotes/demotes a member between `member` and `moderator`. The backend
 * rejects `role=owner` and rejects changing the owner's own row -- see group_router.update_member_role. */
export function updateMemberRole(groupId: string, userId: string, role: GroupMemberRole): Promise<GroupMember> {
  return apiClient.put<GroupMember>(`/groups/${groupId}/members/${userId}/role?role=${role}`);
}

/** Owner-only hard removal ("kick"); backend rejects this for the caller's own row (self-leave
 * must go through leaveGroup instead) -- see group_router.remove_member. */
export function removeMember(groupId: string, userId: string): Promise<void> {
  return apiClient.delete<void>(`/groups/${groupId}/members/${userId}`);
}
