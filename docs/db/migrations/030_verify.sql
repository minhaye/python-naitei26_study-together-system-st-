-- READ-ONLY. Run after 030_add_forum_moderation.sql.
with checks as (
  select 'type_profile_role_exists' as check_name,
    exists (select 1 from pg_type where typname = 'profile_role') as ok
  union all
  select 'type_ban_type_exists',
    exists (select 1 from pg_type where typname = 'ban_type')
  union all
  select 'type_forum_moderation_action_type_exists',
    exists (select 1 from pg_type where typname = 'forum_moderation_action_type')
  union all
  select 'profiles_role_column_exists_not_null_default_user',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
        and is_nullable = 'NO' and column_default like '%user%'
    )
  union all
  select 'no_existing_profile_left_without_role',
    not exists (select 1 from public.profiles where role is null)
  union all
  select 'table_user_bans_exists',
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_bans')
  union all
  select 'table_forum_moderation_actions_exists',
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'forum_moderation_actions'
    )
  union all
  select 'index_user_bans_user_id_exists',
    exists (
      select 1 from pg_indexes where schemaname = 'public' and tablename = 'user_bans'
        and indexname = 'idx_user_bans_user_id'
    )
  union all
  select 'column_forum_posts_deleted_by_exists',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'forum_posts' and column_name = 'deleted_by'
    )
  union all
  select 'rls_enabled_user_bans',
    coalesce((select relrowsecurity from pg_class where relname = 'user_bans'), false)
  union all
  select 'rls_enabled_forum_moderation_actions',
    coalesce((select relrowsecurity from pg_class where relname = 'forum_moderation_actions'), false)
  union all
  select 'no_authenticated_policy_user_bans',
    not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_bans')
  union all
  select 'no_authenticated_policy_forum_moderation_actions',
    not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'forum_moderation_actions'
    )
  union all
  select 'user_bans_row_count_zero',
    (select count(*) from public.user_bans) = 0
  union all
  select 'forum_moderation_actions_row_count_zero',
    (select count(*) from public.forum_moderation_actions) = 0
)
select check_name, case when ok then 'OK' else 'FAIL' end as status from checks;
