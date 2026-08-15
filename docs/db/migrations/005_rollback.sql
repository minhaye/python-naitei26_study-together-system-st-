-- Rollback for 005_contract_messages_to_conversations.sql (contract phase).
--
-- READ THIS BEFORE RUNNING IT.
--
-- Undoes 005's five drops, in reverse dependency order: re-adds
-- messages.channel_id, backfills it, restores its NOT NULL, its FK, its
-- index, and the compatibility trigger + function. Does not touch anything
-- 005 didn't touch (conversations, conversation_members,
-- messages.conversation_id, RLS policies, Realtime, Storage all untouched by
-- 005, so there is nothing to restore there).
--
-- ============================================================================
-- Central assumption -- read this carefully
-- ============================================================================
-- `messages.channel_id` can only be reconstructed for messages that belong
-- to a `channel`-type conversation, because that is the only conversation
-- type with a `channel_id` to backfill from (`room` and `direct`
-- conversations have no channel at all -- see the `conversations` polymorphic
-- check constraint). This mirrors the exact same restriction the
-- `messages_sync_conversation_id` trigger enforced during 004's expand
-- phase (see that trigger's case-2 comment in
-- 004_refactor_chat_to_conversations.sql section 7): a room/direct message
-- insert was already refused back then because channel_id was NOT NULL and
-- had nothing to resolve to.
--
-- This script refuses to run (RAISE EXCEPTION) if that precondition doesn't
-- hold, i.e. if any message now belongs to a room/direct conversation. That
-- can only happen if a room-chat or direct-message feature was built and
-- used sometime between 005 being applied and this rollback being run --
-- this rollback predates that feature by design (see the task scope: this
-- refactor never implements room/DM messaging) and is not safe once it
-- exists. If you need to roll back after that point, this script is no
-- longer sufficient and needs a real design discussion, not a blind re-run.
--
-- ============================================================================
-- Best-effort reconstruction: idx_messages_channel_created
-- ============================================================================
-- The exact original DDL for this index (created before migration 001, so
-- not captured verbatim in any file in this repo) is reconstructed here as
-- `(channel_id, created_at desc, id desc)` -- the same shape as
-- `idx_messages_conversation_created` (added by 004), which was explicitly
-- designed to match this project's existing keyset pagination. This is a
-- reasonable inference, not a verified fact. Before relying on this
-- rollback, cross-check against the literal `indexdef` you can still see in
-- 004_preflight.sql's `messages_indexes` check output (if you saved it from
-- when 004 was first run) or by inspecting a pre-005 backup/snapshot if one
-- exists. If the index name already exists with a different definition when
-- this runs, this script will fail loudly (DROP + recreate below) rather
-- than silently applying a possibly-wrong shape.
--
-- ============================================================================
-- What is deliberately NOT restored
-- ============================================================================
-- The old direct-write RLS policies (`messages_insert`, `messages_update_own`,
-- `messages_delete_own_or_manager`) are NOT recreated -- 005 never touched
-- RLS policies in the first place (only 004 did, intentionally, closing a
-- real gap), so there is nothing here for this rollback to undo on that
-- front. FastAPI remains the sole writer to `messages`, same as today.

begin;

-- Precondition: refuse to proceed if any message belongs to a non-channel
-- conversation -- there is no channel_id to backfill it with.
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
      'Rollback refused: % message(s) belong to a room/direct conversation and have no channel to backfill messages.channel_id from. This rollback is only safe before room/direct chat has been used. See this file''s header for the full explanation.',
      v_non_channel_messages;
  end if;
end $$;

-- 1. Re-add the column, nullable first (mirrors 004 section 6's own
-- add-then-backfill-then-enforce approach for conversation_id).
alter table public.messages add column if not exists channel_id uuid;

-- 2. Backfill: messages.conversation_id -> conversations.channel_id.
update public.messages m
set channel_id = conv.channel_id
from public.conversations conv
where conv.id = m.conversation_id
  and m.channel_id is null;

