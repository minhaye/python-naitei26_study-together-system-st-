-- Post-migration verification for 014_create_forum_tags.sql.
-- READ-ONLY. Modifies nothing. Safe to run after 014_create_forum_tags.sql.

with
  tags_table_exists as (
    select
      'tags_table_exists (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'tags'
  ),
  post_tags_table_exists as (
    select
      'post_tags_table_exists (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'post_tags'
  ),
  tags_indexes_present as (
    select
      'tags_indexes_present (must be OK)' as check_name,
      case when count(*) >= 1 then 'OK' else 'FAIL' end as status,
      string_agg(indexname, ', ') as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'tags' and indexname = 'idx_tags_post_count_desc'
  ),
  post_tags_trigger_present as (
    select
      'post_tags_trigger_present (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_trigger
    where tgrelid = 'public.post_tags'::regclass and tgname = 'trg_update_tag_post_count'
  )
select check_name, status, detail from tags_table_exists
union all
select check_name, status, detail from post_tags_table_exists
union all
select check_name, status, detail from tags_indexes_present
union all
select check_name, status, detail from post_tags_trigger_present;
