-- Rollback for 004_refactor_chat_to_conversations.sql (expand phase).
--
-- READ THIS BEFORE RUNNING IT.
--
-- Simpler than an earlier draft of this file, because 004 itself is now
-- expand-only: it never dropped messages.channel_id, messages_channel_id_fkey,
-- or idx_messages_channel_created, so this rollback does not need to
-- reconstruct them -- they were never gone. It only needs to undo what 004
-- actually added: the conversations/conversation_members tables, the
-- conversation_type enum, messages.conversation_id (+ its FK + its index),
-- the compatibility trigger, the 3 new permission functions, and the RLS
-- policy changes on `messages`.
--
-- Safe ONLY while every message in the database still belongs to a
-- `channel`-type conversation -- i.e. before any room-chat or direct-message
-- feature built on top of this migration has actually written a `room` or
-- `direct` message. This script refuses to run (RAISE EXCEPTION) if that
-- precondition doesn't hold.
--
-- Not a claim that this is lossless in every sense:
--   - Any `room` or `direct` conversation that exists with zero messages
--     (e.g. an empty DM shell someone opened but never sent anything in) IS
--     silently dropped along with its conversation_members rows when
--     `conversations`/`conversation_members` are dropped below. There is no
--     message data in it to lose, but any application code that stored that
--     conversation's UUID somewhere would have a dangling reference.
--   - The can_access_channel() bug fix applied in 004 (section 8) is
--     intentionally NOT reverted here. Rolling back a schema refactor is
--     not a reason to reintroduce a known permission bug.
--
-- Object drop order matters and is deliberate: policies that reference a
-- SECURITY DEFINER function in their USING/WITH CHECK expression create a
-- real dependency (pg_depend) on that function -- DROP FUNCTION without
-- CASCADE fails if a policy still references it. So this script drops
-- POLICIES first, then FUNCTIONS, then TABLES/TYPE. (An earlier draft of
-- this file got this backwards.)

begin;

-- Precondition: refuse to proceed if any message belongs to a non-channel
-- conversation.
do $$
declare
  v_non_channel_messages bigint;
begin
  select count(*) into v_non_channel_messages
  from public.messages m
  join public.conversations conv on conv.id = m.conversation_id
  where conv.type <> 'channel'::public.conversation_type;

  if v_non_channel_messages > 0 then
    raise exception
      'Rollback refused: % message(s) belong to a room/direct conversation. Reverting would destroy or misrepresent this data. This rollback is only safe before room/direct chat has been used.',
      v_non_channel_messages;
  end if;
end $$;

-- 1. Drop the POLICIES that depend on the new functions, and the messages
-- policy that depends on conversation_id -- before touching the functions
-- or the conversation_id column they reference.
drop policy if exists conversations_select on public.conversations;
drop policy if exists conversation_members_select on public.conversation_members;
drop policy if exists messages_select on public.messages;

-- 2. Restore the original 4 messages policies (bodies captured live before
-- 004 first ran), now that the conversation_id-based one is gone.
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_update_own on public.messages;
drop policy if exists messages_delete_own_or_manager on public.messages;

create policy messages_select on public.messages
  for select to authenticated
  using (public.can_access_channel(channel_id));

create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.can_access_channel(channel_id));

create policy messages_update_own on public.messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create policy messages_delete_own_or_manager on public.messages
  for delete to authenticated
  using (
    sender_id = auth.uid()
    or exists (
      select 1 from public.channels c
      where c.id = messages.channel_id and public.is_group_manager(c.group_id)
    )
  );

-- 3. Now that no policy references them, drop the new functions. Signatures
-- match 004's final (single-argument) definitions.
drop function if exists public.can_access_conversation(uuid);
drop function if exists public.can_access_room_conversation(uuid);
drop function if exists public.is_conversation_member(uuid);

-- 4. Drop the compatibility trigger and its function.
drop trigger if exists messages_sync_conversation_id on public.messages;
drop function if exists public.messages_sync_conversation_id();

-- 5. Drop conversation_id's index and FK, then the column. channel_id, its
-- FK, and its index are untouched -- 004 never dropped them.
drop index if exists public.idx_messages_conversation_created;
alter table public.messages drop constraint if exists messages_conversation_id_fkey;
alter table public.messages drop column if exists conversation_id;

-- 6. attachment_path uniqueness. Commented out by default -- this
-- constraint is harmless to keep even without conversation_id (it doesn't
-- reference it), and dropping it re-opens the two-messages-one-Storage-
-- object risk described in 004's header. Uncomment only if you have a
-- specific reason to remove it.
-- drop index if exists public.messages_attachment_path_key;

-- 7. Drop the new tables and enum. Safe: the precondition check above
-- already guarantees no message data lives behind conversation_id, and step
-- 1 already dropped the policies that referenced these tables' rows.
drop table if exists public.conversation_members;
drop table if exists public.conversations;
drop type if exists public.conversation_type;

commit;