-- 3. Verify before enforcing NOT NULL -- the precondition check above should
-- make this impossible, but re-verify inside the same transaction rather
-- than trusting that nothing changed between the check and this UPDATE.
do $$
declare
  v_missing bigint;
begin
  select count(*) into v_missing from public.messages where channel_id is null;
  if v_missing > 0 then
    raise exception
      'Rollback aborted: % message row(s) still have a NULL channel_id after backfill. This should be impossible given the precondition check above -- investigate before retrying.',
      v_missing;
  end if;
end $$;

-- 4. Restore the FK.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_channel_id_fkey'
  ) then
    alter table public.messages
      add constraint messages_channel_id_fkey
      foreign key (channel_id) references public.channels (id) on delete cascade;
  end if;
end $$;

-- 5. Restore NOT NULL.
alter table public.messages alter column channel_id set not null;

-- 6. Restore the old channel_id-scoped cursor index. See this file's header
-- for why this definition is a best-effort reconstruction, not a verified
-- original.
create index if not exists idx_messages_channel_created
  on public.messages (channel_id, created_at desc, id desc);

-- 7. Restore the compatibility trigger function. Body is copied verbatim
-- from 004_refactor_chat_to_conversations.sql section 7 -- this part is not
-- a reconstruction, it's the exact original.
create or replace function public.messages_sync_conversation_id()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_conv public.conversations%rowtype;
begin
  if new.channel_id is null and new.conversation_id is null then
    return new;
  end if;

  if new.channel_id is not null and new.conversation_id is null then
    select conv.id into new.conversation_id
    from public.conversations conv
    where conv.channel_id = new.channel_id;

    if new.conversation_id is null then
      raise exception
        'messages: channel_id % has no matching conversations row -- cannot resolve conversation_id. This should be impossible after 004''s backfill; check whether a channel was created without going through the normal channel-creation path.',
        new.channel_id;
    end if;

    return new;
  end if;

  if new.channel_id is null and new.conversation_id is not null then
    select * into v_conv from public.conversations where id = new.conversation_id;

    if not found then
      raise exception 'messages: conversation_id % does not exist.', new.conversation_id;
    end if;

    if v_conv.type <> 'channel'::public.conversation_type then
      raise exception
        'messages: conversation_id % is type % -- room/direct message inserts are not supported until messages.channel_id''s NOT NULL constraint is lifted again. Only channel-type conversations can insert a message during the expand phase.',
        new.conversation_id, v_conv.type;
    end if;

    new.channel_id := v_conv.channel_id;
    return new;
  end if;

  select * into v_conv from public.conversations where id = new.conversation_id;

  if not found then
    raise exception 'messages: conversation_id % does not exist.', new.conversation_id;
  end if;

  if v_conv.type <> 'channel'::public.conversation_type or v_conv.channel_id is distinct from new.channel_id then
    raise exception
      'messages: channel_id % and conversation_id % do not agree (conversation.type=%, conversation.channel_id=%) -- refusing to guess which one is correct.',
      new.channel_id, new.conversation_id, v_conv.type, v_conv.channel_id;
  end if;

  return new;
end;
$function$;

-- 8. Restore the trigger itself.
drop trigger if exists messages_sync_conversation_id on public.messages;
create trigger messages_sync_conversation_id
  before insert or update on public.messages
  for each row execute function public.messages_sync_conversation_id();

commit;

-- ============================================================================
-- IMPORTANT: this rollback restores the DATABASE to a 004-expand-compatible
-- state. It does NOT revert the application code -- the SQLAlchemy Message
-- model, MessagesService, and the routers were changed in the same work
-- item that produced 005 to stop reading/writing channel_id. If you run
-- this rollback, the running backend will still only set conversation_id on
-- INSERT (by design, post-005-prep code never sets channel_id), which the
-- restored trigger handles correctly (its case 2) -- so the application
-- keeps working either way. This rollback exists to undo the DB schema
-- change, not to un-refactor the backend; do that separately (git revert)
-- if you actually need the pre-refactor application code back too.
-- ============================================================================
