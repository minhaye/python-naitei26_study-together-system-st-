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
  /** The room's single ROOM-type Conversation, created atomically with the room
   * (StudyRoomsService.create). Used to address GET/POST /conversations/{id}/messages --
   * there is no /study-rooms/{id}/messages route. */
  conversation_id: string | null;
  whiteboard_state: Record<string, any> | null;
  presentation_state: PresentationState | null;
}

/** The shared "Slide Bài giảng" deck's current state -- `asset_path` is a Storage object path
 * (resolved to a signed URL via getWhiteboardAssetDownloadUrl, same room-asset endpoints the
 * whiteboard's image sharing uses), not a URL itself, since it's persisted/synced indefinitely
 * and signed URLs expire. Mirrors the shape written by PUT /study-rooms/{room_id}/presentation. */
export interface PresentationState {
  asset_path: string;
  file_name: string;
  page: number;
  page_count: number;
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
