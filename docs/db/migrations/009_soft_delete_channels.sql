-- Soft-delete for `channels`.
--
-- ============================================================================
-- Why
-- ============================================================================
-- DELETE /channels/{id} currently performs a HARD delete (ChannelsService.delete
-- -> session.delete(channel)). Because conversations.channel_id and
-- messages.conversation_id both cascade (ON DELETE CASCADE), deleting a channel
-- today also destroys its conversation and every historical message in it.
-- That is the opposite of the required behavior: a "deleted" Channel must
-- become inaccessible through every normal access path while its row,
-- Conversation, and Messages all remain in the database.
--
-- This migration:
--   1. Adds channels.deleted_at / channels.deleted_by (soft-delete marker +
--      audit trail of who deleted it), reusing the exact `deleted_at
--      TIMESTAMPTZ NULL` shape already established by forum_posts (see
--      STUDY_PLATFORM_DATABASE_SPEC.md § 26) -- the only existing soft-delete
--      convention in this schema. `deleted_by` is new (forum_posts has no
--      equivalent) but follows the same FK convention already used for every
--      other "who performed this" column in this schema (created_by, host_id,
--      moderator_id, sender_id, author_id): ON DELETE RESTRICT.
--   2. Updates can_access_channel() (both the Python mirror in
--      app/core/permissions.py, changed in the same commit as this file, and
--      this SQL function) to deny access outright once deleted_at is set --
--      before any membership/manager/private-channel branch. Every other RLS
--      policy that reads channels (channels_select, channel_members_select)
--      and every function that dispatches through can_access_channel
--      (can_access_conversation, and therefore conversations_select /
--      messages_select) inherits this for free, since they all call this one
--      function -- no need to touch them individually.
--   3. Closes two gaps found live (via pg_policies, read-only) while
--      preparing this migration, both of which let an authenticated group
--      manager bypass FastAPI's business logic entirely via direct
--      Postgres/PostgREST access:
--        - channels_delete_manager currently allows a physical DELETE on
--          `channels` for any group owner/moderator. FastAPI never relies on
--          this (it connects as the `postgres` role and bypasses RLS
--          entirely -- see 004's header), so dropping it costs the running
--          backend nothing, and it is the only thing standing between "this
--          migration's soft-delete guarantee" and "any group manager can
--          still permanently destroy channel history by calling Supabase
--          directly". No replacement policy: this matches the precedent
--          already set for `messages` (004 § 10 -- SELECT only for
--          `authenticated`, FastAPI is the sole writer).
--        - channels_update_manager's USING clause did not check deleted_at,
--          so a manager could UPDATE (edit, or even reset deleted_at back to
--          NULL -- an uncontrolled "undelete") an already-deleted channel
--          directly via Postgres, bypassing the "cannot update a deleted
--          channel" rule FastAPI now enforces. Adding `deleted_at is null` to
--          USING makes an already-deleted row simply not matched by this
--          policy at all, closing both the edit and the undelete path in one
--          change.
--   4. Gates the manager (not self-leave) branches of channel_members_insert
--      / channel_members_delete on the channel's deleted_at, so "manage
--      membership" (add a member / remove someone else) on a deleted channel
--      is denied at the RLS layer too, not only in FastAPI. Self-leave
--      (user_id = auth.uid()) is intentionally left untouched: removing your
--      own historical membership marker from a channel that is already gone
--      grants no access to anything and is not a "manage membership" action.
--
-- Deliberately NOT touched: channels_insert_manager (new rows always start
-- with deleted_at NULL by construction; nothing to gate), the FK/CASCADE
-- chain from channels -> conversations -> messages (soft-delete only works
-- because this migration stops the app from ever issuing the DELETE that
-- would walk it -- the chain itself is correct and unchanged), and any
-- Storage/attachment object (out of scope; historical attachments stay
-- reachable the same way historical messages do).
--
-- Read docs/db/migrations/009_preflight.sql and its output BEFORE running
-- this. Read docs/db/migrations/009_verify.sql AFTER running this.
--
-- Safety:
--   - Single transaction. Any error aborts the whole thing -- nothing
--     partial is left behind.
--   - No DROP TABLE, no TRUNCATE, no deletion of any row. Every CREATE is
--     idempotent (IF NOT EXISTS for the columns; CREATE OR REPLACE for the
--     function; DROP POLICY IF EXISTS + CREATE POLICY for the four policies
--     touched, matching this repo's established policy-change convention --
--     see 004 § 10/13).
--   - Does not change any column type, drop any existing column, or touch
--     any table/policy/function not listed above.

begin;

-- ============================================================================
-- 1. channels: add deleted_at / deleted_by
-- ============================================================================
alter table public.channels
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete restrict;

-- ============================================================================
-- 2. can_access_channel(): deny outright once deleted
-- ============================================================================
-- Identical signature/shape to the live function (see 002 / 004 § 8) -- only
-- addition is the `c.deleted_at is null` guard, checked before every other
-- branch, mirroring the Python-side change to app/core/permissions.py in the
-- same commit (can_access_channel there gains the same check as its first
-- line). This is the single choke point every read path (channels_select,
-- channel_members_select, and via can_access_conversation:
-- conversations_select / messages_select / Realtime) goes through.
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
      and c.deleted_at is null
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
-- 3. channels: close the direct-Postgres physical-delete and undelete/edit gaps
-- ============================================================================

-- No physical DELETE for `authenticated` at all -- FastAPI (postgres role,
-- bypasses RLS) is the sole path that may ever remove a channels row, and it
-- no longer does (see ChannelsService.soft_delete, same commit). Matches the
-- messages precedent (004 § 10): no INSERT/UPDATE/DELETE policy is a valid,
-- intentional "this table is not writable this way" state, not an oversight.
drop policy if exists channels_delete_manager on public.channels;

-- Adds `deleted_at is null` to USING: an already-deleted row is no longer
-- matched by this policy at all, so a manager cannot UPDATE (edit any field,
-- or reset deleted_at back to NULL) a deleted channel via direct Postgres.
-- WITH CHECK is unchanged -- it only needs to keep validating the resulting
-- row still belongs to a group the caller manages; the "was this row deleted
-- before the update" question is USING's job, not WITH CHECK's.
drop policy if exists channels_update_manager on public.channels;
create policy channels_update_manager on public.channels
  for update to authenticated
  using (is_group_manager(group_id) and deleted_at is null)
  with check (is_group_manager(group_id));

-- ============================================================================
-- 4. channel_members: manager-driven membership management also requires a
--    non-deleted channel (self-leave is left untouched -- see header)
-- ============================================================================
drop policy if exists channel_members_insert on public.channel_members;
create policy channel_members_insert on public.channel_members
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.channels c
      where c.id = channel_members.channel_id
        and c.deleted_at is null
        and is_group_manager(c.group_id)
    )
  );

