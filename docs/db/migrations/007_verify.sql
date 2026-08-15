-- Post-migration verification for 007_fix_room_moderation_select_policy.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same reasoning as 004/005/006's verify scripts: one UNION ALL query, one
-- result grid. Everything with status OK/INFO is expected. Anything FAIL
-- means the migration did not end up in the state it was designed to reach.

with
  policy_present as (
    select
      'policy_present:room_moderation_select' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_moderation_actions'
      and policyname = 'room_moderation_select'
  ),
  tautology_removed as (
    select
      'tautology_removed_from_room_moderation_select (must be OK)' as check_name,
      case when qual not like '%srm.room_id = srm.room_id%' then 'OK' else 'FAIL' end as status,
      qual as detail
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_moderation_actions'
      and policyname = 'room_moderation_select'
  ),
  correlated_comparison_present as (
    select
      'correlated_room_id_comparison_present (must be OK)' as check_name,
      case when qual like '%srm.room_id = room_moderation_actions.room_id%' then 'OK' else 'FAIL' end as status,
      qual as detail
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_moderation_actions'
      and policyname = 'room_moderation_select'
  ),
  rls_still_enabled as (
    select
      'rls_enabled:room_moderation_actions' as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relnamespace = 'public'::regnamespace and relname = 'room_moderation_actions'
  ),
  -- Untouched-by-this-migration sanity check: is_room_manager() must still be
  -- callable the same way (this migration must not have altered/dropped it).
  is_room_manager_intact as (
    select
      'function_intact:is_room_manager' as check_name,
      case when count(*) >= 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_proc
    where proname = 'is_room_manager'
      and pronamespace = 'public'::regnamespace
  )

select * from policy_present
union all select * from tautology_removed
union all select * from correlated_comparison_present
union all select * from rls_still_enabled
union all select * from is_room_manager_intact
order by check_name;
