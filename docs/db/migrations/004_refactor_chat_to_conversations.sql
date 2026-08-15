-- Refactor chat storage from a Channel-only model to a polymorphic
-- Conversation abstraction, so the same `messages` table can (eventually)
-- back channel chat, study-room chat, and 1-1 direct messages.
--
-- ============================================================================
-- EXPAND/CONTRACT: this is the EXPAND phase only.
-- ============================================================================
-- 004 adds the new schema (conversations, conversation_members,
-- messages.conversation_id) ALONGSIDE the existing one and keeps
-- `messages.channel_id`, its FK, and its index fully intact. It does NOT
-- drop anything from the pre-existing schema. This is deliberate: the
-- current backend (SQLAlchemy models, MessagesService) still reads and
-- writes `messages.channel_id` exclusively and has not been refactored yet.
-- If 004 dropped channel_id, the running backend would break the moment
-- this migration commits.
--
-- Because `messages.conversation_id` is NOT NULL by the end of this
-- migration while `messages.channel_id` is ALSO still NOT NULL, a BEFORE
-- INSERT/UPDATE trigger (`messages_sync_conversation_id`, section 7 below)
-- keeps the two columns in sync for both the old backend (sets channel_id
-- only) and the eventual refactored one (sets conversation_id only, for
-- channel-type conversations -- room/direct inserts are explicitly refused
-- until 005). It also rejects the case where both are set but disagree,
-- rather than silently trusting one of them. See section 7's own comment
-- for the full 4-case breakdown.
--
-- A separate migration, 005 (not part of this file, not written yet), will
-- do the CONTRACT phase once the backend has been refactored to write
-- conversation_id directly and that refactor has been tested:
--   - drop the messages_sync_conversation_id trigger + function (no longer
--     needed once nothing inserts via channel_id alone)
--   - drop messages_channel_id_fkey
--   - drop idx_messages_channel_created
--   - drop messages.channel_id
--
-- See the final report / commit message for the exact `messages` column
-- list expected right after 004 vs. after 005.
--
-- Scope of this migration, otherwise unchanged from the original design:
--   - Adds `conversations` (type: channel | room | direct) and
--     `conversation_members` (used by `direct` conversations only, for now).
--   - Backfills exactly one `channel`-type conversation per existing row in
--     `channels`, and exactly one `room`-type conversation per existing row
--     in `study_rooms`.
--   - Backfills `messages.conversation_id` for all existing rows.
--   - Redesigns RLS around a new `can_access_conversation()` function.
--   - Does NOT touch: SQLAlchemy models, MessageService, any FastAPI route,
--     the frontend Realtime filter, or Storage.
--
-- Read docs/db/migrations/004_preflight.sql and its output BEFORE running
-- this. Read docs/db/migrations/004_verify.sql AFTER running this.
--
-- Safety:
--   - Single transaction. Any RAISE EXCEPTION aborts the whole thing --
--     nothing partial is left behind.
--   - No DROP TABLE, no TRUNCATE, no deletion of any row, and (per the
--     expand/contract note above) no DROP of any pre-existing column,
--     constraint, or index either. Everything this migration removes is
--     something it also creates in this same file (old RLS policies on
--     `messages`, replaced by new ones in section 12) -- nothing
--     pre-existing is deleted without a same-migration replacement.
--   - Every CREATE is idempotent (IF NOT EXISTS, or an explicit existence
--     check for the constraint/enum/policy/trigger forms that don't support
--     IF NOT EXISTS in Postgres).
--   - No GRANT/REVOKE statements. This project's `public` schema has default
--     ACLs (verified live via pg_default_acl) that automatically grant full
--     table privileges and EXECUTE to anon/authenticated/service_role/postgres
--     on every new object -- identical to every existing table/function.
--     Nothing needs to be granted by hand, and nothing existing is revoked.
--   - Frontend write access to `messages` is intentionally tightened: the
--     live `messages_insert` / `messages_update_own` /
--     `messages_delete_own_or_manager` policies (verified live, currently
--     letting `authenticated` write directly to Supabase) are dropped and
--     NOT recreated on the new conversation_id-based table. Only a SELECT
--     policy is recreated. This matches the documented architecture
--     (docs/chat-integration.md: "Never insert directly into Supabase from
--     the frontend") and closes a live gap between that doc and reality.
--     FastAPI is unaffected -- it connects as the `postgres` role, which
--     bypasses RLS entirely (see 001's header comment), so it never went
--     through these policies to begin with. This part of the design is
--     unchanged from the original review of this migration.
--   - The three new SECURITY DEFINER permission functions
--     (can_access_room_conversation, is_conversation_member,
--     can_access_conversation) take ONLY a resource id and read auth.uid()
--     internally -- unlike the pre-existing can_access_channel /
--     is_group_member / is_group_manager, they do NOT accept an arbitrary
--     p_user_id parameter. Postgres/PostgREST expose any function with
--     EXECUTE granted to `authenticated` as a callable RPC; a function that
--     let the caller pass someone else's user id would let any logged-in
--     user probe "can user X access conversation Y" for an arbitrary X --
--     an access/membership oracle, most sensitive for `direct` conversations
--     where that would leak who is in a DM with whom. Hard-coding auth.uid()
--     closes that off. The pre-existing 3 functions keep their original
--     signature -- changing them is a separate, out-of-scope concern (see
--     the report).
--
-- Expect a brief lock on `messages` / `channels` while this runs (ALTER
-- TABLE takes ACCESS EXCLUSIVE). Data volume at the time this was written
-- (160 messages, 16 channels, 8 study rooms) means this should complete in
-- well under a second, but avoid running it during concurrent write traffic.

begin;

-- ============================================================================
-- 1. conversation_type enum
-- ============================================================================
-- Values restricted to this migration's scope per spec: channel, room,
-- direct. `group_direct` (multi-person DM) is deliberately NOT added here --
-- out of scope for this phase, add it in a later migration when that feature
-- is actually built (ALTER TYPE ... ADD VALUE).
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'conversation_type'
  ) then
    create type public.conversation_type as enum ('channel', 'room', 'direct');
  end if;
end $$;

-- ============================================================================
-- 2. conversations table
-- ============================================================================
-- ON DELETE choices follow the existing convention in this schema:
--   - channel_id / room_id -> CASCADE, matching how messages.channel_id
--     already cascades from channels today, and how study_room_members /
--     room_moderation_actions already cascade from study_rooms. Deleting a
--     channel or room should take its conversation (and thus its messages)
--     with it -- there is no "orphaned conversation" state.
--   - created_by -> RESTRICT, matching channels.created_by,
--     study_rooms.host_id and messages.sender_id, all of which are RESTRICT
--     in this schema. A profile can't be deleted while it authored a
--     conversation record, same as it can't be deleted while it authored a
--     channel or a message.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  channel_id uuid references public.channels (id) on delete cascade,
  room_id uuid references public.study_rooms (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Polymorphic integrity: exactly one of (channel_id, room_id) is set, and
-- only for the matching `type`. `direct` conversations have neither --
-- their identity comes entirely from conversation_members.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and conname = 'conversations_type_target_check'
  ) then
    alter table public.conversations
      add constraint conversations_type_target_check check (
        (type = 'channel'::public.conversation_type and channel_id is not null and room_id is null)
        or (type = 'room'::public.conversation_type and room_id is not null and channel_id is null)
        or (type = 'direct'::public.conversation_type and channel_id is null and room_id is null)
      );
  end if;
end $$;

-- One conversation per channel, one per room. Without these, the backfill
-- below (or a future application bug) could create duplicate conversations
-- for the same channel/room, which would split a channel's message history
-- across two conversation_ids.
create unique index if not exists conversations_channel_id_key
  on public.conversations (channel_id) where channel_id is not null;

create unique index if not exists conversations_room_id_key
  on public.conversations (room_id) where room_id is not null;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. conversation_members table
-- ============================================================================
-- Phase-1 scope: used only for `type = 'direct'` conversations. Channel and
-- room membership continue to come from channel_members / study_room_members
-- (see can_access_conversation() below) -- deliberately NOT duplicated here.
-- No `left_at`: not part of the spec for this phase (direct conversations
-- have no "leave" concept yet), so it is not added speculatively.
create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  constraint conversation_members_conversation_id_user_id_key unique (conversation_id, user_id)
);