drop policy if exists channel_members_delete on public.channel_members;
create policy channel_members_delete on public.channel_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.channels c
      where c.id = channel_members.channel_id
        and c.deleted_at is null
        and is_group_manager(c.group_id)
    )
  );

commit;

-- ============================================================================
-- After this migration:
--   - channels has deleted_at (timestamptz, null = not deleted) and
--     deleted_by (uuid, FK -> profiles.id ON DELETE RESTRICT, null = not
--     deleted). Every existing row has both NULL -- no existing channel is
--     retroactively marked deleted.
--   - can_access_channel(channel_id) returns false for any channel with
--     deleted_at set, for every caller, before any other check runs.
--   - channels_select / channel_members_select / conversations_select /
--     messages_select (and Realtime, which evaluates messages_select) all
--     deny access to a deleted channel's conversation and messages, purely
--     because they all route through can_access_channel().
--   - No `authenticated` role can physically DELETE a channels row anymore
--     (channels_delete_manager is gone). Only FastAPI's postgres-role
--     connection can write to channels at all going forward, and it only
--     ever soft-deletes (sets deleted_at/deleted_by), never deletes the row.
--   - A group manager can no longer UPDATE, or add/remove members on, an
--     already-deleted channel via direct Postgres access -- only via
--     FastAPI, which independently enforces the same rule (see
--     channel_router.py, same commit).
-- ============================================================================
