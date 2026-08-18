-- Preflight checks for 012_backfill_missing_room_conversations.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Same one-UNION-ALL-query shape as 009/010/011's preflight scripts (single
-- result grid in the Supabase SQL Editor).
--
-- Context: the architecture requires every Study Room to have exactly one
-- `room`-type Conversation (see STUDY_PLATFORM_DATABASE_SPEC.md § 16 and
-- § 12 -- room chat/attachments/meeting-token authorization all resolve
-- through the room's Conversation). Migration 004 backfilled exactly one
-- room-Conversation per study_rooms row that existed AT THE TIME 004 ran,
-- and added `conversations_room_id_key` (partial unique index on
-- `conversations.room_id`) plus `conversations_type_target_check` (CHECK:
-- type='room' implies room_id is set and channel_id is null) -- both still
-- live and untouched since. What 004 did NOT do is make Conversation
-- creation part of `StudyRoomsService.create()`'s normal lifecycle -- every
-- Study Room created after 004 ran has had no Conversation at all, until
-- the application-level fix landed alongside this migration (see
-- app/study_rooms/services/study_room_service.py). This migration is the
-- one-time data repair for rooms created in that gap; the application fix
-- is what prevents new gaps going forward.
--
-- This preflight does NOT assume the previously-observed orphan count is
-- still accurate -- it re-counts live. It also does not assume duplicates
-- (one room -> multiple room-Conversations) are absent: if any are found,
-- STOP and report them (room IDs, conversation IDs, message counts per
-- conversation) instead of running 012 -- see the migration file's header
-- for why automatic merge/delete is out of scope here.
--
-- Deliberately covers ALL study_rooms rows, including soft-deleted ones
-- (deleted_at IS NOT NULL) -- migration 010's soft-delete design keeps a
-- deleted room's Conversation and Messages fully intact as history (see
-- STUDY_PLATFORM_DATABASE_SPEC.md § 16's Soft Delete section: "Room row
-- vẫn còn, Conversation vẫn còn, Messages vẫn còn"), and 004's original
-- backfill covered every room unconditionally (deleted_at didn't exist
-- yet). Excluding deleted rooms here would leave some of them permanently
-- orphaned with no path to ever getting a Conversation.
--
-- Run this BEFORE 012_backfill_missing_room_conversations.sql.

with
  study_rooms_row_count as (
    select
      'study_rooms_row_count (informational -- compare against 012_verify.sql''s post-migration count; must be unchanged)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_rooms
  ),
  room_conversations_row_count as (
    select
      'room_type_conversations_row_count (informational -- compare against 012_verify.sql''s post-migration count)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.conversations
    where type = 'room'::public.conversation_type
  ),
  conversations_room_id_key_exists as (
    select
      'unique_index_present:conversations_room_id_key (must be OK -- 004''s partial unique index on conversations.room_id; 012 relies on this already existing rather than adding a new one)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'conversations' and indexname = 'conversations_room_id_key'
  ),
  conversations_type_target_check_exists as (
    select
      'check_constraint_present:conversations_type_target_check (must be OK -- 004''s CHECK that type=room implies room_id is set and channel_id is null)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.conversations'::regclass and conname = 'conversations_type_target_check'
  ),
  rooms_with_zero_conversations as (
    select
      'rooms_with_zero_room_conversations (must be reviewed -- these are the rows 012 will backfill; detail lists room_id, name, group_id, host_id, deleted_at for each)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'INFO/will-be-backfilled' end as status,
      coalesce(
        string_agg(
          sr.id::text || ' name=' || coalesce(sr.name, '') || ' group=' || sr.group_id::text
            || ' host=' || sr.host_id::text || ' deleted_at=' || coalesce(sr.deleted_at::text, 'NULL'),
          ' | '
        ),
        'none'
      ) as detail
    from public.study_rooms sr
    where not exists (
      select 1 from public.conversations conv where conv.room_id = sr.id and conv.type = 'room'::public.conversation_type
    )
  ),
  rooms_with_multiple_conversations as (
    select
      'rooms_with_multiple_room_conversations (must be OK/none-found -- if this is not empty, STOP: do not run 012 automatically. Review each room_id/conversation_id/message-count combination and decide remediation by hand; a duplicate could split real message history across two conversation_ids)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'FAIL/manual-review-required' end as status,
      coalesce(
        string_agg(bad.room_id::text || ' has ' || bad.n::text || ' room-conversations: ' || bad.conversation_ids, ' | '),
        'none'
      ) as detail
    from (
      select
        sr.id as room_id,
        count(conv.id) as n,
        string_agg(conv.id::text || ' (messages=' || (select count(*) from public.messages m where m.conversation_id = conv.id)::text || ')', ', ') as conversation_ids
      from public.study_rooms sr
      join public.conversations conv on conv.room_id = sr.id and conv.type = 'room'::public.conversation_type
      group by sr.id
      having count(conv.id) > 1
    ) bad
  ),
  room_conversations_referencing_missing_room as (
    select
      'room_conversations_referencing_missing_room (informational -- expected to always be OK/none: conversations.room_id has an ON DELETE CASCADE FK to study_rooms.id, so this should not be structurally possible; included as a defense-in-depth check, not because a gap is expected)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'FAIL/data-integrity-issue' end as status,
      coalesce(string_agg(conv.id::text || ' (room_id=' || conv.room_id::text || ')', ', '), 'none') as detail
    from public.conversations conv
    left join public.study_rooms sr on sr.id = conv.room_id
    where conv.type = 'room'::public.conversation_type and sr.id is null
  )

select * from study_rooms_row_count
union all select * from room_conversations_row_count
union all select * from conversations_room_id_key_exists
union all select * from conversations_type_target_check_exists
union all select * from rooms_with_zero_conversations
union all select * from rooms_with_multiple_conversations
union all select * from room_conversations_referencing_missing_room
order by check_name;
