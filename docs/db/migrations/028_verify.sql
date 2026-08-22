-- READ-ONLY. Run after 028_add_forum_reactions.sql. Single UNION ALL query (see
-- migration-convention rule: preflight/verify must be one combined result grid).
with checks as (
  select 'table_post_reactions_exists' as check_name,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'post_reactions'
    ) as ok
  union all
  select 'table_comment_reactions_exists',
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'comment_reactions'
    )
  union all
  select 'unique_constraint_post_reactions_present',
    exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      where tc.table_schema = 'public' and tc.table_name = 'post_reactions'
        and tc.constraint_type = 'UNIQUE'
      group by tc.constraint_name
      having array_agg(kcu.column_name::text order by kcu.column_name) = array['post_id', 'user_id']
    )
  union all
  select 'unique_constraint_comment_reactions_present',
    exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      where tc.table_schema = 'public' and tc.table_name = 'comment_reactions'
        and tc.constraint_type = 'UNIQUE'
      group by tc.constraint_name
      having array_agg(kcu.column_name::text order by kcu.column_name) = array['comment_id', 'user_id']
    )
  union all
  select 'check_constraint_post_reactions_emoji_present',
    exists (
      select 1 from information_schema.check_constraints cc
      join information_schema.table_constraints tc
        on tc.constraint_name = cc.constraint_name and tc.table_schema = cc.constraint_schema
      where tc.table_schema = 'public' and tc.table_name = 'post_reactions'
        and cc.check_clause like '%emoji%'
    )
  union all
  select 'check_constraint_comment_reactions_emoji_present',
    exists (
      select 1 from information_schema.check_constraints cc
      join information_schema.table_constraints tc
        on tc.constraint_name = cc.constraint_name and tc.table_schema = cc.constraint_schema
      where tc.table_schema = 'public' and tc.table_name = 'comment_reactions'
        and cc.check_clause like '%emoji%'
    )
  union all
  select 'rls_enabled_post_reactions',
    coalesce((
      select relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'post_reactions'
    ), false)
  union all
  select 'rls_enabled_comment_reactions',
    coalesce((
      select relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'comment_reactions'
    ), false)
  union all
  select 'no_policy_on_post_reactions',
    not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'post_reactions')
  union all
  select 'no_policy_on_comment_reactions',
    not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'comment_reactions')
  union all
  select 'post_reactions_row_count_matches_post_likes',
    (select count(*) from public.post_reactions) = (select count(*) from public.post_likes)
  union all
  select 'comment_reactions_row_count_matches_comment_likes',
    (select count(*) from public.comment_reactions) = (select count(*) from public.comment_likes)
  union all
  select 'post_likes_still_present_untouched',
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'post_likes')
  union all
  select 'comment_likes_still_present_untouched',
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'comment_likes')
)
select check_name, case when ok then 'OK' else 'FAIL' end as status from checks;
