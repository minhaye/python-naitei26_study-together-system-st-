-- Fixes a tautology in the `room_moderation_select` RLS policy on
-- `public.room_moderation_actions`.
--
-- Why this is needed: docs/db/STUDY_PLATFORM_DATABASE_SPEC.md §37 documents
-- (and re-confirms live on 2026-08-14) that the policy's active-member branch
-- reads:
--
--   EXISTS (
--     SELECT 1 FROM study_room_members srm
--     WHERE srm.room_id = srm.room_id        -- always true
--       AND srm.user_id = auth.uid()
--       AND srm.left_at IS NULL
--   )
--
-- `srm.room_id = srm.room_id` always evaluates true regardless of which room
-- `room_moderation_actions` row is being checked, so the EXISTS collapses to
-- "auth.uid() is an active member of ANY study room" -- not the specific
-- room the moderation-log row belongs to. Combined with the policy's other
-- OR branch (`is_room_manager(room_id)`), the practical effect is: any user
-- who is an active member of some study room (not necessarily the one being
-- queried) can read another room's moderation log, including KICK/MUTE
-- targets and reasons for rooms they have no relationship to.
--
-- This is directly in scope for this task: moderation-action authorization
-- (KICK/MUTE/UNMUTE/RAISE_HAND/LOWER_HAND) is required to be strict, and
-- FastAPI's own `GET /study-rooms/{room_id}/moderation` gets its own
-- `can_access_room` check in this same change -- but RLS is a second,
-- independent read path (Supabase Realtime / direct PostgREST/SELECT access
-- from a client holding a valid Supabase session), which the FastAPI-layer
-- fix does not touch.
--
-- ============================================================================
-- Scope
-- ============================================================================
--   - Replaces ONLY the USING expression of the pre-existing
--     `room_moderation_select` policy on `public.room_moderation_actions`,
--     via ALTER POLICY (no DROP/CREATE, so grants and the policy's other
--     properties are untouched).
--   - The only semantic change: the EXISTS subquery now correlates
--     `srm.room_id` against `room_moderation_actions.room_id` (the row being
--     evaluated) instead of against itself.
--   - Does NOT touch `is_room_manager()`, table structure, other policies,
--     or any FastAPI-reachable behavior (the FastAPI backend authenticates
--     via the `postgres` role and bypasses RLS entirely -- see task context;
--     this migration only affects direct Postgres/PostgREST/Realtime access
--     using a caller's own Supabase session).
--
-- IMPORTANT: This migration was authored from the USING expression quoted in
-- docs/db/STUDY_PLATFORM_DATABASE_SPEC.md §37, not a live pg_policies read.
-- Run 007_preflight.sql first and diff its
-- "CURRENT room_moderation_select USING expression" row against the OLD
-- expression assumed below before applying this in any environment.
--
-- Read docs/db/migrations/007_preflight.sql BEFORE running this.
-- Read docs/db/migrations/007_verify.sql AFTER running this.
--
-- Safety: single transaction; ALTER POLICY is not idempotent by nature but
-- is safe to re-run (it just re-applies the same, already-correct USING
-- expression a second time).

begin;

alter policy room_moderation_select on public.room_moderation_actions
using (
  is_room_manager(room_id)
  or exists (
    select 1
    from study_room_members srm
    where srm.room_id = room_moderation_actions.room_id
      and srm.user_id = auth.uid()
      and srm.left_at is null
  )
);

commit;

-- ============================================================================
-- After this migration:
--   - `room_moderation_select` now grants SELECT on a room_moderation_actions
--     row only to that room's manager (host/moderator, via is_room_manager)
--     or an active member of that SAME room -- not any room.
--   - No column, index, constraint, or other policy is changed.
-- ============================================================================
