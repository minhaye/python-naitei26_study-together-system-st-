import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getMessageReactions } from '../lib/message.api';
import type { MessageReactionSummary } from '../lib/message.types';

/** The shape Supabase's `postgres_changes` payload carries for the `message_reactions`
 * table: its own raw columns, never grouped counts. `message_reactions` has
 * REPLICA IDENTITY FULL (see docs/db/migrations/025_add_message_reactions.sql), so a
 * DELETE event's `old` also carries every column, not just `id`. */
interface RealtimeReactionRow {
  message_id: string;
  conversation_id: string;
}

/** Notifies `onChange` with a freshly hydrated `list[MessageReactionSummary]` (grouped by
 * emoji, `reacted_by_me` relative to the current viewer) whenever any reaction on any
 * message in `conversationId` is added, changed, or removed by anyone -- mirrors
 * useChannelMessagesRealtime.ts's hydrate-via-REST-GET shape, just for reactions instead
 * of message inserts, and covering all three event types instead of only INSERT (a
 * reaction can be updated in place -- switching emoji -- or deleted, not just created).
 *
 * The raw Realtime row never carries grouped counts (only the single changed row), so
 * every event re-fetches GET /messages/{id}/reactions rather than trying to apply the
 * raw row as a delta -- simpler and avoids drifting out of sync with concurrent changes
 * from other users on the same message. */
export function useMessageReactionsRealtime(
  conversationId: string | null,
  onChange: (messageId: string, reactions: MessageReactionSummary[]) => void
) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;

    const channel = supabase
      .channel(`message_reactions:conversation:${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as RealtimeReactionRow | undefined;
          if (!row || row.conversation_id !== conversationId) return;
          const messageId = row.message_id;
          getMessageReactions(messageId)
            .then((reactions) => {
              if (cancelled) return;
              onChangeRef.current(messageId, reactions);
            })
            .catch((err) => {
              // Best-effort, same reasoning as useChannelMessagesRealtime.ts: Realtime is
              // an enhancement, REST PUT/DELETE remain the source of truth either way.
              console.warn('[Realtime] failed to hydrate reactions for message', messageId, err);
            });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] message_reactions subscription issue:', status, err);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
