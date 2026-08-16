-- CONTRACT phase of the Channel -> Conversation refactor. Finishes what
-- 004_refactor_chat_to_conversations.sql (EXPAND phase) started.
--
-- ============================================================================
-- What this does
-- ============================================================================
-- Removes everything that existed purely to keep the pre-refactor backend
-- working alongside `messages.conversation_id`:
--   - the `messages_sync_conversation_id` trigger (+ its function)
--   - `idx_messages_channel_created` (the old channel_id-scoped cursor index)
--   - `messages_channel_id_fkey`
--   - `messages.channel_id` itself
--
-- After this, `messages` has exactly: id, conversation_id, sender_id,
-- content, attachment_path, created_at, updated_at. `conversation_id` is the
-- only way a message is associated with anything.
--
-- This is safe now because the FastAPI backend (SQLAlchemy models,
-- MessagesService, message/attachment routers, app/core/permissions.py) was
-- refactored to read and write `conversation_id` exclusively -- verified by
-- code search and the full test suite (65 passed) before this file was
-- written. See 005_preflight.sql for the automated version of the checks
-- below; run it first and confirm zero FAIL before running this.
--
-- ============================================================================
-- What this does NOT do
-- ============================================================================
--   - Does NOT drop messages.conversation_id, conversations, or
--     conversation_members.
--   - Does NOT delete or modify any message row's data (content,
--     attachment_path, sender_id, timestamps all untouched).
--   - Does NOT touch Supabase Realtime (`messages` stays in
--     supabase_realtime -- nothing here alters publications).
--   - Does NOT touch Storage (bucket, objects, attachment_path format all
--     unchanged).
--   - Does NOT implement room chat or direct messages -- purely a schema
--     cleanup for the channel-chat path that already existed.
--
-- ============================================================================
-- Dependency order (why it's in this order)
-- ============================================================================
-- A trigger fires on the column/table it's attached to, so it must go before
-- its function can be dropped (a function referenced by a live trigger
-- cannot be dropped without CASCADE, and this script avoids CASCADE
-- entirely -- every drop here is explicit and individually justified):
--
--   1. DROP TRIGGER messages_sync_conversation_id (depends on: nothing else
--      being dropped first -- but must go before its function, step 2)
--   2. DROP FUNCTION messages_sync_conversation_id() (now safe: no trigger
--      references it anymore)
--   3. DROP INDEX idx_messages_channel_created (depends on: channel_id
--      column existing -- must go before step 5)
--   4. DROP CONSTRAINT messages_channel_id_fkey (depends on: channel_id
--      column existing -- must go before step 5; also, Postgres won't let
--      you drop a column that a foreign key constraint still references)
--   5. DROP COLUMN messages.channel_id (last: nothing above still
--      references it once steps 1-4 are done)
--
-- ============================================================================
-- Safety
-- ============================================================================
--   - Single transaction (BEGIN...COMMIT). Any RAISE EXCEPTION aborts the
--     whole thing -- nothing partial is left behind.
--   - Every DROP uses IF EXISTS, so this is safe to re-run: a second run
--     after a successful apply is a silent no-op (nothing left to drop),
--     not an error.
--   - No DROP TABLE, no TRUNCATE, no DELETE -- this migration removes
--     schema objects only, never rows.
--   - The paranoid inline check in section 0 duplicates one of
--     005_preflight.sql's checks on purpose (same reasoning as 004's inline
--     backfill-verification check): preflight is advisory and can be run
--     minutes or hours before this file, and nothing stops the data from
--     changing in between. This is the same guarantee 004 gave itself
--     before its own destructive-adjacent step.

begin;

-- ============================================================================
-- 0. Final safety check, re-verified inside the same transaction as the
--    actual drops (not just in the separate preflight script).
-- ============================================================================
do $$
declare
  v_null_conversation bigint;
  v_orphan_conversation bigint;
begin
  select count(*) into v_null_conversation from public.messages where conversation_id is null;
  if v_null_conversation > 0 then
    raise exception
      'Migration aborted: % message row(s) have a NULL conversation_id. This must be 0 before dropping messages.channel_id, or those rows would become permanently unlinked from any conversation. Re-run 005_preflight.sql and investigate before retrying.',
      v_null_conversation;
  end if;

  select count(*) into v_orphan_conversation
  from public.messages m
  left join public.conversations conv on conv.id = m.conversation_id
  where conv.id is null;
  if v_orphan_conversation > 0 then
    raise exception
      'Migration aborted: % message row(s) have a conversation_id that does not match any row in conversations. Re-run 005_preflight.sql and investigate before retrying.',
      v_orphan_conversation;
  end if;
end $$;

-- ============================================================================
-- 1-2. Drop the compatibility trigger, then its function.
-- ============================================================================
drop trigger if exists messages_sync_conversation_id on public.messages;
drop function if exists public.messages_sync_conversation_id();

-- ============================================================================
-- 3. Drop the old channel_id-scoped cursor index. The conversation_id-scoped
--    equivalent (idx_messages_conversation_created, added by 004) is kept --
--    this migration does not touch it.
-- ============================================================================
drop index if exists public.idx_messages_channel_created;

-- ============================================================================
-- 4. Drop the legacy foreign key. Must happen before the column drop below --
--    Postgres refuses to drop a column that a FK constraint still references.
-- ============================================================================
alter table public.messages drop constraint if exists messages_channel_id_fkey;

-- ============================================================================
-- 5. Drop messages.channel_id itself. Nothing above still references it.
-- ============================================================================
alter table public.messages drop column if exists channel_id;

commit;

-- ============================================================================
-- Final `messages` schema right after this migration:
--   id, conversation_id (NOT NULL, FK+index), sender_id, content,
--   attachment_path, created_at, updated_at.
-- No channel_id column. No compatibility trigger. conversations and
-- conversation_members are untouched. Realtime publication membership and
-- RLS policies on `messages` (messages_select, conversation_id-based, set up
-- by 004 section 13) are untouched -- this migration only drops
-- channel_id-related objects, none of which any current policy references.
-- ============================================================================
