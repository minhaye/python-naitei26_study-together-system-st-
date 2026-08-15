-- Post-migration verification for 004_refactor_chat_to_conversations.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- 004 is the EXPAND phase of an expand/contract refactor: it keeps
-- messages.channel_id (+ its FK + its old index) alongside the new
-- messages.conversation_id, so several checks below assert the OLD objects
-- are still PRESENT, not gone -- that's correct for this phase. They get
-- dropped later, by 005, once the backend is refactored and tested.
--
-- Single UNION ALL query, same reasoning as 004_preflight.sql: one result
-- grid instead of relying on the SQL editor showing every intermediate
-- SELECT. Everything with status OK/INFO is expected. Anything FAIL means
-- the migration did not end up in the state it was designed to reach --
-- stop and investigate before building anything on top of this schema.

with
  table_exists as (
    select
      'table_exists:' || t.want as check_name,
      case when x.table_name is not null then 'OK' else 'FAIL' end as status,
      coalesce(x.table_name, 'missing') as detail
    from (values ('conversations'), ('conversation_members')) as t(want)
    left join information_schema.tables x
      on x.table_schema = 'public' and x.table_name = t.want
  ),
  channel_conversation_1to1 as (
    select
      'each_channel_has_exactly_1_conversation' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' channel(s) with != 1 conversation' as detail
    from (
      select c.id, count(conv.id) as n
      from public.channels c
      left join public.conversations conv on conv.channel_id = c.id
      group by c.id
      having count(conv.id) <> 1
    ) bad
  ),
  room_conversation_1to1 as (
    select
      'each_study_room_has_exactly_1_conversation' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' study_room(s) with != 1 conversation' as detail
    from (
      select sr.id, count(conv.id) as n
      from public.study_rooms sr
      left join public.conversations conv on conv.room_id = sr.id
      group by sr.id
      having count(conv.id) <> 1
    ) bad
  ),
  conversation_totals as (
    select
      'conversation_totals (channel-type + room-type == channels + study_rooms)' as check_name,
      case
        when (select count(*) from public.conversations where type = 'channel') = (select count(*) from public.channels)
         and (select count(*) from public.conversations where type = 'room') = (select count(*) from public.study_rooms)
        then 'OK'
        else 'FAIL'
      end as status,
      'channel-type=' || (select count(*) from public.conversations where type = 'channel')
        || '/channels=' || (select count(*) from public.channels)
        || ', room-type=' || (select count(*) from public.conversations where type = 'room')
        || '/study_rooms=' || (select count(*) from public.study_rooms) as detail
  ),
  messages_row_count_unchanged as (
    select
      'messages_row_count_preserved (compare against preflight row_count:messages)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.messages
  ),
  messages_conversation_id_col as (
    select
      'messages.conversation_id column: exists, not null' as check_name,
      case
        when col.is_nullable = 'NO' then 'OK'
        when col.column_name is null then 'FAIL (column missing)'
        else 'FAIL (column is nullable)'
      end as status,
      coalesce(col.data_type, 'missing') as detail
    from (select 1) dummy
    left join information_schema.columns col
      on col.table_schema = 'public' and col.table_name = 'messages' and col.column_name = 'conversation_id'
  ),
  messages_no_null_conversation as (
    select
      'messages_with_null_conversation_id (must be 0)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.messages where conversation_id is null
  ),
  -- 004 is the EXPAND phase only -- channel_id is deliberately KEPT so the
  -- not-yet-refactored backend keeps working. It is only dropped in 005
  -- (the CONTRACT phase), after the backend refactor lands and is tested.
  messages_channel_id_still_present as (
    select
      'messages.channel_id column still present (expected -- 004 is expand-only, dropped in 005)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' matching column(s) found' as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name = 'channel_id'
  ),
  messages_channel_id_fkey_still_present as (
    select
      'messages_channel_id_fkey still present (expected -- dropped in 005)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.messages'::regclass and conname = 'messages_channel_id_fkey'
  ),
  old_channel_index_still_present as (
    select
      'idx_messages_channel_created still present (expected -- dropped in 005)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'messages' and indexname = 'idx_messages_channel_created'
  ),
  compat_trigger_exists as (
    select
      'messages_sync_conversation_id trigger exists, fires BEFORE INSERT+UPDATE' as check_name,
      case when count(*) = 2 then 'OK' else 'FAIL' end as status,
      string_agg(event_manipulation || ':' || action_timing, ', ' order by event_manipulation) as detail
    from information_schema.triggers
    where trigger_schema = 'public' and event_object_table = 'messages'
      and trigger_name = 'messages_sync_conversation_id'
  ),
  compat_trigger_function_exists as (
    select
      'messages_sync_conversation_id() function exists' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'messages_sync_conversation_id'
  ),
  -- Confirms issue-3's fix actually landed: the 3 new permission functions
  -- must take exactly 1 argument (resource id only) -- no p_user_id.
  new_functions_single_arg as (
    select
      'function_takes_resource_id_only (no p_user_id):' || t.want as check_name,
      case when p.pronargs = 1 then 'OK' else 'FAIL' end as status,
      coalesce('pronargs=' || p.pronargs::text, 'function missing') as detail
    from (values ('can_access_conversation'), ('can_access_room_conversation'), ('is_conversation_member')) as t(want)
    left join pg_proc p on p.proname = t.want and p.pronamespace = 'public'::regnamespace
  ),
  polymorphic_check_constraint as (
    select
      'conversations_type_target_check constraint exists' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      coalesce(max(pg_get_constraintdef(oid)), 'missing') as detail
    from pg_constraint
    where conrelid = 'public.conversations'::regclass and conname = 'conversations_type_target_check'
  ),
  channel_partial_unique as (
    select
      'conversations_channel_id_key partial unique index exists' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      coalesce(max(indexdef), 'missing') as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'conversations' and indexname = 'conversations_channel_id_key'
  ),
  room_partial_unique as (
    select
      'conversations_room_id_key partial unique index exists' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      coalesce(max(indexdef), 'missing') as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'conversations' and indexname = 'conversations_room_id_key'
  ),
  message_cursor_index as (
    select
      'idx_messages_conversation_created cursor index exists' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      coalesce(max(indexdef), 'missing') as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'messages' and indexname = 'idx_messages_conversation_created'
  ),
  attachment_unique_index as (
    select
      'messages_attachment_path_key partial unique index exists' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      coalesce(max(indexdef), 'missing') as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'messages' and indexname = 'messages_attachment_path_key'
  ),
  no_dupe_attachments as (
    select
      'no_duplicate_non_null_attachment_path' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' duplicated path(s)' as detail
    from (
      select attachment_path from public.messages
      where attachment_path is not null group by attachment_path having count(*) > 1
    ) d
  ),
  rls_enabled_new_tables as (
    select
      'rls_enabled:' || relname as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in ('conversations', 'conversation_members', 'messages')
  ),
  new_policies_exist as (
    select
      'policy_exists:' || t.tbl || '.' || t.want as check_name,
      case when pol.policyname is not null then 'OK' else 'FAIL' end as status,
      coalesce(pol.cmd, 'missing') as detail
    from (values
      ('conversations', 'conversations_select'),
      ('conversation_members', 'conversation_members_select'),
      ('messages', 'messages_select')
    ) as t(tbl, want)
    left join pg_policies pol
      on pol.schemaname = 'public' and pol.tablename = t.tbl and pol.policyname = t.want
  ),
  old_write_policies_gone as (
    select
      'old_frontend_write_policy_removed:' || t.want as check_name,
      case when count(pol.policyname) = 0 then 'OK' else 'FAIL' end as status,
      count(pol.policyname)::text as detail
    from (values ('messages_insert'), ('messages_update_own'), ('messages_delete_own_or_manager')) as t(want)
    left join pg_policies pol
      on pol.schemaname = 'public' and pol.tablename = 'messages' and pol.policyname = t.want
    group by t.want
  ),
  realtime_pub as (
    select
      'realtime_publication:messages still present' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ),
  -- Same behavioral test as 004_preflight.sql, run again post-migration.
  -- Expected flip: still_passing must now be 0 whenever stale_total > 0.
  stale_private_access as (
    select
      'stale_private_channel_member_bug_check (post-fix state)' as check_name,
      case
        when stale_total = 0 then 'INFO (no stale banned/left member with a private channel_members row in current data -- test is vacuous, not proof)'
        when still_passing = 0 then 'OK (bug fixed: 0/' || stale_total || ' stale rows pass)'
        else 'FAIL (' || still_passing || '/' || stale_total || ' stale rows still pass -- fix did not take)'
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
  )
