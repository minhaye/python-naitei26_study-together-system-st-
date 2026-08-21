import type { UserSummary } from './profile.types';

/** Mirrors app/db/enums.py ConversationType. Only 'direct' is ever produced by the
 * endpoints this file's api wraps (/conversations/direct); 'channel' and 'room'
 * conversations are addressed via channel.types.ts/room chat instead. */
export type ConversationType = 'channel' | 'room' | 'direct';

/** Mirrors ConversationParticipant (app/conversations/dto/conversation_dto.py) --
 * identical shape to UserSummary, reused directly rather than redeclared. */
export type ConversationParticipant = UserSummary;

/** Mirrors ConversationResponse (app/conversations/dto/conversation_dto.py). */
export interface Conversation {
  id: string;
  type: ConversationType;
  created_at: string;
  other_participant: ConversationParticipant | null;
  unread_count: number;
}
