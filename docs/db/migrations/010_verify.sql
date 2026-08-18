-- Post-migration verification for 010_soft_delete_study_rooms.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same reasoning as 009's verify script: one UNION ALL query, one result
-- grid. Everything with status OK/INFO is expected. Anything FAIL means the
-- migration did not end up in the state it was designed to reach.

with
  deleted_at_column_present as (
    select
      'column_present:study_rooms.deleted_at (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'study_rooms' and column_name = 'deleted_at'
      and data_type = 'timestamp with time zone' and is_nullable = 'YES'
  ),
  deleted_by_column_present as (
    select
      'column_present:study_rooms.deleted_by (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'study_rooms' and column_name = 'deleted_by'
      and data_type = 'uuid' and is_nullable = 'YES'
  ),
  deleted_by_fk_restrict as (
    select
      'fk_present:study_rooms.deleted_by -> profiles.id ON DELETE RESTRICT (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_class frel on frel.oid = con.confrelid
    where rel.relname = 'study_rooms'
      and frel.relname = 'profiles'
      and con.contype = 'f'
      and con.confdeltype = 'r'
      and con.conkey = (
        select array_agg(attnum order by attnum)
        from pg_attribute
        where attrelid = rel.oid and attname = 'deleted_by'
      )
  ),
  no_existing_room_marked_deleted as (
    select
      'no_existing_room_retroactively_deleted (must be OK -- migration must not have set deleted_at on any pre-existing row)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.study_rooms
    where deleted_at is not null
  ),
  can_access_room_conversation_checks_deleted_at as (
    select
      'can_access_room_conversation_body_has_deleted_at_guard (must be OK)' as check_name,
      case when pg_get_functiondef(p.oid) like '%sr.deleted_at is null%' then 'OK' else 'FAIL' end as status,
      pg_get_functiondef(p.oid) as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  can_access_room_conversation_has_host_branch as (
    select
      'can_access_room_conversation_body_has_host_branch (must be OK -- closes the Python/SQL parity gap: host gets unconditional access, matching can_access_room())' as check_name,
      case when pg_get_functiondef(p.oid) like '%sr.host_id = auth.uid()%' then 'OK' else 'FAIL' end as status,
      pg_get_functiondef(p.oid) as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  no_authenticated_delete_policy_on_study_rooms as (
    select
      'no_authenticated_delete_policy:study_rooms (must be OK -- no authenticated-role physical delete)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      coalesce(string_agg(policyname, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_rooms' and cmd = 'DELETE' and 'authenticated' = any(roles)
  ),
  study_rooms_hide_deleted_present as (
    select
      'restrictive_policy_present:study_rooms_hide_deleted (must be OK -- SELECT, deleted_at IS NULL)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_rooms' and policyname = 'study_rooms_hide_deleted'
      and cmd = 'SELECT' and permissive = 'RESTRICTIVE' and qual like '%deleted_at IS NULL%'
  ),
  study_rooms_block_update_present as (
    select
      'restrictive_policy_present:study_rooms_block_update_when_deleted (must be OK -- UPDATE, deleted_at IS NULL)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_rooms' and policyname = 'study_rooms_block_update_when_deleted'
      and cmd = 'UPDATE' and permissive = 'RESTRICTIVE' and qual like '%deleted_at IS NULL%'
  ),
  study_room_members_restrictive_present as (
    select
      'restrictive_policy_present:study_room_members_block_when_room_deleted (must be OK -- ALL, references parent room deleted_at)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'study_room_members'
      and policyname = 'study_room_members_block_when_room_deleted'
      and cmd = 'ALL' and permissive = 'RESTRICTIVE'
      and qual like '%deleted_at is null%' and with_check like '%deleted_at is null%'
  ),
  room_moderation_actions_restrictive_present as (
    select
      'restrictive_policy_present:room_moderation_actions_block_when_room_deleted (must be OK -- ALL, references parent room deleted_at)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'room_moderation_actions'
      and policyname = 'room_moderation_actions_block_when_room_deleted'
      and cmd = 'ALL' and permissive = 'RESTRICTIVE'
      and qual like '%deleted_at is null%' and with_check like '%deleted_at is null%'
  ),
  rls_still_enabled_study_rooms as (
    select
      'rls_enabled:study_rooms (must be OK)' as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relname = 'study_rooms' and relnamespace = 'public'::regnamespace
  ),
  rls_still_enabled_study_room_members as (
    select
      'rls_enabled:study_room_members (must be OK)' as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relname = 'study_room_members' and relnamespace = 'public'::regnamespace
  ),
  rls_still_enabled_room_moderation_actions as (
    select
      'rls_enabled:room_moderation_actions (must be OK)' as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relname = 'room_moderation_actions' and relnamespace = 'public'::regnamespace
  ),
  study_rooms_row_count_unchanged as (
    select
      'study_rooms_row_count (informational -- compare against 010_preflight.sql''s pre-migration count)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_rooms
  ),
  no_orphaned_rooms_still as (
    select
      'no_new_orphaned_rooms (must be OK -- migration must not have touched conversations; pre-existing orphans, if any, are a separate known gap -- see 010_preflight.sql)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_rooms sr
    where not exists (select 1 from public.conversations conv where conv.room_id = sr.id)
  ),
  no_study_room_members_deleted as (
    select
      'study_room_members_row_count (informational -- confirm unchanged from before 010)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_room_members
  ),
  no_room_moderation_actions_deleted as (
    select
      'room_moderation_actions_row_count (informational -- confirm unchanged from before 010)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.room_moderation_actions
  )

select * from deleted_at_column_present
union all select * from deleted_by_column_present
union all select * from deleted_by_fk_restrict
union all select * from no_existing_room_marked_deleted
union all select * from can_access_room_conversation_checks_deleted_at
union all select * from can_access_room_conversation_has_host_branch
union all select * from no_authenticated_delete_policy_on_study_rooms
union all select * from study_rooms_hide_deleted_present
union all select * from study_rooms_block_update_present
union all select * from study_room_members_restrictive_present
union all select * from room_moderation_actions_restrictive_present
union all select * from rls_still_enabled_study_rooms
union all select * from rls_still_enabled_study_room_members
union all select * from rls_still_enabled_room_moderation_actions
union all select * from study_rooms_row_count_unchanged
union all select * from no_orphaned_rooms_still
union all select * from no_study_room_members_deleted
union all select * from no_room_moderation_actions_deleted
order by check_name;
