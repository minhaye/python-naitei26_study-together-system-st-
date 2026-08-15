-- Preflight checks for 005_contract_messages_to_conversations.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Same reasoning as 004_preflight.sql: one UNION ALL query so the Supabase
-- SQL Editor's single result grid shows every check at once. Anything with
-- status FAIL means 005 is not safe to run yet -- fix the underlying issue
-- (almost certainly in application code or data, not in this script) and
-- re-run this file before touching 005_contract_messages_to_conversations.sql.
--
-- Run this BEFORE 005_contract_messages_to_conversations.sql.

with
  row_counts as (
    select 'row_count:messages (compare against post-005 verify)' as check_name, 'INFO' as status, count(*)::text as detail
    from public.messages
    union all
    select 'row_count:conversations', 'INFO', count(*)::text from public.conversations
    union all
    select 'row_count:channels', 'INFO', count(*)::text from public.channels
    union all
    select 'row_count:study_rooms', 'INFO', count(*)::text from public.study_rooms
  ),

  -- ==========================================================================
  -- Conversations
  -- ==========================================================================
  channel_conversation_1to1 as (
    select
      'each_channel_has_exactly_1_conversation (must be 0 bad)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' channel(s) with != 1 conversation' as detail
    from (
      select c.id, count(conv.id) as n
      from public.channels c
      left join public.conversations conv on conv.channel_id = c.id and conv.type = 'channel'::public.conversation_type
      group by c.id
      having count(conv.id) <> 1
    ) bad
  ),
  room_conversation_1to1 as (
    select
      'each_study_room_has_exactly_1_conversation (must be 0 bad)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' study_room(s) with != 1 conversation' as detail
    from (
      select sr.id, count(conv.id) as n
      from public.study_rooms sr
      left join public.conversations conv on conv.room_id = sr.id and conv.type = 'room'::public.conversation_type
      group by sr.id
      having count(conv.id) <> 1
    ) bad
  ),
  no_bad_channel_target as (
    select
      'conversations_channel_type_bad_target (must be 0 -- type=channel with null/mismatched channel_id)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.conversations
    where type = 'channel'::public.conversation_type and (channel_id is null or room_id is not null)
  ),
  no_bad_room_target as (
    select
      'conversations_room_type_bad_target (must be 0 -- type=room with null/mismatched room_id)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.conversations
    where type = 'room'::public.conversation_type and (room_id is null or channel_id is not null)
  ),

  -- ==========================================================================
  -- Messages
  -- ==========================================================================
  conversation_id_col as (
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
  no_null_conversation_id as (
    select
      'messages_with_null_conversation_id (must be 0)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.messages where conversation_id is null
  ),
  no_orphan_conversation_id as (
    select
      'messages_with_orphan_conversation_id (must be 0 -- conversation_id not in conversations)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.messages m
    left join public.conversations conv on conv.id = m.conversation_id
    where conv.id is null
  ),
  all_channel_messages_valid as (
    select
      'existing_channel_messages_have_valid_conversation (must be 0 bad)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.messages m
    join public.conversations conv on conv.id = m.conversation_id
    where m.channel_id is not null
      and (conv.type <> 'channel'::public.conversation_type or conv.channel_id is distinct from m.channel_id)
  ),

  -- ==========================================================================
  -- Legacy compatibility objects -- MUST still exist right now (005 is what
  -- removes them). A FAIL here means either 005 already ran, or something
  -- else dropped them out of band -- either way, stop and investigate rather
  -- than running 005 against unexpected state.
  -- ==========================================================================
  legacy_channel_id_col as (
    select
      'messages.channel_id column present (expected before 005)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name = 'channel_id'
  ),
  legacy_channel_id_fkey as (
    select
      'messages_channel_id_fkey present (expected before 005)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.messages'::regclass and conname = 'messages_channel_id_fkey'
  ),
  legacy_channel_index as (
    select
      'idx_messages_channel_created present (expected before 005)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'messages' and indexname = 'idx_messages_channel_created'
  ),
  legacy_trigger as (
    select
      'messages_sync_conversation_id trigger present (expected before 005)' as check_name,
      case when count(*) = 2 then 'OK' else 'FAIL' end as status,
      string_agg(event_manipulation || ':' || action_timing, ', ' order by event_manipulation) as detail
    from information_schema.triggers
    where trigger_schema = 'public' and event_object_table = 'messages'
      and trigger_name = 'messages_sync_conversation_id'
  ),
  legacy_trigger_function as (
    select
      'messages_sync_conversation_id() function present (expected before 005)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'messages_sync_conversation_id'
  ),

  -- ==========================================================================
  -- New (004-introduced) schema -- MUST already exist. 005 only drops legacy
  -- objects; it never (re)creates any of these.
  -- ==========================================================================
  new_conversation_index as (
    select
      'idx_messages_conversation_created present' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'messages' and indexname = 'idx_messages_conversation_created'
  ),
  new_conversation_fkey as (
    select
      'messages_conversation_id_fkey present' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.messages'::regclass and conname = 'messages_conversation_id_fkey'
  ),
  conversations_table as (
    select
      'table_exists:conversations' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'conversations'
  ),
  conversation_members_table as (
    select
      'table_exists:conversation_members' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'conversation_members'
  )

select * from row_counts
union all select * from channel_conversation_1to1
union all select * from room_conversation_1to1
union all select * from no_bad_channel_target
union all select * from no_bad_room_target
union all select * from conversation_id_col
union all select * from no_null_conversation_id
union all select * from no_orphan_conversation_id
union all select * from all_channel_messages_valid
union all select * from legacy_channel_id_col
union all select * from legacy_channel_id_fkey
union all select * from legacy_channel_index
union all select * from legacy_trigger
union all select * from legacy_trigger_function
union all select * from new_conversation_index
union all select * from new_conversation_fkey
union all select * from conversations_table
union all select * from conversation_members_table
order by check_name;
