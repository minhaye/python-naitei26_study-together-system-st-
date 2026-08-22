-- Verify for 027_lock_down_study_room_members_writes.sql. READ-ONLY. Run after applying it.

with
  no_authenticated_write_policy as (
    select
      'no_authenticated_write_policy:study_room_members (must be OK -- FastAPI is now the sole writer; RESTRICTIVE policies are deliberately excluded, they only narrow access, never grant it)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      coalesce(string_agg(policyname || ':' || cmd, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_room_members'
      and 'authenticated' = any(roles) and cmd != 'SELECT' and permissive = 'PERMISSIVE'
  ),
  old_broad_select_gone as (
    select
      'study_room_members_select_gone (must be OK -- the old any-group-member SELECT policy is removed)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_room_members' and policyname = 'study_room_members_select'
  ),
  narrow_select_present as (
    select
      'study_room_members_select_room_participant_present (must be OK -- sole remaining SELECT policy)' as check_name,
      case
        when count(*) = 1
         and bool_and(cmd = 'SELECT')
         and bool_and(permissive = 'PERMISSIVE')
         and bool_and('authenticated' = any(roles))
         and bool_and(qual like '%can_access_room_conversation(room_id)%')
        then 'OK' else 'FAIL'
      end as status,
      coalesce(string_agg(policyname, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_room_members'
      and policyname = 'study_room_members_select_room_participant'
  ),
  only_one_select_policy as (
    select
      'exactly_one_select_policy:study_room_members (must be OK -- confirms no other SELECT policy survived)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      coalesce(string_agg(policyname, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_room_members' and cmd = 'SELECT'
  ),
  restrictive_policy_untouched as (
    select
      'restrictive_policy_present:study_room_members_block_when_room_deleted (must be OK -- untouched by 027)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_room_members'
      and policyname = 'study_room_members_block_when_room_deleted' and cmd = 'ALL' and permissive = 'RESTRICTIVE'
  ),
  rls_still_enabled as (
    select
      'rls_enabled:study_room_members (must be OK)' as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relname = 'study_room_members' and relnamespace = 'public'::regnamespace
  ),
  still_in_publication as (
    select
      'in_supabase_realtime_publication:study_room_members (must be OK -- 026 untouched by 027)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_room_members'
  ),
  row_count_unchanged as (
    select
      'study_room_members_row_count (informational -- must equal 027_preflight.sql''s pre-migration count; 027 never touches data)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_room_members
  )

select * from no_authenticated_write_policy
union all select * from old_broad_select_gone
union all select * from narrow_select_present
union all select * from only_one_select_policy
union all select * from restrictive_policy_untouched
union all select * from rls_still_enabled
union all select * from still_in_publication
union all select * from row_count_unchanged
order by check_name;
