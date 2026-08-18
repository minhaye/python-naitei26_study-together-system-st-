-- Post-migration verification for 011_room_manage_authority_current_group_role.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same one-UNION-ALL-query shape as 009/010's verify scripts. Everything
-- with status OK/INFO is expected. Anything FAIL means the migration did
-- not end up in the state it was designed to reach.

with
  can_access_room_conversation_host_branch_removed as (
    select
      'can_access_room_conversation_host_branch_removed (must be OK -- host_id must no longer be an unconditional access grant)' as check_name,
      case when pg_get_functiondef(p.oid) like '%sr.host_id = auth.uid()%' then 'FAIL' else 'OK' end as status,
      pg_get_functiondef(p.oid) as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  can_access_room_conversation_still_checks_deleted_at as (
    select
      'can_access_room_conversation_body_has_deleted_at_guard (must be OK -- 010''s guard must survive this migration)' as check_name,
      case when pg_get_functiondef(p.oid) like '%sr.deleted_at is null%' then 'OK' else 'FAIL' end as status,
      pg_get_functiondef(p.oid) as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  can_access_room_conversation_still_checks_group_member as (
    select
      'can_access_room_conversation_body_has_group_member_branch (must be OK -- the non-host branch must be untouched)' as check_name,
      case when pg_get_functiondef(p.oid) like '%is_group_member(sr.group_id, auth.uid())%' then 'OK' else 'FAIL' end as status,
      pg_get_functiondef(p.oid) as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  can_access_room_conversation_still_checks_active_membership as (
    select
      'can_access_room_conversation_body_has_active_membership_check (must be OK -- srm.left_at is null must remain the participation gate)' as check_name,
      case when pg_get_functiondef(p.oid) like '%srm.left_at is null%' then 'OK' else 'FAIL' end as status,
      pg_get_functiondef(p.oid) as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  study_rooms_hide_deleted_still_present as (
    select
      'restrictive_policy_present:study_rooms_hide_deleted (must be OK -- 010''s policy must be untouched by 011)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_rooms' and policyname = 'study_rooms_hide_deleted'
      and cmd = 'SELECT' and permissive = 'RESTRICTIVE' and qual like '%deleted_at IS NULL%'
  ),
  no_authenticated_delete_policy_on_study_rooms_still as (
    select
      'no_authenticated_delete_policy:study_rooms (must be OK -- 010''s closure must still hold)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      coalesce(string_agg(policyname, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_rooms' and cmd = 'DELETE' and 'authenticated' = any(roles)
  ),
  study_rooms_row_count_unchanged as (
    select
      'study_rooms_row_count (informational -- compare against 011_preflight.sql''s pre-migration count)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_rooms
  ),
  study_room_members_row_count_unchanged as (
    select
      'study_room_members_row_count (informational -- must equal the pre-migration count; 011 never touches this table)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_room_members
  )

select * from can_access_room_conversation_host_branch_removed
union all select * from can_access_room_conversation_still_checks_deleted_at
union all select * from can_access_room_conversation_still_checks_group_member
union all select * from can_access_room_conversation_still_checks_active_membership
union all select * from study_rooms_hide_deleted_still_present
union all select * from no_authenticated_delete_policy_on_study_rooms_still
union all select * from study_rooms_row_count_unchanged
union all select * from study_room_members_row_count_unchanged
order by check_name;
