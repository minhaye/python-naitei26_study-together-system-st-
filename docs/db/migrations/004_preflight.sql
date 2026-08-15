-- Preflight checks for 004_refactor_chat_to_conversations.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Written as a single UNION ALL query on purpose: the Supabase SQL Editor
-- (and most "run script" tools) only display the result grid of the LAST
-- statement when you paste a file with multiple SELECTs. One combined grid
-- means you see every check in one screen.
--
-- Run this BEFORE 004_refactor_chat_to_conversations.sql. Anything with
-- status FAIL will make the migration abort partway through via
-- RAISE EXCEPTION -- better to know now than mid-transaction.

with
  row_counts as (
    select 'row_count:messages' as check_name, 'INFO' as status, count(*)::text as detail from public.messages
    union all
    select 'row_count:channels', 'INFO', count(*)::text from public.channels
    union all
    select 'row_count:channel_members', 'INFO', count(*)::text from public.channel_members
    union all
    select 'row_count:study_rooms', 'INFO', count(*)::text from public.study_rooms
    union all
    select 'row_count:study_room_members', 'INFO', count(*)::text from public.study_room_members
    union all
    select 'row_count:groups', 'INFO', count(*)::text from public.groups
    union all
    select 'row_count:group_members', 'INFO', count(*)::text from public.group_members
  ),
  orphan_messages as (
    select
      'orphan_messages_missing_channel (must be 0)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.messages m
    left join public.channels c on c.id = m.channel_id
    where c.id is null
  ),
  dupe_attachments as (
    select
      'duplicate_attachment_paths (must be 0 distinct)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      coalesce(string_agg(attachment_path || ' x' || cnt, ', '), 'none') as detail
    from (
      select attachment_path, count(*) as cnt
      from public.messages
      where attachment_path is not null
      group by attachment_path
      having count(*) > 1
    ) d
  ),
  null_created_by as (
    select
      'channels_null_created_by (must be 0)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.channels where created_by is null
  ),
  null_host_id as (
    select
      'study_rooms_null_host_id (must be 0)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.study_rooms where host_id is null
  ),
  existing_conv_objects as (
    select
      'existing_conversation_tables (expect none -- clean slate)' as check_name,
      case when count(*) = 0 then 'OK' else 'WARN' end as status,
      coalesce(string_agg(table_name, ', '), 'none') as detail
    from information_schema.tables
    where table_schema = 'public' and table_name in ('conversations', 'conversation_members')
  ),
  existing_enum as (
    select
      'existing_conversation_type_enum (expect none)' as check_name,
      case when count(*) = 0 then 'OK' else 'WARN' end as status,
      count(*)::text as detail
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'conversation_type'
  ),
  messages_indexes as (
    select
      'messages_index:' || indexname as check_name,
      'INFO' as status,
      indexdef as detail
    from pg_indexes where schemaname = 'public' and tablename = 'messages'
  ),
  messages_constraints as (
    select
      'messages_constraint:' || conname as check_name,
      'INFO' as status,
      pg_get_constraintdef(oid) as detail
    from pg_constraint where conrelid = 'public.messages'::regclass
  ),
  rls_state as (
    select
      'rls_enabled:' || relname as check_name,
      case when relrowsecurity then 'OK' else 'WARN' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in ('messages', 'channels', 'channel_members', 'group_members', 'study_rooms', 'study_room_members')
  ),
  messages_policies as (
    select
      'messages_policy:' || policyname as check_name,
      'INFO' as status,
      cmd as detail
    from pg_policies where schemaname = 'public' and tablename = 'messages'
  ),
  realtime_pub as (
    select
      'realtime_publication:messages (expect present)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ),
  -- Behavioral test, not a text-pattern guess: for every real
  -- channel_members row on a private channel whose underlying group
  -- membership is banned/left (gm.status <> 'active'), does
  -- can_access_channel() still return true? That's the exact bug
  -- 002/004-section-7 fixes. If stale_total = 0, no such row exists in
  -- current data and this check is inconclusive (not a failure) --
  -- 004_verify.sql re-runs the same test after the fix is applied.
  stale_private_access as (
    select
      'stale_private_channel_member_bug_check (pre-fix state)' as check_name,
      case
        when stale_total = 0 then 'INFO (no stale banned/left member with a private channel_members row in current data)'
        when still_passing = 0 then 'OK (fix already active: 0/' || stale_total || ' stale rows pass)'
        else 'FAIL-EXPECTED (' || still_passing || '/' || stale_total || ' stale rows still pass -- confirms the known bug is live; 004 fixes it)'
      end as status,
      'stale_rows=' || stale_total || ', still_passing=' || still_passing as detail
    from (
      select
        count(*) as stale_total,
        count(*) filter (where public.can_access_channel(cm.channel_id, cm.user_id)) as still_passing
      from public.channel_members cm
      join public.channels c on c.id = cm.channel_id and c.is_private = true
      join public.group_members gm on gm.group_id = c.group_id and gm.user_id = cm.user_id
      where gm.status <> 'active'
    ) t
  ),
  -- VALUES + LEFT JOIN on purpose: a plain `WHERE proname IN (...)` simply
  -- produces no row at all for a function that doesn't exist, which is easy
  -- to miss in a result grid. This way every required function gets an
  -- explicit row, and a missing one shows an explicit FAIL instead of just
  -- being silently absent. LEFT JOINed against a DISTINCT subquery (not
  -- pg_proc directly) so a hypothetical future overload of one of these
  -- names can't fan this out into duplicate rows.
  required_functions as (
    select
      'required_function:' || t.want as check_name,
      case when p.proname is not null then 'OK' else 'FAIL' end as status,
      coalesce(p.proname, 'MISSING') as detail
    from (values
      ('is_group_member'),
      ('is_group_manager'),
      ('can_access_channel'),
      ('set_updated_at')
    ) as t(want)
    left join (
      select distinct proname from pg_proc where pronamespace = 'public'::regnamespace
    ) p on p.proname = t.want
  ),
  existing_compat_trigger as (
    select
      'existing_messages_sync_conversation_id_trigger (expect none)' as check_name,
      case when count(*) = 0 then 'OK' else 'WARN' end as status,
      count(*)::text as detail
    from information_schema.triggers
    where trigger_schema = 'public' and event_object_table = 'messages'
      and trigger_name = 'messages_sync_conversation_id'
  ),
  storage_bucket as (
    select
      'storage_bucket:message-attachments (informational, 004 does not touch Storage)' as check_name,
      case when count(*) = 1 then 'INFO (exists)' else 'INFO (does not exist yet)' end as status,
      count(*)::text as detail
    from storage.buckets where id = 'message-attachments'
  )
select * from row_counts
union all select * from orphan_messages
union all select * from dupe_attachments
union all select * from null_created_by
union all select * from null_host_id
union all select * from existing_conv_objects
union all select * from existing_enum
union all select * from messages_indexes
union all select * from messages_constraints
union all select * from rls_state
union all select * from messages_policies
union all select * from realtime_pub
union all select * from stale_private_access
union all select * from required_functions
union all select * from existing_compat_trigger
union all select * from storage_bucket
order by check_name;
