import { apiClient } from './apiClient';
import type { Message, MessageCreate, MessageListResponse, MessageReactionSummary } from './message.types';

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

/** Upserts the current user's reaction on a message (picking a new emoji replaces their
 * previous one) -- returns the fresh grouped summary for that message directly, no need
 * for a follow-up GET. */
export function setMessageReaction(messageId: string, emoji: string): Promise<MessageReactionSummary[]> {
  return apiClient.put<MessageReactionSummary[]>(`/messages/${messageId}/reactions`, { emoji });
}

/** Removes the current user's reaction on a message (idempotent) -- also returns the fresh
 * grouped summary. */
export function removeMessageReaction(messageId: string): Promise<MessageReactionSummary[]> {
  return apiClient.delete<MessageReactionSummary[]>(`/messages/${messageId}/reactions`);
}

/** Used by useMessageReactionsRealtime.ts to hydrate a raw Realtime reaction-change event
 * (which only carries the changed row, not grouped counts) -- not called by the user who
 * triggered the change, since setMessageReaction/removeMessageReaction already return the
 * fresh summary directly. */
export function getMessageReactions(messageId: string): Promise<MessageReactionSummary[]> {
  return apiClient.get<MessageReactionSummary[]>(`/messages/${messageId}/reactions`);
}
