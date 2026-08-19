-- Preflight for 020_enable_workspace_realtime_sync.sql. READ-ONLY.
--
-- Confirms: channels/study_rooms/group_notes exist with RLS enabled, prints what the
-- supabase_realtime publication currently contains (expected: messages only -- channels and
-- study_rooms have never been added, see 001_enable_realtime_messages.sql), prints every
-- current `authenticated` policy on group_notes (expected: NONE -- see
-- 019_create_group_notes.sql, which deliberately shipped with zero policies), and confirms
-- is_group_member() exists (the function 020 reuses for the new group_notes SELECT policy --
-- no new/arbitrary-user permission function is introduced).
--
-- Run this and read every row before running 020_enable_workspace_realtime_sync.sql. If
-- group_notes already has an `authenticated` policy, or channels/study_rooms are already in
-- the publication, STOP and reconcile before proceeding (020 assumes the state described
-- above; re-running its idempotent guards is safe either way, but the assumptions in its
-- header comment would no longer hold).

select 'rls_enabled:channels' as check, relrowsecurity as detail
from pg_class where relname = 'channels' and relnamespace = 'public'::regnamespace;

select 'rls_enabled:study_rooms' as check, relrowsecurity as detail
from pg_class where relname = 'study_rooms' and relnamespace = 'public'::regnamespace;

select 'rls_enabled:group_notes' as check, relrowsecurity as detail
from pg_class where relname = 'group_notes' and relnamespace = 'public'::regnamespace;

-- Current publication membership for the four tables this migration cares about.
select 'in_supabase_realtime_publication' as check, tablename, true as detail
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('messages', 'channels', 'study_rooms', 'group_notes')
order by tablename;

-- Every current `authenticated` policy on group_notes -- expected to print ZERO rows.
select 'group_notes_current_policy' as check, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'group_notes' and 'authenticated' = any(roles);

-- Confirms is_group_member() exists and its signature (this migration does not create or
-- modify it -- it's the same pre-existing function channels_select/study_rooms policies and
-- can_access_channel()/can_access_room_conversation() already call, per 002/004/009/010).
select 'function_exists:is_group_member' as check, pg_get_function_identity_arguments(oid) as detail
from pg_proc
where proname = 'is_group_member' and pronamespace = 'public'::regnamespace;