create index if not exists idx_conversation_members_conversation
  on public.conversation_members (conversation_id);

create index if not exists idx_conversation_members_user
  on public.conversation_members (user_id);

-- ============================================================================
-- 4. Backfill: one `channel`-type conversation per existing channel
-- ============================================================================
-- Idempotent via NOT EXISTS -- safe if this block is ever re-run.
insert into public.conversations (type, channel_id, created_by, created_at, updated_at)
select 'channel'::public.conversation_type, c.id, c.created_by, c.created_at, c.updated_at
from public.channels c
where not exists (
  select 1 from public.conversations conv where conv.channel_id = c.id
);

-- ============================================================================
-- 5. Backfill: one `room`-type conversation per existing study room
-- ============================================================================
-- study_rooms has no updated_at column (verified live) -- created_at is used
-- for both. No messages exist for rooms yet; this only prepares the
-- architecture per the spec (room chat API is a later phase).
insert into public.conversations (type, room_id, created_by, created_at, updated_at)
select 'room'::public.conversation_type, sr.id, sr.host_id, sr.created_at, sr.created_at
from public.study_rooms sr
where not exists (
  select 1 from public.conversations conv where conv.room_id = sr.id
);

-- ============================================================================
-- 6. messages: add conversation_id (nullable first), backfill, enforce
-- ============================================================================
alter table public.messages add column if not exists conversation_id uuid;

