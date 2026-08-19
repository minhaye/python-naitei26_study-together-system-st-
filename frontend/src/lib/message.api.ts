import { apiClient } from './apiClient';
import type { Message, MessageCreate, MessageListResponse } from './message.types';

/** Newest-first, cursor-paginated. `before` is an opaque cursor from a prior
 * response's `next_cursor`. Channel messages are addressed by the channel's
 * `conversation_id`, not the channel id itself -- there is no /channels/{id}/messages route. */
export function listConversationMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<MessageListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  return apiClient.get<MessageListResponse>(`/conversations/${conversationId}/messages?${params.toString()}`);
}

/** Sender identity is always derived server-side from the bearer token
 * (message_router.create_message); no sender_id field exists on the request. */
export function sendConversationMessage(conversationId: string, data: MessageCreate): Promise<Message> {
  return apiClient.post<Message>(`/conversations/${conversationId}/messages`, data);
}

/** Fetches a single fully-hydrated message (with its joined `sender: UserSummary`) by id.
 * Used by useChannelMessagesRealtime.ts to hydrate a Realtime INSERT event -- Supabase's
 * `postgres_changes` payload only ever carries the raw `messages` row, never a SQL join, so
 * this REST call is what turns that raw row into a real `Message`. Authorization is the same
 * `can_access_conversation` check as every other message endpoint (message_router.get_message). */
export function getMessage(messageId: string): Promise<Message> {
  return apiClient.get<Message>(`/messages/${messageId}`);
}
