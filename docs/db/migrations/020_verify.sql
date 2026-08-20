-- READ-ONLY verification for 020_create_tasks.sql.
with task_columns as (
  select 'tasks_required_columns' as check_name,
    case when count(*) = 7 then 'OK' else 'FAIL' end as status,
    string_agg(column_name, ', ' order by column_name) as detail
  from information_schema.columns where table_schema = 'public' and table_name = 'tasks'
    and column_name in ('id', 'user_id', 'title', 'due_date', 'priority', 'completed_at', 'created_at')
), owner_index as (
  select 'tasks_user_due_date_index' as check_name,
    case when count(*) = 1 then 'OK' else 'FAIL' end as status, count(*)::text as detail
  from pg_indexes where schemaname = 'public' and tablename = 'tasks' and indexname = 'tasks_user_due_date_idx'
), rls as (
  select 'tasks_rls_enabled' as check_name,
    case when relrowsecurity then 'OK' else 'FAIL' end as status, relrowsecurity::text as detail
  from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace
  where nspname = 'public' and relname = 'tasks'
), owner_policies as (
  select 'tasks_owner_policies' as check_name,
    case when count(*) = 3 then 'OK' else 'FAIL' end as status,
    string_agg(policyname, ', ' order by policyname) as detail
  from pg_policies where schemaname = 'public' and tablename = 'tasks' and roles = '{authenticated}'
)
select * from task_columns union all select * from owner_index union all select * from rls union all select * from owner_policies order by check_name;