-- Backfill: messages.channel_id -> conversations.channel_id -> conversations.id
update public.messages m
set conversation_id = conv.id
from public.conversations conv
where conv.channel_id = m.channel_id
  and m.conversation_id is null;

-- Verify before doing anything destructive. Do NOT silently drop or ignore
-- unmapped rows -- abort the whole transaction instead.
do $$
declare
  v_missing bigint;
begin
  select count(*) into v_missing from public.messages where conversation_id is null;
  if v_missing > 0 then
    raise exception
      'Migration aborted: % message row(s) have no matching conversation (conversation_id is still NULL after backfill). This means some messages.channel_id values do not resolve to a channel-conversation created in step 4 -- check for orphaned messages (see 004_preflight.sql check 2) before retrying.',
      v_missing;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_conversation_id_fkey'
  ) then
    alter table public.messages
      add constraint messages_conversation_id_fkey
      foreign key (conversation_id) references public.conversations (id) on delete cascade;
  end if;
end $$;

alter table public.messages alter column conversation_id set not null;

-- ============================================================================
-- 7. Compatibility trigger: keep channel_id and conversation_id in sync
-- ============================================================================
-- Why this exists: messages.conversation_id is NOT NULL as of section 6, but
-- the current (not yet refactored) MessagesService only ever sets
-- channel_id on INSERT -- it has no idea conversation_id exists. Without
-- this trigger, every message insert from the live backend would start
-- failing the moment this migration commits. Symmetrically, once the
-- backend IS refactored (still ahead of us -- not in this migration) it
-- will start setting conversation_id and stop setting channel_id, but
-- channel_id is still NOT NULL in this expand phase, so that path needs
-- covering too. The trigger handles all four combinations of
-- (channel_id, conversation_id) nullability on the incoming row:
--
--   1. channel_id set, conversation_id NULL (today's backend, unmodified)
--      -> resolve conversation_id from channel_id.
--   2. conversation_id set, channel_id NULL (the refactored backend,
--      channel-type conversations only -- see below)
--      -> resolve channel_id from the conversation, but ONLY if the
--         conversation is type='channel'. Room/direct conversations have no
--         channel_id to fall back to, and messages.channel_id is still NOT
--         NULL in this expand phase -- a room/direct message insert is
--         expected to fail here with a clear, specific error rather than a
--         generic not-null-constraint violation. Migration 005 (not written
--         yet) is what actually lifts this restriction, by finally dropping
--         messages.channel_id's NOT NULL requirement (and the column
--         itself).
--   3. both set -- don't silently trust either one. Verify the conversation
--      is type='channel' AND its channel_id equals the row's channel_id.
--      RAISE EXCEPTION on any mismatch instead of picking a winner.
--   4. both NULL -- do nothing here and let the pre-existing NOT NULL
--      constraint on channel_id (and the one added on conversation_id in
--      section 6) reject the row on their own. Nothing to resolve when
--      there is no information to resolve it from.
--
-- This does NOT try to re-resolve anything if an UPDATE changes one of the
-- two columns on an existing row to a *different but still non-null* value
-- without updating the other -- that case is caught by branch 3 above
-- (mismatch -> reject), not silently "fixed", since messages are never
-- moved between channels in this application and a mismatch there almost
-- certainly means a bug in whatever wrote the row.
--
-- Not SECURITY DEFINER: the only writer that matters here is FastAPI, which
-- already connects as the `postgres` role (full access, bypasses RLS) --
-- there is nothing to escalate. Keeping it as a plain, invoker-rights
-- function is simpler and has less privileged surface than it needs to be
-- for what it does.
create or replace function public.messages_sync_conversation_id()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_conv public.conversations%rowtype;
begin
  -- Case 4: nothing to resolve from -- let NOT NULL constraints reject it.
  if new.channel_id is null and new.conversation_id is null then
    return new;
  end if;

  -- Case 1: old-backend insert -- channel_id given, resolve conversation_id.
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

  -- Case 2: refactored-backend insert -- conversation_id given, channel_id
  -- missing. Only channel-type conversations can resolve a channel_id;
  -- room/direct are refused (see header) since messages.channel_id is
  -- still NOT NULL in this expand phase.
  if new.channel_id is null and new.conversation_id is not null then
    select * into v_conv from public.conversations where id = new.conversation_id;

    if not found then
      raise exception 'messages: conversation_id % does not exist.', new.conversation_id;
    end if;

    if v_conv.type <> 'channel'::public.conversation_type then
      raise exception
        'messages: conversation_id % is type % -- room/direct message inserts are not supported until migration 005 removes messages.channel_id''s NOT NULL constraint. Only channel-type conversations can insert a message during the expand phase.',
        new.conversation_id, v_conv.type;
    end if;

    new.channel_id := v_conv.channel_id;
    return new;
  end if;

  -- Case 3: both given -- verify consistency instead of trusting either one.
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

