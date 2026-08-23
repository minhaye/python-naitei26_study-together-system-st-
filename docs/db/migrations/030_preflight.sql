-- READ-ONLY preflight for 030_add_forum_moderation.sql.
with tables_exist as (
  select 'profiles_and_forum_posts_exist' as check_name,
    case when count(*) = 2 then 'OK' else 'FAIL' end as status,
    string_agg(table_name, ',') as detail
  from information_schema.tables
  where table_schema = 'public' and table_name in ('profiles', 'forum_posts')
), role_column_absent as (
  select 'profiles_role_column_absent' as check_name,
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
    count(*)::text as detail
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
), deleted_by_column_absent as (
  select 'forum_posts_deleted_by_column_absent' as check_name,
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
    count(*)::text as detail
  from information_schema.columns
  where table_schema = 'public' and table_name = 'forum_posts' and column_name = 'deleted_by'
), new_tables_absent as (
  select 'user_bans_and_forum_moderation_actions_absent' as check_name,
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
    string_agg(table_name, ',') as detail
  from information_schema.tables
  where table_schema = 'public' and table_name in ('user_bans', 'forum_moderation_actions')
), new_types_absent as (
  select 'new_enum_types_absent' as check_name,
    case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
    string_agg(typname, ',') as detail
  from pg_type
  where typname in ('profile_role', 'ban_type', 'forum_moderation_action_type')
), profiles_row_count as (
  select 'profiles_row_count' as check_name, 'INFO' as status, count(*)::text as detail from public.profiles
), forum_posts_row_count as (
  select 'forum_posts_row_count' as check_name, 'INFO' as status, count(*)::text as detail from public.forum_posts
)
select * from tables_exist
union all select * from role_column_absent
union all select * from deleted_by_column_absent
union all select * from new_tables_absent
union all select * from new_types_absent
union all select * from profiles_row_count
union all select * from forum_posts_row_count
order by check_name;
