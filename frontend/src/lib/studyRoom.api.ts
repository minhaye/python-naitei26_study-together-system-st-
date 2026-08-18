import { apiClient } from './apiClient';
import type {
  ModerationAction,
  RoomModerationAction,
  StudyRoom,
  StudyRoomCreate,
  StudyRoomMember,
  StudyRoomMemberRole,
} from './studyRoom.types';

export function getStudyRoom(roomId: string): Promise<StudyRoom> {
  return apiClient.get<StudyRoom>(`/study-rooms/${roomId}`);
}

/** Used by StudyGroupDetail.tsx to link to real room ids instead of mock ones. */
export function listStudyRoomsByGroup(groupId: string): Promise<StudyRoom[]> {
  return apiClient.get<StudyRoom[]>(`/study-rooms/?group_id=${groupId}`);
}

/**
 * Host is always the authenticated caller, derived server-side (see
 * study_room_router.create_room) -- StudyRoomCreate has no host_id field to send. The
 * backend also requires the caller to be an active owner or moderator of `data.group_id`
 * (is_group_manager) -- a plain member gets 403.
 */
export function createStudyRoom(data: StudyRoomCreate): Promise<StudyRoom> {
  return apiClient.post<StudyRoom>('/study-rooms/', data);
}

/** Caller is always derived from the bearer token on the backend; no user id is ever sent. */
export function joinStudyRoom(roomId: string): Promise<StudyRoomMember> {
  return apiClient.post<StudyRoomMember>(`/study-rooms/${roomId}/join`);
}

/** Backend derives the leaving member from the bearer token — this can only leave the caller's own membership. */
export function leaveStudyRoom(roomId: string): Promise<StudyRoomMember> {
  return apiClient.post<StudyRoomMember>(`/study-rooms/${roomId}/leave`);
}

export function startStudyRoom(roomId: string): Promise<StudyRoom> {
  return apiClient.post<StudyRoom>(`/study-rooms/${roomId}/start`);
}

export function endStudyRoom(roomId: string): Promise<StudyRoom> {
  return apiClient.post<StudyRoom>(`/study-rooms/${roomId}/end`);
}

export function listStudyRoomMembers(roomId: string, activeOnly: boolean): Promise<StudyRoomMember[]> {
  return apiClient.get<StudyRoomMember[]>(`/study-rooms/${roomId}/members?active_only=${activeOnly}`);
}

export function listStudyRoomModeration(roomId: string): Promise<RoomModerationAction[]> {
  return apiClient.get<RoomModerationAction[]>(`/study-rooms/${roomId}/moderation`);
}

/**
 * `room_id`/`moderator_id` are required fields on the backend's RoomModerationActionCreate DTO,
 * but the server always overwrites both with the path room id and the authenticated caller's id
 * (see study_room_router.log_moderation) — the values sent here are never trusted as identity.
 */
export function logStudyRoomModeration(
  roomId: string,
  currentUserId: string,
  targetUserId: string,
  action: ModerationAction,
  reason?: string
): Promise<RoomModerationAction> {
  return apiClient.post<RoomModerationAction>(`/study-rooms/${roomId}/moderation`, {
    room_id: roomId,
    moderator_id: currentUserId,
    target_user_id: targetUserId,
    action,
    reason: reason ?? null,
  });
}

/** Host, or an active group owner/moderator of the room's group -- enforced server-side.
 * Soft delete: the StudyRoom row, its Conversation, all historical Messages, members, and
 * moderation history remain in the database (see
 * docs/db/migrations/010_soft_delete_study_rooms.sql); it only becomes inaccessible. Acting
 * identity (deleted_by) is always derived from the bearer token, never sent by the client. */
export function deleteStudyRoom(roomId: string): Promise<void> {
  return apiClient.delete<void>(`/study-rooms/${roomId}`);
}

export function updateStudyRoomMemberRole(
  roomId: string,
  userId: string,
  role: StudyRoomMemberRole
): Promise<StudyRoomMember> {
  return apiClient.put<StudyRoomMember>(
    `/study-rooms/${roomId}/members/${userId}/role?role=${encodeURIComponent(role)}`
  );
}
