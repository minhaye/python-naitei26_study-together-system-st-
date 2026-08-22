-- Verify for 026_enable_study_room_members_realtime.sql. READ-ONLY. Run after applying it.

with
  policy_present as (
    select
      'study_room_members_select_room_participant_present (must be OK -- SELECT, PERMISSIVE, authenticated, uses can_access_room_conversation)' as check_name,
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
  restrictive_policy_untouched as (
    select
      'restrictive_policy_present:study_room_members_block_when_room_deleted (must be OK -- untouched by 026)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_room_members'
      and policyname = 'study_room_members_block_when_room_deleted'
      and cmd = 'ALL' and permissive = 'RESTRICTIVE'
  ),
  no_authenticated_write_policy as (
    select
      'no_authenticated_write_policy_added_by_026 (informational -- 026 adds none; pre-existing authenticated write policies on this table, if any, predate 026 and are NOT introduced by it -- see study_room_members_all_current_policies below)' as check_name,
      'INFO' as status,
      coalesce(string_agg(policyname || ':' || cmd, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_room_members'
      and 'authenticated' = any(roles) and cmd != 'SELECT'
  ),
  all_current_policies as (
    select
      'study_room_members_all_current_policies (informational -- full picture after 026; read every one, especially any INSERT/UPDATE/DELETE for authenticated -- those predate 026, see 026_preflight.sql for whether they were already flagged)' as check_name,
      'INFO' as status,
      coalesce(string_agg(policyname || ':' || cmd || ':' || permissive, ', ' order by policyname), 'none') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_room_members'
  ),
  in_publication as (
    select
      'in_supabase_realtime_publication:study_room_members (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_room_members'
  ),
  rls_still_enabled as (
    select
      'rls_enabled:study_room_members (must be OK)' as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relname = 'study_room_members' and relnamespace = 'public'::regnamespace
  ),
  can_access_room_conversation_unchanged as (
    select
      'can_access_room_conversation_still_has_expected_branches (must be OK -- 026 does not modify this function)' as check_name,
      case
        when pg_get_functiondef(p.oid) like '%sr.deleted_at is null%'
         and pg_get_functiondef(p.oid) like '%is_group_member(sr.group_id, auth.uid())%'
         and pg_get_functiondef(p.oid) like '%srm.left_at is null%'
        then 'OK' else 'FAIL'
      end as status,
      pg_get_functiondef(p.oid) as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  row_count_unchanged as (
    select
      'study_room_members_row_count (informational -- compare against 026_preflight.sql''s pre-migration count)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_room_members
  )

select * from policy_present
union all select * from restrictive_policy_untouched
union all select * from no_authenticated_write_policy
union all select * from all_current_policies
union all select * from in_publication
union all select * from rls_still_enabled
union all select * from can_access_room_conversation_unchanged
union all select * from row_count_unchanged
order by check_name;
