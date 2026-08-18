-- Backfills a `room`-type Conversation for every Study Room that does not
-- already have one (the Study Room -> Conversation creation invariant gap,
-- 2026-08-18).
--
-- ============================================================================
-- Why
-- ============================================================================
-- The architecture requires every Study Room to have exactly one `room`-type
-- Conversation (room chat/attachments/meeting-token authorization all
-- resolve through it -- see STUDY_PLATFORM_DATABASE_SPEC.md § 16, § 12).
-- Migration 004 backfilled exactly one room-Conversation per study_rooms row
-- that existed AT THE TIME 004 ran, but never made Conversation creation
-- part of `StudyRoomsService.create()`'s normal lifecycle -- every Study
-- Room created after 004 ran (and before the application-level fix landed
-- alongside this migration) has had no Conversation at all. This migration
-- is the one-time data repair for that gap; the same-commit change to
-- `StudyRoomsService.create()` (app/study_rooms/services/study_room_service.py)
-- is what prevents the gap from reopening for future rooms.
--
-- Read docs/db/migrations/012_preflight.sql and its output BEFORE running
-- this -- in particular `rooms_with_multiple_room_conversations`. If that
-- check is not OK/none-found, DO NOT run this migration: stop and resolve
-- the duplicate(s) by hand first (see that check's own comment for why).
-- Read docs/db/migrations/012_verify.sql AFTER running this.
--
-- ============================================================================
-- What this does NOT do
-- ============================================================================
-- Does not add a new unique constraint or index: `conversations_room_id_key`
-- (partial unique index on `conversations.room_id`, migration 004) already
-- guarantees at most one room-Conversation per room at the DB level, and
-- `conversations_type_target_check` (also 004) already guarantees a
-- `room`-type Conversation always has room_id set / channel_id null. Both
-- are confirmed present by 012_preflight.sql; this migration does not
-- recreate or alter either.
--
-- Does not touch soft-deleted rooms differently from active ones: covers
-- every `study_rooms` row unconditionally, including deleted_at IS NOT NULL
-- rows. A soft-deleted room keeps its full history (Conversation, Messages,
-- StudyRoomMembers) intact by design (see § 16's Soft Delete section) --
-- excluding deleted rooms here would leave some of them permanently
-- orphaned, with no path to ever getting a Conversation, and would break
-- FK integrity for any historical Messages a deleted-but-previously-orphan
-- room might otherwise need.
--
-- Does not delete, merge, or rewrite any existing Conversation or Message.
-- Does not touch `study_rooms` or `study_room_members` at all -- read-only
-- with respect to both.
--
-- ============================================================================
-- Safety
-- ============================================================================
-- Single transaction. Any error aborts the whole thing -- nothing partial
-- is left behind.
--
-- Idempotent: the INSERT ... WHERE NOT EXISTS guard (same shape as 004's
-- original room backfill, section 5) means a room that already has a
-- room-Conversation is skipped -- running this migration a second time
-- inserts zero rows and is a no-op. `created_by` mirrors 004's original
-- choice: `study_rooms.host_id` (the room's creator) -- there is no other
-- "who backfilled this" identity to attribute it to, and this matches what
-- every room created through the normal app path already has as its
-- Conversation's created_by (see StudyRoomsService.create).
--
-- `created_at`/`updated_at` are backfilled from the room's own `created_at`
-- (study_rooms has no separate updated_at column -- same choice 004's
-- original backfill made), not `now()` -- so a Conversation backfilled here
-- reflects when its room was actually created, not when this migration ran.

begin;

insert into public.conversations (type, room_id, created_by, created_at, updated_at)
select 'room'::public.conversation_type, sr.id, sr.host_id, sr.created_at, sr.created_at
from public.study_rooms sr
where not exists (
  select 1 from public.conversations conv
  where conv.room_id = sr.id and conv.type = 'room'::public.conversation_type
);

commit;

-- ============================================================================
-- After this migration:
--   - Every study_rooms row (active or soft-deleted) has exactly one
--     room-type Conversation.
--   - conversations_room_id_key and conversations_type_target_check remain
--     exactly as they were (both pre-existing, both untouched).
--   - No study_rooms or study_room_members row is added, changed, or
--     removed.
--   - No pre-existing Conversation or Message is added, changed, or
--     removed -- this migration only INSERTs rows for rooms that had zero
--     room-Conversations.
-- ============================================================================
