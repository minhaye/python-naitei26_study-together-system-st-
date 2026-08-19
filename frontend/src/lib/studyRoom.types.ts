import type { UserSummary } from './profile.types';

/** Mirrors app/db/enums.py */
export type StudyRoomStatus = 'waiting' | 'active' | 'ended';
export type StudyRoomMemberRole = 'host' | 'moderator' | 'participant';
export type ModerationAction = 'mute' | 'unmute' | 'kick' | 'raise_hand' | 'lower_hand';

/** Mirrors StudyRoomResponse (app/study_rooms/dto/study_room_dto.py) */
export interface StudyRoom {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  host_id: string;
  status: StudyRoomStatus;
  max_participants: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  /** Soft-delete marker (migration 010). A StudyRoom returned by the list/detail endpoints
   * is always non-deleted -- the backend excludes/404s deleted rooms -- so these are present
   * on the type for parity with the API response, not because the UI branches on them today. */
  deleted_at: string | null;
  deleted_by: string | null;
  whiteboard_state: Record<string, any> | null;
}

/** Mirrors StudyRoomMemberResponse. `user` is the canonical identity source -- see
 * src/utils/userDisplay.ts's getDisplayName(), never derive a label from `user_id`. */
export interface StudyRoomMember {
  id: string;
  room_id: string;
  user_id: string;
  role: StudyRoomMemberRole;
  joined_at: string;
  left_at: string | null;
  user: UserSummary;
}

/** Mirrors StudyRoomCreate (app/study_rooms/dto/study_room_dto.py). No `host_id` field:
 * the room host is always the authenticated caller, never client-supplied. */
export interface StudyRoomCreate {
  group_id: string;
  name: string;
  description?: string | null;
  max_participants?: number;
}

/** Mirrors RoomModerationActionResponse */
export interface RoomModerationAction {
  id: string;
  room_id: string;
  moderator_id: string;
  target_user_id: string;
  action: ModerationAction;
  reason: string | null;
  created_at: string;
}
