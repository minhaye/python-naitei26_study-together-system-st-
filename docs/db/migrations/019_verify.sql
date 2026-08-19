-- Post-migration verification for 019_create_group_notes.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same one-UNION-ALL-query shape as prior verify scripts. Everything with
-- status OK/INFO is expected. Anything FAIL means the migration did not end
-- up in the state it was designed to reach -- stop and investigate before
-- building/relying on the Notes API against this database.

with
  group_notes_table_exists as (
    select
      'group_notes_table_exists (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'group_notes'
  ),
  group_notes_required_columns as (
    select
      'group_notes_required_columns (must be OK -- all 7 expected columns present)' as check_name,
      case when count(*) = 7 then 'OK' else 'FAIL' end as status,
      string_agg(column_name, ', ' order by column_name) as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'group_notes'
      and column_name in ('id', 'group_id', 'author_id', 'title', 'content', 'created_at', 'updated_at')
  ),
  group_notes_group_id_index_present as (
    select
      'index_present:idx_group_notes_group_id (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'group_notes' and indexname = 'idx_group_notes_group_id'
  ),
  group_notes_no_rows_yet as (
    select
      'group_notes_row_count (informational -- expected 0 immediately after this migration; the API has not created any yet)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.group_notes
  ),
  group_notes_rls_enabled as (
    select
      'rls_enabled:group_notes (must be OK)' as check_name,
      case when c.relrowsecurity then 'OK' else 'FAIL' end as status,
      case when c.relrowsecurity then 'enabled' else 'DISABLED' end as detail
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relname = 'group_notes'
  ),
  no_policy_for_authenticated as (
    select
      'no_policy_for_authenticated:group_notes (must be OK -- FastAPI, postgres role, is the sole reader/writer; no Realtime/direct-client access for Notes)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      coalesce(string_agg(policyname || ':' || cmd, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'group_notes'
  ),
  room_notes_table_absent as (
    select
      'room_notes_table_absent (informational -- confirms the earlier, never-applied Room-scoped draft left no trace)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'INFO/unexpectedly-exists' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'room_notes'
  )

select * from group_notes_table_exists
union all select * from group_notes_required_columns
union all select * from group_notes_group_id_index_present
union all select * from group_notes_no_rows_yet
union all select * from group_notes_rls_enabled
union all select * from no_policy_for_authenticated
union all select * from room_notes_table_absent
order by check_name;
