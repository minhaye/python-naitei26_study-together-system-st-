import type { UserSummary } from './profile.types';

/** Mirrors MessageResponse (app/messages/dto/message_dto.py). `sender` is the canonical
 * identity source for the message author -- see src/utils/userDisplay.ts's
 * getDisplayName(), never derive a label from `sender_id`. */
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  attachment_path: string | null;
  created_at: string;
  updated_at: string;
  sender: UserSummary;
}

/** Mirrors MessageListResponse. Cursor-based pagination, newest-first ordering. */
export interface MessageListResponse {
  items: Message[];
  next_cursor: string | null;
}

/** Mirrors MessageCreate -- no sender_id/user_id: the backend always derives the sender
 * from the authenticated caller (see message_router.create_message). */
export interface MessageCreate {
  content: string;
}
