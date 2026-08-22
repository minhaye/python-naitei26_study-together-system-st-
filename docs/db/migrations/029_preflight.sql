-- READ-ONLY preflight for 029_drop_forum_likes.sql. Do not run 029 unless every check here is
-- OK/expected -- dropping post_likes/comment_likes is irreversible without a backup.
with table_checks as (
  select 'post_reactions_exists' as check_name,
    case when count(*) = 1 then 'OK' else 'FAIL' end as status, count(*)::text as detail
  from information_schema.tables where table_schema = 'public' and table_name = 'post_reactions'
  union all
  select 'comment_reactions_exists',
    case when count(*) = 1 then 'OK' else 'FAIL' end, count(*)::text
  from information_schema.tables where table_schema = 'public' and table_name = 'comment_reactions'
), row_counts as (
  select 'post_likes_row_count' as check_name, 'INFO' as status, count(*)::text as detail
  from public.post_likes
  union all
  select 'comment_likes_row_count', 'INFO', count(*)::text from public.comment_likes
  union all
  select 'post_reactions_row_count', 'INFO', count(*)::text from public.post_reactions
  union all
  select 'comment_reactions_row_count', 'INFO', count(*)::text from public.comment_reactions
), backfill_completeness as (
  -- Anti-join: any post_likes/comment_likes row with no matching post_reactions/
  -- comment_reactions row means 028's backfill hasn't run (or didn't finish) for that row --
  -- dropping the old tables now would silently lose that like.
  select 'post_likes_rows_all_backfilled' as check_name,
    case when count(*) = 0 then 'OK' else 'FAIL/unbackfilled post_likes rows -- re-run 028''s backfill insert first' end as status,
    count(*)::text as detail
  from public.post_likes pl
  left join public.post_reactions pr on pr.post_id = pl.post_id and pr.user_id = pl.user_id
  where pr.id is null
  union all
  select 'comment_likes_rows_all_backfilled',
    case when count(*) = 0 then 'OK' else 'FAIL/unbackfilled comment_likes rows -- re-run 028''s backfill insert first' end,
    count(*)::text
  from public.comment_likes cl
  left join public.comment_reactions cr on cr.comment_id = cl.comment_id and cr.user_id = cl.user_id
  where cr.id is null
)
select * from table_checks
union all select * from row_counts
union all select * from backfill_completeness
order by check_name;
