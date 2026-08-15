-- Guarantee, at the database level, that a pair of users can never end up
-- with more than one `type = 'direct'` conversation between them.
--
-- Why this is needed: migration 004 already documented this as a known gap
-- (see docs/db/STUDY_PLATFORM_DATABASE_SPEC.md §15) -- `conversation_members`
-- is a child table, so "this pair of users already has a direct
-- conversation" cannot be expressed as a declarative constraint directly on
-- it. A naive "SELECT then INSERT if not found" in the service layer is not
-- safe under concurrent requests (A->B and B->A arriving at the same time
-- could both pass the SELECT and both INSERT, producing two conversations
-- for the same pair). This migration adds a real, race-safe constraint.
--
-- ============================================================================
-- Design
-- ============================================================================
-- Two new nullable columns are added directly to `conversations`:
--   direct_user_min_id, direct_user_max_id
-- populated ONLY for type='direct' rows, always with
-- direct_user_min_id < direct_user_max_id (the pair sorted so that A-B and
-- B-A resolve to the same row). A partial unique index on
-- (direct_user_min_id, direct_user_max_id) where type='direct' then makes a
-- duplicate pair a hard constraint violation at INSERT time, not just a
-- service-layer convention. The application (app/conversations/services/
-- conversation_service.py) computes and sorts the pair before insert; the
-- CHECK constraint below independently re-validates min < max so a service
-- bug that inserts the pair in the wrong order is rejected rather than
-- silently creating a second row for the same two users.
--
-- This is purely additive: no existing column, index, or constraint is
-- changed or dropped, and no currently-running code reads or writes these
-- two new columns (direct conversations don't exist in the app yet), so
-- there is no expand/contract concern here -- unlike 004/005, this doesn't
-- need to be split across two migrations.
--
-- ============================================================================
-- Scope
-- ============================================================================
--   - Adds conversations.direct_user_min_id / direct_user_max_id (nullable
--     UUID, FK to profiles, ON DELETE CASCADE -- matches
--     conversation_members.user_id's cascade: if either participant's
--     profile is deleted, their direct conversation goes with it).
--   - Adds a CHECK constraint enforcing both columns are set (and
--     min < max) for type='direct' rows, and both NULL otherwise.
--   - Adds a partial unique index enforcing at most one direct conversation
--     per (min, max) pair.
--   - Does NOT touch conversation_members, messages, RLS policies, or any
--     SQL permission function -- can_access_conversation()'s direct branch
--     (is_conversation_member(), added in 004) is unaffected by this change,
--     since it only ever looks at conversation_members, not these new
--     columns.
--
-- Read docs/db/migrations/006_preflight.sql BEFORE running this.
-- Read docs/db/migrations/006_verify.sql AFTER running this.
--
-- Safety: single transaction; every CREATE/ALTER is idempotent (IF NOT
-- EXISTS or an explicit existence check). No DROP, no data changes -- there
-- are no existing type='direct' rows for this migration to touch (verified
-- in preflight).

begin;

-- ============================================================================
-- 1. New columns
-- ============================================================================
alter table public.conversations
  add column if not exists direct_user_min_id uuid references public.profiles (id) on delete cascade;

alter table public.conversations
  add column if not exists direct_user_max_id uuid references public.profiles (id) on delete cascade;

-- ============================================================================
-- 2. CHECK constraint
-- ============================================================================
-- Belt-and-suspenders against the polymorphic check added in 004 (section 2
-- there already guarantees channel_id/room_id are NULL for type='direct',
-- unaffected by this migration). This constraint additionally requires: a
-- direct conversation always carries its pair, sorted; a non-direct
-- conversation never carries one.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and conname = 'conversations_direct_pair_check'
  ) then
    alter table public.conversations
      add constraint conversations_direct_pair_check check (
        (
          type = 'direct'::public.conversation_type
          and direct_user_min_id is not null
          and direct_user_max_id is not null
          and direct_user_min_id < direct_user_max_id
        )
        or (
          type <> 'direct'::public.conversation_type
          and direct_user_min_id is null
          and direct_user_max_id is null
        )
      );
  end if;
end $$;

-- ============================================================================
-- 3. Partial unique index: at most one direct conversation per pair
-- ============================================================================
create unique index if not exists conversations_direct_pair_key
  on public.conversations (direct_user_min_id, direct_user_max_id)
  where type = 'direct'::public.conversation_type;

commit;

-- ============================================================================
-- After this migration:
--   - conversations gains direct_user_min_id, direct_user_max_id (nullable,
--     FK to profiles, CASCADE).
--   - A concurrent INSERT of a second type='direct' row for the same
--     (min, max) pair fails with a unique_violation on
--     conversations_direct_pair_key -- the service layer (see
--     ConversationsService.get_or_create_direct) catches this via a
--     SAVEPOINT (session.begin_nested()) and re-queries for the row the
--     other transaction committed, rather than raising it to the caller.
-- ============================================================================
