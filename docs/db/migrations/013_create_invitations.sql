-- Unified invitation system for Group / Study Room / Private Channel.
--
-- ============================================================================
-- Why
-- ============================================================================
-- Invite UX today is entirely fake on the frontend (a button that fires
-- alert('Đã sao chép liên kết mời tham gia nhóm học!') with no clipboard
-- write, no URL, no backend call -- see StudyGroupDetail.tsx). `groups.
-- invite_code` exists but nothing reads or validates it. This migration adds
-- the backend-authoritative invitation model the new /invitations API
-- (app/invitations/) is built on.
--
-- This migration:
--   1. Creates `invitation_method` ('email'|'code') and `invitation_status`
--      ('pending'|'accepted'|'declined'|'expired'|'revoked') enums.
--   2. Creates `invitations`: exactly one of group_id/room_id/channel_id is
--      set (CHECK), FKs cascade with their target (an invitation for a
--      deleted target is meaningless). `secret_hash` is the ONLY persisted
--      form of the plaintext token (EMAIL) or code (CODE) -- the plaintext
--      is returned exactly once, at creation (see InvitationsService.create),
--      and is not recoverable from the database afterward. `expired` is
--      never written by a background job -- it's a derived read-time state
--      (status='pending' AND expires_at < now()); redemption's atomic
--      UPDATE (status='pending' AND expires_at > now()) rejects it
--      naturally. No separate "used" flag: single-use is enforced by status
--      leaving 'pending' on first successful redemption.
--   3. Extends `notifications` with a nullable `invitation_id` FK (the
--      notification references the invitation rather than duplicating its
--      target/status -- Accept/Decline in the UI call the invitation
--      redemption endpoints, never write membership directly) and adds two
--      new `notification_type` values: 'study_room_invitation',
--      'private_channel_invitation'. The existing (previously unused)
--      'group_invite' value is reused for Group invitations rather than
--      adding a third new value for it.
--   4. Enables RLS on `invitations` with a single SELECT-own policy
--      (creator, or the authenticated caller's own JWT email matching
--      recipient_email) and no write policy for `authenticated` -- FastAPI
--      (the `postgres` role, bypasses RLS -- see 004's header) is the sole
--      writer, same precedent as `messages`/`channels`.
--   5. `notifications` already has RLS enabled live with three existing
--      policies never captured in any migration FILE in this repo before
--      now (same "discovered live, never tracked" situation as 010's
--      study_rooms policies) -- confirmed via 013_preflight.sql (2026-08-18,
--      135 rows): notifications_select_own (SELECT), notifications_
--      update_own (UPDATE), notifications_delete_own (DELETE). This
--      migration keeps the SELECT-own policy (idempotent drop-if-exists +
--      recreate, same "user_id = auth.uid()" semantics) and explicitly
--      DROPS the UPDATE and DELETE policies, so that -- like messages/
--      channels/invitations -- FastAPI (postgres role, bypasses RLS) becomes
--      the sole writer for notifications too. This matches
--      notification_router.py's own redesign in the same commit (no public
--      POST endpoint at all; GET/PUT/DELETE now scoped to current_user.id)
--      and removes a second, previously-undocumented authorization surface
--      that let an authenticated user mutate their own notifications
--      directly via PostgREST/Supabase client, bypassing FastAPI's owner
--      check entirely. Nothing in this repo's frontend or backend was found
--      to depend on that direct-write path (see docs/invitations.md).
--
-- Read docs/db/migrations/013_preflight.sql and its output BEFORE running
-- this. Read docs/db/migrations/013_verify.sql AFTER running this.
--
-- Safety:
--   - Single transaction (split in two -- see the comment between them --
--     both must succeed or the whole migration is not considered applied).
--     Any error aborts the transaction it's in -- nothing partial is left
--     behind within either half.
--   - No DROP TABLE, no TRUNCATE, no deletion of any row. `invitations` is
--     entirely new; `notifications` only gains a new nullable column (every
--     existing row gets invitation_id = NULL) and two new enum values
--     (ALTER TYPE ... ADD VALUE IF NOT EXISTS -- safe inside this
--     transaction because nothing in this same migration inserts a
--     notifications row using either new value).
--   - NOT purely additive: this migration DOES remove two pre-existing,
--     previously-undocumented RLS policies (notifications_update_own,
--     notifications_delete_own -- see § 5 above and 013_preflight.sql,
--     which prints their exact live bodies for the record before this
--     runs). No row data is touched by this -- it only narrows which
--     Postgres *role* (authenticated vs postgres/FastAPI) may write to the
--     table, matching the messages/channels precedent already established
--     in this repo (009's header: "FastAPI never relies on this... costs
--     the running backend nothing to drop").
--   - Idempotent: CREATE TYPE/TABLE use IF NOT EXISTS, ALTER TABLE ADD
--     COLUMN uses IF NOT EXISTS, policies use DROP POLICY IF EXISTS +
--     CREATE POLICY, or DROP POLICY IF EXISTS with no replacement (matches
--     004 §10/13, 009's established convention).

begin;

-- ============================================================================
-- 1. Enums
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'invitation_method') then
    create type public.invitation_method as enum ('email', 'code');
  end if;
  if not exists (select 1 from pg_type where typname = 'invitation_status') then
    create type public.invitation_status as enum ('pending', 'accepted', 'declined', 'expired', 'revoked');
  end if;
end $$;

-- ============================================================================
-- 2. invitations
-- ============================================================================
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  room_id uuid references public.study_rooms (id) on delete cascade,
  channel_id uuid references public.channels (id) on delete cascade,
  method public.invitation_method not null,
  status public.invitation_status not null default 'pending',
  created_by uuid not null references public.profiles (id) on delete restrict,
  recipient_email text,
  secret_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_exactly_one_target check (
    (group_id is not null)::int + (room_id is not null)::int + (channel_id is not null)::int = 1
  ),
  constraint invitations_email_recipient check (
    (method = 'email' and recipient_email is not null) or (method = 'code' and recipient_email is null)
  )
);

