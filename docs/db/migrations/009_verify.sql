-- Post-migration verification for 009_soft_delete_channels.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same reasoning as 004-008's verify scripts: one UNION ALL query, one result
-- grid. Everything with status OK/INFO is expected. Anything FAIL means the
-- migration did not end up in the state it was designed to reach.

with
  deleted_at_column_present as (
    select
      'column_present:channels.deleted_at (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'channels' and column_name = 'deleted_at'
      and data_type = 'timestamp with time zone' and is_nullable = 'YES'
  ),
  deleted_by_column_present as (
    select
      'column_present:channels.deleted_by (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'channels' and column_name = 'deleted_by'
      and data_type = 'uuid' and is_nullable = 'YES'
  ),
  deleted_by_fk_restrict as (
    select
      'fk_present:channels.deleted_by -> profiles.id ON DELETE RESTRICT (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_class frel on frel.oid = con.confrelid
    where rel.relname = 'channels'
      and frel.relname = 'profiles'
      and con.contype = 'f'
      and con.confdeltype = 'r'
      and con.conkey = (
        select array_agg(attnum order by attnum)
        from pg_attribute
        where attrelid = rel.oid and attname = 'deleted_by'
      )
  ),
  no_existing_channel_marked_deleted as (
    select
      'no_existing_channel_retroactively_deleted (must be OK -- migration must not have set deleted_at on any pre-existing row)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.channels
    where deleted_at is not null
  ),
  can_access_channel_checks_deleted_at as (
    select
      'can_access_channel_body_has_deleted_at_guard (must be OK)' as check_name,
      case when pg_get_functiondef(p.oid) like '%c.deleted_at is null%' then 'OK' else 'FAIL' end as status,
      pg_get_functiondef(p.oid) as detail
    from pg_proc p
    where p.proname = 'can_access_channel' and p.pronamespace = 'public'::regnamespace
  ),
  channels_delete_manager_gone as (
    select
      'policy_absent:channels_delete_manager (must be OK -- no authenticated-role physical delete)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'channels' and policyname = 'channels_delete_manager'
  ),
  channels_update_manager_checks_deleted_at as (
    select
      'channels_update_manager_using_has_deleted_at_guard (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    where c.relname = 'channels'
      and pol.polname = 'channels_update_manager'
      and pg_get_expr(pol.polqual, pol.polrelid) like '%deleted_at IS NULL%'
  ),
  channel_members_insert_checks_deleted_at as (
    select
      'channel_members_insert_checks_deleted_at (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    where c.relname = 'channel_members'
      and pol.polname = 'channel_members_insert'
      and pg_get_expr(pol.polwithcheck, pol.polrelid) like '%deleted_at IS NULL%'
  ),
  channel_members_delete_checks_deleted_at as (
    select
      'channel_members_delete_manager_branch_checks_deleted_at (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    where c.relname = 'channel_members'
      and pol.polname = 'channel_members_delete'
      and pg_get_expr(pol.polqual, pol.polrelid) like '%deleted_at IS NULL%'
      and pg_get_expr(pol.polqual, pol.polrelid) like '%user_id = auth.uid()%'
  ),
  rls_still_enabled_on_channels as (
    select
      'rls_enabled:channels (must be OK -- unrelated to this migration, sanity check)' as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relname = 'channels' and relnamespace = 'public'::regnamespace
  ),
  channel_row_count_unchanged as (
    select
      'channels_row_count (informational -- compare against preflight/pre-migration count)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.channels
  ),
  no_orphaned_channels_still as (
    select
      'no_channels_without_conversation (must be OK -- migration must not have touched conversations)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.channels c
    where not exists (select 1 from public.conversations conv where conv.channel_id = c.id)
  )

select * from deleted_at_column_present
union all select * from deleted_by_column_present
union all select * from deleted_by_fk_restrict
union all select * from no_existing_channel_marked_deleted
union all select * from can_access_channel_checks_deleted_at
union all select * from channels_delete_manager_gone
union all select * from channels_update_manager_checks_deleted_at
union all select * from channel_members_insert_checks_deleted_at
union all select * from channel_members_delete_checks_deleted_at
union all select * from rls_still_enabled_on_channels
union all select * from channel_row_count_unchanged
union all select * from no_orphaned_channels_still
order by check_name;