drop trigger if exists messages_sync_conversation_id on public.messages;
create trigger messages_sync_conversation_id
  before insert or update on public.messages
  for each row execute function public.messages_sync_conversation_id();

-- ============================================================================
-- 8. Close the known can_access_channel() gap
-- ============================================================================
-- Verified live: this fix (originally prepared in
-- 002_fix_can_access_channel_active_membership.sql) has NOT been applied to
-- this project yet -- the live function still lets a banned/left group
-- member with a stale channel_members row read a private channel. Reapplied
-- here (identical body to 002, idempotent CREATE OR REPLACE) because
-- can_access_conversation() below delegates to this function for
-- `type = 'channel'` conversations, and the spec for this migration
-- explicitly requires that gap to be closed. Running 002 separately is now
-- redundant but harmless (same body). Signature intentionally unchanged
-- (still accepts p_user_id) -- see the header note on why the 3 new
-- functions below do NOT follow this pattern; changing this pre-existing
-- function's signature is out of scope here.
create or replace function public.can_access_channel(p_channel_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.channels c
    where c.id = p_channel_id
      and public.is_group_member(c.group_id, p_user_id)
      and (
        c.is_private = false
        or public.is_group_manager(c.group_id, p_user_id)
        or exists (
          select 1
          from public.channel_members cm
          where cm.channel_id = c.id
            and cm.user_id = p_user_id
        )
      )
  );
