import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { listDirectConversations, markConversationRead } from '../lib/conversation.api';
import { useAuthContext } from './auth-context';
import { UnreadMessagesContext } from './unread-messages-context';
import type { Message } from '../lib/message.types';

/** Same shape Realtime's `postgres_changes` INSERT payload actually delivers for `messages`
 * -- see useChannelMessagesRealtime.ts's identical RealtimeMessageRow. Only `conversation_id`/
 * `sender_id` are needed here (counting, not display), so unlike that hook this never hydrates
 * via GET /messages/{id} -- cheaper, and unnecessary for a badge count. */
type RealtimeMessageRow = Omit<Message, 'sender'>;

/** App-wide unread-DM badge state: mounted once above <AppRoutes /> (see main.tsx), so the
 * "Tin nhắn" nav badge in Header.tsx stays live via Realtime even while browsing other pages,
 * not just while /messages is open. Mirrors AuthContext.tsx's provider shape (useState + a
 * mount-scoped effect), the only other "survives route changes" precedent in this codebase. */
export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const { session, loading, user } = useAuthContext();
  const userId = user?.id ?? null;

  const [conversationIds, setConversationIds] = useState<string[]>([]);
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});

  const refresh = useCallback(() => {
    if (loading || !session) {
      setConversationIds([]);
      setUnreadByConversation({});
      return;
    }
    listDirectConversations()
      .then((conversations) => {
        setConversationIds(conversations.map((c) => c.id));
        setUnreadByConversation(Object.fromEntries(conversations.map((c) => [c.id, c.unread_count])));
      })
      .catch(() => {
        /* Silent: the badge should never break page load if this fails. */
      });
  }, [loading, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // One Realtime channel per known conversation id -- new territory in this codebase (every
  // existing Realtime hook subscribes to exactly one id), but mirrors the same
  // one-channel-per-id shape as useChannelMessagesRealtime.ts, just opened N times. Keyed off
  // the *content* of conversationIds (not the array reference) so this only tears down/
  // reopens when the actual set of ids changes, not on every unread-count update.
  const conversationIdsKey = conversationIds.join(',');
  useEffect(() => {
    if (loading || !session || conversationIds.length === 0) return;

    const channels = conversationIds.map((conversationId) =>
      supabase
        .channel(`unread:conversation:${conversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const row = payload.new as RealtimeMessageRow;
            if (row.sender_id === userId) return;
            setUnreadByConversation((prev) => ({ ...prev, [conversationId]: (prev[conversationId] ?? 0) + 1 }));
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
    // conversationIdsKey already captures conversationIds' content-equality; listing
    // conversationIds itself would defeat the point (a new array reference every render
    // would resubscribe constantly).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationIdsKey, loading, session, userId]);

  const markAsRead = useCallback((conversationId: string) => {
    setUnreadByConversation((prev) => ({ ...prev, [conversationId]: 0 }));
    markConversationRead(conversationId).catch(() => {
      /* Silent: a failed write self-corrects on the next refresh(). */
    });
  }, []);

  const getUnread = useCallback(
    (conversationId: string) => unreadByConversation[conversationId] ?? 0,
    [unreadByConversation]
  );

  const totalUnread = Object.values(unreadByConversation).reduce((sum, n) => sum + n, 0);

  return (
    <UnreadMessagesContext.Provider value={{ totalUnread, getUnread, markAsRead, refresh }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}
