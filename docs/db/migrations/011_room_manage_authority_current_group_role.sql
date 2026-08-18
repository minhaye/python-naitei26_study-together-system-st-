-- Removes the unconditional `host_id` bypass from can_access_room_conversation()
-- (SQL/RLS side of the Study Room authorization audit, 2026-08-18).
--
-- ============================================================================
-- Why
-- ============================================================================
-- 010 (confirmed live) added `sr.host_id = auth.uid()` as an unconditional OR
-- branch to can_access_room_conversation(), deliberately mirroring Python's
-- can_access_room() at the time, which granted the room host access
-- regardless of their current Group role/status or their own
-- study_room_members row.
--
-- A follow-up audit found `study_rooms.host_id` was being treated as a
-- permanent, independent authorization grant across both Python and SQL:
--
--   1. Management (update/start/end/delete, KICK/MUTE/UNMUTE, member-role
--      changes) -- fixed in the same commit as this migration, entirely in
--      Python (app/core/permissions.py::can_manage_room,
--      app/study_rooms/routers/study_room_router.py). No SQL/RLS change is
--      needed for this half: FastAPI's Postgres connection uses a role that
--      bypasses RLS entirely (see 004's header), so RLS never enforced
--      management authority in the first place -- there is no equivalent
--      SQL function or policy expressing "who may KICK/end/delete a room"
--      to fix here.
--   2. Participation (read/write access to a room's conversation) -- THIS is
--      the half that has a real SQL/RLS surface, because Supabase Realtime
--      and any direct PostgREST caller evaluate can_access_room_conversation()
--      directly, bypassing FastAPI (and therefore bypassing the Python fix)
--      entirely. This migration closes that half.
--
-- The fix: remove the `sr.host_id = auth.uid()` branch added by 010, leaving
-- only the pre-existing `is_group_member(...) AND active study_room_members
-- row` branch (untouched, not widened, not narrowed). This is safe -- not a
-- new inaccessible-host bug -- because StudyRoomsService.create() has always
-- inserted an active HOST-role study_room_members row for the creator in the
-- same transaction as the room itself; a currently-participating host already
-- satisfies the remaining branch on its own. Only a host who has since left
-- the room (left_at set, or missing a membership row entirely -- a data
-- anomaly for any room created through the normal app path; see
-- 011_preflight.sql's `hosts_without_active_study_room_members_row` check)
-- loses the unconditional access `host_id` alone used to grant -- which is
-- the intended fix, matching the new Python-side can_access_room().
--
-- Deliberately NOT touched: the `sr.deleted_at is null` guard added by 010
-- (still checked first, unconditionally, for every caller), the non-host
-- `is_group_member(...) AND active study_room_members row` branch (left
-- byte-for-byte identical), every RESTRICTIVE deleted_at-guard policy added
-- by 010, and the room's own study_room_members/room_moderation_actions
-- tables/policies (not part of this fix).
--
-- Read docs/db/migrations/011_preflight.sql and its output BEFORE running
-- this -- in particular the `hosts_without_active_study_room_members_row`
-- row: any room listed there is a host who will lose unconditional SQL/RLS
-- conversation access once this migration commits (they may still have
-- FastAPI/Python access if their study_room_members row merely has left_at
-- set vs. missing entirely -- Python's can_access_room() applies the exact
-- same rule post-fix, so this is expected convergence, not a new
-- inconsistency). Read docs/db/migrations/011_verify.sql AFTER running this.
--
-- Safety:
--   - Single transaction. Any error aborts the whole thing -- nothing
--     partial is left behind.
--   - CREATE OR REPLACE for the function only -- no DROP TABLE, no
--     TRUNCATE, no deletion of any row, no column/policy change.
--   - Idempotent: safe to re-run: re-applying the same CREATE OR REPLACE
--     body converges to the same state.

begin;

-- ============================================================================
-- can_access_room_conversation(): remove the unconditional host_id branch
-- ============================================================================
-- Same signature/shape as the live (post-010) function, with the
-- `sr.host_id = auth.uid()` OR branch removed. Everything else -- the
-- `sr.deleted_at is null` guard and the `is_group_member(...) AND active
-- study_room_members row` branch -- is copied verbatim from 010's body.
create or replace function public.can_access_room_conversation(p_room_id uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.study_rooms sr
    where sr.id = p_room_id
      and sr.deleted_at is null
      and public.is_group_member(sr.group_id, auth.uid())
      and exists (
        select 1
        from public.study_room_members srm
        where srm.room_id = sr.id
          and srm.user_id = auth.uid()
          and srm.left_at is null
      )
  );
$function$;

commit;

-- ============================================================================
-- After this migration:
--   - can_access_room_conversation(room_id) no longer grants access purely
--     because sr.host_id = auth.uid() -- a host now needs the same active
--     study_room_members row (plus current active Group membership) as any
--     other participant, matching Python's can_access_room() post-fix.
--   - A host who is still an active room participant (the normal case,
--     guaranteed by StudyRoomsService.create() at room-creation time) is
--     unaffected -- their own active study_room_members row already
--     satisfies the remaining branch.
--   - A host who has left the room, or whose Group membership is no longer
--     active (left/banned), loses conversation access via this function,
--     same as any other non-participating former member -- Realtime
--     subscriptions and direct PostgREST reads for that room's messages now
--     agree with FastAPI instead of disagreeing with it.
--   - The deleted_at guard and every RESTRICTIVE policy added by 010 are
--     unchanged.
--   - No column, table, or policy is added, dropped, or renamed by this
--     migration -- function body only.
-- ============================================================================