$function$;

-- ============================================================================
-- 9. New permission helper functions
-- ============================================================================
-- Two departures from the pre-existing convention (can_access_channel /
-- is_group_member / is_group_manager), both intentional:
--
--   1. `SET search_path = ''` instead of `SET search_path TO 'public'`.
--      Every non-builtin identifier (tables, the conversation_type enum)
--      must be schema-qualified or name resolution fails outright, rather
--      than silently falling back to whatever happens to be first on the
--      caller's search_path. Stricter defense-in-depth for newly-written
--      SECURITY DEFINER functions.
--
--   2. No `p_user_id` parameter -- these take ONLY a resource id and read
--      auth.uid() internally. See the migration header for why: exposing a
--      caller-controlled target-user parameter on a SECURITY DEFINER
--      permission check, reachable as a PostgREST RPC by any authenticated
--      client, turns it into a membership oracle for arbitrary other users.
--      There is no current caller (FastAPI included -- it bypasses RLS via
--      the postgres role and never calls these) that needs to check access
--      on behalf of someone other than the requester, so no
--      internal/private arbitrary-user variant is introduced either --
--      add one later, explicitly not exposed to anon/authenticated, only if
--      a real caller needs it.
--
-- Neither change touches the 3 pre-existing functions from section 8, which
-- keep their original convention and signature untouched.

-- Room-chat access: active group member AND a non-left study_room_members
-- row. Deliberately stricter than study_rooms_select's RLS policy (which
-- only requires group membership) -- a group member who was never in, or
-- was kicked from, a room's `study_room_members` must not read/subscribe to
-- that room's conversation.
create or replace function public.can_access_room_conversation(p_room_id uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.study_rooms sr
    join public.study_room_members srm
      on srm.room_id = sr.id
     and srm.user_id = auth.uid()
     and srm.left_at is null
    where sr.id = p_room_id
      and public.is_group_member(sr.group_id, auth.uid())
  );
$function$;

-- Direct-conversation membership check, split into its own SECURITY DEFINER
-- function (rather than inlined in the conversation_members RLS policy)
-- for the same reason can_access_channel/is_group_member are functions in
-- this project: a policy on conversation_members that queried
-- conversation_members directly in its own USING clause would work, but
-- routing it through a SECURITY DEFINER function keeps the permission logic
-- in one auditable place and matches this project's established pattern.
create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  );
$function$;

-- Single entry point RLS (and future application code) can call regardless
-- of conversation type. Dispatches on conversations.type to the appropriate
-- existing (channel) or new (room, direct) check. Passes auth.uid()
-- explicitly to can_access_channel() -- that pre-existing function still
-- accepts p_user_id, but this call site never forwards a caller-supplied
-- value into it, only the requester's own id.
create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.conversations conv
    where conv.id = p_conversation_id
      and (
        (conv.type = 'channel'::public.conversation_type and public.can_access_channel(conv.channel_id, auth.uid()))
        or (conv.type = 'room'::public.conversation_type and public.can_access_room_conversation(conv.room_id))
        or (conv.type = 'direct'::public.conversation_type and public.is_conversation_member(conv.id))
      )
  );
$function$;

-- ============================================================================
-- 10. Drop old channel_id-based WRITE/SELECT policies on messages
-- ============================================================================
-- Not a schema-drop, a policy-drop -- unrelated to the expand/contract
-- concern above (RLS policies aren't part of "the old schema" the running
-- backend depends on; FastAPI bypasses RLS entirely). Recreated against
-- conversation_id in section 12 -- SELECT only, see the header comment on
-- why INSERT/UPDATE/DELETE are not recreated for `authenticated`.
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_update_own on public.messages;
drop policy if exists messages_delete_own_or_manager on public.messages;

