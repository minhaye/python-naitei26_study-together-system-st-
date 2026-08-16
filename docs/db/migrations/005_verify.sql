-- Post-migration verification for 005_contract_messages_to_conversations.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same reasoning as 004_verify.sql: one UNION ALL query, one result grid.
-- Everything with status OK/INFO is expected. Anything FAIL means the
-- migration did not end up in the state it was designed to reach -- stop and
-- investigate before treating the CONTRACT phase as done.

with
  -- ==========================================================================
  -- Legacy objects must be GONE.
  -- ==========================================================================
  legacy_channel_id_col_gone as (
    select
      'messages.channel_id column absent' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' matching column(s) found (expected 0)' as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name = 'channel_id'
  ),
  legacy_channel_id_fkey_gone as (
    select
      'messages_channel_id_fkey absent' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.messages'::regclass and conname = 'messages_channel_id_fkey'
  ),
  legacy_channel_index_gone as (
    select
      'idx_messages_channel_created absent' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'messages' and indexname = 'idx_messages_channel_created'
  ),
  legacy_trigger_gone as (
    select
      'messages_sync_conversation_id trigger absent' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.triggers
    where trigger_schema = 'public' and event_object_table = 'messages'
      and trigger_name = 'messages_sync_conversation_id'
  ),
  legacy_trigger_function_gone as (
    select
      'messages_sync_conversation_id() function absent' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'messages_sync_conversation_id'
  ),

  -- ==========================================================================
  -- Conversation-based schema must still be intact -- 005 must not have
  -- touched any of this.
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
  conversation_fkey as (
    select
      'messages_conversation_id_fkey exists' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.messages'::regclass and conname = 'messages_conversation_id_fkey'
  ),
  conversation_index as (
    select
      'idx_messages_conversation_created exists' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'messages' and indexname = 'idx_messages_conversation_created'
  ),
  conversations_table_intact as (
    select
      'table_exists:conversations' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'conversations'
  ),
  conversation_members_table_intact as (
    select
      'table_exists:conversation_members' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'conversation_members'
  ),

  -- ==========================================================================
  -- Data integrity.
  -- ==========================================================================
  message_row_count as (
    select
      'messages_row_count_preserved (compare against 005_preflight.sql row_count:messages)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.messages
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
      'messages_with_orphan_conversation_id (must be 0)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.messages m
    left join public.conversations conv on conv.id = m.conversation_id
    where conv.id is null
  ),
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

  -- ==========================================================================
  -- Realtime / RLS -- must be untouched by this migration.
  -- ==========================================================================
  realtime_pub as (
    select
      'realtime_publication:messages still present' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ),
  rls_enabled as (
    select
      'rls_enabled:' || relname as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in ('messages', 'conversations', 'conversation_members')
  ),
  select_policies_exist as (
    select
      'policy_exists:' || t.tbl || '.' || t.want as check_name,
      case when pol.policyname is not null then 'OK' else 'FAIL' end as status,
      coalesce(pol.cmd, 'missing') as detail
    from (values
      ('messages', 'messages_select'),
      ('conversations', 'conversations_select'),
      ('conversation_members', 'conversation_members_select')
    ) as t(tbl, want)
    left join pg_policies pol
      on pol.schemaname = 'public' and pol.tablename = t.tbl and pol.policyname = t.want
  )

select * from legacy_channel_id_col_gone
union all select * from legacy_channel_id_fkey_gone
union all select * from legacy_channel_index_gone
union all select * from legacy_trigger_gone
union all select * from legacy_trigger_function_gone
union all select * from conversation_id_col
union all select * from conversation_fkey
union all select * from conversation_index
union all select * from conversations_table_intact
union all select * from conversation_members_table_intact
union all select * from message_row_count
union all select * from no_null_conversation_id
union all select * from no_orphan_conversation_id
union all select * from channel_conversation_1to1
union all select * from room_conversation_1to1
union all select * from attachment_unique_index
union all select * from no_dupe_attachments
union all select * from realtime_pub
union all select * from rls_enabled
union all select * from select_policies_exist
order by check_name;
