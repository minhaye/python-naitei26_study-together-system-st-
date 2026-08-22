-- READ-ONLY preflight for 025_add_message_reactions.sql.
with required_tables as (
  select 'messages_exists' as check_name,
    case when count(*) = 1 then 'OK' else 'FAIL' end as status,
    count(*)::text as detail
  from information_schema.tables
  where table_schema = 'public' and table_name = 'messages'
  union all
  select 'conversations_exists',
    case when count(*) = 1 then 'OK' else 'FAIL' end,
    count(*)::text
  from information_schema.tables
  where table_schema = 'public' and table_name = 'conversations'
  union all
  select 'profiles_exists',
    case when count(*) = 1 then 'OK' else 'FAIL' end,
    count(*)::text
  from information_schema.tables
  where table_schema = 'public' and table_name = 'profiles'
), table_absent as (
  select 'message_reactions_absent' as check_name,
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
    count(*)::text as detail
  from information_schema.tables
  where table_schema = 'public' and table_name = 'message_reactions'
), function_exists as (
  select 'can_access_conversation_exists' as check_name,
    case when count(*) = 1 then 'OK' else 'FAIL' end as status,
    count(*)::text as detail
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'can_access_conversation'
), row_counts as (
  select 'messages_row_count' as check_name, 'INFO' as status, count(*)::text as detail
  from public.messages
)
select * from required_tables
union all select * from table_absent
union all select * from function_exists
union all select * from row_counts
order by check_name;
