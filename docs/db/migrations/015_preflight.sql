-- Preflight checks for 015_cleanup_stale_mock_resources.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including against
-- production, at any time.
--
-- Same one-UNION-ALL-query shape as 008-014's preflight scripts (single result grid in the
-- Supabase SQL Editor).
--
-- Context: commit cd0613b ("theem datata", 2026-08-10) added docs/db/data.csv, a raw dump of
-- synthetic seed INSERT statements (including ~20 public.resources rows named
-- 'mock-resource-<n>-<m>.<ext>', file_path='group-resources/<group_id>/<filename>') that was
-- manually run against the live database at some point. Commit d664e10 ("clean up stale db
-- artifacts", 2026-08-14) removed data.csv from git as a docs cleanup -- but that only
-- untracked the file, it never touched the live rows it had already produced. Those rows
-- predate the real `group-resources` Storage bucket (migration 014) and the real upload path
-- scheme (`groups/{group_id}/{user_id}/{object_id}/{filename}`, see
-- app/resources/services/resource_storage_service.py.build_object_path) -- they are
-- Resource-metadata-only ghosts with no corresponding Storage object, which is why
-- downloading them fails while real uploads work fine.
--
-- No code path in the current repo creates these (confirmed: `grep -r "mock-resource-"` over
-- app/, scripts/, docs/db/migrations/ finds nothing) -- 015 is a one-time live-data cleanup,
-- not a fix to any seed/fixture/migration in this repo.
--
-- Run this BEFORE 015_cleanup_stale_mock_resources.sql, and READ THE ROW LIST in
-- mock_resources_matched below before running the cleanup -- it is the only record of exactly
-- what will be deleted.

with
  resources_table_reachable as (
    select
      'resources_table_reachable (must be OK)' as check_name,
      case when count(*) >= 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' total row(s) in public.resources' as detail
    from public.resources
  ),
  mock_resources_matched as (
    select
      'mock_resources_matched (must be reviewed -- exact rows 015 will delete; this list is the only record of what was removed)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'INFO/will-be-deleted' end as status,
      coalesce(
        string_agg(id::text || ' group=' || group_id::text || ' name=' || name || ' path=' || file_path, ' | ' order by name),
        'none'
      ) as detail
    from public.resources
    where name like 'mock-resource-%'
  ),
  mock_resources_count as (
    select
      'mock_resources_count (informational -- compare against 015_verify.sql''s post-cleanup count of 0)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.resources
    where name like 'mock-resource-%'
  ),
  mock_resources_have_legacy_path_shape as (
    select
      'mock_resources_all_have_legacy_seed_path_shape (must be OK -- safety check that every matched row uses the OLD seed path shape (`group-resources/<group_id>/<filename>`, no per-user/per-object segments), never the real upload shape (`groups/...`, see build_object_path) -- if this is FAIL, STOP: something matching the name pattern may be a real uploaded resource, not seed data)' as check_name,
      case when count(*) filter (where file_path like 'groups/%') = 0 then 'OK' else 'FAIL/real-path-shape-found' end as status,
      count(*) filter (where file_path like 'groups/%')::text || ' matched row(s) unexpectedly have a real-upload-shaped path' as detail
    from public.resources
    where name like 'mock-resource-%'
  ),
  mock_resources_have_no_storage_object as (
    select
      'mock_resources_have_no_group_resources_storage_object (informational -- confirms the hypothesis that these are metadata-only ghosts; expected OK/none-found since the bucket did not exist when this seed data was inserted)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'INFO/objects-exist' end as status,
      count(*)::text as detail
    from public.resources r
    where r.name like 'mock-resource-%'
      and exists (
        select 1 from storage.objects o
        where o.bucket_id = 'group-resources' and o.name = r.file_path
      )
  ),
  resources_non_mock_row_count as (
    select
      'resources_non_mock_row_count (informational -- compare against 015_verify.sql''s post-cleanup count; must be unchanged, 015 only deletes mock-resource-% rows)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.resources
    where name not like 'mock-resource-%'
  )

select * from resources_table_reachable
union all select * from mock_resources_matched
union all select * from mock_resources_count
union all select * from mock_resources_have_legacy_path_shape
union all select * from mock_resources_have_no_storage_object
union all select * from resources_non_mock_row_count
order by check_name;
