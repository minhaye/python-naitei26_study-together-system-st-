-- Post-cleanup verification for 015_cleanup_stale_mock_resources.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the cleanup commits.
--
-- Same one-UNION-ALL-query shape as 004/008-014's verify scripts. Everything with status
-- OK/INFO is expected. Anything FAIL means the cleanup did not end up in the state it was
-- designed to reach -- stop and investigate before treating the stale-mock-Resources issue as
-- resolved. Compare the INFO rows here against 015_preflight.sql's output.

with
  mock_resources_gone as (
    select
      'mock_resources_gone (must be OK -- every mock-resource-% row from 015_preflight.sql''s mock_resources_matched list is deleted)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' mock-resource-% row(s) still present' as detail
    from public.resources
    where name like 'mock-resource-%'
  ),
  resources_non_mock_row_count_unchanged as (
    select
      'resources_non_mock_row_count (must equal 015_preflight.sql''s pre-cleanup count -- 015 must not have touched any other resource)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.resources
    where name not like 'mock-resource-%'
  ),
  resources_total_row_count as (
    select
      'resources_total_row_count (informational -- must equal 015_preflight.sql''s pre-cleanup total minus mock_resources_count)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.resources
  ),
  resource_folders_untouched as (
    select
      'resource_folders_row_count (informational -- 015 never touches resource_folders; included only as a sanity check that nothing else moved)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.resource_folders
  )

select * from mock_resources_gone
union all select * from resources_non_mock_row_count_unchanged
union all select * from resources_total_row_count
union all select * from resource_folders_untouched
order by check_name;
