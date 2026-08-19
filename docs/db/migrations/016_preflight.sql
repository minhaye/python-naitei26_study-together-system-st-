-- Preflight checks for 016_create_forum_tags.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times.

with
  forum_posts_table_exists as (
    select
      'forum_posts_table_exists (must be OK -- the table post_tags foreign keys point at)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'forum_posts'
  ),
  tags_table_absent as (
    select
      'tags_table_absent (must be OK/none-found -- 016 creates this table)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'tags'
  ),
  post_tags_table_absent as (
    select
      'post_tags_table_absent (must be OK/none-found -- 016 creates this table)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'post_tags'
  )
select check_name, status, detail from forum_posts_table_exists
union all
select check_name, status, detail from tags_table_absent
union all
select check_name, status, detail from post_tags_table_absent;
