-- Soft-delete for `study_rooms`.
--
-- ============================================================================
-- Why
-- ============================================================================
-- Study Rooms currently have no delete concept at all -- no DELETE endpoint,
-- no soft-delete columns. This migration adds one, reusing the exact
-- `deleted_at TIMESTAMPTZ NULL` / `deleted_by UUID NULL` shape already
-- established for `channels` by 009_soft_delete_channels.sql (which itself
-- reused the `forum_posts.deleted_at` convention -- see
-- STUDY_PLATFORM_DATABASE_SPEC.md § 26). `deleted_by` follows the same FK
-- convention already used for every other "who performed this" column in
-- this schema (host_id, moderator_id, created_by, ...): ON DELETE RESTRICT.
--
-- Deliberately separate from room lifecycle: STUDY_PLATFORM_DATABASE_SPEC.md
-- § 17 is explicit that ending a room ("Không nên DELETE room ngay khi kết
-- thúc") must not delete it -- `status = ended` stays normally-readable
-- history. `deleted_at` is an orthogonal, new axis: a deleted room is
-- unavailable through every normal access path (like a deleted Channel),
-- regardless of what `status` it was in when deleted.
--
-- This migration:
--   1. Adds study_rooms.deleted_at / study_rooms.deleted_by.
--   2. Updates can_access_room_conversation() (both the Python mirror in
--      app/core/permissions.py -- can_access_room / can_manage_room /
--      can_join_room, changed in the same commit as this file -- and this
--      SQL function) to deny access outright once deleted_at is set, before
--      any other branch. This is the single existing choke point every SQL
--      read path for room messages/Realtime goes through (via
--      can_access_conversation -> conversations_select / messages_select),
--      exactly mirroring how 009 patched can_access_channel().
--
--      While already touching this function, this migration ALSO closes a
--      pre-existing Python/SQL parity gap rather than preserving it: Python's
--      can_access_room() has always granted the room host implicit access
--      ("if room.host_id == user_id: return True"), unconditionally, even if
--      the host's own study_room_members row is missing or has left_at set --
--      but can_access_room_conversation() has never had an equivalent branch,
--      only the study_room_members-row check. A host whose own membership row
--      was somehow inactive could therefore read their own room's messages
--      via FastAPI but be denied by RLS/Realtime for the exact same room --
--      a real, user-visible disagreement, not just a theoretical one. The
--      fix adds `sr.host_id = auth.uid()` as an unconditional OR branch,
--      mirroring Python's unconditional host check exactly (no group-
--      membership requirement on that branch either, since Python's has
--      none). The pre-existing study_room_members branch (including its
--      is_group_member requirement) is left completely untouched -- this
--      only adds the missing host branch, it does not loosen or restructure
--      the non-host path.
--   3. UNLIKE 009: the base study_rooms / study_room_members /
--      room_moderation_actions RLS policies are NOT captured anywhere in
--      this repo (see 010_preflight.sql's header) -- they predate every
--      tracked migration, so this migration cannot safely DROP+CREATE them
--      without risking silently replacing logic nobody has verified. Instead
--      it adds RESTRICTIVE policies (ANDed with whatever permissive policies
--      already exist, never OR'd/widening) requiring deleted_at IS NULL on
--      the parent room. A restrictive policy is safe to add blind: it can
--      only narrow access below whatever the (unknown) permissive policies
--      already allow, never grant anything new. Real-world enforcement for
--      the app itself is unaffected either way, since FastAPI's postgres-
--      role connection bypasses RLS entirely (see 004's header) -- these
--      policies only harden the direct-Postgres/PostgREST path, same
--      scope as 009's channels_update_manager / channel_members_* changes.
--   4. Closes one gap the same way 009 did for channels: drops ANY
--      authenticated-role physical DELETE policy on study_rooms, by name,
--      discovered dynamically via pg_policies rather than a hardcoded name
--      (010_preflight.sql prints whatever is found beforehand). FastAPI
--      never relies on such a policy (it soft-deletes only -- see
--      StudyRoomsService.soft_delete), so removing it costs the running
--      backend nothing, and it is what would otherwise let an authenticated
--      group manager or host physically DELETE a study_rooms row directly
--      via Supabase, cascade-destroying its conversation/messages/members/
--      moderation history, bypassing FastAPI's soft-delete entirely.
--
-- Deliberately NOT touched: the FK/CASCADE chain from study_rooms ->
-- conversations -> messages / study_room_members / room_moderation_actions
-- (soft-delete only works because this migration, together with the
-- FastAPI-side change in the same commit, stops the app from ever issuing
-- the DELETE that would walk it -- the chain itself is correct and
-- unchanged), and any Storage/attachment object (out of scope; historical
-- attachments stay reachable the same way historical messages do).
--
-- Read docs/db/migrations/010_preflight.sql and its output BEFORE running
-- this -- in particular, review every "CURRENT policy on study_rooms /
-- study_room_members / room_moderation_actions" INFO row it prints. Read
-- docs/db/migrations/010_verify.sql AFTER running this.
--
-- Safety:
--   - Single transaction. Any error aborts the whole thing -- nothing
--     partial is left behind.
--   - No DROP TABLE, no TRUNCATE, no deletion of any row. Every CREATE is
--     idempotent (IF NOT EXISTS for the columns; CREATE OR REPLACE for the
--     function; DROP POLICY IF EXISTS + CREATE POLICY for the new
--     restrictive policies, matching this repo's established policy-change
--     convention -- see 004 § 10/13, 009 § 3/4).
--   - Does not change any column type, drop any existing column/policy this
--     migration did not itself just create, or touch any table/function not
--     listed above.

begin;

-- ============================================================================
-- 1. study_rooms: add deleted_at / deleted_by
-- ============================================================================
alter table public.study_rooms
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete restrict;

-- ============================================================================
-- 2. can_access_room_conversation(): deny outright once deleted; add the
--    missing host branch to match Python's can_access_room()
-- ============================================================================
-- Same signature/shape as the live function (see 004 § 8, body captured
-- verbatim in that migration), with two changes:
--   - `sr.deleted_at is null`, checked first, before the host/member OR.
--   - `sr.host_id = auth.uid()` added as an unconditional OR branch,
--     mirroring can_access_room()'s host check in app/core/permissions.py
--     exactly (unconditional -- no group-membership or study_room_members
--     requirement on this branch, since Python's host check has none
--     either). The pre-existing study_room_members-row branch (including its
--     is_group_member requirement) is untouched -- see header § 2 for why.
create or replace function public.can_access_room_conversation(p_room_id uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.study_rooms sr
    where sr.id = p_room_id
      and sr.deleted_at is null
      and (
        sr.host_id = auth.uid()
        or (
          public.is_group_member(sr.group_id, auth.uid())
          and exists (
            select 1
            from public.study_room_members srm
            where srm.room_id = sr.id
              and srm.user_id = auth.uid()
              and srm.left_at is null
          )
        )
      )
  );
$function$;

-- ============================================================================
-- 3. study_rooms: close the direct-Postgres physical-delete path
-- ============================================================================
-- Name-agnostic: drops every authenticated-role DELETE policy on
-- study_rooms, whatever it is currently called (010_preflight.sql prints
-- what is found before this runs). Mirrors 009's channels_delete_manager
-- removal -- no replacement DELETE policy for `authenticated` is added; only
-- FastAPI's postgres-role connection may ever remove a study_rooms row, and
-- it no longer does (see StudyRoomsService.soft_delete, same commit).
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'study_rooms' and cmd = 'DELETE' and 'authenticated' = any(roles)
  loop
    execute format('drop policy %I on public.study_rooms', pol.policyname);
  end loop;
end $$;

-- ============================================================================
-- 4. RESTRICTIVE deleted_at guards (safe without knowing the existing
--    permissive policy bodies -- see header § 3)
-- ============================================================================
alter table public.study_rooms enable row level security;
alter table public.study_room_members enable row level security;
alter table public.room_moderation_actions enable row level security;

-- study_rooms: a deleted room is neither readable nor updatable by
-- `authenticated`, regardless of whatever permissive SELECT/UPDATE policy
-- already exists. (No restrictive INSERT policy needed: a new row always
-- starts with deleted_at NULL by construction, and FastAPI is the only
-- inserter in practice.)
drop policy if exists study_rooms_hide_deleted on public.study_rooms;
create policy study_rooms_hide_deleted on public.study_rooms
  as restrictive
  for select to authenticated
  using (deleted_at is null);

drop policy if exists study_rooms_block_update_when_deleted on public.study_rooms;
create policy study_rooms_block_update_when_deleted on public.study_rooms
  as restrictive
  for update to authenticated
  using (deleted_at is null);

-- study_room_members: join/leave/role-change/kick against a deleted room's
-- membership table is blocked for `authenticated`, regardless of whatever
-- permissive policies already exist. Deliberately no self-action carve-out
-- (unlike 009's channel_members_delete, where leaving = a DELETE the
-- migration author had confirmed live and could reason about precisely) --
-- study_room_members "leave" is an UPDATE (left_at = now()), and the current
-- live policy shape for that path is not captured in this repo (see
-- 010_preflight.sql). Blocking it uniformly on a deleted room is the
-- conservative choice: it cannot widen access, and matches the product
-- framing that a deleted room is unavailable for normal operations for
-- everyone, including removing your own membership row from it via direct
-- Postgres -- consistent with the real, tested self-leave path
-- (POST /study-rooms/{id}/leave), which now also 404s on a deleted room
-- (see study_room_router.leave_room / _get_active_room_or_404).
drop policy if exists study_room_members_block_when_room_deleted on public.study_room_members;
create policy study_room_members_block_when_room_deleted on public.study_room_members
  as restrictive
  for all to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_members.room_id and sr.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_members.room_id and sr.deleted_at is null
    )
  );

-- room_moderation_actions: logging/reading moderation actions (mute/kick/
-- raise_hand/...) against a deleted room is blocked for `authenticated`,
-- regardless of whatever permissive policies already exist (e.g.
-- room_moderation_select, fixed by 007). Historical rows are never removed
-- by this policy -- RESTRICTIVE only gates new visibility/writes going
-- forward, exactly like the study_room_members policy above.
drop policy if exists room_moderation_actions_block_when_room_deleted on public.room_moderation_actions;
create policy room_moderation_actions_block_when_room_deleted on public.room_moderation_actions
  as restrictive
  for all to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = room_moderation_actions.room_id and sr.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = room_moderation_actions.room_id and sr.deleted_at is null
    )
  );

