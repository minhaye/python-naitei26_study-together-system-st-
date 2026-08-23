-- READ-ONLY preflight for 031_add_user_reports.sql.
with profiles_exists as (
  select 'profiles_exists' as check_name,
    case when count(*) = 1 then 'OK' else 'FAIL' end as status,
    string_agg(table_name, ',') as detail
  from information_schema.tables
  where table_schema = 'public' and table_name = 'profiles'
), new_table_absent as (
  select 'user_reports_absent' as check_name,
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
    count(*)::text as detail
  from information_schema.tables
  where table_schema = 'public' and table_name = 'user_reports'
), new_types_absent as (
  select 'new_enum_types_absent' as check_name,
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
    string_agg(typname, ',') as detail
  from pg_type
  where typname in ('report_reason', 'report_status')
), profiles_row_count as (
  select 'profiles_row_count' as check_name, 'INFO' as status, count(*)::text as detail from public.profiles
)
select * from profiles_exists
union all select * from new_table_absent
union all select * from new_types_absent
union all select * from profiles_row_count
order by check_name;
