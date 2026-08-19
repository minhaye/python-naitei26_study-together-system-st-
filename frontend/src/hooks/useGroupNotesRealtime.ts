import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getNote } from '../lib/note.api';
import type { Note } from '../lib/note.types';

export interface GroupNotesRealtimeHandlers {
  onUpsert: (note: Note) => void;
  onDelete: (noteId: string) => void;
}

/**
 * Realtime sync for Group Notes (`group_notes`).
 *
 * Requires docs/db/migrations/020_enable_workspace_realtime_sync.sql to be applied live:
 * `group_notes` previously had RLS enabled with ZERO policies for `authenticated` at all
 * (see docs/db/migrations/019_create_group_notes.sql), so no INSERT/UPDATE event can be
 * delivered until that migration adds a SELECT policy scoped to active Group membership.
 * Until then this hook subscribes but silently receives nothing for INSERT/UPDATE -- REST
 * (useGroupNotes.ts's load/submitCreate/submitEdit) remains fully functional either way.
 *
 * INSERT/UPDATE deliver only the raw `group_notes` row (`author_id`, no joined `author`), so
 * both are hydrated via GET /notes/{id} before reaching the caller -- same pattern and same
 * reason as useChannelMessagesRealtime.ts's message hydration (Note.author is a join
 * Realtime's raw payload can never produce). A caller who loses group access between the
 * event and the hydration GET gets a 403 there and the event is simply dropped.
 *
 * DELETE is deliberately NOT filtered by `group_id`: Supabase never applies RLS to DELETE
 * events ("there is no way for Postgres to verify a user has access to a deleted record" --
 * Supabase Realtime docs), and this table's default REPLICA IDENTITY only carries `id` in
 * the old row anyway (no `group_id` to filter on server-side). Switching to REPLICA IDENTITY
 * FULL would fix delivery but would also broadcast a deleted note's full title/content to
 * *any* subscriber regardless of group membership -- a direct violation of "Group Notes
 * remain accessible only to active Group members." So `onDelete` is only ever given a bare
 * id, and the caller (useGroupNotes.ts) is expected to no-op unless that id is already part
 * of its own REST/INSERT/UPDATE-authorized local state -- content from a DELETE payload is
 * never trusted, because there isn't any.
 */
export function useGroupNotesRealtime(groupId: string | null, handlers: GroupNotesRealtimeHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;

    const hydrate = (row: { id: string; group_id: string }) => {
      if (row.group_id !== groupId) return;
      getNote(row.id)
        .then((note) => {
          if (cancelled) return;
          handlersRef.current.onUpsert(note);
        })
        .catch((err) => {
          console.warn('[Realtime] failed to hydrate group note', row.id, err);
        });
    };

    const channel = supabase
      .channel(`group_notes:group:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_notes', filter: `group_id=eq.${groupId}` },
        (payload) => hydrate(payload.new as { id: string; group_id: string })
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_notes', filter: `group_id=eq.${groupId}` },
        (payload) => hydrate(payload.new as { id: string; group_id: string })
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_notes' },
        (payload) => {
          const old = payload.old as { id?: string };
          if (old.id) handlersRef.current.onDelete(old.id);
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] group_notes subscription issue:', status, err);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId]);
}
