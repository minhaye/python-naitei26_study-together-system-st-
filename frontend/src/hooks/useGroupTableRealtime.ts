import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface GroupTableRealtimeHandlers<T> {
  onInsert: (row: T) => void;
  onUpdate: (row: T) => void;
}

/**
 * Generic Realtime sync for a `group_id`-scoped table, hydrating every INSERT/UPDATE through
 * a REST GET-by-id before handing it to the caller -- same pattern and same reason as
 * useChannelMessagesRealtime.ts's message hydration / useGroupNotesRealtime.ts's note
 * hydration.
 *
 * This is required even for `channels`/`study_rooms`, whose raw table rows otherwise look
 * like a 1:1 match for their frontend response types: `conversation_id` on BOTH is not a real
 * column at all -- it's a Python `@property` on the backend SQLAlchemy entity
 * (ChannelResponse/StudyRoomResponse), computed from a `LEFT JOIN`-style relationship to the
 * table's related `conversations` row (see app/channels/entities/channel_entity.py,
 * app/study_rooms/entities/study_room_entity.py). A raw `postgres_changes` payload only ever
 * contains real table columns, so `conversation_id` is silently absent (not null -- simply
 * not a key) on every raw INSERT/UPDATE row for these two tables. Casting that raw row
 * directly to `Channel`/`StudyRoom` -- which this hook's first version did -- would produce
 * an object that type-checks but is quietly wrong the moment anything reads
 * `.conversation_id` (e.g. opening chat for a Realtime-delivered Channel). Hydrating via
 * GET /channels/{id} / GET /study-rooms/{id} (both pre-existing REST endpoints, already used
 * elsewhere) avoids ever trusting the raw row as a complete response object.
 *
 * INSERT/UPDATE only, deliberately no DELETE handler: both `channels` and `study_rooms` are
 * soft-deleted via UPDATE (`deleted_at`), never a real SQL DELETE (docs/db/migrations/
 * 009_soft_delete_channels.sql, 010_soft_delete_study_rooms.sql -- no `authenticated` DELETE
 * policy exists on either table, and FastAPI never issues one). Supabase Realtime evaluates a
 * table's RLS SELECT policy against the POST-image for UPDATE events, so a soft-delete
 * transition (deleted_at null -> set, which flips the row from visible to invisible under
 * channels_select/study_rooms_hide_deleted) is a well-documented Realtime limitation: it is
 * not reliably delivered to clients who could see the row before the update, AND even when it
 * is, the hydration GET below will 404 for it (the REST endpoint denies deleted rows the same
 * way RLS does) -- either way the event is simply dropped, which callers should treat as the
 * expected outcome, not an error to retry. This is a Supabase platform behavior, not a bug in
 * this hook -- see StudyGroupDetail.tsx's call sites for how callers defensively handle the
 * rare case a soft-delete UPDATE *does* arrive and *does* hydrate (e.g. a 200 response with
 * `deleted_at` set, which can't actually happen given the above, but is handled anyway as
 * belt-and-suspenders), and the task report for why this isn't worked around with new
 * infrastructure (a Broadcast/trigger-based channel would be the standard fix, out of scope).
 *
 * Subscribes only while `groupId` is set; re-subscribes (unsubscribing the previous channel
 * first) whenever `table`/`groupId` changes, so there is never more than one active
 * subscription per hook instance and no cross-group event leakage. A hydration GET still in
 * flight when `groupId` changes or the hook unmounts is discarded on resolution (mirrors
 * useChannelMessagesRealtime.ts's cancellation guard) so it can't deliver into a view the
 * caller has already navigated away from.
 */
export function useGroupTableRealtime<T>(
  table: string,
  groupId: string | null,
  hydrate: (id: string) => Promise<T>,
  handlers: GroupTableRealtimeHandlers<T>
) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);
  const hydrateRef = useRef(hydrate);
  useEffect(() => {
    hydrateRef.current = hydrate;
  }, [hydrate]);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;

    const handle = (onDone: (row: T) => void) => (payload: { new: unknown }) => {
      const row = payload.new as { id: string; group_id?: string };
      if (row.group_id !== groupId) return;
      hydrateRef.current(row.id)
        .then((hydrated) => {
          if (cancelled) return;
          onDone(hydrated);
        })
        .catch((err) => {
          // Covers both a transient failure and the expected 403/404 for a row that was
          // (or became) inaccessible between the event and this GET -- e.g. a soft-deleted
          // channel/room, or access revoked in between. Realtime is an enhancement, not the
          // persistence layer, so this one notification is simply dropped either way.
          console.warn(`[Realtime] failed to hydrate ${table} row`, row.id, err);
        });
    };

    const channel = supabase
      .channel(`${table}:group:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `group_id=eq.${groupId}` },
        handle((row) => handlersRef.current.onInsert(row))
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table, filter: `group_id=eq.${groupId}` },
        handle((row) => handlersRef.current.onUpdate(row))
      )
      .subscribe((status, err) => {
        // Realtime is an enhancement, not the persistence layer -- REST GET/POST/PUT/DELETE
        // stay usable even if this never connects, so a transport issue is only logged.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] ${table} subscription issue:`, status, err);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [table, groupId]);
}
