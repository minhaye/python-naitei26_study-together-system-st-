-- Preflight for 027_lock_down_study_room_members_writes.sql. READ-ONLY.
--
-- Context: while reviewing 026 (Realtime for study_room_members), a live query surfaced FOUR
-- pre-existing `authenticated` policies on this table that were never captured or reviewed
-- anywhere in this repo before now (010's header explicitly flagged this as an unknown):
--
--   study_room_members_select  (SELECT) -- EXISTS (... is_group_member(sr.group_id)) --
--     broader than 026's own study_room_members_select_room_participant: grants read access to
--     ANY active Group member, not just an active participant of THIS room (no left_at check,
--     no can_access_room_conversation parity). Permissive policies are OR'd, so this one --
--     not 026's -- currently governs the widest SELECT access.
--   study_room_members_insert  (INSERT, WITH CHECK: user_id = auth.uid() OR is_room_manager(room_id))
--   study_room_members_update  (UPDATE, USING/WITH CHECK: user_id = auth.uid() OR is_room_manager(room_id))
--   study_room_members_delete  (DELETE, USING: user_id = auth.uid() OR is_room_manager(room_id))
--
-- The INSERT/UPDATE/DELETE policies let any authenticated user write their own row directly via
-- Supabase/PostgREST -- bypassing join_room/leave_room's is_active_group_member and
-- can_join_room(room) checks entirely -- and let anyone `is_room_manager(room_id)` returns true
-- for write ANY member's row directly, bypassing can_manage_room's is_group_manager (current
-- active Group owner/moderator) check that study_room_router.py's KICK/role-change endpoints
-- enforce. `is_room_manager()` is itself an uncaptured legacy function (see below) -- there is
-- no confirmed guarantee it implements the same CURRENT-Group-role rule migration 011 fixed
-- can_access_room_conversation() to use; it may still be host_id-based (the exact class of stale
-- authorization 011 closed for read access, never audited for this table's write policies).
--
-- A repo-wide search confirms the frontend never writes to study_room_members directly (grep for
-- "study_room_members" under frontend/src turns up only comments and 026's Realtime *read*
-- subscription) -- every join/leave/role-change/kick goes through FastAPI
-- (study_room_router.py), which uses a Postgres role that bypasses RLS entirely (this repo's
-- established connection model, see 004's header). So these four policies grant a write path
-- that nothing in the current app actually uses on purpose -- a bypass with no legitimate
-- caller, not a feature.
--
-- Run this and read every row before running 027. If it turns out something DOES rely on one of
-- these four policies (e.g. a direct-client code path this search missed, or a deliberate
-- product decision nobody documented), STOP and do not run 027 as written.

-- Confirms the four policies still look exactly as captured above -- read every column.
select
  'study_room_members_policy_before_027' as check,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public' and tablename = 'study_room_members'
order by policyname;

-- Prints is_room_manager()'s current body for the record (027 does not modify or depend on this
-- function -- it's shown purely so the exact reason study_room_members_insert/update/delete were
-- unsafe is captured, in case a similar audit of room_moderation_actions' room_moderation_select
-- policy -- which also calls is_room_manager(), see 007 -- is done later).
select 'function_body:is_room_manager (informational only, not modified by 027)' as check,
  pg_get_functiondef(p.oid) as detail
from pg_proc p
where p.proname = 'is_room_manager' and p.pronamespace = 'public'::regnamespace;

-- Confirms 026's narrower, correctly-scoped SELECT policy is present -- 027 keeps this one and
-- relies on it being the sole SELECT policy left after dropping study_room_members_select.
select 'study_room_members_select_room_participant_present' as check, count(*) as detail
from pg_policies
where schemaname = 'public' and tablename = 'study_room_members'
  and policyname = 'study_room_members_select_room_participant' and cmd = 'SELECT';

select 'study_room_members_row_count (informational)' as check, count(*)::text as detail
from public.study_room_members;
