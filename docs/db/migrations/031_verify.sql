-- READ-ONLY. Run after 031_add_user_reports.sql.
with checks as (
  select 'type_report_reason_exists' as check_name,
    exists (select 1 from pg_type where typname = 'report_reason') as ok
  union all
  select 'type_report_status_exists',
    exists (select 1 from pg_type where typname = 'report_status') as ok
  union all
  select 'table_user_reports_exists',
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_reports') as ok
  union all
  select 'constraint_user_reports_not_self_exists',
    exists (
      select 1 from information_schema.table_constraints
      where table_schema = 'public' and table_name = 'user_reports' and constraint_name = 'user_reports_not_self'
    ) as ok
  union all
  select 'index_user_reports_reported_user_id_exists',
    exists (
      select 1 from pg_indexes where schemaname = 'public' and tablename = 'user_reports'
        and indexname = 'idx_user_reports_reported_user_id'
    ) as ok
  union all
  select 'index_user_reports_status_exists',
    exists (
      select 1 from pg_indexes where schemaname = 'public' and tablename = 'user_reports'
        and indexname = 'idx_user_reports_status'
    ) as ok
  union all
  select 'rls_enabled_user_reports',
    coalesce((select relrowsecurity from pg_class where relname = 'user_reports'), false) as ok
  union all
  select 'no_authenticated_policy_user_reports',
    not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_reports') as ok
  union all
  select 'user_reports_row_count_zero',
    (select count(*) from public.user_reports) = 0 as ok
)
select check_name, case when ok then 'OK' else 'FAIL' end as status from checks;
