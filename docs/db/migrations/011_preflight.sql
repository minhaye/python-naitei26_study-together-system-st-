-- Preflight checks for 011_room_manage_authority_current_group_role.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Same one-UNION-ALL-query shape as 009/010's preflight scripts, for the
-- same reason (single result grid in the Supabase SQL Editor).
--
-- Context: 010 (confirmed live) added an unconditional `sr.host_id =
-- auth.uid()` OR branch to can_access_room_conversation(), mirroring the
-- Python side's `can_access_room()`, which at the time also granted the
-- room host unconditional access regardless of their current Group role or
-- their own study_room_members row status. The backend-side audit that
-- produced this migration found that `host_id` was being treated as a
-- permanent, independent authorization grant -- both for room MANAGEMENT
-- (update/start/end/delete, KICK/MUTE/UNMUTE, member-role changes -- fixed
-- in the same commit as this migration, in app/core/permissions.py and
-- app/study_rooms/routers/study_room_router.py, Python-only, no SQL
-- involved there since FastAPI's Postgres connection uses a role that
-- bypasses RLS) and for room PARTICIPATION (read/write access to a room's
-- conversation, which Realtime and any direct PostgREST caller DO evaluate
-- through RLS, since they don't go through FastAPI at all).
--
-- This migration closes the PARTICIPATION half of that gap in SQL: it
-- removes the unconditional `sr.host_id = auth.uid()` branch from
-- can_access_room_conversation(), leaving only the pre-existing
-- `is_group_member(...) AND active study_room_members row` branch
-- (untouched). This is safe -- not a new inaccessible-host bug -- because
-- StudyRoomsService.create() has always inserted an active HOST-role
-- study_room_members row for the creator in the same transaction as the
-- room itself (see app/study_rooms/services/study_room_service.py); a
-- currently-participating host already satisfies the remaining branch.
-- Only a host who has since left the room (left_at set, or no membership
-- row at all -- a data anomaly for any room created through the normal
-- app path) loses the access `host_id` alone used to grant, which is the
-- intended fix, not a regression.
--
-- Run this BEFORE 011_room_manage_authority_current_group_role.sql.

with
  can_access_room_conversation_exists as (
    select
      'function_exists:can_access_room_conversation' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  current_can_access_room_conversation_body as (
    select
      'CURRENT can_access_room_conversation() body -- READ THIS before running 011' as check_name,
      'INFO' as status,
      coalesce(pg_get_functiondef(p.oid), 'function not found') as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  current_body_has_host_branch as (
    select
      'can_access_room_conversation_host_branch_present (informational -- OK/expected means the pre-011 function still has the unconditional host_id branch added by 010, which is what 011 removes)' as check_name,
      case
        when pg_get_functiondef(p.oid) like '%sr.host_id = auth.uid()%' then 'OK/expected-before-011'
        else 'INFO/already-absent'
      end as status,
      coalesce(pg_get_functiondef(p.oid), 'function not found') as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  current_body_has_group_member_branch as (
    select
      'can_access_room_conversation_group_member_branch_present (must be OK -- this is the branch 011 must leave untouched)' as check_name,
      case
        when pg_get_functiondef(p.oid) like '%is_group_member(sr.group_id, auth.uid())%' then 'OK'
        else 'FAIL'
      end as status,
      coalesce(pg_get_functiondef(p.oid), 'function not found') as detail
    from pg_proc p
    where p.proname = 'can_access_room_conversation' and p.pronamespace = 'public'::regnamespace
  ),
  hosts_without_active_room_membership as (
    select
      'hosts_without_active_study_room_members_row (informational -- any row here is a host who would lose SQL/RLS conversation access once 011 removes the host_id branch; expected to be none or only rooms whose host has actually left the room)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'INFO/review-before-running-011' end as status,
      coalesce(string_agg(sr.id::text || ' (host=' || sr.host_id::text || ')', ', '), 'none') as detail
    from public.study_rooms sr
    where sr.deleted_at is null
      and not exists (
        select 1 from public.study_room_members srm
        where srm.room_id = sr.id and srm.user_id = sr.host_id and srm.left_at is null
      )
  ),
  study_rooms_row_count as (
    select
      'study_rooms_row_count (informational -- compare against 011_verify.sql''s post-migration count)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.study_rooms
  )

select * from can_access_room_conversation_exists
union all select * from current_can_access_room_conversation_body
union all select * from current_body_has_host_branch
union all select * from current_body_has_group_member_branch
union all select * from hosts_without_active_room_membership
union all select * from study_rooms_row_count
order by check_name;