-- ============================================================================
-- 11. New message index for cursor pagination
-- ============================================================================
-- Matches the app's existing keyset pagination shape (created_at, id) --
-- see docs/chat-integration.md's next_cursor description and
-- MessagesService.list_by_channel -- just scoped to conversation_id instead
-- of channel_id. Added ALONGSIDE the pre-existing idx_messages_channel_created
-- (kept, per the expand/contract note -- dropped only in 005).
create index if not exists idx_messages_conversation_created
  on public.messages (conversation_id, created_at desc, id desc);

-- ============================================================================
-- 12. attachment_path uniqueness
-- ============================================================================
-- Checked live: zero duplicates today. Guard kept anyway so this migration
-- fails loudly (and rolls back everything above) instead of silently
-- skipping the constraint if that ever changes before this is run.
do $$
declare
  v_dupe_count bigint;
begin
  select count(*) into v_dupe_count
  from (
    select attachment_path
    from public.messages
    where attachment_path is not null
    group by attachment_path
    having count(*) > 1
  ) d;

  if v_dupe_count > 0 then
    raise exception
      'Migration aborted: % distinct attachment_path value(s) are referenced by more than one message. Deleting a message also deletes its Storage object (see app/attachments/services/attachment_service.py) -- two messages sharing one path would mean deleting either one destroys the file out from under the other. Resolve the duplicates manually (do not let this migration delete data) before re-running.',
      v_dupe_count;
  end if;
end $$;

create unique index if not exists messages_attachment_path_key
  on public.messages (attachment_path) where attachment_path is not null;

-- ============================================================================
-- 13. RLS: enable on the new tables, add policies
-- ============================================================================
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security; -- already enabled live; idempotent no-op

-- conversations: readable only if the caller can access it by its
-- underlying type-specific rule. No INSERT/UPDATE/DELETE policy for
-- `authenticated` -- conversations are created/managed by FastAPI (postgres
-- role, bypasses RLS), never directly by the frontend.
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (public.can_access_conversation(id));

-- conversation_members: a member can see the member list of any
-- conversation they themselves belong to (needed to render "who is in this
-- DM"), but not the membership of a direct conversation they are not part
-- of. No write policy for `authenticated`, same reasoning as conversations.
drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select on public.conversation_members
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- messages: SELECT only. See header comment -- this intentionally does not
-- recreate the live messages_insert/messages_update_own/
-- messages_delete_own_or_manager policies. FastAPI remains the sole writer.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (public.can_access_conversation(conversation_id));

-- ============================================================================
-- 14. Realtime
-- ============================================================================
-- No action. `public.messages` is already in the supabase_realtime
-- publication (verified live) and this migration does not remove it. Only
-- `messages` needs to be there -- conversations/conversation_members are
-- read via REST/RLS, not subscribed to directly. The frontend's Realtime
-- filter changes from `channel_id=eq.<channel_id>` to
-- `conversation_id=eq.<conversation_id>` in a later (frontend) phase, not
-- here.

commit;

-- ============================================================================
-- Final `messages` schema right after this migration (expand phase done):
--   id, channel_id (NOT NULL, FK+index kept), sender_id, content,
--   attachment_path, created_at, updated_at, conversation_id (NOT NULL,
--   FK+index added). Both channel_id and conversation_id are present and
--   populated for every row; messages_sync_conversation_id keeps them in
--   sync for any INSERT/UPDATE that only supplies one of the two (either
--   direction), and rejects both a mismatch between them and any
--   room/direct message insert (channel_id has no NOT NULL exemption yet).
--
-- What 005 (contract phase, separate file, written once the backend refactor
-- lands and is tested) removes: messages_sync_conversation_id (trigger +
-- function), messages_channel_id_fkey, idx_messages_channel_created,
-- messages.channel_id. Nothing else from this migration is expected to
-- change in 005.
-- ============================================================================
