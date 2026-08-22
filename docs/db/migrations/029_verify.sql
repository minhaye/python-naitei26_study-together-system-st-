-- READ-ONLY. Run after 029_drop_forum_likes.sql.
with checks as (
  select 'post_likes_gone' as check_name,
    not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'post_likes') as ok
  union all
  select 'comment_likes_gone',
    not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'comment_likes')
  union all
  select 'post_reactions_untouched',
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'post_reactions')
  union all
  select 'comment_reactions_untouched',
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'comment_reactions')
)
select check_name, case when ok then 'OK' else 'FAIL' end as status from checks;