commit;

-- ============================================================================
-- After this migration:
--   - study_rooms has deleted_at (timestamptz, null = not deleted) and
--     deleted_by (uuid, FK -> profiles.id ON DELETE RESTRICT, null = not
--     deleted). Every existing row has both NULL -- no existing room is
--     retroactively marked deleted.
--   - can_access_room_conversation(room_id) returns false for any room with
--     deleted_at set, for every caller, including the host. conversations_select
--     and messages_select (and Realtime, which evaluates messages_select) all
--     deny access to a deleted room's conversation and messages for
--     ROOM-type conversations, purely because they route through this
--     function via can_access_conversation().
--   - For a non-deleted room, can_access_room_conversation(room_id) now also
--     returns true for the room's host unconditionally (matching
--     can_access_room() in app/core/permissions.py), even if the host has no
--     study_room_members row or has left_at set on it. Ordinary members are
--     unaffected -- the pre-existing group-membership + active-membership-row
--     requirement for non-hosts is untouched.
--   - No `authenticated` role can physically DELETE a study_rooms row
--     anymore. Only FastAPI's postgres-role connection can write to
--     study_rooms at all going forward, and it only ever soft-deletes.
--   - A deleted room's row, its own study_room_members rows, and its
--     room_moderation_actions rows all become unreadable/unwritable by
--     `authenticated` via direct Postgres, on top of (not instead of) the
--     equivalent guards added to app/core/permissions.py in the same
--     commit, which are what actually gate the running FastAPI backend.
-- ============================================================================
