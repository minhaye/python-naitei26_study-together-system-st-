-- READ-ONLY. Run after 024_add_conversation_members_last_read_at.sql. Single UNION ALL
-- query (see migration-convention rule: preflight/verify must be one combined result grid).
with checks as (
  select 'column_last_read_at_exists' as check_name,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'conversation_members'
        and column_name = 'last_read_at'
    ) as ok
  union all
  select 'column_last_read_at_not_null',
    coalesce((
      select is_nullable = 'NO' from information_schema.columns
      where table_schema = 'public' and table_name = 'conversation_members'
        and column_name = 'last_read_at'
    ), false)
  union all
  select 'column_last_read_at_has_default',
    coalesce((
      select column_default is not null from information_schema.columns
      where table_schema = 'public' and table_name = 'conversation_members'
        and column_name = 'last_read_at'
    ), false)
  union all
  select 'no_rows_with_null_last_read_at',
    not exists (select 1 from public.conversation_members where last_read_at is null)
  union all
  select 'no_authenticated_write_policy_added',
    not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'conversation_members'
        and cmd in ('INSERT', 'UPDATE', 'DELETE')
    )
  union all
  select 'policy_conversation_members_select_present',
    exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'conversation_members'
        and policyname = 'conversation_members_select'
    )
)
select check_name, case when ok then 'OK' else 'FAIL' end as status from checks;
