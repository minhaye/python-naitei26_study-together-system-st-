-- READ-ONLY. Run after 025_add_message_reactions.sql. Single UNION ALL query (see
-- migration-convention rule: preflight/verify must be one combined result grid).
with checks as (
  select 'table_message_reactions_exists' as check_name,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'message_reactions'
    ) as ok
  union all
  select 'unique_constraint_message_id_user_id_present',
    exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      where tc.table_schema = 'public' and tc.table_name = 'message_reactions'
        and tc.constraint_type = 'UNIQUE'
      group by tc.constraint_name
      having array_agg(kcu.column_name::text order by kcu.column_name) = array['message_id', 'user_id']
    )
  union all
  select 'check_constraint_emoji_present',
    exists (
      select 1 from information_schema.check_constraints cc
      join information_schema.table_constraints tc
        on tc.constraint_name = cc.constraint_name and tc.table_schema = cc.constraint_schema
      where tc.table_schema = 'public' and tc.table_name = 'message_reactions'
        and cc.check_clause like '%emoji%'
    )
  union all
  select 'replica_identity_full',
    coalesce((
      select relreplident = 'f'
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'message_reactions'
    ), false)
  union all
  select 'rls_enabled',
    coalesce((
      select relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'message_reactions'
    ), false)
  union all
  select 'policy_message_reactions_select_present',
    exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'message_reactions'
        and policyname = 'message_reactions_select'
    )
  union all
  select 'no_authenticated_write_policy_added',
    not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'message_reactions'
        and cmd in ('INSERT', 'UPDATE', 'DELETE')
    )
  union all
  select 'in_realtime_publication',
    exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
    )
  union all
  select 'zero_rows_immediately_after',
    (select count(*) from public.message_reactions) = 0
)
select check_name, case when ok then 'OK' else 'FAIL' end as status from checks;
