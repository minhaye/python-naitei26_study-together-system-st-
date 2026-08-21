-- READ-ONLY preflight for 024_add_conversation_members_last_read_at.sql.
with table_exists as (
  select 'conversation_members_exists' as check_name,
    case when count(*) = 1 then 'OK' else 'FAIL' end as status,
    count(*)::text as detail
  from information_schema.tables
  where table_schema = 'public' and table_name = 'conversation_members'
), column_absent as (
  select 'last_read_at_absent' as check_name,
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
    count(*)::text as detail
  from information_schema.columns
  where table_schema = 'public' and table_name = 'conversation_members' and column_name = 'last_read_at'
), row_count as (
  select 'conversation_members_row_count' as check_name, 'INFO' as status, count(*)::text as detail
  from public.conversation_members
)
select * from table_exists
union all select * from column_absent
union all select * from row_count
order by check_name;
