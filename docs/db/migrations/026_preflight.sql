-- Preflight for 026_enable_study_room_members_realtime.sql. READ-ONLY.
--
-- study_room_members' base policies were NEVER captured in this repo (010's header says so
-- explicitly: "Unlike 009, the base study_rooms/study_room_members/room_moderation_actions RLS
-- policies were never captured in this repo, so instead of replacing unknown permissive
-- policies, [010] adds new RESTRICTIVE deleted_at IS NULL policies"). 026 adds the first
-- PERMISSIVE policy this repo has ever defined on study_room_members. Permissive policies are
-- OR'd together by Postgres, so if an unknown existing permissive SELECT policy is broader than
-- the one 026 adds, that pre-existing policy -- not 026's -- would still govern the widest
-- access. This preflight exists to surface that before 026 runs, since nobody has read it.
--
-- Run this and read EVERY policy row before running 026. If any existing permissive policy on
-- study_room_members grants SELECT more broadly than "caller can access this room's
-- conversation" (e.g. `true`, or scoped only to the room without the active-membership check),
-- STOP and reconcile first -- adding study_room_members to the Realtime publication would
-- publish change events under whatever policy is actually broadest, not under 026's new one.

-- Every current policy on study_room_members, whatever their names/bodies are. Read each one.
select
  'study_room_members_current_policy' as check,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public' and tablename = 'study_room_members'
order by permissive desc, policyname;

-- RLS must already be enabled (it has been since 010).
select 'rls_enabled:study_room_members' as check, relrowsecurity as detail
from pg_class where relname = 'study_room_members' and relnamespace = 'public'::regnamespace;

-- Current publication membership -- expected: study_room_members NOT present yet. If 020 has
-- since been run live, messages/channels/study_rooms/group_notes may also show up here; that's
-- fine and unrelated to this migration.
select 'in_supabase_realtime_publication' as check, tablename, true as detail
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;

-- Confirms can_access_room_conversation(uuid) exists and its exact signature -- 026 reuses this
-- pre-existing function (introduced by 004, modified by 010/011) for the new policy instead of
-- introducing a new one. It already takes only a room id and reads auth.uid() internally (no
-- caller-supplied target-user-id param), matching this repo's RLS-function convention.
select 'function_exists:can_access_room_conversation' as check,
  pg_get_function_identity_arguments(oid) as detail
from pg_proc
where proname = 'can_access_room_conversation' and pronamespace = 'public'::regnamespace;

-- Print its current body for the record -- must still have the deleted_at guard + is_group_member
-- + active study_room_members-row branches (010/011), unmodified by 026.
select 'can_access_room_conversation_current_body' as check, pg_get_functiondef(p.oid) as detail
from pg_proc p
where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace;

select 'study_room_members_row_count (informational)' as check, count(*)::text as detail
from public.study_room_members;
