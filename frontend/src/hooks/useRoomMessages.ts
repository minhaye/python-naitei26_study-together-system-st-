import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/apiClient';
import { listConversationMessages, sendConversationMessage } from '../lib/message.api';
import { useChannelMessagesRealtime } from './useChannelMessagesRealtime';
import type { Message } from '../lib/message.types';

export interface RoomMessagesError {
  status: number | null;
  message: string;
}

function toRoomMessagesError(err: unknown): RoomMessagesError {
  if (err instanceof ApiError) {
    return { status: err.status, message: err.message };
  }
  return { status: null, message: 'Đã xảy ra lỗi không xác định.' };
}

/** REST send responses and Realtime INSERT events for the sender's own message both
 * resolve to the same persisted row, so both paths must go through this to avoid
 * rendering it twice -- regardless of which of the two arrives first (mirrors
 * StudyGroupDetail.tsx's appendMessageDeduped for Channel chat). */
function appendMessageDeduped(prev: Message[], message: Message): Message[] {
  return prev.some((m) => m.id === message.id) ? prev : [...prev, message];
}

/** Real persisted messages for a Study Room's ROOM Conversation. Reuses the same generic
 * `/conversations/{id}/messages` REST endpoints and Realtime subscription as Channel chat
 * (see message.api.ts, useChannelMessagesRealtime.ts) -- there is no Room-specific message
 * API. Access control is enforced server-side (can_access_conversation /
 * can_send_to_conversation), independent of whatever `conversationId` this hook is given.
 * useChannelMessagesRealtime already hydrates every Realtime-delivered message into a real
 * `Message` (real `sender: UserSummary`, never a placeholder) before calling back here, so
 * this hook only needs to dedupe -- see that hook for why a raw Realtime row can never be
 * trusted as a `Message` on its own. */
export function useRoomMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<RoomMessagesError | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<RoomMessagesError | null>(null);

  // Tracks the conversation each in-flight request belongs to, so a response for a
  // conversation the caller has since navigated away from is discarded instead of
  // leaking into the new view (mirrors StudyGroupDetail.tsx's activeChannelRef).
  const conversationRef = useRef(conversationId);
  useEffect(() => {
    conversationRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setLoadError(null);
    setSendError(null);
    if (!conversationId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    listConversationMessages(conversationId)
      .then((res) => {
        if (cancelled || conversationRef.current !== conversationId) return;
        // Backend returns newest-first; reverse for standard oldest-to-newest chat display.
        setMessages([...res.items].reverse());
      })
      .catch((err) => {
        if (cancelled || conversationRef.current !== conversationId) return;
        setLoadError(toRoomMessagesError(err));
      })
      .finally(() => {
        if (cancelled || conversationRef.current !== conversationId) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useChannelMessagesRealtime(conversationId, (incoming) => {
    setMessages((prev) => appendMessageDeduped(prev, incoming));
  });

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !conversationId || isSending) return;
      const targetConversationId = conversationId;
      setIsSending(true);
      setSendError(null);
      try {
        const sent = await sendConversationMessage(targetConversationId, { content: trimmed });
        if (conversationRef.current === targetConversationId) {
          setMessages((prev) => appendMessageDeduped(prev, sent));
        }
      } catch (err) {
        setSendError(toRoomMessagesError(err));
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, isSending]
  );

  return {
    messages,
    isLoading,
    loadError,
    isSending,
    sendError,
    sendMessage,
    clearSendError: () => setSendError(null),
  };
}
