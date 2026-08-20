-- Enables Supabase Realtime (Postgres Changes) for workspace-level sync: Channels, Study
-- Rooms, and Group Notes. Companion to 001_enable_realtime_messages.sql, which only ever
-- covered `messages` -- Room/Channel *message* Realtime is untouched by this migration.
--
-- ============================================================================
-- Why, and what was actually missing
-- ============================================================================
-- Channels and Study Rooms already have correctly-scoped RLS SELECT policies
-- (channels_select / the base study_rooms policy referenced in 004 as "study_rooms_select"),
-- audited and hardened repeatedly (002, 009, 010, 011) specifically because Realtime reads
-- them directly. What was missing was much simpler: neither table was ever added to the
-- `supabase_realtime` publication (only `messages` was, in 001), so Postgres Changes events
-- for INSERT/UPDATE on `channels`/`study_rooms` were never broadcast to any client at all,
-- regardless of RLS. This migration's §1 is a pure publication addition -- it does not
-- create, drop, or modify any policy or function on either table.
--
-- Group Notes (`group_notes`) is different: 019_create_group_notes.sql enabled RLS with
-- ZERO policies for `authenticated`, by design, for that task's scope ("Notes is never read
-- via Realtime or a direct Supabase client subscription... no Realtime introduced for Notes,
-- per MVP scope"). That was a scope decision for 019, not a permanent constraint -- this
-- migration's §2 is the first `authenticated` policy ever added to group_notes: a plain
-- SELECT policy requiring active Group membership, via the same `is_group_member()` function
-- every other membership-scoped policy in this schema already uses (no new/arbitrary-user
-- permission function is introduced -- see docs/db/migrations/002_fix_can_access_channel_
-- active_membership.sql for the established convention this follows). This intentionally
-- matches the read-access rule note_router.py already enforces at the REST layer
-- (_require_group_member / is_active_group_member) -- Realtime is being brought up to the
-- same bar FastAPI already holds, not a new or looser bar.
--
-- ============================================================================
-- Deliberately NOT done, and why
-- ============================================================================
-- - No INSERT/UPDATE/DELETE policy for `authenticated` is added to group_notes. FastAPI
--   (postgres role, bypasses RLS) remains the sole writer -- same as messages/channels/
--   invitations/notifications (see 013's header for the established precedent).
-- - group_notes' REPLICA IDENTITY is left at its Postgres default (primary key only). Setting
--   it to FULL would let a client receive a deleted note's full title/content in the DELETE
--   event's `old` payload -- and Supabase Realtime never applies RLS to DELETE events at all
--   ("there is no way for Postgres to verify a user has access to a deleted record" -- inherent
--   Postgres/Realtime limitation, not a gap specific to this schema). That would let anyone
--   who can open a Realtime subscription (any authenticated user) see the content of a note
--   that was just deleted from a group they are not a member of, directly contradicting
--   "Group Notes remain accessible only to active Group members." The frontend
--   (useGroupNotesRealtime.ts) instead only ever receives a bare note id on DELETE and treats
--   it purely as a signal to remove that id from its own already-authorized local state.
-- - No change to can_access_channel() / can_access_room_conversation() / any existing
--   channels/study_rooms policy -- both were already correctly scoped for Realtime by 002/
--   009/010/011; this migration only makes Postgres actually publish their change events.
-- - Known, accepted gap (not fixed here, see the migration report): Postgres Changes checks a
--   table's RLS SELECT policy against the POST-image for UPDATE events. A Channel/Study Room
--   soft-delete (`deleted_at` set via UPDATE, per 009/010) flips the row from visible to
--   invisible under channels_select/study_rooms_hide_deleted -- so previously-subscribed
--   clients will typically NOT receive that specific UPDATE event. This is a documented
--   Supabase Realtime limitation (RLS re-evaluated per event, not "was visible before"), not
--   something this migration or the frontend works around with new infrastructure (a
--   Broadcast/trigger-based channel would be the standard fix, out of scope for this MVP).
--
-- Read docs/db/migrations/020_preflight.sql and its output BEFORE running this. Read
-- docs/db/migrations/020_verify.sql AFTER running this.
--
-- Safety:
--   - Single transaction. Any error aborts the whole thing -- nothing partial is left behind.
--   - Purely additive: publication ADD TABLE (idempotent, guarded like 001), one new CREATE
--     POLICY (idempotent via DROP POLICY IF EXISTS + CREATE, matching this repo's established
--     policy-change convention -- see 004 §10/13, 009 §3/4, 010 §4). No existing row, column,
--     function, or policy is touched.

begin;

-- ============================================================================
-- 1. Publication: add channels + study_rooms (messages already added by 001)
-- ============================================================================
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'channels'
    ) then
        alter publication supabase_realtime add table public.channels;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_rooms'
    ) then
        alter publication supabase_realtime add table public.study_rooms;
    end if;
end $$;

-- ============================================================================
-- 2. group_notes: first-ever `authenticated` policy -- SELECT, active Group members only
-- ============================================================================
drop policy if exists group_notes_select_active_member on public.group_notes;
create policy group_notes_select_active_member on public.group_notes
  for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- ============================================================================
-- 3. Publication: add group_notes (only meaningful now that a SELECT policy exists for it)
-- ============================================================================
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_notes'
    ) then
        alter publication supabase_realtime add table public.group_notes;
    end if;
end $$;

commit;

-- ============================================================================
-- After this migration:
--   - `channels`, `study_rooms`, and `group_notes` are all in the `supabase_realtime`
--     publication (alongside the pre-existing `messages`) -- INSERT/UPDATE (and, for
--     group_notes, DELETE -- see header for why DELETE is unaffected by RLS either way) events
--     now actually broadcast for all four.
--   - group_notes' access model is now, precisely:
--       1. `authenticated` gets direct SELECT ONLY where group_notes_select_active_member
--          allows it (i.e. only rows whose group_id the caller is an active member of) --
--          this is a real, enforced RLS policy now, not "no direct access" as under 019.
--       2. Realtime (Postgres Changes) delivery is gated by that same SELECT policy, since
--          Realtime evaluates it per subscriber/per row -- an outsider's subscription simply
--          never receives INSERT/UPDATE events for a group they're not an active member of.
--       3. FastAPI (`postgres` role, bypasses RLS) remains the sole MUTATION/write boundary
--         -- every create/update/delete still goes through app/notes/ and its
--          `_require_note_manager` (Owner/Moderator only) authorization.
--       4. No INSERT/UPDATE/DELETE policy for `authenticated` exists on group_notes -- a
--          direct Supabase/PostgREST client can read (per #1) but never write.
--     ("FastAPI is the sole reader/writer", 019's framing, is no longer the accurate
--     description of the read side as of this migration -- see docs/db/migrations/README.md's
--     019 row, which now points here.)
--   - channels/study_rooms' existing SELECT/UPDATE/DELETE policies, and the
--     can_access_channel()/can_access_room_conversation() functions, are byte-for-byte
--     unchanged.
--   - No existing row anywhere was modified.
-- ============================================================================
