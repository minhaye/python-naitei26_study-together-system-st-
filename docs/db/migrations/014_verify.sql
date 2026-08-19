-- Post-migration verification for 014_create_group_resources_bucket.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same one-UNION-ALL-query shape as 004/008-013's verify scripts. Everything with status
-- OK/INFO is expected. Anything FAIL means the migration did not end up in the state it was
-- designed to reach -- stop and investigate before relying on Group Resources upload/download
-- against this database. Compare the INFO rows here against 014_preflight.sql's output.

with
  group_resources_bucket_exists as (
    select
      'group_resources_bucket_exists (must be OK -- exactly one row)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from storage.buckets
    where id = 'group-resources'
  ),
  group_resources_bucket_is_private as (
    select
      'group_resources_bucket_public_false (must be OK -- objects must only be reachable via FastAPI-issued signed URLs, never a public URL)' as check_name,
      case when bool_and(public = false) then 'OK' else 'FAIL' end as status,
      coalesce(string_agg('public=' || public::text, ', '), 'bucket not found') as detail
    from storage.buckets
    where id = 'group-resources'
  ),
  group_resources_bucket_file_size_limit as (
    select
      'group_resources_bucket_file_size_limit (must be OK -- must equal 20971520 bytes / 20 MB, matching app/resources/constants.py MAX_RESOURCE_SIZE_BYTES)' as check_name,
      case when bool_and(file_size_limit = 20971520) then 'OK' else 'FAIL' end as status,
      coalesce(string_agg(coalesce(file_size_limit::text, 'NULL'), ', '), 'bucket not found') as detail
    from storage.buckets
    where id = 'group-resources'
  ),
  group_resources_bucket_mime_types as (
    select
      'group_resources_bucket_allowed_mime_types (must be OK -- exactly the 11 types in 014''s INSERT / app/resources/constants.py ALLOWED_RESOURCE_CONTENT_TYPES, no more, no fewer)' as check_name,
      case
        when bool_and(
          allowed_mime_types @> array[
            'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          ]::text[]
          and array_length(allowed_mime_types, 1) = 11
        )
        then 'OK'
        else 'FAIL'
      end as status,
      coalesce(string_agg(array_to_string(allowed_mime_types, ','), ', '), 'bucket not found') as detail
    from storage.buckets
    where id = 'group-resources'
  ),
  storage_buckets_row_count as (
    select
      'storage_buckets_row_count (informational -- must equal 014_preflight.sql''s pre-migration count + 0 or 1, never more)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from storage.buckets
  ),
  storage_objects_policies_for_group_resources_absent as (
    select
      'storage_objects_policies_mentioning_group_resources (must be OK/none-found -- 014 creates no storage.objects policies; deny-by-default via zero anon/authenticated policies is the intended access model)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'FAIL/unexpected-policy' end as status,
      coalesce(string_agg(policyname || ' cmd=' || cmd, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%group-resources%' or coalesce(with_check, '') ilike '%group-resources%')
  ),
  no_anon_or_authenticated_write_access_to_group_resources as (
    select
      'no_write_policy_grants_anon_or_authenticated_on_group_resources (must be OK -- no INSERT/UPDATE/DELETE policy on storage.objects references this bucket for anon/authenticated; the only write path is the service-role signed-URL flow)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      coalesce(string_agg(policyname || ' cmd=' || cmd || ' roles=' || roles::text, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd <> 'SELECT'
      and (coalesce(qual, '') ilike '%group-resources%' or coalesce(with_check, '') ilike '%group-resources%')
      and (roles::text[] && array['anon', 'authenticated'])
  ),
  storage_objects_rls_still_enabled as (
    select
      'storage_objects_rls_enabled (must be OK -- 014 must not have disabled RLS on storage.objects)' as check_name,
      coalesce(max(case when c.relrowsecurity then 'OK' else 'FAIL' end), 'FAIL/table-not-found') as status,
      coalesce(max('relrowsecurity=' || c.relrowsecurity::text), 'storage.objects not found') as detail
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'storage'
    where c.relname = 'objects'
  ),
  message_attachments_bucket_unmodified as (
    select
      'message_attachments_bucket_unmodified (must be OK -- 014 must not have touched 003''s pre-existing bucket)' as check_name,
      case
        when bool_and(
          public = false
          and file_size_limit = 10485760
          and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']::text[]
          and array_length(allowed_mime_types, 1) = 5
        )
        then 'OK'
        else 'FAIL'
      end as status,
      coalesce(
        string_agg('public=' || public::text || ' file_size_limit=' || file_size_limit::text || ' mime_count=' || array_length(allowed_mime_types, 1)::text, ', '),
        'bucket not found (unexpected)'
      ) as detail
    from storage.buckets
    where id = 'message-attachments'
  ),
  other_buckets_unmodified_count as (
    select
      'other_buckets_present (informational -- every bucket id besides group-resources/message-attachments; must match 014_preflight.sql''s storage_buckets_row_count minus those two, and none should have been touched by 014, which only INSERTs one row)' as check_name,
      'INFO' as status,
      coalesce(string_agg(id, ', ' order by id), 'none') as detail
    from storage.buckets
    where id not in ('group-resources', 'message-attachments')
  ),
  storage_objects_row_count_unchanged as (
    select
      'storage_objects_total_row_count (informational -- must equal 014_preflight.sql''s pre-migration count; 014 is an INSERT into storage.buckets only, it never touches storage.objects)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from storage.objects
  )

select * from group_resources_bucket_exists
union all select * from group_resources_bucket_is_private
union all select * from group_resources_bucket_file_size_limit
union all select * from group_resources_bucket_mime_types
union all select * from storage_buckets_row_count
union all select * from storage_objects_policies_for_group_resources_absent
union all select * from no_anon_or_authenticated_write_access_to_group_resources
union all select * from storage_objects_rls_still_enabled
union all select * from message_attachments_bucket_unmodified
union all select * from other_buckets_unmodified_count
union all select * from storage_objects_row_count_unchanged
order by check_name;
