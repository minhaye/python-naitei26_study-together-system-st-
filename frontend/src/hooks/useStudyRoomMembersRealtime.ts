import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/** Notifies `onChange` whenever a `study_room_members` row for `roomId` is inserted or updated
 * (join/leave/kick/role-change are all a row on this table -- moderation-mute/hand-raise are
 * separate, in `room_moderation_actions`, not covered by this hook). The raw Realtime row is
 * never used directly -- it lacks the joined `user: UserSummary` a `StudyRoomMember` needs, so
 * `onChange` is expected to trigger a REST refetch (`useStudyRoom.ts`'s `loadMembers`), the same
 * hydrate-via-REST pattern `useChannelMessagesRealtime.ts` uses for messages.
 *
 * Requires docs/db/migrations/026_enable_study_room_members_realtime.sql to have been run live
 * -- until then this subscribes but the channel simply never receives any event, and
 * useStudyRoom's REST polling fallback remains the only source of updates.
 *
 * Subscribes only while `roomId` is set and re-subscribes whenever it changes, unsubscribing the
 * previous channel first -- there is never more than one active subscription per hook instance. */
export function useStudyRoomMembersRealtime(roomId: string | null, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`study_room_members:room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_room_members', filter: `room_id=eq.${roomId}` },
        () => onChangeRef.current()
      )
      .subscribe((status, err) => {
        // Realtime is an enhancement, not the persistence layer -- the REST poll in
        // useStudyRoom.ts keeps working even if this never connects, so a transport issue is
        // only logged.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] study_room_members subscription issue:', status, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);
}
