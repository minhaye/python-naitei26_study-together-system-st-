-- Preflight checks for 010_soft_delete_study_rooms.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Same reasoning as 009's preflight script (see its header): one UNION ALL
-- query so the Supabase SQL Editor's single result grid shows every check at
-- once. Diagnostic queries use VALUES + LEFT JOIN (not WHERE ... IN) so a
-- missing required object still produces a visible FAIL row instead of
-- silently vanishing from the grid.
--
-- Unlike 009 (channels), the base RLS policies on study_rooms /
-- study_room_members / room_moderation_actions were never captured in this
-- repo -- they predate every tracked migration (same situation documented in
-- 008's header for the groups_add_owner trigger). This preflight therefore
-- prints EVERY current policy on all three tables by querying pg_policies
-- directly (name-agnostic), rather than checking a fixed list of expected
-- policy names the way 009_preflight.sql did for channels_update_manager
-- etc. Read every INFO row's `detail` column before running 010 -- if any
-- policy shown here needs a deleted_at guard beyond what 010 adds (which
-- only touches can_access_room_conversation() and adds new RESTRICTIVE
-- policies -- see that migration's header for why), that is a follow-up,
-- not something this preflight or 010 assumes away.
--
-- 010 also closes a pre-existing Python/SQL parity gap while it is already
-- touching can_access_room_conversation(): Python's can_access_room() has
-- always granted the room host unconditional access; this SQL function has
-- never had that branch. The "CURRENT can_access_room_conversation() body"
-- INFO row below is expected to show NO `host_id` reference before 010 runs
-- -- that is the gap being closed, not a preflight failure.
--
-- Run this BEFORE 010_soft_delete_study_rooms.sql.

with
  study_rooms_table_exists as (
    select
      'table_exists:study_rooms' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'study_rooms'
  ),
  study_room_members_table_exists as (
    select
      'table_exists:study_room_members' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'study_room_members'
  ),
  room_moderation_actions_table_exists as (
    select
      'table_exists:room_moderation_actions' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'room_moderation_actions'
  ),
  profiles_table_exists as (
    select
      'table_exists:profiles' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ),
  deleted_at_column_absent as (
    select
      'column_absent:study_rooms.deleted_at (informational -- OK means not yet added, expected before 010)' as check_name,
      case when count(*) = 0 then 'OK' else 'INFO/already-present' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'study_rooms' and column_name = 'deleted_at'
  ),
  deleted_by_column_absent as (
    select
      'column_absent:study_rooms.deleted_by (informational -- OK means not yet added, expected before 010)' as check_name,
      case when count(*) = 0 then 'OK' else 'INFO/already-present' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'study_rooms' and column_name = 'deleted_by'
  ),
  no_orphaned_rooms as (
    select
      'no_rooms_without_conversation (informational -- pre-existing gap: StudyRoomsService.create() does not create a conversation for new rooms, only the 8 rooms backfilled by migration 004 have one; NOT something 010 fixes)' as check_name,
      case when count(*) = 0 then 'OK' else 'INFO/pre-existing-gap' end as status,
      count(*)::text as detail
    from public.study_rooms sr
    where not exists (select 1 from public.conversations conv where conv.room_id = sr.id)
  ),
  current_can_access_room_conversation_body as (
    select
      'CURRENT can_access_room_conversation() body -- READ THIS before running 010' as check_name,
      'INFO' as status,
      coalesce(pg_get_functiondef(p.oid), 'function not found') as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation'
      and p.pronamespace = 'public'::regnamespace
  ),
  current_can_access_room_conversation_host_branch_absent as (
    select
      'can_access_room_conversation_host_branch_absent (informational -- OK/expected-gap means the pre-010 function has no host_id branch, which is the Python/SQL parity gap 010 closes)' as check_name,
      case
        when pg_get_functiondef(p.oid) like '%host_id%' then 'INFO/already-present'
        else 'OK/expected-gap'
      end as status,
      coalesce(pg_get_functiondef(p.oid), 'function not found') as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation'
      and p.pronamespace = 'public'::regnamespace
  ),
  study_rooms_delete_policies as (
    select
      'CURRENT study_rooms DELETE policy for authenticated (informational -- 010 drops ALL of these; must be OK/none-found or the physical-delete gap 010 §3 closes is confirmed live)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'INFO/will-be-dropped' end as status,
      coalesce(string_agg(policyname || ': ' || coalesce(qual, '<none>'), ' | '), 'none') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_rooms' and cmd = 'DELETE' and 'authenticated' = any(roles)
  ),
  all_study_rooms_policies as (
    select
      'CURRENT policy on study_rooms: ' || policyname || ' (' || cmd || ')' as check_name,
      'INFO' as status,
      coalesce('permissive=' || permissive || ' | roles=' || roles::text || ' | using=' || coalesce(qual, '<none>') || ' | with_check=' || coalesce(with_check, '<none>'), 'n/a') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_rooms'
  ),
  all_study_room_members_policies as (
    select
      'CURRENT policy on study_room_members: ' || policyname || ' (' || cmd || ')' as check_name,
      'INFO' as status,
      coalesce('permissive=' || permissive || ' | roles=' || roles::text || ' | using=' || coalesce(qual, '<none>') || ' | with_check=' || coalesce(with_check, '<none>'), 'n/a') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_room_members'
  ),
  all_room_moderation_actions_policies as (
    select
      'CURRENT policy on room_moderation_actions: ' || policyname || ' (' || cmd || ')' as check_name,
      'INFO' as status,
      coalesce('permissive=' || permissive || ' | roles=' || roles::text || ' | using=' || coalesce(qual, '<none>') || ' | with_check=' || coalesce(with_check, '<none>'), 'n/a') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'room_moderation_actions'
  ),
  rls_enabled_study_rooms as (
    select
      'rls_enabled:study_rooms (informational -- 010 enables it defensively regardless)' as check_name,
      case when relrowsecurity then 'OK' else 'INFO/currently-disabled' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relname = 'study_rooms' and relnamespace = 'public'::regnamespace
  ),
  rls_enabled_study_room_members as (
    select
      'rls_enabled:study_room_members (informational -- 010 enables it defensively regardless)' as check_name,
      case when relrowsecurity then 'OK' else 'INFO/currently-disabled' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relname = 'study_room_members' and relnamespace = 'public'::regnamespace
  ),
  rls_enabled_room_moderation_actions as (
    select
      'rls_enabled:room_moderation_actions (informational -- 010 enables it defensively regardless)' as check_name,
      case when relrowsecurity then 'OK' else 'INFO/currently-disabled' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relname = 'room_moderation_actions' and relnamespace = 'public'::regnamespace
  ),
  study_rooms_row_count as (
    select
      'study_rooms_row_count (informational -- compare against 010_verify.sql''s post-migration count and confirm it is unchanged)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_rooms
  )

select * from study_rooms_table_exists
union all select * from study_room_members_table_exists
union all select * from room_moderation_actions_table_exists
union all select * from profiles_table_exists
union all select * from deleted_at_column_absent
union all select * from deleted_by_column_absent
union all select * from no_orphaned_rooms
union all select * from current_can_access_room_conversation_body
union all select * from current_can_access_room_conversation_host_branch_absent
union all select * from study_rooms_delete_policies
union all select * from all_study_rooms_policies
union all select * from all_study_room_members_policies
union all select * from all_room_moderation_actions_policies
union all select * from rls_enabled_study_rooms
union all select * from rls_enabled_study_room_members
union all select * from rls_enabled_room_moderation_actions
union all select * from study_rooms_row_count
order by check_name;
