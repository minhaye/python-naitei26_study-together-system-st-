-- Post-migration verification for 013_create_invitations.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same one-UNION-ALL-query shape as 004/008-012's verify scripts. Everything
-- with status OK/INFO is expected. Anything FAIL means the migration did not
-- end up in the state it was designed to reach -- stop and investigate
-- before building/relying on the invitations API against this database.
--
-- Notably confirms notifications_update_own/notifications_delete_own (two
-- pre-existing policies discovered live via 013_preflight.sql, never
-- tracked in any migration file before 013) are gone, and
-- notifications_select_own is still present with the same semantics --
-- see 013_create_invitations.sql § 5 for why.

with
  invitations_table_exists as (
    select
      'invitations_table_exists (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'invitations'
  ),
  invitations_required_columns as (
    select
      'invitations_required_columns (must be OK -- all 14 expected columns present)' as check_name,
      case when count(*) = 14 then 'OK' else 'FAIL' end as status,
      string_agg(column_name, ', ' order by column_name) as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'invitations'
      and column_name in (
        'id', 'group_id', 'room_id', 'channel_id', 'method', 'status', 'created_by',
        'recipient_email', 'secret_hash', 'expires_at', 'accepted_at', 'declined_at',
        'revoked_at', 'created_at'
      )
  ),
  invitations_exactly_one_target_check_present as (
    select
      'check_constraint_present:invitations_exactly_one_target (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.invitations'::regclass and conname = 'invitations_exactly_one_target'
  ),
  invitations_email_recipient_check_present as (
    select
      'check_constraint_present:invitations_email_recipient (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.invitations'::regclass and conname = 'invitations_email_recipient'
  ),
  invitations_secret_hash_unique as (
    select
      'secret_hash_unique_constraint_present (must be OK)' as check_name,
      case when count(*) >= 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'invitations' and indexdef ilike '%unique%secret_hash%'
  ),
  invitations_no_rows_yet as (
    select
      'invitations_row_count (informational -- expected 0 immediately after this migration; the API has not created any yet)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.invitations
  ),
  notifications_invitation_id_present as (
    select
      'notifications.invitation_id_column_present (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'invitation_id'
  ),
  notifications_existing_rows_have_null_invitation_id as (
    select
      'existing_notifications_have_null_invitation_id (must be OK -- 013 never sets invitation_id on any pre-existing row)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' row(s) unexpectedly have invitation_id set' as detail
    from public.notifications
    where invitation_id is not null
  ),
  notification_type_new_values_present as (
    select
      'notification_type_enum_has_new_values (must be OK -- study_room_invitation and private_channel_invitation both present)' as check_name,
      case when count(*) = 2 then 'OK' else 'FAIL' end as status,
      string_agg(enumlabel, ', ' order by enumlabel) as detail
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'notification_type'
      and e.enumlabel in ('study_room_invitation', 'private_channel_invitation')
  ),
  invitations_rls_enabled as (
    select
      'rls_enabled:invitations (must be OK)' as check_name,
      case when c.relrowsecurity then 'OK' else 'FAIL' end as status,
      case when c.relrowsecurity then 'enabled' else 'DISABLED' end as detail
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relname = 'invitations'
  ),
  notifications_rls_enabled as (
    select
      'rls_enabled:notifications (must be OK)' as check_name,
      case when c.relrowsecurity then 'OK' else 'FAIL' end as status,
      case when c.relrowsecurity then 'enabled' else 'DISABLED' end as detail
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relname = 'notifications'
  ),
  invitations_select_policy_present as (
    select
      'policy_present:invitations_select_own (must be OK)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'invitations' and policyname = 'invitations_select_own'
  ),
  notifications_select_policy_present as (
    select
      'policy_present:notifications_select_own (must be OK -- kept, same user_id = auth.uid() semantics as before 013)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_select_own'
  ),
  notifications_update_policy_dropped as (
    select
      'policy_absent:notifications_update_own (must be OK -- 013 explicitly drops this pre-existing policy; see 013_preflight.sql for its live body before removal)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL/still-present' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_update_own'
  ),
  notifications_delete_policy_dropped as (
    select
      'policy_absent:notifications_delete_own (must be OK -- 013 explicitly drops this pre-existing policy; see 013_preflight.sql for its live body before removal)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL/still-present' end as status,
      count(*)::text as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_delete_own'
  ),
  notifications_row_count_unchanged as (
    select
      'notifications_row_count (informational -- must equal 013_preflight.sql''s pre-migration count; 013 never inserts/deletes a notifications row, only adds a column and drops two policies)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.notifications
  ),
  no_write_policy_for_authenticated as (
    select
      'no_write_policy_for_authenticated:invitations+notifications (must be OK -- FastAPI, postgres role, is the sole writer; matches messages/channels precedent)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      coalesce(string_agg(tablename || ':' || policyname || ':' || cmd, ', '), 'none') as detail
    from pg_policies
    where schemaname = 'public' and tablename in ('invitations', 'notifications') and cmd <> 'SELECT'
  )

select * from invitations_table_exists
union all select * from invitations_required_columns
union all select * from invitations_exactly_one_target_check_present
union all select * from invitations_email_recipient_check_present
union all select * from invitations_secret_hash_unique
union all select * from invitations_no_rows_yet
union all select * from notifications_invitation_id_present
union all select * from notifications_existing_rows_have_null_invitation_id
union all select * from notification_type_new_values_present
union all select * from invitations_rls_enabled
union all select * from notifications_rls_enabled
union all select * from invitations_select_policy_present
union all select * from notifications_select_policy_present
union all select * from notifications_update_policy_dropped
union all select * from notifications_delete_policy_dropped
union all select * from notifications_row_count_unchanged
union all select * from no_write_policy_for_authenticated
order by check_name;
