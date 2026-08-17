-- Tracks the `add_group_owner()` function and `groups_add_owner` trigger that
-- already exist LIVE on the Supabase project but were never captured in any
-- file in this repo -- they predate the migration-tracking discipline
-- established with 001-007.
--
-- Why this is needed: while fixing a `group_members_group_id_user_id_key`
-- UniqueViolation on POST /groups (see app/groups/services/group_service.py,
-- GroupsService.create), we found that GroupsService.create() used to insert
-- the owner's group_members row itself -- duplicating what this live trigger
-- already does unconditionally for every INSERT into `groups`, via
-- `INSERT ... ON CONFLICT (group_id, user_id) DO UPDATE`. The application-side
-- insert has now been removed (it is not part of this migration -- that is a
-- Python code change), which means GroupsService.create() now DEPENDS on this
-- trigger for `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §8's invariant:
--
--   groups.owner_id = A  =>  group_members(group_id, A, role=owner) must exist
--
-- Without this migration, a fresh database built only from the tracked
-- migrations (001-007) would be missing this trigger entirely, so creating a
-- group would silently produce NO owner membership row -- a correctness bug
-- that would not reproduce against the current live database (which already
-- has the trigger, out of band), only against a rebuilt one. This migration
-- closes that gap.
--
-- The function/trigger definitions below were copied verbatim from the live
-- database via `pg_get_functiondef()` / `pg_get_triggerdef()` on 2026-08-17
-- (confirmed: function is `plpgsql`, `SECURITY DEFINER`, `search_path=public`,
-- volatile; trigger is `AFTER INSERT ... FOR EACH ROW`, enabled) -- this is a
-- reproduction, not a reinvention, per the task's explicit instruction not to
-- invent different behavior.
--
-- ============================================================================
-- Scope
-- ============================================================================
--   - CREATE OR REPLACE FUNCTION public.add_group_owner() -- idempotent by
--     construction; re-running with the same body is a no-op.
--   - DROP TRIGGER IF EXISTS + CREATE TRIGGER groups_add_owner ON
--     public.groups -- Postgres has no CREATE OR REPLACE TRIGGER prior to v14
--     in general use across environments, so this repo's convention (see
--     004/005 companion scripts) is DROP ... IF EXISTS then CREATE, which is
--     safe to re-run any number of times and produces the identical trigger
--     each time.
--   - Does NOT touch `groups_set_updated_at` / `set_updated_at()` (a separate,
--     already-implicit trigger, out of scope for this fix) or any other
--     table, policy, or function.
--
-- Safety: on the CURRENT live database, the function body and trigger
-- definition below are byte-for-byte identical to what already exists (see
-- 008_preflight.sql), so applying this migration there is a pure schema
-- NORMALIZATION -- it tracks the existing live object in version control, it
-- does not change runtime behavior. On a FRESH database built only from
-- 001-007, this migration is what actually CREATES the trigger for the first
-- time, which is required for GroupsService.create() to behave correctly.
--
-- Read docs/db/migrations/008_preflight.sql BEFORE running this.
-- Read docs/db/migrations/008_verify.sql AFTER running this.

begin;

create or replace function public.add_group_owner()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.group_members (group_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active')
  on conflict (group_id, user_id)
  do update set role = 'owner', status = 'active';

  return new;
end;
$function$;

drop trigger if exists groups_add_owner on public.groups;

create trigger groups_add_owner
after insert on public.groups
for each row
execute function add_group_owner();

commit;

-- ============================================================================
-- After this migration:
--   - `public.add_group_owner()` exists (SECURITY DEFINER, tracked here).
--   - `groups_add_owner` (AFTER INSERT ON public.groups, FOR EACH ROW) exists
--     and is enabled, calling add_group_owner().
--   - Every row inserted into `groups` (via GroupsService.create() or any
--     other path, e.g. direct SQL/PostgREST) automatically gets exactly one
--     active `owner` group_members row for `new.owner_id`, upserted via
--     ON CONFLICT so re-running the underlying INSERT logic never raises
--     group_members_group_id_user_id_key.
--   - No column, table, policy, or other trigger/function is changed.
-- ============================================================================
