import { apiClient } from './apiClient';
import type { Conversation } from './conversation.types';

/** Idempotent get-or-create of the 1:1 direct conversation between the current user and
 * `userId` (see conversation_router.create_or_get_direct_conversation). Always resolves
 * 200 -- the caller cannot distinguish "created" from "already existed". Self-DM -> 400
 * ApiError, nonexistent user -> 404 ApiError. */
export function createOrGetDirectConversation(userId: string): Promise<Conversation> {
  return apiClient.post<Conversation>('/conversations/direct', { user_id: userId });
}

/** Lists the current user's direct conversations, newest-first, each already resolved
 * with its `other_participant` and `unread_count`. No pagination params -- the backend
 * endpoint has none. */
export function listDirectConversations(): Promise<Conversation[]> {
  return apiClient.get<Conversation[]>('/conversations/direct');
}

/** Marks a direct conversation as read for the current user (updates their
 * conversation_members.last_read_at to now()). No response body. */
export function markConversationRead(conversationId: string): Promise<void> {
  return apiClient.post<void>(`/conversations/${conversationId}/read`);
}