select * from table_exists
union all select * from channel_conversation_1to1
union all select * from room_conversation_1to1
union all select * from conversation_totals
union all select * from messages_row_count_unchanged
union all select * from messages_conversation_id_col
union all select * from messages_no_null_conversation
union all select * from messages_channel_id_still_present
union all select * from messages_channel_id_fkey_still_present
union all select * from old_channel_index_still_present
union all select * from compat_trigger_exists
union all select * from compat_trigger_function_exists
union all select * from new_functions_single_arg
union all select * from polymorphic_check_constraint
union all select * from channel_partial_unique
union all select * from room_partial_unique
union all select * from message_cursor_index
union all select * from attachment_unique_index
union all select * from no_dupe_attachments
union all select * from rls_enabled_new_tables
union all select * from new_policies_exist
union all select * from old_write_policies_gone
union all select * from realtime_pub
union all select * from stale_private_access
order by check_name;

-- ============================================================================
-- Optional manual tests for messages_sync_conversation_id (NOT part of the
-- read-only query above -- each of these writes a row, then rolls it back;
-- none of them are auto-executed). Run each block yourself, separately, in
-- the SQL Editor, to actually observe the trigger's 4-case behavior instead
-- of only confirming the trigger object exists. Uses whatever channel
-- happens to be first/second by created_at -- adjust the subqueries if you
-- want a specific channel.
--
-- Test A -- old-backend-style insert: channel_id only, conversation_id
-- should be resolved automatically (case 1). Expect the RETURNING row to
-- show a non-null conversation_id matching that channel's conversation.
-- begin;
--   insert into public.messages (channel_id, sender_id, content)
--   values (
--     (select id from public.channels order by created_at limit 1),
--     (select created_by from public.channels order by created_at limit 1),
--     'manual trigger test A -- old backend, channel_id only -- rolled back'
--   )
--   returning id, channel_id, conversation_id;
-- rollback;
--
-- Test B -- refactored-backend-style insert: conversation_id only (a
-- channel-type conversation), channel_id should be resolved automatically
-- (case 2). Expect the RETURNING row to show a non-null channel_id matching
-- that conversation's channel_id.
-- begin;
--   insert into public.messages (conversation_id, sender_id, content)
--   values (
--     (select conv.id from public.conversations conv
--        join public.channels c on c.id = conv.channel_id
--        order by c.created_at limit 1),
--     (select created_by from public.channels order by created_at limit 1),
--     'manual trigger test B -- new backend, conversation_id only -- rolled back'
--   )
--   returning id, channel_id, conversation_id;
-- rollback;
--
-- Test C -- mismatch rejection: channel_id from one channel paired with the
-- conversation_id of a *different* channel (case 3). Expect this INSERT
-- itself to fail with the "do not agree" exception from the trigger -- the
-- final `rollback;` clears the aborted transaction afterwards (required
-- since the failed INSERT leaves the session in an aborted-transaction
-- state). Needs at least 2 channels to exist (16 exist live at the time
-- this was written).
-- begin;
--   insert into public.messages (channel_id, conversation_id, sender_id, content)
--   values (
--     (select id from public.channels order by created_at limit 1),
--     (select conv.id from public.conversations conv
--        join public.channels c on c.id = conv.channel_id
--        order by c.created_at limit 1 offset 1),
--     (select created_by from public.channels order by created_at limit 1),
--     'manual trigger test C -- mismatched channel_id/conversation_id -- must fail'
--   );
-- rollback;
-- ============================================================================

