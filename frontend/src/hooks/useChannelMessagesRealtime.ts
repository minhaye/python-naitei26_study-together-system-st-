import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getMessage } from '../lib/message.api';
import type { Message } from '../lib/message.types';

/** The shape Supabase's `postgres_changes` INSERT payload actually delivers for the
 * `messages` table: exactly its own columns, straight from logical replication -- never a
 * SQL join. In particular there is no `sender` here, unlike the REST API's `Message` (see
 * message.types.ts), which always has one joined in. Treating this raw row as a `Message`
 * was a real bug: a consumer that unconditionally reads `message.sender.avatar_url`
 * (StudyRoom.tsx's senderDisplay) crashed on it. This type exists so that gap can never be
 * cast away silently again -- see the hydration step below, which is what actually produces
 * a real `Message` for callers. */
type RealtimeMessageRow = Omit<Message, 'sender'>;

/** Notifies `onInsert` for every new Channel/Room message persisted to `conversationId`,
 * always with a fully-hydrated `Message` (real `sender: UserSummary`, never a placeholder).
 * Realtime's raw row is hydrated via the same `GET /messages/{id}` REST endpoint the rest of
 * the app already uses (message.api.ts's getMessage) -- this is the one shared place that
 * owes every caller (StudyGroupDetail.tsx's Channel chat and useRoomMessages.ts's Room chat
 * both use this hook) a real `Message`, rather than each caller normalizing/guessing a
 * fallback sender on its own.
 *
 * Access is enforced by Postgres RLS (`can_access_conversation`, see
 * docs/db/migrations/004_refactor_chat_to_conversations.sql) for the subscription itself,
 * independently of the REST-layer FastAPI authorization -- and the hydration GET below goes
 * through that same FastAPI `can_access_conversation` check again, so a caller who loses
 * access between the INSERT and the hydration fetch (e.g. left the room) gets a 403 there and
 * the event is simply dropped rather than ever reaching `onInsert`.
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

    // Guards a hydration fetch that's still in flight when conversationId changes or the
    // hook unmounts, so a late GET response can't deliver a message into a view the caller
    // has already navigated away from (mirrors the cancellation pattern used for the
    // initial REST load in useRoomMessages.ts / StudyGroupDetail.tsx).
    let cancelled = false;

    const channel = supabase
      .channel(`messages:conversation:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as RealtimeMessageRow;
          if (row.conversation_id !== conversationId) return;
          getMessage(row.id)
            .then((message) => {
              if (cancelled) return;
              onInsertRef.current(message);
            })
            .catch((err) => {
              // Best-effort: if hydration fails (message deleted, access revoked, transient
              // network issue), this one Realtime notification is dropped rather than
              // surfacing a malformed Message. REST GET/POST remain the source of truth and
              // are unaffected either way.
              console.warn('[Realtime] failed to hydrate message', row.id, err);
            });
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
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