create index if not exists idx_invitations_pending_email_recipient
  on public.invitations (recipient_email)
  where method = 'email' and status = 'pending';

create index if not exists idx_invitations_group_id on public.invitations (group_id);
create index if not exists idx_invitations_room_id on public.invitations (room_id);
create index if not exists idx_invitations_channel_id on public.invitations (channel_id);

-- ============================================================================
-- 3. notifications: invitation_id + new notification_type values
-- ============================================================================
alter table public.notifications
  add column if not exists invitation_id uuid references public.invitations (id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'notification_type' and e.enumlabel = 'study_room_invitation'
  ) then
    alter type public.notification_type add value 'study_room_invitation';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'notification_type' and e.enumlabel = 'private_channel_invitation'
  ) then
    alter type public.notification_type add value 'private_channel_invitation';
  end if;
end $$;

commit;

-- New enum values must be committed before they can be used in a query (a Postgres
-- restriction on ALTER TYPE ... ADD VALUE) -- start a fresh transaction for the RLS setup
-- below, which does not use them, so this split is precautionary, not currently required.
begin;

-- ============================================================================
-- 4. invitations: RLS
-- ============================================================================
alter table public.invitations enable row level security;

drop policy if exists invitations_select_own on public.invitations;
create policy invitations_select_own on public.invitations
  for select to authenticated
  using (
    created_by = auth.uid()
    or (recipient_email is not null and recipient_email = lower(coalesce(auth.jwt() ->> 'email', '')))
  );

-- No insert/update/delete policy for `authenticated` -- FastAPI (postgres role, bypasses
-- RLS) is the sole writer, matching the messages/channels precedent (004 §10, 009).

-- ============================================================================
-- 5. notifications: RLS (live state discovered, not previously tracked in
--    any migration file -- see 013_preflight.sql and the header above)
-- ============================================================================
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- Explicitly close the two pre-existing write policies -- FastAPI (postgres
-- role) becomes the sole writer, matching messages/channels/invitations.
-- No public POST endpoint exists at all (notification_router.py, same
-- commit); GET/PUT/DELETE are authenticated and scoped to current_user.id.
-- These DROPs are the only reason this migration is not purely additive --
-- see the Safety section above and 013_preflight.sql for the exact bodies
-- being removed.
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;

-- No insert/update/delete policy for `authenticated` remains after this.

commit;

-- ============================================================================
-- After this migration:
--   - public.invitations exists: exactly one of group_id/room_id/channel_id
--     set (CHECK), secret_hash unique, recipient_email required iff
--     method='email' (CHECK), RLS enabled with a single SELECT-own policy,
--     no write policy for `authenticated`.
--   - public.notifications has a new nullable invitation_id column (every
--     pre-existing row has it NULL, row count unchanged) and
--     notification_type gained 'study_room_invitation'/
--     'private_channel_invitation'. RLS remains enabled on notifications;
--     notifications_select_own is unchanged in effect; notifications_
--     update_own and notifications_delete_own are GONE -- no authenticated
--     write policy remains on notifications, same as invitations/messages/
--     channels.
--   - No existing row in any table was modified except notifications
--     gaining the new NULL-valued column. No data was deleted anywhere --
--     only two RLS policy objects (not rows) were removed.
-- ============================================================================
