-- Enables Supabase Realtime (Postgres Changes) for `study_room_members`. Companion to
-- 020_enable_workspace_realtime_sync.sql (Channels/Study Rooms/Group Notes) -- this covers the
-- one workspace-sync table 020 didn't: the Study Room membership roster itself.
--
-- ============================================================================
-- Why
-- ============================================================================
-- The Study Room sidebar's member list/count (StudyRoom.tsx's `participants`, sourced from
-- useStudyRoom.ts's `members`) only ever refetched after the CURRENT user's own join/leave/
-- moderate action -- an already-open tab never learned when someone ELSE joined or left, so the
-- count/list silently went stale (reported bug: sidebar stuck showing "(2)" after a 3rd and 4th
-- person joined; only a full reload picked it up). A REST-polling fallback was added client-side
-- first (useStudyRoom.ts, 10s interval) as an immediate fix; this migration is the follow-up so
-- membership changes propagate instantly instead of on a poll delay.
--
-- ============================================================================
-- What this does, and what it deliberately doesn't
-- ============================================================================
-- 1. Adds the FIRST-EVER PERMISSIVE policy this repo has defined on study_room_members:
--    `study_room_members_select_room_participant`, SELECT, scoped to
--    `public.can_access_room_conversation(room_id)` -- the same pre-existing, already-audited
--    function (004/010/011) that already gates `conversations_select`/`messages_select` for a
--    room's chat. Reusing it (rather than writing a new predicate) means "can see this room's
--    member roster" is defined to mean exactly "can see this room's chat", which is already the
--    access rule study_room_router.list_members() enforces at the FastAPI layer
--    (`can_access_room()` -> active Group membership AND an active, non-left study_room_members
--    row of the caller's own). No new/arbitrary-user RLS function is introduced (see this repo's
--    established convention: RLS-facing functions take only a resource id and read auth.uid()
--    internally -- can_access_room_conversation already has this exact shape).
--
--    This table's base policies were NEVER captured in this repo (010's header says so
--    explicitly). 026_preflight.sql prints every existing policy on study_room_members so it can
--    be read BEFORE this runs -- if an existing permissive SELECT policy turns out to be broader
--    than the one added here, Postgres OR's permissive policies together, so the broader one
--    would still govern; this migration does not attempt to discover or replace an unknown
--    policy body, mirroring how 010 handled the same unknown for its own (RESTRICTIVE) additions.
--
-- 2. Adds `study_room_members` to the `supabase_realtime` publication, so INSERT/UPDATE events
--    are actually broadcast under the policy from §1 (a correctly-scoped policy alone does
--    nothing for Realtime until the table is published -- same gap 020 closed for channels/
--    study_rooms).
--
-- Deliberately NOT done:
-- - No INSERT/UPDATE/DELETE policy for `authenticated` is added. FastAPI (`postgres` role,
--   bypasses RLS) remains the sole writer for join/leave/kick/mute/role-change -- same
--   precedent as messages/channels/study_rooms/group_notes (020's write-side note).
-- - REPLICA IDENTITY is left at its Postgres default (primary key only). study_room_members rows
--   are never hard-deleted in this codebase -- "leave"/"kick" are both an UPDATE setting
--   `left_at` (see StudyRoomsService.leave/moderate) -- so there is no DELETE event whose `old`
--   payload could leak content the way 020's group_notes note describes; this is a non-issue
--   here, not an oversight.
-- - No change to can_access_room_conversation(), study_room_members_block_when_room_deleted
--   (010's RESTRICTIVE deleted-room guard, still applies on top of the new permissive policy),
--   or any study_rooms/room_moderation_actions policy.
-- - Known, accepted gap (same class as 020's documented one): Postgres Changes evaluates a
--   table's SELECT policy against the POST-image for UPDATE events. A caller who leaves a room
--   (their own row's left_at flips) loses can_access_room_conversation() for that room on their
--   NEXT evaluation -- including for OTHER members' rows -- so their own client may not reliably
--   receive further Realtime events for that room after leaving. The frontend does not depend on
--   this: leaving always calls loadMembers() itself (useStudyRoom.ts's `leave`), and navigates
--   away immediately after.
--
-- Read docs/db/migrations/026_preflight.sql and its output BEFORE running this -- in particular,
-- read every existing policy row it prints for study_room_members. Read
-- docs/db/migrations/026_verify.sql AFTER running this.
--
-- Safety:
--   - Single transaction. Any error aborts the whole thing -- nothing partial is left behind.
--   - Idempotent: `drop policy if exists` + `create policy` for the new policy, guarded
--     `alter publication ... add table` for the publication (matches 001/020's established
--     idempotent-guard style). Re-running after a successful apply is a no-op.
--   - Purely additive: no existing row, column, function, or other policy on study_room_members
--     (or any other table) is touched.

begin;

-- ============================================================================
-- 1. study_room_members: first-ever PERMISSIVE policy -- SELECT, room participants only
-- ============================================================================
drop policy if exists study_room_members_select_room_participant on public.study_room_members;
create policy study_room_members_select_room_participant on public.study_room_members
  for select to authenticated
  using (public.can_access_room_conversation(room_id));

-- ============================================================================
-- 2. Publication: add study_room_members
-- ============================================================================
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_room_members'
    ) then
        alter publication supabase_realtime add table public.study_room_members;
    end if;
end $$;

commit;

-- ============================================================================
-- After this migration:
--   - `authenticated` gets direct SELECT on study_room_members ONLY where
--     can_access_room_conversation(room_id) allows it -- i.e. only rows belonging to a room the
--     caller is themselves an active, non-left member of (and whose Group membership is active,
--     and whose room is not soft-deleted). An outsider's subscription/query returns nothing for
--     a room they haven't joined.
--   - study_room_members is now in the supabase_realtime publication -- INSERT/UPDATE events for
--     rows a subscriber can see (per the policy above) are broadcast. The frontend
--     (useStudyRoomMembersRealtime.ts, wired into useStudyRoom.ts) refetches the full member list
--     via the existing REST endpoint on any such event, rather than trusting the raw Realtime row
--     directly, since it lacks the joined `user: UserSummary` a StudyRoomMember needs (same
--     hydrate-via-REST pattern as useChannelMessagesRealtime.ts).
--   - FastAPI (`postgres` role) remains the sole writer -- no authenticated INSERT/UPDATE/DELETE
--     policy exists on study_room_members.
--   - study_room_members_block_when_room_deleted (010's RESTRICTIVE policy) is untouched and
--     still narrows the above on top, for a soft-deleted room.
--   - No existing row anywhere was modified.
-- ============================================================================
