-- READ-ONLY verification for 021_create_roadmaps.sql.
with tables_present as (
  select 'roadmap_tables_present' as check_name, case when count(*) = 2 then 'OK' else 'FAIL' end as status, count(*)::text as detail
  from information_schema.tables where table_schema = 'public' and table_name in ('roadmaps', 'roadmap_phases')
), rls_enabled as (
  select 'roadmap_rls_enabled' as check_name, case when count(*) = 2 then 'OK' else 'FAIL' end as status, count(*)::text as detail
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('roadmaps', 'roadmap_phases') and c.relrowsecurity
), policies_present as (
  select 'roadmap_owner_policies' as check_name, case when count(*) = 6 then 'OK' else 'FAIL' end as status, count(*)::text as detail
  from pg_policies where schemaname = 'public' and tablename in ('roadmaps', 'roadmap_phases') and roles = '{authenticated}'
) select * from tables_present union all select * from rls_enabled union all select * from policies_present order by check_name;
