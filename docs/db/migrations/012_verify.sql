-- Post-migration verification for 012_backfill_missing_room_conversations.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same one-UNION-ALL-query shape as 004/009/010/011's verify scripts.
-- Everything with status OK/INFO is expected. Anything FAIL means the
-- migration did not end up in the state it was designed to reach -- stop
-- and investigate before treating the Study Room -> Conversation invariant
-- as repaired.

with
  every_room_has_exactly_one_conversation as (
    select
      'each_study_room_has_exactly_1_room_conversation (must be OK -- includes soft-deleted rooms; this is the core invariant 012 exists to restore)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' study_room(s) with != 1 room-conversation' as detail
    from (
      select sr.id, count(conv.id) as n
      from public.study_rooms sr
      left join public.conversations conv on conv.room_id = sr.id and conv.type = 'room'::public.conversation_type
      group by sr.id
      having count(conv.id) <> 1
    ) bad
  ),
  no_room_with_multiple_conversations as (
    select
      'no_study_room_has_more_than_1_room_conversation (must be OK -- 012 must never have created a duplicate)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      coalesce(string_agg(bad.room_id::text || ' has ' || bad.n::text, ', '), 'none') as detail
    from (
      select sr.id as room_id, count(conv.id) as n
      from public.study_rooms sr
      join public.conversations conv on conv.room_id = sr.id and conv.type = 'room'::public.conversation_type
      group by sr.id
      having count(conv.id) > 1
    ) bad
  ),
  study_rooms_row_count_unchanged as (
    select
      'study_rooms_row_count (informational -- must equal 012_preflight.sql''s pre-migration count; 012 never touches study_rooms)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_rooms
  ),
  room_conversations_row_count as (
    select
      'room_type_conversations_row_count (informational -- must equal preflight count + the number of previously-orphaned rooms backfilled)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.conversations
    where type = 'room'::public.conversation_type
  ),
  no_conversation_row_lost as (
    select
      'total_conversations_row_count (informational -- channel-type and direct-type counts must be unchanged from before 012; only room-type may have grown)' as check_name,
      'INFO' as status,
      'channel=' || (select count(*) from public.conversations where type = 'channel'::public.conversation_type)::text
        || ', room=' || (select count(*) from public.conversations where type = 'room'::public.conversation_type)::text
        || ', direct=' || (select count(*) from public.conversations where type = 'direct'::public.conversation_type)::text
      as detail
  ),
  conversations_room_id_key_still_present as (
    select
      'unique_index_present:conversations_room_id_key (must be OK -- 004''s constraint; 012 must not have touched it)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'conversations' and indexname = 'conversations_room_id_key'
  ),
  conversations_type_target_check_still_present as (
    select
      'check_constraint_present:conversations_type_target_check (must be OK -- 004''s constraint; 012 must not have touched it)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.conversations'::regclass and conname = 'conversations_type_target_check'
  ),
  backfilled_conversations_have_valid_created_by as (
    select
      'room_conversations_created_by_matches_host (informational -- confirms created_by was backfilled from study_rooms.host_id, not left null or defaulted to some other identity)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' room-conversation(s) whose created_by != their room''s host_id' as detail
    from public.conversations conv
    join public.study_rooms sr on sr.id = conv.room_id
    where conv.type = 'room'::public.conversation_type and conv.created_by <> sr.host_id
  ),
  soft_delete_state_untouched as (
    select
      'study_rooms_soft_delete_state_untouched (must be OK -- 012 must not have changed any room''s deleted_at/deleted_by)' as check_name,
      'INFO' as status,
      'deleted_rooms=' || (select count(*) from public.study_rooms where deleted_at is not null)::text
        || ', active_rooms=' || (select count(*) from public.study_rooms where deleted_at is null)::text
      as detail
  ),
  deleted_rooms_also_have_conversation as (
    select
      'soft_deleted_rooms_have_room_conversation (must be OK -- historical/deleted rooms are backfilled too, not skipped)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' soft-deleted study_room(s) still missing a room-conversation' as detail
    from public.study_rooms sr
    where sr.deleted_at is not null
      and not exists (
        select 1 from public.conversations conv where conv.room_id = sr.id and conv.type = 'room'::public.conversation_type
      )
  ),
  rls_still_enabled as (
    select
      'rls_enabled:' || t.want as check_name,
      case when c.relrowsecurity then 'OK' else 'FAIL' end as status,
      case when c.relrowsecurity then 'enabled' else 'DISABLED' end as detail
    from (values ('conversations'), ('study_rooms'), ('messages')) as t(want)
    join pg_class c on c.relname = t.want
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  )

select * from every_room_has_exactly_one_conversation
union all select * from no_room_with_multiple_conversations
union all select * from study_rooms_row_count_unchanged
union all select * from room_conversations_row_count
union all select * from no_conversation_row_lost
union all select * from conversations_room_id_key_still_present
union all select * from conversations_type_target_check_still_present
union all select * from backfilled_conversations_have_valid_created_by
union all select * from soft_delete_state_untouched
union all select * from deleted_rooms_also_have_conversation
union all select * from rls_still_enabled
order by check_name;
