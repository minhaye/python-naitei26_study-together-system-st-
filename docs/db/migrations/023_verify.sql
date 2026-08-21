-- READ-ONLY. Run after 023_add_group_background.sql. Single UNION ALL query (see
-- migration-convention rule: preflight/verify must be one combined result grid, not a
-- sequence of separate SELECTs whose earlier results get hidden by the SQL Editor).
with checks as (
  select 'column_groups_background_url' as check_name,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'groups' and column_name = 'background_url'
    ) as ok
  union all
  select 'bucket_group_backgrounds_exists',
    exists (select 1 from storage.buckets where id = 'group-backgrounds')
  union all
  select 'bucket_group_backgrounds_is_public',
    coalesce((select public from storage.buckets where id = 'group-backgrounds'), false)
  union all
  select 'policy_group_backgrounds_upload_present',
    exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'Group managers can upload group background'
    )
)
select check_name, case when ok then 'OK' else 'FAIL' end as status from checks;
