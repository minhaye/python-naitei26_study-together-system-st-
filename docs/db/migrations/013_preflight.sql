-- Preflight checks for 013_create_invitations.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Same one-UNION-ALL-query shape as 008-012's preflight scripts (single
-- result grid in the Supabase SQL Editor).
--
-- Context: 013 creates a brand-new `invitations` table (no pre-existing
-- schema to diff against, unlike 009/010) and extends `notifications` with
-- a nullable `invitation_id` FK + two new `notification_type` enum values.
--
-- `notifications`'s RLS state is not mentioned in 001's confirmed-RLS list
-- or in any later migration file in this repo -- same "discovered live,
-- never tracked" situation 010's preflight hit for study_rooms/
-- study_room_members/room_moderation_actions. A live run of this preflight
-- (2026-08-18, 135 notifications rows) found RLS already enabled with THREE
-- existing policies: notifications_select_own (SELECT), notifications_
-- update_own (UPDATE), notifications_delete_own (DELETE) -- i.e. the table
-- was never wide-open, but it does allow an authenticated user to mutate
-- their own notifications directly via PostgREST/Supabase client, bypassing
-- FastAPI entirely. 013_create_invitations.sql keeps the SELECT-own policy
-- (idempotent drop-if-exists + recreate, same semantics: user_id =
-- auth.uid()) and explicitly DROPS notifications_update_own/
-- notifications_delete_own, so that -- like messages/channels/invitations
-- -- FastAPI (postgres role, bypasses RLS) becomes the sole writer. This
-- matches notification_router.py's own design in the same commit (no public
-- POST endpoint at all; GET/PUT/DELETE scoped to current_user.id) and
-- avoids two divergent authorization surfaces for the same mutations.
--
-- READ the `notifications_existing_policies` result below (full USING/WITH
-- CHECK bodies) BEFORE running 013 -- if either policy's body differs from
-- a plain "user_id = auth.uid()" own-row check, or if anything currently
-- depends on writing to notifications via PostgREST/Supabase client
-- directly (not found in this repo's frontend or backend as of this
-- writing), STOP and reconsider before running 013 as-is.
--
-- Run this BEFORE 013_create_invitations.sql.

with
  required_tables_exist as (
    select
      'required_tables_exist (must be OK -- groups/study_rooms/channels/profiles/notifications, the tables 013''s new FKs point at or extends)' as check_name,
      case when count(*) = 5 then 'OK' else 'FAIL' end as status,
      string_agg(table_name, ', ') as detail
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('groups', 'study_rooms', 'channels', 'profiles', 'notifications')
  ),
  invitations_table_absent as (
    select
      'invitations_table_absent (must be OK/none-found -- 013 creates this table; if it already exists, STOP and review before running 013)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'invitations'
  ),
  notifications_invitation_id_absent as (
    select
      'notifications.invitation_id_column_absent (must be OK/none-found -- 013 adds this column; informational if it somehow already exists)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'INFO/already-exists' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'invitation_id'
  ),
  notifications_rls_current_state as (
    select
      'notifications_rls_current_state (informational -- expected INFO/enabled; not tracked in any prior migration FILE, but confirmed live 2026-08-18)' as check_name,
      case when c.relrowsecurity then 'INFO/enabled' else 'INFO/DISABLED' end as status,
      'relrowsecurity=' || c.relrowsecurity::text as detail
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relname = 'notifications'
  ),
  notifications_existing_policies as (
    select
      'notifications_existing_policies (READ EVERY BODY before running 013 -- expected: notifications_select_own kept as-is, notifications_update_own/notifications_delete_own explicitly DROPPED by 013 to make FastAPI the sole writer; STOP if any body is not a plain user_id = auth.uid() own-row check, or if an unexpected policy name appears)' as check_name,
      'INFO' as status,
      policyname || ' cmd=' || cmd || ' using=(' || coalesce(qual, 'null') || ') with_check=(' || coalesce(with_check, 'null') || ')' as detail
    from pg_policies
    where schemaname = 'public' and tablename = 'notifications'
  ),
  notification_type_enum_values as (
    select
      'notification_type_enum_current_values (informational -- confirms study_room_invitation/private_channel_invitation are not already present)' as check_name,
      'INFO' as status,
      string_agg(enumlabel, ', ' order by enumsortorder) as detail
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'notification_type'
  ),
  auth_users_reachable as (
    select
      'auth_users_table_reachable (must be OK -- InvitationsService.lookup_user_id_by_email queries this directly; confirms the connecting role has SELECT on auth.users)' as check_name,
      case when count(*) >= 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' row(s) in auth.users' as detail
    from auth.users
  ),
  notifications_row_count as (
    select
      'notifications_row_count (informational -- compare against 013_verify.sql''s post-migration count; must be unchanged, and every existing row must have invitation_id IS NULL after 013)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.notifications
  )

select * from required_tables_exist
union all select * from invitations_table_absent
union all select * from notifications_invitation_id_absent
union all select * from notifications_rls_current_state
union all select * from notifications_existing_policies
union all select * from notification_type_enum_values
union all select * from auth_users_reachable
union all select * from notifications_row_count
order by check_name;
