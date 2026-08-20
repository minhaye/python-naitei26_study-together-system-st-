-- READ-ONLY preflight for 021_create_roadmaps.sql.
with required_profiles as (
  select 'profiles_exists' as check_name, case when count(*) = 1 then 'OK' else 'FAIL' end as status, count(*)::text as detail
  from information_schema.tables where table_schema = 'public' and table_name = 'profiles'
), roadmap_tables_absent as (
  select 'roadmap_tables_absent' as check_name, case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status, count(*)::text as detail
  from information_schema.tables where table_schema = 'public' and table_name in ('roadmaps', 'roadmap_phases')
) select * from required_profiles union all select * from roadmap_tables_absent order by check_name;
