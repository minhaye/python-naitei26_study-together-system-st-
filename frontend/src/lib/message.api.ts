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
