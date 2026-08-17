import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Message } from '../lib/message.types';

/** Notifies `onInsert` for every new Channel message persisted to `conversationId`.
 *
 * Access is enforced by Postgres RLS (`can_access_conversation`, see
 * docs/db/migrations/004_refactor_chat_to_conversations.sql), independently of the
 * REST-layer FastAPI authorization -- Realtime events come straight from Postgres and
 * never pass through the FastAPI routes. The `conversation_id=eq.` filter below is a
 * convenience, not the security boundary; the row-level check inside the callback below
 * is a defensive belt-and-suspenders measure, not a substitute for RLS.
 *
 * Subscribes only while `conversationId` is set and re-subscribes whenever it changes,
 * unsubscribing the previous channel first -- there is never more than one active
 * subscription per hook instance. */
export function useChannelMessagesRealtime(conversationId: string | null, onInsert: (message: Message) => void) {
  const onInsertRef = useRef(onInsert);
  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:conversation:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as Message;
          if (row.conversation_id !== conversationId) return;
          onInsertRef.current(row);
        }
      )
      .subscribe((status, err) => {
        // Realtime is an enhancement, not the persistence layer -- REST GET/POST stay
        // usable even if this never connects, so a transport issue is only logged.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] channel messages subscription issue:', status, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
