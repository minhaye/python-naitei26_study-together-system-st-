-- READ-ONLY preflight for 020_create_tasks.sql.
with required_profiles as (
  select 'profiles_exists' as check_name,
    case when count(*) = 1 then 'OK' else 'FAIL' end as status,
    count(*)::text as detail
  from information_schema.tables where table_schema = 'public' and table_name = 'profiles'
), tasks_absent as (
  select 'tasks_absent' as check_name,
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
    count(*)::text as detail
  from information_schema.tables where table_schema = 'public' and table_name = 'tasks'
)
select * from required_profiles union all select * from tasks_absent order by check_name;
