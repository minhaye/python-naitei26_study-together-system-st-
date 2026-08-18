import { apiClient } from './apiClient';
import type { MeetingTokenResponse } from './meeting.types';

/**
 * Caller is always derived from the bearer token on the backend; no user id is ever sent.
 * Authorization (`can_join_room_meeting`): active Group membership + active Room membership +
 * room not soft-deleted + room not ended -- enforced entirely server-side (403/404 on failure).
 * The browser only ever receives the LiveKit participant token this returns, never the
 * server's LiveKit API key/secret.
 */
export function createMeetingToken(roomId: string): Promise<MeetingTokenResponse> {
  return apiClient.post<MeetingTokenResponse>(`/study-rooms/${roomId}/meeting/token`);
}
