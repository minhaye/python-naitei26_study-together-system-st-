-- Preflight checks for 014_create_group_resources_bucket.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including against
-- production, at any time.
--
-- Same one-UNION-ALL-query shape as 008-013's preflight scripts (single result grid in the
-- Supabase SQL Editor).
--
-- Context: 014 inserts exactly one row into storage.buckets ('group-resources'), mirroring
-- 003_create_message_attachments_bucket.sql. It uses ON CONFLICT (id) DO NOTHING, which means
-- it CANNOT fix an already-existing bucket with the wrong config -- it will silently no-op.
-- This preflight exists to catch that case (and a few other live-environment assumptions the
-- migration takes for granted) before you run it.
--
-- Run this BEFORE 014_create_group_resources_bucket.sql.

with
  storage_schema_reachable as (
    select
      'storage_buckets_reachable (must be OK -- confirms the connecting role can read storage.buckets at all)' as check_name,
      case when count(*) >= 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' existing bucket(s)' as detail
    from storage.buckets
  ),
  storage_buckets_required_columns as (
    select
      'storage_buckets_required_columns (must be OK -- id/name/public/file_size_limit/allowed_mime_types, the columns 014''s INSERT targets)' as check_name,
      case when count(*) = 5 then 'OK' else 'FAIL' end as status,
      string_agg(column_name, ', ' order by column_name) as detail
    from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets'
      and column_name in ('id', 'name', 'public', 'file_size_limit', 'allowed_mime_types')
  ),
  connecting_role_can_insert_buckets as (
    select
      'connecting_role_can_insert_into_storage_buckets (must be OK -- 014 will fail outright otherwise)' as check_name,
      case when has_table_privilege(current_user, 'storage.buckets', 'INSERT') then 'OK' else 'FAIL' end as status,
      current_user as detail
  ),
  group_resources_bucket_absent as (
    select
      'group_resources_bucket_absent (expected OK/none-found -- if INFO/already-exists, read the group_resources_bucket_existing_config row below before running 014: ON CONFLICT DO NOTHING means 014 will NOT reconcile a mismatched config)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'INFO/already-exists' end as status,
      count(*)::text as detail
    from storage.buckets
    where id = 'group-resources'
  ),
  group_resources_bucket_existing_config as (
    select
      'group_resources_bucket_existing_config (informational -- only meaningful if group_resources_bucket_absent above is already-exists; compare against 014''s intended values: public=false, file_size_limit=20971520, 11 allowed_mime_types)' as check_name,
      'INFO' as status,
      coalesce(
        string_agg(
          'public=' || public::text
            || ' file_size_limit=' || coalesce(file_size_limit::text, 'NULL')
            || ' allowed_mime_types=' || coalesce(array_to_string(allowed_mime_types, ','), 'NULL'),
          ''
        ),
        'n/a -- bucket does not exist yet'
      ) as detail
    from storage.buckets
    where id = 'group-resources'
  ),
  message_attachments_bucket_reference as (
    select
      'message_attachments_bucket_reference (informational -- 003''s live sibling bucket, as a sanity baseline for what a correctly-configured private bucket in this project looks like)' as check_name,
      'INFO' as status,
      coalesce(
        string_agg(
          'public=' || public::text
            || ' file_size_limit=' || coalesce(file_size_limit::text, 'NULL')
            || ' allowed_mime_types=' || coalesce(array_to_string(allowed_mime_types, ','), 'NULL'),
          ''
        ),
        'n/a -- message-attachments bucket not found (unexpected, see 003)'
      ) as detail
    from storage.buckets
    where id = 'message-attachments'
  ),
  storage_objects_rls_enabled as (
    select
      'storage_objects_rls_enabled (informational -- 014''s deny-by-default rationale assumes this is true, same as 003)' as check_name,
      coalesce(max(case when c.relrowsecurity then 'INFO/enabled' else 'INFO/DISABLED' end), 'FAIL/table-not-found') as status,
      coalesce(max('relrowsecurity=' || c.relrowsecurity::text), 'storage.objects not found') as detail
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'storage'
    where c.relname = 'objects'
  ),
  storage_objects_policies_all as (
    select
      'storage_objects_existing_policies (informational -- full list of ALL storage.objects policies in this project, not just group-resources-scoped ones; 003''s design assumed zero anon/authenticated policies existed -- confirm that is still true)' as check_name,
      'INFO' as status,
      policyname || ' cmd=' || cmd || ' roles=' || roles::text || ' using=(' || coalesce(qual, 'null') || ')' as detail
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  ),
  storage_objects_policies_relevant_to_group_resources as (
    select
      'storage_objects_policies_mentioning_group_resources (must be OK/none-found -- 014 creates no policies; any pre-existing one referencing this bucket id is unexpected and should be reviewed manually before running 014)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'FAIL/manual-review-required' end as status,
      coalesce(string_agg(policyname || ' cmd=' || cmd, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%group-resources%' or coalesce(with_check, '') ilike '%group-resources%')
  ),
  storage_objects_existing_for_group_resources as (
    select
      'storage_objects_existing_for_group_resources_bucket (must be OK/none-found -- objects already stored under this bucket id, e.g. from a prior manual creation; 014 itself never touches storage.objects, this is purely informational context)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'INFO/objects-present' end as status,
      count(*)::text as detail
    from storage.objects
    where bucket_id = 'group-resources'
  ),
  storage_buckets_row_count as (
    select
      'storage_buckets_row_count (informational -- compare against 014_verify.sql''s post-migration count; must grow by exactly 0 or 1)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from storage.buckets
  )

select * from storage_schema_reachable
union all select * from storage_buckets_required_columns
union all select * from connecting_role_can_insert_buckets
union all select * from group_resources_bucket_absent
union all select * from group_resources_bucket_existing_config
union all select * from message_attachments_bucket_reference
union all select * from storage_objects_rls_enabled
union all select * from storage_objects_policies_all
union all select * from storage_objects_policies_relevant_to_group_resources
union all select * from storage_objects_existing_for_group_resources
union all select * from storage_buckets_row_count
order by check_name;
