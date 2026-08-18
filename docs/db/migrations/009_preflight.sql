-- Preflight checks for 009_soft_delete_channels.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Same reasoning as 004-008's preflight scripts: one UNION ALL query so the
-- Supabase SQL Editor's single result grid shows every check at once.
--
-- On the CURRENT live database (checked 2026-08-18), `channels` has no
-- `deleted_at`/`deleted_by` columns yet, and `can_access_channel()` /
-- `channels_update_manager` / `channel_members_insert` / `channel_members_delete`
-- do not know about soft-delete at all -- these checks are expected to show
-- FAIL/0 (informational, not blocking) before 009 runs. The two INFO rows at
-- the bottom print the live definitions verbatim so they can be diffed
-- against what 009_soft_delete_channels.sql is about to (re-)create.
--
-- Run this BEFORE 009_soft_delete_channels.sql.

with
  channels_table_exists as (
    select
      'table_exists:channels' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'channels'
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
      'column_absent:channels.deleted_at (informational -- OK means not yet added, expected before 009)' as check_name,
      case when count(*) = 0 then 'OK' else 'INFO/already-present' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'channels' and column_name = 'deleted_at'
  ),
  deleted_by_column_absent as (
    select
      'column_absent:channels.deleted_by (informational -- OK means not yet added, expected before 009)' as check_name,
      case when count(*) = 0 then 'OK' else 'INFO/already-present' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'channels' and column_name = 'deleted_by'
  ),
  channels_delete_manager_policy_present as (
    select
      'policy_present:channels_delete_manager (informational -- this is DROPped by 009, see header)' as check_name,
      case when count(*) = 1 then 'INFO/will-be-dropped' else 'INFO/already-absent' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'channels' and policyname = 'channels_delete_manager'
  ),
  no_orphaned_channels as (
    select
      'no_channels_without_conversation (must be OK -- soft-delete relies on the channel''s conversation still existing)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.channels c
    where not exists (select 1 from public.conversations conv where conv.channel_id = c.id)
  ),
  current_can_access_channel_body as (
    select
      'CURRENT can_access_channel() body -- READ THIS before running 009' as check_name,
      'INFO' as status,
      coalesce(pg_get_functiondef(p.oid), 'function not found') as detail
    from pg_proc p
    where p.proname = 'can_access_channel'
      and p.pronamespace = 'public'::regnamespace
  ),
  current_channels_update_manager_policy as (
    select
      'CURRENT channels_update_manager policy -- READ THIS before running 009' as check_name,
      'INFO' as status,
      coalesce('USING: ' || pg_get_expr(pol.polqual, pol.polrelid) || ' | WITH CHECK: ' || pg_get_expr(pol.polwithcheck, pol.polrelid), 'policy not found') as detail
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    where c.relname = 'channels' and pol.polname = 'channels_update_manager'
  ),
  current_channel_members_insert_policy as (
    select
      'CURRENT channel_members_insert policy -- READ THIS before running 009' as check_name,
      'INFO' as status,
      coalesce('WITH CHECK: ' || pg_get_expr(pol.polwithcheck, pol.polrelid), 'policy not found') as detail
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    where c.relname = 'channel_members' and pol.polname = 'channel_members_insert'
  ),
  current_channel_members_delete_policy as (
    select
      'CURRENT channel_members_delete policy -- READ THIS before running 009' as check_name,
      'INFO' as status,
      coalesce('USING: ' || pg_get_expr(pol.polqual, pol.polrelid), 'policy not found') as detail
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    where c.relname = 'channel_members' and pol.polname = 'channel_members_delete'
  )

select * from channels_table_exists
union all select * from profiles_table_exists
union all select * from deleted_at_column_absent
union all select * from deleted_by_column_absent
union all select * from channels_delete_manager_policy_present
union all select * from no_orphaned_channels
union all select * from current_can_access_channel_body
union all select * from current_channels_update_manager_policy
union all select * from current_channel_members_insert_policy
union all select * from current_channel_members_delete_policy
order by check_name;
