-- READ-ONLY preflight for 028_add_forum_reactions.sql.
with required_tables as (
  select 'forum_posts_exists' as check_name,
    case when count(*) = 1 then 'OK' else 'FAIL' end as status, count(*)::text as detail
  from information_schema.tables where table_schema = 'public' and table_name = 'forum_posts'
  union all
  select 'comments_exists',
    case when count(*) = 1 then 'OK' else 'FAIL' end, count(*)::text
  from information_schema.tables where table_schema = 'public' and table_name = 'comments'
  union all
  select 'profiles_exists',
    case when count(*) = 1 then 'OK' else 'FAIL' end, count(*)::text
  from information_schema.tables where table_schema = 'public' and table_name = 'profiles'
  union all
  select 'post_likes_exists',
    case when count(*) = 1 then 'OK' else 'FAIL' end, count(*)::text
  from information_schema.tables where table_schema = 'public' and table_name = 'post_likes'
  union all
  select 'comment_likes_exists',
    case when count(*) = 1 then 'OK' else 'FAIL' end, count(*)::text
  from information_schema.tables where table_schema = 'public' and table_name = 'comment_likes'
), tables_absent as (
  select 'post_reactions_absent' as check_name,
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
    count(*)::text as detail
  from information_schema.tables where table_schema = 'public' and table_name = 'post_reactions'
  union all
  select 'comment_reactions_absent',
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end,
    count(*)::text
  from information_schema.tables where table_schema = 'public' and table_name = 'comment_reactions'
), row_counts as (
  select 'post_likes_row_count' as check_name, 'INFO' as status, count(*)::text as detail
  from public.post_likes
  union all
  select 'comment_likes_row_count', 'INFO', count(*)::text
  from public.comment_likes
), existing_policies as (
  -- Names/bodies of any authenticated-role policy already on forum_posts/post_likes/
  -- comment_likes -- not expected (Forum has no Realtime/direct-client access today), but
  -- printed for the record before this migration adds RLS to the two brand-new tables, same
  -- reasoning 010/013's preflights used for tables whose live policy state wasn't tracked here.
  select 'post_likes_policy:' || policyname as check_name, 'INFO' as status,
    cmd || ' using(' || coalesce(qual, '') || ') with check(' || coalesce(with_check, '') || ')' as detail
  from pg_policies where schemaname = 'public' and tablename = 'post_likes'
  union all
  select 'comment_likes_policy:' || policyname, 'INFO',
    cmd || ' using(' || coalesce(qual, '') || ') with check(' || coalesce(with_check, '') || ')'
  from pg_policies where schemaname = 'public' and tablename = 'comment_likes'
  union all
  select 'forum_posts_policy:' || policyname, 'INFO',
    cmd || ' using(' || coalesce(qual, '') || ') with check(' || coalesce(with_check, '') || ')'
  from pg_policies where schemaname = 'public' and tablename = 'forum_posts'
), rls_state as (
  select 'post_likes_rls_enabled' as check_name, 'INFO' as status,
    coalesce((
      select relrowsecurity::text from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'post_likes'
    ), 'unknown') as detail
  union all
  select 'comment_likes_rls_enabled', 'INFO',
    coalesce((
      select relrowsecurity::text from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'comment_likes'
    ), 'unknown')
)
select * from required_tables
union all select * from tables_absent
union all select * from row_counts
union all select * from existing_policies
union all select * from rls_state
order by check_name;
