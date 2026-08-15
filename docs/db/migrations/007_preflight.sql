-- Preflight checks for 007_fix_room_moderation_select_policy.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Same reasoning as 004/005/006's preflight scripts: one UNION ALL query so
-- the Supabase SQL Editor's single result grid shows every check at once.
-- Anything with status FAIL means 007 is not safe to run yet.
--
-- This migration fixes a known, previously-documented tautology in the
-- `room_moderation_select` RLS policy on `room_moderation_actions`
-- (`srm.room_id = srm.room_id` instead of
-- `srm.room_id = room_moderation_actions.room_id` -- see
-- docs/db/STUDY_PLATFORM_DATABASE_SPEC.md §37). The IMPORTANT check below
-- prints the policy's CURRENT `qual` (USING) expression verbatim -- read it
-- before running 007, since 007 replaces that expression wholesale via
-- ALTER POLICY and this migration was written from the spec doc's quoted
-- text, not a live DB connection.
--
-- Run this BEFORE 007_fix_room_moderation_select_policy.sql.

with
  table_exists as (
    select
      'table_exists:room_moderation_actions' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'room_moderation_actions'
  ),
  study_room_members_exists as (
    select
      'table_exists:study_room_members' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'study_room_members'
  ),
  is_room_manager_exists as (
    select
      'function_exists:is_room_manager' as check_name,
      case when count(*) >= 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_proc
    where proname = 'is_room_manager'
      and pronamespace = 'public'::regnamespace
  ),
  policy_exists as (
    select
      'policy_exists:room_moderation_select on room_moderation_actions' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_moderation_actions'
      and policyname = 'room_moderation_select'
  ),
  current_policy_definition as (
    select
      'CURRENT room_moderation_select USING expression -- READ THIS before running 007' as check_name,
      'INFO' as status,
      coalesce(qual, 'policy not found') as detail
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_moderation_actions'
      and policyname = 'room_moderation_select'
  ),
  tautology_still_present as (
    select
      'tautology_present_in_current_policy (informational -- expect true before 007 runs)' as check_name,
      'INFO' as status,
      coalesce((qual like '%srm.room_id = srm.room_id%')::text, 'policy not found') as detail
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_moderation_actions'
      and policyname = 'room_moderation_select'
  ),
  rls_enabled as (
    select
      'rls_enabled:room_moderation_actions' as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relnamespace = 'public'::regnamespace and relname = 'room_moderation_actions'
  )

select * from table_exists
union all select * from study_room_members_exists
union all select * from is_room_manager_exists
union all select * from policy_exists
union all select * from current_policy_definition
union all select * from tautology_still_present
union all select * from rls_enabled
order by check_name;
